/**
 * 아이고 월령별 가격 변동 알림 cron (04:00 KST = 19:00 UTC, 비활성 상태로 시작).
 *
 * 동작:
 *   1. price_drops_baby/{오늘 KST} read — 그룹 1~4가 누적한 슬러그별 변동
 *   2. users 컬렉션 순회 — notificationEnabled / expoPushToken / 24h 가드
 *   3. 사용자 월령 → 슬러그 매칭 (끝 "-N-M" 범위 또는 범위 없음=공통)
 *   4. 매칭 슬러그가 1개 이상이면 사용자당 1알림 발송 (요약 메시지)
 *   5. 발송 성공 시 users/{uid}.lastBabyDropAlertAt = now (24h 가드용)
 *   6. 만료 토큰 정리 (cleanupInvalidUsers)
 *
 * 환경변수:
 *   FIREBASE_SERVICE_ACCOUNT_KEY    Admin SDK 인증 (jigumiya 프로젝트)
 *   DRY_RUN                         '1' 지정 시 실제 push 미발송 (디버그용)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { pickBabyDropMessage } from './messages.js';

const DRY_RUN = process.env.DRY_RUN === '1';
const ALERT_GUARD_MS = 24 * 60 * 60 * 1000; // 24시간 중복 방지

const expo = new Expo();

interface PriceDrop {
  productId: string;
  productName: string;
  productImage: string;
  productUrl: string;
  isRocket: boolean;
  prevPrice: number;
  newPrice: number;
  dropAmount: number;
  dropRate: number;
}

interface DropsDoc {
  bySlug: Record<string, PriceDrop[]>;
  groupsCompleted?: number[];
  updatedAt?: number;
}

interface ChildLite {
  id?: string;
  name?: string;
  birthDate?: string;
}

function todayKstDateStr(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function calcBabyMonths(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  if (Number.isNaN(birth.getTime())) return -1;
  return (
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth())
  );
}

/** 슬러그 끝 "-N-M" 범위가 있으면 N..M 매칭, 없으면 공통(true). */
function slugMatchesMonths(slug: string, months: number): boolean {
  const m = slug.match(/-(\d+)-(\d+)$/);
  if (!m) return true; // 공통 슬러그 (wipes, swaddle 등)
  const min = parseInt(m[1]!, 10);
  const max = parseInt(m[2]!, 10);
  return months >= min && months <= max;
}

function pickPrimaryChildMonths(userData: Record<string, any>): number {
  const children: ChildLite[] = Array.isArray(userData.children) ? userData.children : [];
  const selectedId: string | undefined = userData.selectedChildId;

  let target: ChildLite | undefined;
  if (children.length > 0) {
    target = (selectedId ? children.find((c) => c.id === selectedId) : undefined) ?? children[0];
  }
  const birthDate = target?.birthDate || userData.babyBirthDate;
  if (!birthDate) return -1;
  return calcBabyMonths(birthDate);
}

async function cleanupInvalidUsers(
  db: FirebaseFirestore.Firestore,
  invalidTokens: string[],
) {
  if (invalidTokens.length === 0) return;
  const tokenSet = new Set(invalidTokens);
  const usersSnap = await db.collection('users').get();
  let cleaned = 0;
  for (const userDoc of usersSnap.docs) {
    const token = userDoc.data().expoPushToken;
    if (!token || !tokenSet.has(token)) continue;
    await userDoc.ref.update({ expoPushToken: FieldValue.delete() });
    cleaned += 1;
  }
  console.log(`[BabyNotifier] 만료 토큰 정리: ${cleaned}건`);
}

async function sendChunked(
  messages: ExpoPushMessage[],
): Promise<{ tickets: ExpoPushTicket[]; invalidTokens: string[] }> {
  const tickets: ExpoPushTicket[] = [];
  const invalidTokens: string[] = [];

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const result = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...result);
      console.log('[BabyNotifier] 발송:', result.length, '건');
    } catch (e) {
      console.error('[BabyNotifier] 발송 실패:', e);
    }
  }

  tickets.forEach((ticket, i) => {
    if (ticket.status !== 'error') return;
    const token = messages[i]?.to as string;
    const code = ticket.details?.error;
    if (code === 'DeviceNotRegistered' || code === 'InvalidCredentials') {
      console.log('[BabyNotifier] 만료 토큰:', token?.slice(0, 30), `(code=${code})`);
      if (token) invalidTokens.push(token);
    } else {
      console.log(
        '[BabyNotifier][DEBUG] 판정 제외 에러:',
        token?.slice(0, 30),
        `(code=${code ?? 'unknown'}, message="${ticket.message}")`,
      );
    }
  });

  return { tickets, invalidTokens };
}

