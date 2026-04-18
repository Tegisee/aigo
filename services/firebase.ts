import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  signInAnonymously as firebaseSignInAnonymously,
  onAuthStateChanged,
  linkWithCredential,
  GoogleAuthProvider,
  signInWithCredential,
  type User,
} from 'firebase/auth';
// @ts-ignore — RN-specific export in @firebase/auth/dist/rn
import { getReactNativePersistence } from '@firebase/auth/dist/rn/index.js';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  updateDoc,
  getDocs,
  increment,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  writeBatch,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { TrackedItem, SharedProduct, BabyCategory } from '../types';
export type { SharedProduct };

const firebaseConfig = {
  apiKey: 'AIzaSyA0QT1Fg7vT1C-qDemN-g1zMCy6rlNZC4Q',
  authDomain: 'aigo-a.firebaseapp.com',
  projectId: 'aigo-a',
  storageBucket: 'aigo-a.firebasestorage.app',
  messagingSenderId: '531153481988',
  appId: Platform.OS === 'android'
    ? '1:531153481988:android:c8755d32917fa072186051'
    : Platform.OS === 'ios'
      ? '1:531153481988:ios:fb45cb0a904e218b186051'
      : '1:531153481988:web:975f641749d8f1e3186051',
  measurementId: 'G-TXFXMGMCCT',
};

/** Firebase 설정이 완료되었는지 확인 */
const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith('TODO');

// Firebase 초기화 (설정 미완료 시 null)
let app: ReturnType<typeof initializeApp> | null = null;
let auth: ReturnType<typeof initializeAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;

if (isFirebaseConfigured) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  db = getFirestore(app);
} else {
  console.warn('[Firebase] 설정 미완료 — TODO placeholder 감지. Firestore/Auth 비활성화.');
}

/** Anonymous Auth 로그인 (자동) — 기존 세션(구글 포함) 복원 우선, 없을 때만 익명 생성 */
export async function signInAnonymously(): Promise<string | null> {
  if (!auth) return null;
  try {
    const restoredUser = await new Promise<User | null>((resolve) => {
      const unsubscribe = onAuthStateChanged(auth!, (user) => {
        unsubscribe();
        resolve(user);
      });
    });

    if (restoredUser) {
      const isGoogle = restoredUser.providerData.some((p) => p.providerId === 'google.com');
      console.log('[Firebase] 기존 세션 복원 —', isGoogle ? '구글 계정' : '익명', 'uid:', restoredUser.uid);
      return restoredUser.uid;
    }

    console.log('[Firebase] 기존 세션 없음 — 새 익명 계정 생성');
    const credential = await firebaseSignInAnonymously(auth);
    return credential.user.uid;
  } catch (e) {
    console.warn('[Firebase] 익명 로그인 실패:', e);
    return null;
  }
}

/** 현재 로그인된 uid 반환 */
export function getCurrentUid(): string | null {
  return auth?.currentUser?.uid ?? null;
}

/**
 * uid가 확정될 때까지 대기 (최대 timeoutMs).
 * linkGoogleAccount 직후처럼 onAuthStateChanged 비동기 반영 지연을 방어.
 * 이미 uid가 있으면 즉시 반환.
 */
export async function waitForUid(timeoutMs = 2000): Promise<string | null> {
  const immediate = getCurrentUid();
  if (immediate) return immediate;
  if (!auth) return null;

  return new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (uid: string | null) => {
      if (settled) return;
      settled = true;
      resolve(uid);
    };
    const unsub = onAuthStateChanged(auth!, (user) => {
      if (user?.uid) {
        unsub();
        finish(user.uid);
      }
    });
    setTimeout(() => {
      unsub();
      finish(getCurrentUid());
    }, timeoutMs);
  });
}

/**
 * auth.currentUser가 **비익명(Google 등 영구 프로바이더)** 으로 전환될 때까지 대기.
 * signInWithCredential 직후 auth state 반영이 마이크로태스크/persistence writing 지연으로
 * 늦어지면, 후속 write(updateUserSettings 등)가 익명 A uid로 가버리는 회귀를 방어.
 * 이미 비익명이면 즉시 반환, 아니면 onAuthStateChanged로 대기, 타임아웃 시 현재 상태로 finalize.
 */
