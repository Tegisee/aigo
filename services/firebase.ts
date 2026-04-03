import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  signInAnonymously as firebaseSignInAnonymously,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
// @ts-ignore — RN-specific export in @firebase/auth/dist/rn
import { getReactNativePersistence } from '@firebase/auth/dist/rn/index.js';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  getDocs,
  query,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { TrackedItem } from '../types';

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

// ─── Push Token / 알림 설정 ───

/** Expo Push Token 저장 */
export async function savePushToken(token: string): Promise<void> {
  const uid = getCurrentUid();
  if (!uid || !db) return;

  try {
    await setDoc(
      doc(db!,'users', uid),
      { expoPushToken: token, notificationEnabled: true, lastActiveAt: new Date().toISOString() },
      { merge: true },
    );
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

// ─── Firestore CRUD ───

function userItemsCol(uid: string) {
  return collection(db!, 'users', uid, 'items');
}

/** Firestore에 상품 저장 */
export async function saveItemToFirestore(item: TrackedItem): Promise<void> {
  const uid = getCurrentUid();
  if (!uid || !db) return;

  try {
    await setDoc(doc(db!,'users', uid, 'items', item.id), item);
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
    await updateDoc(doc(db!,'users', uid, 'items', itemId), data);
  } catch (e) {
    console.warn('[Firebase] 상품 업데이트 실패:', e);
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