async function main() {
  console.log('[BabyNotifier] 시작:', new Date().toISOString(), DRY_RUN ? '(DRY_RUN)' : '');

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const dateStr = todayKstDateStr();
  const dropsSnap = await db.collection('price_drops_baby').doc(dateStr).get();
  if (!dropsSnap.exists) {
    console.log(`[BabyNotifier] price_drops_baby/${dateStr} 없음 — 종료`);
    return;
  }
  const dropsDoc = dropsSnap.data() as DropsDoc;
  const bySlug = dropsDoc.bySlug || {};
  const slugList = Object.keys(bySlug).filter((s) => (bySlug[s] || []).length > 0);
  if (slugList.length === 0) {
    console.log(`[BabyNotifier] 변동 슬러그 0개 — 종료`);
    return;
  }
  console.log(
    `[BabyNotifier] price_drops_baby/${dateStr} — 변동 슬러그 ${slugList.length}개 (groups=${(dropsDoc.groupsCompleted || []).join(',')})`,
  );

  const now = Date.now();
  const usersSnap = await db.collection('users').get();
  console.log(`[BabyNotifier] 전체 유저: ${usersSnap.size}명`);

  const messages: ExpoPushMessage[] = [];
  const targetUids: string[] = []; // messages 와 동일 인덱스 — 발송 후 lastBabyDropAlertAt 갱신
  const skipReasons: Record<string, number> = {};
  const inc = (k: string) => {
    skipReasons[k] = (skipReasons[k] || 0) + 1;
  };

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    const uid = userDoc.id;
    const token = userData.expoPushToken as string | undefined;
    const notifEnabled = userData.notificationEnabled !== false;

    if (!token) {
      inc('no-token');
      continue;
    }
    if (!notifEnabled) {
      inc('notif-off');
      continue;
    }
    if (!Expo.isExpoPushToken(token)) {
      inc('invalid-format');
      continue;
    }

    const lastAt = Number(userData.lastBabyDropAlertAt || 0);
    if (lastAt > 0 && now - lastAt < ALERT_GUARD_MS) {
      inc('24h-guard');
      continue;
    }

    const months = pickPrimaryChildMonths(userData);
    if (months < 0) {
      inc('no-birthDate');
      continue;
    }

    const matchedSlugs = slugList.filter((s) => slugMatchesMonths(s, months));
    if (matchedSlugs.length === 0) {
      inc('no-match');
      continue;
    }

    const { title, body } = pickBabyDropMessage(months);
    messages.push({
      to: token,
      sound: 'default' as const,
      title,
      body,
      priority: 'high' as const,
      channelId: 'price',
      data: {
        type: 'baby-category-drop',
        slugs: matchedSlugs,
        screen: 'baby-category',
      },
    });
    targetUids.push(uid);
  }

  console.log(
    `[BabyNotifier] 발송 대상: ${messages.length}건, skip 사유: ${JSON.stringify(skipReasons)}`,
  );

  if (DRY_RUN) {
    console.log('[BabyNotifier] DRY_RUN — 실제 발송 스킵, 종료');
    return;
  }
  if (messages.length === 0) {
    console.log('[BabyNotifier] 발송 대상 0건 — 종료');
    return;
  }

  const { tickets, invalidTokens } = await sendChunked(messages);

  // ticket status 집계
  const statusCount: Record<string, number> = {};
  tickets.forEach((t) => {
    statusCount[t.status] = (statusCount[t.status] || 0) + 1;
  });
  console.log('[BabyNotifier] ticket 집계:', JSON.stringify(statusCount));

  // 발송 성공한 사용자만 lastBabyDropAlertAt 갱신
  const successUids: string[] = [];
  tickets.forEach((t, i) => {
    if (t.status === 'ok') {
      const uid = targetUids[i];
      if (uid) successUids.push(uid);
    }
  });
  for (const uid of successUids) {
    try {
      await db.collection('users').doc(uid).update({ lastBabyDropAlertAt: now });
    } catch (e) {
      console.warn(`[BabyNotifier] lastBabyDropAlertAt 갱신 실패 uid=${uid}:`, e);
    }
  }
  console.log(`[BabyNotifier] lastBabyDropAlertAt 갱신: ${successUids.length}명`);

  await cleanupInvalidUsers(db, invalidTokens);

  console.log('[BabyNotifier] 종료');
}

main().catch((e) => {
  console.error('[BabyNotifier] 치명적 오류:', e);
  process.exit(1);
});