export async function waitForNonAnonymousUid(
  timeoutMs = 5000,
): Promise<string | null> {
  if (!auth) return null;
  const cur = auth.currentUser;
  if (cur?.uid && !cur.isAnonymous) return cur.uid;

  return new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (uid: string | null) => {
      if (settled) return;
      settled = true;
      resolve(uid);
    };
    const unsub = onAuthStateChanged(auth!, (user) => {
      if (user?.uid && !user.isAnonymous) {
        unsub();
        finish(user.uid);
      }
    });
    setTimeout(() => {
      unsub();
      const c = auth?.currentUser;
      finish(c && c.uid && !c.isAnonymous ? c.uid : null);
    }, timeoutMs);
  });
}

export interface LinkGoogleResult {
  success: boolean;
  error?: string;
  /** uid가 변경됨 = 기존 계정 복구 (재설치 시나리오). 데이터 복원 필요 */
  recoveredAccount: boolean;
}

/** 구글 로그인 → 익명 계정에 연동 (merge) */
export async function linkGoogleAccount(idToken: string): Promise<LinkGoogleResult> {
  if (!auth) return { success: false, error: 'Firebase 미초기화', recoveredAccount: false };

  const prevUid = auth.currentUser?.uid;

  try {
    const credential = GoogleAuthProvider.credential(idToken);
    const currentUser = auth.currentUser;

    if (currentUser?.isAnonymous) {
      // 익명 → 구글 연동 (데이터 유지, uid 불변)
      await linkWithCredential(currentUser, credential);
      console.log('[Firebase] 구글 연동 성공 (uid 유지):', currentUser.uid);
      return { success: true, recoveredAccount: false };
    } else if (currentUser) {
      // 이미 로그인된 상태
      return { success: true, recoveredAccount: false };
    } else {
      // 로그인 안 된 상태 → 구글로 직접 로그인
      const result = await signInWithCredential(auth, credential);
      const newUid = result.user.uid;
      console.log('[Firebase] 구글 직접 로그인 성공:', newUid);
      return { success: true, recoveredAccount: prevUid !== newUid };
    }
  } catch (e: any) {
    if (e.code === 'auth/credential-already-in-use') {
      // 재설치 등으로 새 익명 계정 → 기존 구글 계정 연동 실패
      // → signInWithCredential로 기존 구글 계정으로 직접 로그인 (데이터 복구)
      try {
        const credential = GoogleAuthProvider.credential(idToken);
        const result = await signInWithCredential(auth!, credential);
        const newUid = result.user.uid;

        // [Login] post-link 진단 로그 — auth.currentUser 실제 전환 상태 기록
        const cur = auth!.currentUser;
        const providers = cur?.providerData?.map((p) => p.providerId) ?? [];
        const postLinkLog =
          `[Login] post-link uid=${cur?.uid ?? 'null'}, ` +
          `isAnonymous=${cur?.isAnonymous ?? 'null'}, ` +
          `providers=${JSON.stringify(providers)}`;
        console.log(postLinkLog);
        await appendFirebaseDebug(postLinkLog);

        // non-anonymous 전환 명시 대기 (auth state 반영 지연 방어)
        const confirmedUid = await waitForNonAnonymousUid(5000);
        const confirmLog = `[Login] non-anon confirmed uid=${confirmedUid ?? 'null'}`;
        console.log(confirmLog);
        await appendFirebaseDebug(confirmLog);

        console.log('[Firebase] 기존 구글 계정으로 로그인 성공 (데이터 복구):', prevUid, '→', newUid);
        return { success: true, recoveredAccount: true };
      } catch (fallbackError: any) {
        console.warn('[Firebase] 구글 직접 로그인도 실패:', fallbackError);
        return { success: false, error: fallbackError.message, recoveredAccount: false };
      }
    }
    console.warn('[Firebase] 구글 연동 실패:', e);
    return { success: false, error: e.message, recoveredAccount: false };
  }
}

