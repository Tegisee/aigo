import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { fetchCurrentPrice, extractProductId } from './coupang-api.js';
import {
  sendSmartNotifications,
  type SmartPushTarget,
} from './notifier.js';

// Firebase Admin 초기화 (aigo-a 프로젝트)
const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}',
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// KST 시간 계산
const kstHour = (new Date().getUTCHours() + 9) % 24;
const isNightRun = kstHour >= 20 && kstHour <= 22; // 21시 실행 여부

interface UserItem {
  id: string;
  url: string;
  resolvedUrl?: string;
  productId?: string;
  vendorItemId?: string;
  productName: string;
  category?: string;
  currentPrice: number;
  targetPrice: number;
  priceHistory: { date: string; price: number }[];
  repurchaseEnabled?: boolean;
  repurchaseDays?: number;
  lastPurchasedAt?: string;
}

// ─── shared_products 동시 업데이트 ───

async function updateSharedProduct(
  productId: string,
  newPrice: number,
  previousPrice: number,
  productName: string,
  category: string,
  thumbnail: string,
) {
  const ref = db.collection('shared_products').doc(productId);
  const today = new Date().toISOString().slice(0, 10);

  try {
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data()!;
      const history = data.priceHistory || [];
      const lastEntry = history[history.length - 1];
      if (!lastEntry || lastEntry.date !== today) {
        history.push({ date: today, price: newPrice });
      } else {
        lastEntry.price = newPrice;
      }

      await ref.update({
        currentPrice: newPrice,
        previousPrice: previousPrice,
        priceHistory: history.slice(-30),
        lastCheckedAt: new Date().toISOString(),
      });
    } else {
      // 문서 없으면 생성
      await ref.set({
        productId,
        productName,
        category: category || '기타',
        ageGroup: '',
        currentPrice: newPrice,
        previousPrice: newPrice,
        thumbnail: thumbnail || '',
        priceHistory: [{ date: today, price: newPrice }],
        trackerCount: 0,
        purchaseCount: 0,
        lastCheckedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn(`[SharedProducts] 업데이트 실패 (${productId}):`, e);
  }
}

// ─── 재구매 알림 체크 ───

function checkRepurchase(item: UserItem): number | null {
  if (!item.repurchaseEnabled || !item.repurchaseDays) return null;
  const base = item.lastPurchasedAt || new Date(Date.now()).toISOString().slice(0, 10);
  const nextDate = new Date(base);
  nextDate.setDate(nextDate.getDate() + item.repurchaseDays);
  const daysLeft = Math.ceil((nextDate.getTime() - Date.now()) / 86400000);
  // D-3부터 알림
  if (daysLeft <= 3) return daysLeft;
  return null;
}

// ─── 만료 토큰 정리 ───

async function cleanupInvalidUsers(invalidTokens: string[]) {
  if (invalidTokens.length === 0) return;

  const usersSnap = await db.collection('users').get();
  for (const userDoc of usersSnap.docs) {
    const token = userDoc.data().expoPushToken;
    if (!token || !invalidTokens.includes(token)) continue;

    console.log(`[Cleanup] 만료 토큰 제거: ${userDoc.id}`);
    await userDoc.ref.update({
      expoPushToken: FieldValue.delete(),
      notificationEnabled: false,
    });
  }
}

// ─── 예방접종 스케줄 (babyinfo.tsx와 동일) ───

const VACCINATION_SCHEDULE = [
  { month: '출생', minMonth: 0, maxMonth: 0, vaccines: ['B형간염 1차', 'BCG(결핵)'] },
  { month: '1개월', minMonth: 1, maxMonth: 1, vaccines: ['B형간염 2차'] },
  { month: '2개월', minMonth: 2, maxMonth: 3, vaccines: ['DTaP 1차', 'IPV 1차', 'Hib 1차', 'PCV 1차', '로타바이러스 1차'] },
  { month: '4개월', minMonth: 4, maxMonth: 5, vaccines: ['DTaP 2차', 'IPV 2차', 'Hib 2차', 'PCV 2차', '로타바이러스 2차'] },
  { month: '6개월', minMonth: 6, maxMonth: 11, vaccines: ['DTaP 3차', 'IPV 3차', 'Hib 3차', 'PCV 3차', 'B형간염 3차', '인플루엔자(매년)'] },
  { month: '12개월', minMonth: 12, maxMonth: 14, vaccines: ['MMR 1차', '수두 1차', 'Hib 4차', 'PCV 4차', 'A형간염 1차'] },
  { month: '15개월', minMonth: 15, maxMonth: 17, vaccines: ['DTaP 4차'] },
  { month: '18개월', minMonth: 18, maxMonth: 47, vaccines: ['A형간염 2차'] },
  { month: '만 4~6세', minMonth: 48, maxMonth: 71, vaccines: ['DTaP 5차', 'IPV 4차', 'MMR 2차'] },
  { month: '만 6세', minMonth: 72, maxMonth: 83, vaccines: ['일본뇌염(사백신 4차 또는 생백신 2차)'] },
  { month: '만 11~12세', minMonth: 132, maxMonth: 155, vaccines: ['Tdap/Td', 'HPV(자궁경부암) 1~2차', '일본뇌염 5차'] },
];

/** 아이 월령 계산 */
function calcBabyMonths(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
}

/** 예방접종 미접종 체크 → 푸시 대상 반환 */
async function checkVaccineOverdue(
  uid: string,
  token: string,
  userData: Record<string, any>,
): Promise<SmartPushTarget[]> {
  const targets: SmartPushTarget[] = [];
  const children: Array<{ id: string; name: string; birthDate: string }> = userData.children || [];
  const vaccinationRecords: Record<string, string> = userData.vaccinationRecords || {};
  const today = new Date().toISOString().slice(0, 10);

  // 중복 방지: 오늘 이미 발송했으면 스킵
  const lastAlertDate = userData.lastVaccineAlertDate;
  if (lastAlertDate === today) {
    console.log(`[Vaccine] ${uid}: 오늘 이미 발송됨, 스킵`);
    return targets;
  }

  let hasOverdue = false;

  for (const child of children) {
    if (!child.birthDate) continue;
    const babyMonths = calcBabyMonths(child.birthDate);
    const childName = child.name || '우리 아이';

    for (const schedule of VACCINATION_SCHEDULE) {
      // 접종 시기가 지난 항목만 체크 (maxMonth < 현재 월령)
      if (babyMonths <= schedule.maxMonth) continue;

      for (const vaccine of schedule.vaccines) {
        // 이미 접종 완료면 스킵
        if (vaccinationRecords[vaccine]) continue;

        hasOverdue = true;
        targets.push({
          token,
          itemId: '',
          productName: vaccine,
          alertType: 'vaccine_overdue',
          currentPrice: 0,
          previousPrice: 0,
          targetPrice: 0,
          lowestPrice: 0,
          noChangeDays: 0,
          childName,
          vaccineName: vaccine,
        });
        console.log(`  💉 ${childName}: ${vaccine} 미접종 (${schedule.month} 시기 경과)`);
      }
    }
  }

  // 미접종 항목이 있으면 오늘 날짜 기록 (중복 방지)
  if (hasOverdue) {
    try {
      await db.collection('users').doc(uid).update({ lastVaccineAlertDate: today });
    } catch {}
  }

  // 아이당 최대 3건만 발송 (너무 많은 알림 방지)
  return targets.slice(0, 3);
}

// ─── 비활성 유저 정리 (21시에만) ───

async function cleanupInactiveUsers() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const usersSnap = await db.collection('users').get();
  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const lastActive = data.lastActiveAt?.toDate?.() || data.lastActiveAt;
    if (!lastActive) continue;

    if (new Date(lastActive) < thirtyDaysAgo) {
      console.log(`[Cleanup] 비활성 유저 정리: ${userDoc.id}`);
      const itemsSnap = await userDoc.ref.collection('items').get();
      const batch = db.batch();
      itemsSnap.docs.forEach((doc) => batch.delete(doc.ref));
      batch.delete(userDoc.ref);
      await batch.commit();
      console.log(`[Cleanup] 삭제 완료: ${itemsSnap.size}개 상품 + 유저`);
    }
  }
}

