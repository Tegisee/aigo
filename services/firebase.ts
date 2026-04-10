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

/** Anonymous Auth 로그인 (자동) — AsyncStorage 복원 완료 대기 후 판단 */
export async function signInAnonymously(): Promise<string | null> {
  if (!auth) return null;
  try {
    const restoredUser = await new Promise<User | null>((resolve) => {
      const unsubscribe = onAuthStateChanged(auth!, (user) => {
        unsubscribe();
        resolve(user);
      });
    });

    if (restoredUser) return restoredUser.uid;

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
      { expoPushToken: token, lastActiveAt: new Date().toISOString() },
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
  const uid = getCurrentUid();
  if (!uid || !db) return;

  try {
    await setDoc(doc(db!,'users', uid), data, { merge: true });
  } catch (e) {
    console.warn('[Firebase] 유저 설정 저장 실패:', e);
  }
}

/** Firestore에서 유저 설정 복원 (구글 로그인 데이터 복구용) */
export async function fetchUserSettings(): Promise<Record<string, any> | null> {
  const uid = getCurrentUid();
  if (!uid || !db) return null;

  try {
    const snap = await getDoc(doc(db!, 'users', uid));
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (e) {
    console.warn('[Firebase] 유저 설정 조회 실패:', e);
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
export async function upsertSharedProduct(item: TrackedItem): Promise<void> {
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

/** 카테고리별 인기 상품 조회 (trackerCount 내림차순) */
export async function fetchPopularByCategory(
  category: BabyCategory,
  count: number = 10,
): Promise<SharedProduct[]> {
  if (!db) return [];

  try {
    const q = query(
      collection(db!, 'shared_products'),
      where('category', '==', category),
      where('trackerCount', '>', 0),
      orderBy('trackerCount', 'desc'),
      firestoreLimit(count),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as SharedProduct);
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