/** 현재 로그인 상태 확인 */
export function getAuthState(): { isAnonymous: boolean; provider: string | null; email: string | null } {
  const user = auth?.currentUser;
  if (!user) return { isAnonymous: true, provider: null, email: null };

  const googleProvider = user.providerData.find((p) => p.providerId === 'google.com');
  return {
    isAnonymous: user.isAnonymous,
    provider: googleProvider ? 'google' : null,
    email: googleProvider?.email ?? null,
  };
}

// ─── Push Token / 알림 설정 ───

/** Expo Push Token 저장 */
export async function savePushToken(token: string): Promise<void> {
  const uid = getCurrentUid();
  if (!uid || !db) {
    console.warn('[Firebase] Push Token 저장 스킵 — uid:', uid, 'db:', !!db);
    return;
  }

  try {
    await setDoc(
      doc(db!,'users', uid),
      { expoPushToken: token, notificationEnabled: true, lastActiveAt: new Date().toISOString() },
      { merge: true },
    );
    console.log('[Firebase] Push Token 저장 완료:', token?.slice(0, 30));
  } catch (e) {
    console.warn('[Firebase] Push Token 저장 실패:', e);
  }
}

/** 알림 ON/OFF 설정 저장 */
export async function updateNotificationEnabled(
  enabled: boolean,
): Promise<void> {
  const uid = getCurrentUid();
  if (!uid || !db) return;

  try {
    await setDoc(
      doc(db!,'users', uid),
      { notificationEnabled: enabled },
      { merge: true },
    );
  } catch (e) {
    console.warn('[Firebase] 알림 설정 저장 실패:', e);
  }
}

/** 유저 설정 Firestore 저장 (부분 업데이트) */
export async function updateUserSettings(
  data: Record<string, any>,
): Promise<void> {
  // waitForUid: onAuthStateChanged 기반 uid 확정 대기
  // 기존 자체 구현은 첫 emit이 null이면 즉시 종료되어 signInAnonymously 전 호출 시 skip되는 버그가 있었음
  const uid = await waitForUid(3000);

  if (!uid || !db) {
    console.warn('[Firebase] 유저 설정 저장 스킵 — uid 없음. keys:', Object.keys(data).join(','));
    return;
  }

  try {
    await setDoc(doc(db!,'users', uid), data, { merge: true });
  } catch (e) {
    console.warn('[Firebase] 유저 설정 저장 실패:', e);
  }
}

/** AsyncStorage(aigo-restore-debug) 키에 한 줄 누적 — restore.ts와 동일 키 공유 */
async function appendFirebaseDebug(line: string) {
  try {
    const ts = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const prev = await AsyncStorage.getItem('aigo-restore-debug');
    await AsyncStorage.setItem(
      'aigo-restore-debug',
      `${prev ?? ''}\n[${ts}] ${line}`.trim(),
    );
  } catch {}
}

/** Firestore에서 유저 설정 복원 (구글 로그인 데이터 복구용)
 *  getDocFromServer로 클라이언트 캐시를 우회해 항상 서버 원본을 읽음.
 *  상세 디버그: uid, snap.exists, keys 목록을 AsyncStorage에 기록.
 */