// ─── 메인 ───

async function main() {
  console.log(`[PriceChecker] 시작: ${new Date().toISOString()} (KST ${kstHour}시, 야간=${isNightRun})`);

  const usersSnap = await db.collection('users').get();
  console.log(`[Debug] 전체 유저: ${usersSnap.size}명`);

  const pushTargets: SmartPushTarget[] = [];
  let totalItems = 0;
  let processedItems = 0;

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    const uid = userDoc.id;
    const token = userData.expoPushToken as string | undefined;
    const notifEnabled = userData.notificationEnabled !== false;
    const repurchaseNotifEnabled = userData.repurchaseNotificationEnabled !== false;

    const itemsSnap = await db.collection('users').doc(uid).collection('items').get();
    totalItems += itemsSnap.size;
    if (itemsSnap.empty) continue;

    for (const itemDoc of itemsSnap.docs) {
      const item = itemDoc.data() as UserItem;
      if (!item.url || !item.productName) continue;
      processedItems++;

      console.log(`[PriceChecker] 조회: ${item.productName?.slice(0, 30)}`);

      const productId =
        item.productId ||
        extractProductId(item.resolvedUrl || '') ||
        extractProductId(item.url);

      const result = await fetchCurrentPrice(item.productName, productId, item.currentPrice);

      if (!result || result.price === 0) {
        console.log(`  → 가격 조회 실패, 건너뜀`);
        continue;
      }

      const prevPrice = item.currentPrice;
      const newPrice = result.price;
      const today = new Date().toISOString().slice(0, 10);

      // ── 항상 Firestore에 가격 저장 (6회 모두) ──
      const history = item.priceHistory || [];
      const lastEntry = history[history.length - 1];
      if (!lastEntry || lastEntry.date !== today) {
        history.push({ date: today, price: newPrice });
      } else {
        lastEntry.price = newPrice;
      }
      const trimmed = history.slice(-30);

      const updateData: Record<string, any> = {
        currentPrice: newPrice,
        priceHistory: trimmed,
      };
      if (result.image && !itemDoc.data().thumbnail) {
        updateData.thumbnail = result.image;
      }
      if (itemDoc.data().productName === '상품 정보 없음' && result.name) {
        updateData.productName = result.name;
      }

      await itemDoc.ref.update(updateData);
      console.log(`  → ${prevPrice.toLocaleString()}원 → ${newPrice.toLocaleString()}원 (저장 완료)`);

      // ── shared_products 동시 업데이트 ──
      if (productId) {
        await updateSharedProduct(
          productId,
          newPrice,
          prevPrice,
          item.productName,
          item.category || '기타',
          result.image || '',
        );
      }

      // ── 알림 조건 (토큰 있고 알림 활성화된 경우만) ──
      if (!token || !notifEnabled) continue;

      const allPrices = trimmed.map((h) => h.price);
      const lowestPrice = Math.min(...allPrices);
      const basePush: SmartPushTarget = {
        token,
        itemId: item.id,
        productName: item.productName,
        currentPrice: newPrice,
        previousPrice: prevPrice,
        targetPrice: item.targetPrice,
        lowestPrice,
        alertType: 'no_change',
        noChangeDays: 0,
      };

      const hasTarget = item.targetPrice != null && item.targetPrice > 0;

      // 즉시 알림: 가격 하락 / 목표가 도달 / 역대 최저
      if (hasTarget && newPrice <= item.targetPrice && prevPrice > item.targetPrice) {
        pushTargets.push({ ...basePush, alertType: 'target_reached' });
        console.log(`  📢 목표가 도달!`);
      } else if (!hasTarget && newPrice < prevPrice && newPrice <= lowestPrice && trimmed.length >= 2) {
        pushTargets.push({ ...basePush, alertType: 'lowest_no_target' });
        console.log(`  📢 최저가 갱신 (목표가 없음)`);
      } else if (newPrice < prevPrice && newPrice <= lowestPrice && trimmed.length >= 3) {
        pushTargets.push({ ...basePush, alertType: 'lowest_ever' });
        console.log(`  📢 역대 최저가!`);
      } else if (newPrice < prevPrice && trimmed.length >= 2) {
        pushTargets.push({ ...basePush, alertType: 'price_drop' });
        console.log(`  📢 가격 하락`);
      } else if (isNightRun) {
        // 21시에만: 무변동 알림
        let noChangeDays = 1;
        for (let i = trimmed.length - 2; i >= 0; i--) {
          if (trimmed[i].price === newPrice) noChangeDays++;
          else break;
        }
        if (noChangeDays >= 2) {
          pushTargets.push({ ...basePush, alertType: 'no_change', noChangeDays });
          console.log(`  📢 ${noChangeDays}일 무변동 (21시 알림)`);
        }
      }

      // 21시에만: 재구매 알림
      if (isNightRun && repurchaseNotifEnabled && token) {
        const daysLeft = checkRepurchase(item);
        if (daysLeft !== null) {
          pushTargets.push({
            ...basePush,
            alertType: 'repurchase',
            repurchaseDaysLeft: daysLeft,
          });
          console.log(`  📢 재구매 D-${daysLeft}`);
        }
      }

      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // 21시에만: 예방접종 미접종 알림
  if (isNightRun) {
    console.log('[Vaccine] 예방접종 미접종 체크 시작');
    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const token = userData.expoPushToken as string | undefined;
      const notifEnabled = userData.notificationEnabled !== false;
      if (!token || !notifEnabled) continue;

      const children = userData.children || [];
      if (children.length === 0) continue;

      const vaccineTargets = await checkVaccineOverdue(userDoc.id, token, userData);
      pushTargets.push(...vaccineTargets);
    }
  }

  // 알림 발송
  let invalidTokens: string[] = [];
  if (pushTargets.length > 0) {
    console.log(`[PriceChecker] 알림 ${pushTargets.length}건 발송`);
    invalidTokens = await sendSmartNotifications(pushTargets);
  }

  await cleanupInvalidUsers(invalidTokens);

  // 21시에만 비활성 유저 정리
  if (isNightRun) {
    await cleanupInactiveUsers();
  }

  console.log(`[Debug] 처리 완료: 전체 ${totalItems}개 중 ${processedItems}개 조회`);
  console.log('[PriceChecker] 완료:', new Date().toISOString());
}

main().catch(console.error);