export async function fetchUserSettings(): Promise<Record<string, any> | null> {
  const uid = getCurrentUid();
  const dbOk = !!db;
  const projectId = (db as any)?._databaseId?.projectId
    ?? (app as any)?.options?.projectId
    ?? '(unknown)';
  const databaseId = (db as any)?._databaseId?.database ?? '(default)';

  const preLog =
    `[FetchSettings] uid=${uid ?? 'null'}, db=${dbOk ? 'ok' : 'null'}, ` +
    `project=${projectId}, database=${databaseId}`;
  console.log(preLog);
  await appendFirebaseDebug(preLog);

  if (!uid || !db) {
    await appendFirebaseDebug('[FetchSettings] ABORT — uid 또는 db 없음');
    return null;
  }

  try {
    const snap = await getDocFromServer(doc(db!, 'users', uid));
    const existsLog = `[FetchSettings] snap.exists=${snap.exists()}, fromCache=${snap.metadata.fromCache}, hasPendingWrites=${snap.metadata.hasPendingWrites}`;
    console.log(existsLog);
    await appendFirebaseDebug(existsLog);

    if (snap.exists()) {
      const data = snap.data();
      const keys = Object.keys(data).sort();
      const keysLog = `[FetchSettings] keys(${keys.length}): ${keys.join(',')}`;
      console.log(keysLog);
      await appendFirebaseDebug(keysLog);
      // children/parentInfo 값 유무도 축약 기록
      const detailLog =
        `[FetchSettings] detail: children=${Array.isArray(data.children) ? 'array[' + data.children.length + ']' : typeof data.children}, ` +
        `parentInfo=${data.parentInfo && typeof data.parentInfo === 'object' ? 'obj(' + Object.keys(data.parentInfo).length + 'keys)' : typeof data.parentInfo}, ` +
        `babyName=${data.babyName ?? '(none)'}`;
      console.log(detailLog);
      await appendFirebaseDebug(detailLog);
      // snap.data() raw JSON 덤프 — Object.keys vs 실제 직렬화 불일치 여부까지 잡기 위함
      try {
        const raw = JSON.stringify(data);
        const rawLog =
          `[FetchSettings] raw(${raw.length}chars): ` +
          `${raw.slice(0, 2000)}${raw.length > 2000 ? '…(truncated)' : ''}`;
        console.log(rawLog);
        await appendFirebaseDebug(rawLog);
      } catch (jsonErr: any) {
        await appendFirebaseDebug(`[FetchSettings] raw JSON 실패: ${jsonErr?.message ?? jsonErr}`);
      }
      return data;
    }

    await appendFirebaseDebug('[FetchSettings] 문서 없음 (exists=false)');
    return null;
  } catch (e: any) {
    const errLog = `[FetchSettings] 오류: code=${e?.code ?? '(none)'}, message=${e?.message ?? String(e)}`;
    console.warn('[Firebase] 유저 설정 조회 실패:', e);
    await appendFirebaseDebug(errLog);
    return null;
  }
}

// ─── Firestore CRUD ───

function userItemsCol(uid: string) {
  return collection(db!, 'users', uid, 'items');
}

/** undefined 필드 제거 (Firestore는 undefined 저장 불가) */
function sanitize<T extends Record<string, any>>(obj: T): T {
  const clean = { ...obj };
  for (const key of Object.keys(clean)) {
    if (clean[key] === undefined) delete clean[key];
  }
  return clean;
}

/** Firestore에 상품 저장 */
export async function saveItemToFirestore(item: TrackedItem): Promise<void> {
  const uid = getCurrentUid();
  if (!uid || !db) return;

  try {
    await setDoc(doc(db!,'users', uid, 'items', item.id), sanitize(item));
  } catch (e) {
    console.warn('[Firebase] 상품 저장 실패:', e);
  }
}

/** Firestore에서 상품 삭제 */
export async function removeItemFromFirestore(itemId: string): Promise<void> {
  const uid = getCurrentUid();
  if (!uid || !db) return;

  try {
    await deleteDoc(doc(db!,'users', uid, 'items', itemId));
  } catch (e) {
    console.warn('[Firebase] 상품 삭제 실패:', e);
  }
}

/** Firestore에서 상품 목록 불러오기 */
export async function fetchItemsFromFirestore(): Promise<TrackedItem[]> {
  const uid = getCurrentUid();
  if (!uid || !db) return [];

  try {
    const q = query(userItemsCol(uid), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as TrackedItem);
  } catch (e) {
    console.warn('[Firebase] 상품 목록 조회 실패:', e);
    return [];
  }
}

/** Firestore 상품 업데이트 (부분) */
export async function updateItemInFirestore(
  itemId: string,
  data: Partial<TrackedItem>
): Promise<void> {
  const uid = getCurrentUid();
  if (!uid || !db) return;

  try {
    await updateDoc(doc(db!,'users', uid, 'items', itemId), sanitize(data as any));
  } catch (e) {
    console.warn('[Firebase] 상품 업데이트 실패:', e);
  }
}

// ─── Shared Products (공유 가격 데이터) ───

/** 상품 등록/관심 추가 시 shared_products 생성 또는 trackerCount 증가 */
export async function upsertSharedProduct(
  item: TrackedItem,
  gender?: 'male' | 'female' | 'both',
): Promise<void> {
  if (!db) return;

  const productId = item.productId || item.id;
  const ref = doc(db!, 'shared_products', productId);

  try {
    const snap = await getDoc(ref);

    if (snap.exists()) {
      await updateDoc(ref, { trackerCount: increment(1) });
    } else {
      const now = new Date().toISOString();
      const shared: SharedProduct = {
        productId,
        productName: item.productName,
        category: item.category || '기타',
        ageGroup: '',
        gender: gender || 'both',
        currentPrice: item.currentPrice,
        previousPrice: item.currentPrice,
        thumbnail: item.thumbnail,
        priceHistory: item.priceHistory.length > 0
          ? item.priceHistory
          : [{ date: now.slice(0, 10), price: item.currentPrice }],
        trackerCount: 1,
        purchaseCount: 0,
        lastCheckedAt: now,
      };
      await setDoc(ref, shared);
    }
  } catch (e) {
    console.warn('[Firebase] shared_products upsert 실패:', e);
  }
}

/** 구매 시 purchaseCount 증가 */
export async function incrementPurchaseCount(productId: string): Promise<void> {
  if (!db) return;

  try {
    const ref = doc(db!, 'shared_products', productId);
    await updateDoc(ref, { purchaseCount: increment(1) });
  } catch (e) {
    console.warn('[Firebase] purchaseCount 증가 실패:', e);
  }
}

/** 상품 삭제 시 trackerCount 감소 */
export async function decrementTrackerCount(itemId: string): Promise<void> {
  if (!db) return;

  const ref = doc(db!, 'shared_products', itemId);

  try {
    await updateDoc(ref, { trackerCount: increment(-1) });
  } catch (e) {
    console.warn('[Firebase] trackerCount 감소 실패:', e);
  }
}

/** 단일 shared_product 조회 */
export async function fetchSharedProduct(productId: string): Promise<SharedProduct | null> {
  if (!db) return null;

  try {
    const snap = await getDoc(doc(db!, 'shared_products', productId));
    return snap.exists() ? (snap.data() as SharedProduct) : null;
  } catch (e) {
    console.warn('[Firebase] shared_product 조회 실패:', e);
    return null;
  }
}

/** 카테고리별 인기 상품 조회 (trackerCount 내림차순, 성별 필터링) */
export async function fetchPopularByCategory(
  category: BabyCategory,
  count: number = 10,
  gender?: 'male' | 'female' | 'unknown',
): Promise<SharedProduct[]> {
  if (!db) return [];

  try {
    const q = query(
      collection(db!, 'shared_products'),
      where('category', '==', category),
      where('trackerCount', '>', 0),
      orderBy('trackerCount', 'desc'),
      firestoreLimit(count * 2), // 성별 필터링 후 부족하지 않도록 여유분 조회
    );
    const snapshot = await getDocs(q);
    let results = snapshot.docs.map((d) => d.data() as SharedProduct);

    // 성별 필터링: male/female인 경우 해당 성별 + both + gender 미설정 상품만
    if (gender && gender !== 'unknown') {
      results = results.filter((p) => !p.gender || p.gender === 'both' || p.gender === gender);
    }

    return results.slice(0, count);
  } catch (e) {
    console.warn('[Firebase] 카테고리별 인기 상품 조회 실패:', e);
    return [];
  }
}

/** 로컬 전체 데이터를 Firestore에 백업 */
export async function syncLocalToFirestore(
  items: TrackedItem[]
): Promise<void> {
  const uid = getCurrentUid();
  if (!uid || !db) return;

  try {
    const batch = writeBatch(db!);

    // lastActiveAt 업데이트
    batch.set(doc(db!,'users', uid), { lastActiveAt: new Date().toISOString() }, { merge: true });

    for (const item of items) {
      batch.set(doc(db!,'users', uid, 'items', item.id), item);
    }

    await batch.commit();
  } catch (e) {
    console.warn('[Firebase] 동기화 실패:', e);
  }
}
