import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  signInAnonymously as firebaseSignInAnonymously,
  onAuthStateChanged,
  linkWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  reauthenticateWithCredential,
  deleteUser,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
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
import type {
  TrackedItem,
  SharedProduct,
  BabyCategory,
  CategoryBestBaby,
} from '../types';
import { getCategorySlug } from '../types';
export type { SharedProduct };

const firebaseConfig = {
  apiKey: 'AIzaSyAMGMGrOJw1TqdytZqB_Y0-roiYRyKQ5Ho',
  authDomain: 'jigumiya.firebaseapp.com',
  projectId: 'jigumiya',
  storageBucket: 'jigumiya.firebasestorage.app',
  messagingSenderId: '250441543259',
  appId: Platform.OS === 'android'
    ? '1:250441543259:android:9faddd4ff858f49605197e'
    : '1:250441543259:ios:deadd077a127951c05197e',
};

/** Firebase 설정이 완료되었는지 확인 */
const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith('TODO');

// Firebase 초기화 (설정 미완료 시 null)
let app: ReturnType<typeof initializeApp> | null = null;
let auth: ReturnType<typeof initializeAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let functions: ReturnType<typeof getFunctions> | null = null;

if (isFirebaseConfigured) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  db = getFirestore(app);
  functions = getFunctions(app, 'asia-northeast3');
} else {
  console.warn('[Firebase] 설정 미완료 — TODO placeholder 감지. Firestore/Auth 비활성화.');
}

// ─── Cloud Functions Callable ───

export type ResolveAffiliateResult =
  | { ok: true; shortenUrl: string; originalUrl: string }
  | { ok: false; error: string; detail?: string };

/**
 * Cloud Functions `resolveAndGenerateAffiliateUrl` 호출.
 * 서버가 link.coupang.com → vp URL resolve + /deeplink API 호출까지 일괄 처리.
 * 네트워크/배포 오류 시 { ok: false, error: 'callable_error' } 반환 — 예외는 내부 흡수.
 */
export async function callResolveAffiliate(
  sharedUrl: string,
): Promise<ResolveAffiliateResult> {
  if (!functions) {
    return { ok: false, error: 'callable_error', detail: 'functions not initialized' };
  }
  try {
    const callable = httpsCallable<
      { sharedUrl: string },
      ResolveAffiliateResult
    >(functions, 'resolveAndGenerateAffiliateUrl');
    const { data } = await callable({ sharedUrl });
    return data;
  } catch (e) {
    console.warn('[Functions] resolveAffiliate 실패:', e);
    return {
      ok: false,
      error: 'callable_error',
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Functions 콜드 스타트 워밍업.
 * sentinel URL은 backend(functions/src/index.ts)에서 coupang.com 미포함 시 즉시 early return →
 * 쿠팡 API 미호출(Rate Limit 0), 컨테이너 init만 트리거.
 * 모달 mount / AppState active 전환 시 호출 — 사용자 클릭 시점 warm 확률 ↑.
 */
export async function warmupResolveAffiliate(): Promise<void> {
  if (!functions) return;
  try {
    const callable = httpsCallable<{ sharedUrl: string }, ResolveAffiliateResult>(
      functions,
      'resolveAndGenerateAffiliateUrl',
    );
    await callable({ sharedUrl: 'https://__warmup__.local/' });
  } catch {
    // silent — cold start만 트리거하면 됨
  }
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

/**
 * auth의 **초기 상태** 반환 (onAuthStateChanged의 첫 fire를 await).
 * - null: 세션 없음 (fresh install, 세션 만료 등)
 * - 객체: firebase:authUser:* 에서 복원된 기존 세션
 * 용도: _layout 시작 시점에 "익명 uid를 만들지 말지" 결정할 때 사용.
 */
export async function getInitialAuthUser(): Promise<{
  uid: string;
  isAnonymous: boolean;
  providers: string[];
} | null> {
  if (!auth) return null;
  const user = await new Promise<User | null>((resolve) => {
    const unsub = onAuthStateChanged(auth!, (u) => {
      unsub();
      resolve(u);
    });
  });
  if (!user) return null;
  return {
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    providers: user.providerData?.map((p) => p.providerId) ?? [],
  };
}

/**
 * auth 상태 변화 구독 — onAuthStateChanged의 얇은 래퍼.
 * auth 인스턴스를 외부에 노출하지 않기 위한 helper.
 * 최초 구독 시 현재 상태로도 한 번 fire됨 (Firebase SDK 규약).
 */
export function subscribeAuthState(
  callback: (
    uid: string | null,
    info?: { isAnonymous: boolean; providers: string[] },
  ) => void,
): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      callback(null);
      return;
    }
    callback(user.uid, {
      isAnonymous: user.isAnonymous,
      providers: user.providerData?.map((p) => p.providerId) ?? [],
    });
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
      // 로그인 안 된 상태 → 구글로 직접 로그인 (신규 유저 / 온보딩 경로)
      const result = await signInWithCredential(auth, credential);
      const newUid = result.user.uid;

      // post-signin 진단 로그 + 비익명 확정 대기 (fallback 분기와 동일 패턴)
      const cur = auth!.currentUser;
      const providers = cur?.providerData?.map((p) => p.providerId) ?? [];
      const postLinkLog =
        `[Login] direct-signIn uid=${cur?.uid ?? 'null'}, ` +
        `isAnonymous=${cur?.isAnonymous ?? 'null'}, ` +
        `providers=${JSON.stringify(providers)}`;
      console.log(postLinkLog);
      await appendFirebaseDebug(postLinkLog).catch(() => {});

      const confirmedUid = await waitForNonAnonymousUid(5000);
      await appendFirebaseDebug(`[Login] non-anon confirmed uid=${confirmedUid ?? 'null'}`).catch(() => {});

      console.log('[Firebase] 구글 직접 로그인 성공:', newUid);
      // prevUid가 undefined면 순수 신규 → recoveredAccount=false
      return { success: true, recoveredAccount: !!prevUid && prevUid !== newUid };
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

/** Apple 로그인 → 익명 계정에 연동 또는 직접 signIn (linkGoogleAccount와 동일 패턴) */
export async function linkAppleAccount(
  identityToken: string,
  rawNonce: string,
): Promise<LinkGoogleResult> {
  if (!auth) return { success: false, error: 'Firebase 미초기화', recoveredAccount: false };

  const prevUid = auth.currentUser?.uid;
  const provider = new OAuthProvider('apple.com');

  try {
    const credential = provider.credential({ idToken: identityToken, rawNonce });
    const currentUser = auth.currentUser;

    if (currentUser?.isAnonymous) {
      await linkWithCredential(currentUser, credential);
      console.log('[Firebase] Apple 연동 성공 (uid 유지):', currentUser.uid);
      return { success: true, recoveredAccount: false };
    } else if (currentUser) {
      return { success: true, recoveredAccount: false };
    } else {
      const result = await signInWithCredential(auth, credential);
      const newUid = result.user.uid;

      const cur = auth!.currentUser;
      const providers = cur?.providerData?.map((p) => p.providerId) ?? [];
      const postLinkLog =
        `[AppleLogin] direct-signIn uid=${cur?.uid ?? 'null'}, ` +
        `isAnonymous=${cur?.isAnonymous ?? 'null'}, ` +
        `providers=${JSON.stringify(providers)}`;
      console.log(postLinkLog);
      await appendFirebaseDebug(postLinkLog).catch(() => {});

      const confirmedUid = await waitForNonAnonymousUid(5000);
      await appendFirebaseDebug(`[AppleLogin] non-anon confirmed uid=${confirmedUid ?? 'null'}`).catch(() => {});

      console.log('[Firebase] Apple 직접 로그인 성공:', newUid);
      return { success: true, recoveredAccount: !!prevUid && prevUid !== newUid };
    }
  } catch (e: any) {
    if (e.code === 'auth/credential-already-in-use') {
      try {
        const credential = provider.credential({ idToken: identityToken, rawNonce });
        const result = await signInWithCredential(auth!, credential);
        const newUid = result.user.uid;

        const cur = auth!.currentUser;
        const providers = cur?.providerData?.map((p) => p.providerId) ?? [];
        const postLinkLog =
          `[AppleLogin] post-link uid=${cur?.uid ?? 'null'}, ` +
          `isAnonymous=${cur?.isAnonymous ?? 'null'}, ` +
          `providers=${JSON.stringify(providers)}`;
        console.log(postLinkLog);
        await appendFirebaseDebug(postLinkLog);

        const confirmedUid = await waitForNonAnonymousUid(5000);
        await appendFirebaseDebug(`[AppleLogin] non-anon confirmed uid=${confirmedUid ?? 'null'}`);

        console.log('[Firebase] 기존 Apple 계정으로 로그인 성공 (데이터 복구):', prevUid, '→', newUid);
        return { success: true, recoveredAccount: true };
      } catch (fallbackError: any) {
        console.warn('[Firebase] Apple 직접 로그인도 실패:', fallbackError);
        return { success: false, error: fallbackError.message, recoveredAccount: false };
      }
    }
    console.warn('[Firebase] Apple 연동 실패:', e);
    return { success: false, error: e.message, recoveredAccount: false };
  }
}

/** Firebase Auth 로그아웃 — currentUser를 null로 (Firestore 데이터는 보존) */
export async function signOutFirebase(): Promise<void> {
  if (!auth) return;
  try {
    await firebaseSignOut(auth);
  } catch (e) {
    console.warn('[Firebase] signOut 실패:', e);
  }
}

/** 현재 로그인 상태 확인 */
export function getAuthState(): { isAnonymous: boolean; provider: 'google' | 'apple' | null; email: string | null } {
  const user = auth?.currentUser;
  if (!user) return { isAnonymous: true, provider: null, email: null };

  const googleProvider = user.providerData.find((p) => p.providerId === 'google.com');
  if (googleProvider) {
    return { isAnonymous: user.isAnonymous, provider: 'google', email: googleProvider.email ?? null };
  }
  const appleProvider = user.providerData.find((p) => p.providerId === 'apple.com');
  if (appleProvider) {
    return { isAnonymous: user.isAnonymous, provider: 'apple', email: appleProvider.email ?? user.email ?? null };
  }
  return { isAnonymous: user.isAnonymous, provider: null, email: null };
}

// ─── Push Token / 알림 설정 ───

/** savePushToken 마지막 실패 사유 (디버그용 — getLastSavePushTokenError 로 조회) */
let lastSavePushTokenError: string | null = null;

/**
 * Expo Push Token 저장.
 * 성공 시 true, 실패(uid 없음 / db 없음 / setDoc 실패) 시 false 반환 — throw 안 함.
 * 호출자(notifications.ts)는 false 시 retryTokenSave 발동.
 */
export async function savePushToken(token: string): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid || !db) {
    const skipLog = `[SavePushToken] SKIP — uid=${uid ?? 'null'}, db=${!!db}`;
    console.warn(skipLog);
    await appendFirebaseDebug(skipLog).catch(() => {});
    lastSavePushTokenError = skipLog;
    return false;
  }

  try {
    const cur = auth?.currentUser;
    const preLog =
      `[SavePushToken] 쓰기 시작 — uid=${uid}, ` +
      `isAnonymous=${cur?.isAnonymous}, providers=${JSON.stringify(cur?.providerData?.map((p) => p.providerId) ?? [])}`;
    console.log(preLog);
    await appendFirebaseDebug(preLog).catch(() => {});

    await setDoc(
      doc(db!,'users', uid),
      {
        expoPushToken: token,
        notificationEnabled: true,
        lastActiveAt: new Date().toISOString(),
        // C (2026-05-04): 알림 발송 시 앱 식별 — jigumiya cron은 app !== 'aigo' 사용자 스킵.
        // 사고 학습: users 컬렉션에 다른 EAS projectId 토큰 혼재 시 Expo batch 거절.
        app: 'aigo' as const,
      },
      { merge: true },
    );
    const doneLog = `[SavePushToken] 완료 — uid=${uid}, token=${token?.slice(0, 20)}…`;
    console.log(doneLog);
    await appendFirebaseDebug(doneLog).catch(() => {});
    lastSavePushTokenError = null;
    return true;
  } catch (e: any) {
    const errLog = `[SavePushToken] 실패 — uid=${uid}, err=${e?.code ?? ''} ${e?.message ?? e}`;
    console.warn(errLog);
    await appendFirebaseDebug(errLog).catch(() => {});
    lastSavePushTokenError = errLog;
    return false;
  }
}

/** savePushToken 마지막 실패 사유 반환. 직전 호출이 성공했거나 미호출이면 null. */
export function getLastSavePushTokenError(): string | null {
  return lastSavePushTokenError;
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
  const uid = await waitForUid(3000);

  if (!uid || !db) {
    const skipLog = `[UpdateUserSettings] SKIP — uid=${uid ?? 'null'}, db=${!!db}, keys=${Object.keys(data).join(',')}`;
    console.warn(skipLog);
    await appendFirebaseDebug(skipLog).catch(() => {});
    return;
  }

  try {
    const cur = auth?.currentUser;
    const preLog =
      `[UpdateUserSettings] 쓰기 시작 — uid=${uid}, ` +
      `isAnonymous=${cur?.isAnonymous}, providers=${JSON.stringify(cur?.providerData?.map((p) => p.providerId) ?? [])}, ` +
      `keys=${Object.keys(data).join(',')}`;
    console.log(preLog);
    await appendFirebaseDebug(preLog).catch(() => {});

    await setDoc(doc(db!,'users', uid), data, { merge: true });

    const doneLog = `[UpdateUserSettings] 완료 — uid=${uid}, keys=${Object.keys(data).join(',')}`;
    console.log(doneLog);
    await appendFirebaseDebug(doneLog).catch(() => {});
  } catch (e: any) {
    const errLog = `[UpdateUserSettings] 실패 — uid=${uid}, err=${e?.code ?? ''} ${e?.message ?? e}`;
    console.warn(errLog);
    await appendFirebaseDebug(errLog).catch(() => {});
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
 *  debugCollector: 호출자가 제공하면 모든 [FetchSettings] 로그를 in-memory 배열로 수집
 *  (AsyncStorage 키 race/Alert 잘림 우회). 미제공 시 레거시 appendFirebaseDebug 경로.
 */
export async function fetchUserSettings(
  debugCollector?: (line: string) => void,
): Promise<Record<string, any> | null> {
  const pushLog = (line: string) => {
    console.log(line);
    if (debugCollector) debugCollector(line);
    else void appendFirebaseDebug(line).catch(() => {});
  };

  const uid = getCurrentUid();
  const dbOk = !!db;
  const projectId = (db as any)?._databaseId?.projectId
    ?? (app as any)?.options?.projectId
    ?? '(unknown)';
  const databaseId = (db as any)?._databaseId?.database ?? '(default)';

  pushLog(
    `[FetchSettings] uid=${uid ?? 'null'}, db=${dbOk ? 'ok' : 'null'}, ` +
    `project=${projectId}, database=${databaseId}`,
  );

  if (!uid || !db) {
    pushLog('[FetchSettings] ABORT — uid 또는 db 없음');
    return null;
  }

  try {
    const snap = await getDocFromServer(doc(db!, 'users', uid));
    pushLog(
      `[FetchSettings] snap.exists=${snap.exists()}, fromCache=${snap.metadata.fromCache}, hasPendingWrites=${snap.metadata.hasPendingWrites}`,
    );

    if (snap.exists()) {
      const data = snap.data();
      const keys = Object.keys(data).sort();
      pushLog(`[FetchSettings] keys(${keys.length}): ${keys.join(',')}`);
      // children/parentInfo 값 유무 축약
      pushLog(
        `[FetchSettings] detail: children=${Array.isArray(data.children) ? 'array[' + data.children.length + ']' : typeof data.children}, ` +
        `parentInfo=${data.parentInfo && typeof data.parentInfo === 'object' ? 'obj(' + Object.keys(data.parentInfo).length + 'keys)' : typeof data.parentInfo}, ` +
        `babyName=${data.babyName ?? '(none)'}`,
      );
      // snap.data() raw JSON 덤프 — Object.keys vs 실제 직렬화 불일치 여부까지 잡기 위함
      try {
        const raw = JSON.stringify(data);
        pushLog(
          `[FetchSettings] raw(${raw.length}chars): ` +
          `${raw.slice(0, 2000)}${raw.length > 2000 ? '…(truncated)' : ''}`,
        );
      } catch (jsonErr: any) {
        pushLog(`[FetchSettings] raw JSON 실패: ${jsonErr?.message ?? jsonErr}`);
      }
      return data;
    }

    pushLog('[FetchSettings] 문서 없음 (exists=false)');
    return null;
  } catch (e: any) {
    console.warn('[Firebase] 유저 설정 조회 실패:', e);
    pushLog(`[FetchSettings] 오류: code=${e?.code ?? '(none)'}, message=${e?.message ?? String(e)}`);
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

// ─── Category Best (Baby) ─── cron이 적재한 카테고리 베스트셀러 read

export interface BabyBestProduct {
  productId: string;
  productName: string;
  productPrice: number;
  productImage: string;
  productUrl: string;
  isRocket: boolean;
}

/**
 * BabyCategory → category_best_baby/{slug} 1회 read.
 * cron(scripts/baby-category-best-updater)이 적재한 베스트셀러 목록 반환.
 *
 * 성별 필터링: 의류/신발/장난감 등 한정. productName 키워드로 휴리스틱 매칭.
 * 결과 부족하면 호출자가 fetchPopularByCategory로 보충 가능.
 *
 * 미적재 카테고리(예: '기타') 또는 cron 미실행 상태 → 빈 배열 반환.
 */
export async function fetchBabyCategoryBest(
  category: BabyCategory,
  count: number = 10,
  gender?: 'male' | 'female' | 'unknown',
  months: number | null = null,
): Promise<BabyBestProduct[]> {
  if (!db) return [];

  const slug = getCategorySlug(category, months);
  if (!slug) return [];

  try {
    const snap = await getDoc(doc(db!, 'category_best_baby', slug));
    if (!snap.exists()) return [];

    const data = snap.data() as CategoryBestBaby;
    let products = Array.isArray(data.products) ? [...data.products] : [];

    // 성별 필터링 — 의류/신발/장난감만 적용 (다른 카테고리는 노op)
    const genderFilterable = ['의류', '신발', '장난감'].includes(category);
    if (genderFilterable && gender && gender !== 'unknown') {
      const opposite = gender === 'male'
        ? /(여아|걸|girl|공주|핑크|레이스|치마|드레스)/i
        : /(남아|보이|boy|왕자|블루|네이비|로봇|공룡|자동차)/i;
      products = products.filter((p) => !opposite.test(p.productName));
    }

    return products.slice(0, count).map((p) => ({
      productId: String(p.productId),
      productName: p.productName,
      productPrice: Number(p.productPrice) || 0,
      productImage: p.productImage,
      productUrl: p.productUrl,
      isRocket: !!p.isRocket,
    }));
  } catch (e) {
    console.warn('[Firebase] category_best_baby 조회 실패:', e);
    return [];
  }
}

// ─── 이벤트 베스트 (cron 적재) ───

export interface EventBestProduct {
  productId: string;
  productName: string;
  productPrice: number;
  productImage: string;
  productUrl: string;
  isRocket: boolean;
}

/**
 * event_best/{eventSlug} 1회 read.
 * cron(scripts/event-best-updater)이 minPrice=50,000 필터로 적재.
 * 미적재 또는 미존재 슬러그 → 빈 배열.
 */
export async function fetchEventBest(
  eventSlug: string,
  count: number = 10,
): Promise<EventBestProduct[]> {
  if (!db) return [];
  if (!eventSlug) return [];

  try {
    const snap = await getDoc(doc(db!, 'event_best', eventSlug));
    if (!snap.exists()) return [];

    const data = snap.data() as any;
    const products = Array.isArray(data?.products) ? data.products : [];
    return products.slice(0, count).map((p: any) => ({
      productId: String(p.productId),
      productName: p.productName,
      productPrice: Number(p.productPrice) || 0,
      productImage: p.productImage,
      productUrl: p.productUrl,
      isRocket: !!p.isRocket,
    }));
  } catch (e) {
    console.warn('[Firebase] event_best 조회 실패:', e);
    return [];
  }
}

// ─── 오늘의 육아템 (가격 하락 + 카테고리 베스트 fallback) ───

export interface BabyPriceDrop {
  productId: string;
  productName: string;
  thumbnail: string;
  prevPrice: number;
  currentPrice: number;
  dropRate: number; // 음수 %
  trackerCount: number;
}

/**
 * shared_products에서 가격 하락 상품 추출 (price_drops 컬렉션 미이식 대안).
 *
 * Firestore는 필드 간 비교 쿼리 불가 → lastCheckedAt desc 정렬로 최근 체크된 상품
 * 가져온 뒤 클라이언트에서 currentPrice < previousPrice 필터 + dropRate 정렬.
 *
 * 호출 비용: scanLimit read 1회 (기본 100건). previousPrice=0 이거나 currentPrice 동일/상승 항목은 클라 필터로 제거.
 */
export async function fetchSharedPriceDrops(
  maxItems: number = 20,
  scanLimit: number = 100,
  gender?: 'male' | 'female' | 'unknown',
): Promise<BabyPriceDrop[]> {
  if (!db) return [];

  try {
    const q = query(
      collection(db!, 'shared_products'),
      orderBy('lastCheckedAt', 'desc'),
      firestoreLimit(scanLimit),
    );
    const snapshot = await getDocs(q);
    const all = snapshot.docs.map((d) => d.data() as SharedProduct);

    const drops: BabyPriceDrop[] = [];
    for (const p of all) {
      const prev = Number(p.previousPrice) || 0;
      const curr = Number(p.currentPrice) || 0;
      if (prev <= 0 || curr <= 0 || curr >= prev) continue;
      if (gender && gender !== 'unknown' && p.gender && p.gender !== 'both' && p.gender !== gender) continue;
      const dropRate = ((curr - prev) / prev) * 100;
      drops.push({
        productId: String(p.productId),
        productName: p.productName,
        thumbnail: p.thumbnail || '',
        prevPrice: prev,
        currentPrice: curr,
        dropRate,
        trackerCount: Number(p.trackerCount) || 0,
      });
    }

    drops.sort((a, b) => a.dropRate - b.dropRate);
    return drops.slice(0, maxItems);
  } catch (e) {
    console.warn('[Firebase] shared_products 가격 하락 조회 실패:', e);
    return [];
  }
}

/**
 * fallback 풀 구성용: 여러 BabyCategory 슬러그 병렬 read (category_best_baby).
 * 월령/성별 적용된 카테고리 목록 받아 perCategory개씩 합산.
 */
export async function fetchBabyCategoryBestPool(
  categories: BabyCategory[],
  perCategory: number = 5,
  gender?: 'male' | 'female' | 'unknown',
  months: number | null = null,
): Promise<BabyBestProduct[]> {
  if (!db || categories.length === 0) return [];

  const results = await Promise.all(
    categories.map((cat) => fetchBabyCategoryBest(cat, perCategory, gender, months)),
  );
  const seen = new Set<string>();
  const pool: BabyBestProduct[] = [];
  for (const arr of results) {
    for (const p of arr) {
      if (seen.has(p.productId)) continue;
      seen.add(p.productId);
      pool.push(p);
    }
  }
  return pool;
}

// ─── 앱 메타 설정 (업데이트 안내용) ───

export interface AppConfigDoc {
  minRequiredVersion?: string;
  latestVersion?: string;
  forceUpdate?: boolean;
  releaseNotes?: string;
  updateMessage?: string; // 운영자 커스텀 안내문구 — 있으면 releaseNotes/기본문구보다 우선 표시
  updatedAt?: number;
}

/**
 * meta/config_{appKey} 문서 1회 read.
 * Firestore Rules: meta/{docId} read public — 인증 전에도 호출 가능.
 * 미존재 / 네트워크 실패 시 null.
 */
export async function fetchAppConfig(
  appKey: string,
): Promise<AppConfigDoc | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db!, 'meta', `config_${appKey}`));
    if (!snap.exists()) return null;
    return snap.data() as AppConfigDoc;
  } catch (e) {
    console.warn('[Firebase] meta/config 조회 실패:', e);
    return null;
  }
}

// ─── 계정 삭제 ───

export type DeleteAccountErrorCode =
  | 'not_configured'
  | 'no_user'
  | 'reauth_cancelled'
  | 'reauth_failed'
  | 'network'
  | 'unknown';

export interface DeleteAccountResult {
  success: boolean;
  errorCode?: DeleteAccountErrorCode;
  errorMessage?: string;
}

/** users/{uid} 하위 서브컬렉션을 모두 삭제 (현재는 items 컬렉션만 존재) */
async function deleteUserSubcollections(uid: string): Promise<void> {
  if (!db) return;
  const subcollections = ['items'] as const;
  for (const name of subcollections) {
    const snap = await getDocs(collection(db!, 'users', uid, name));
    if (snap.empty) continue;
    const batch = writeBatch(db!);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/**
 * 계정 삭제
 * 1. (구글/Apple 계정인 경우) reauthenticateWithCredential로 재인증
 * 2. Firestore users/{uid} 하위 컬렉션 삭제 (items 등)
 * 3. Firestore users/{uid} 문서 삭제
 * 4. Firebase Auth 계정 삭제 (deleteUser)
 * 5. 외부 세션 로그아웃 (호출자 측)
 */
export async function deleteAccount(
  googleIdToken?: string,
  appleCredential?: { identityToken: string; rawNonce: string },
): Promise<DeleteAccountResult> {
  if (!auth || !db) {
    return { success: false, errorCode: 'not_configured', errorMessage: 'Firebase 미초기화' };
  }

  const user = auth.currentUser;
  if (!user) {
    return { success: false, errorCode: 'no_user', errorMessage: '로그인된 계정이 없습니다.' };
  }

  const uid = user.uid;
  const isGoogle = user.providerData.some((p) => p.providerId === 'google.com');
  const isApple = user.providerData.some((p) => p.providerId === 'apple.com');

  try {
    // 1. 외부 계정이면 재인증 (최근 로그인 요구 대응)
    if (isGoogle) {
      if (!googleIdToken) {
        return { success: false, errorCode: 'reauth_cancelled', errorMessage: '재인증이 필요합니다.' };
      }
      try {
        const credential = GoogleAuthProvider.credential(googleIdToken);
        await reauthenticateWithCredential(user, credential);
      } catch (e: any) {
        console.warn('[DeleteAccount] 재인증 실패:', e);
        return { success: false, errorCode: 'reauth_failed', errorMessage: e?.message ?? '재인증 실패' };
      }
    } else if (isApple) {
      if (!appleCredential) {
        return { success: false, errorCode: 'reauth_cancelled', errorMessage: '재인증이 필요합니다.' };
      }
      try {
        const provider = new OAuthProvider('apple.com');
        const credential = provider.credential({
          idToken: appleCredential.identityToken,
          rawNonce: appleCredential.rawNonce,
        });
        await reauthenticateWithCredential(user, credential);
      } catch (e: any) {
        console.warn('[DeleteAccount] Apple 재인증 실패:', e);
        return { success: false, errorCode: 'reauth_failed', errorMessage: e?.message ?? '재인증 실패' };
      }
    }

    // 2. 하위 컬렉션 삭제
    await deleteUserSubcollections(uid);

    // 3. users/{uid} 문서 삭제
    await deleteDoc(doc(db!, 'users', uid)).catch((e) => {
      console.warn('[DeleteAccount] users 문서 삭제 실패(무시):', e);
    });

    // 4. Auth 계정 삭제
    await deleteUser(user);

    // 5. 혹시 남아있을 세션 로그아웃
    await firebaseSignOut(auth).catch(() => {});

    return { success: true };
  } catch (e: any) {
    const code = e?.code ?? '';
    if (code === 'auth/network-request-failed') {
      return { success: false, errorCode: 'network', errorMessage: '네트워크 연결을 확인해주세요.' };
    }
    if (code === 'auth/requires-recent-login') {
      return { success: false, errorCode: 'reauth_failed', errorMessage: '재로그인이 필요합니다.' };
    }
    console.warn('[DeleteAccount] 실패:', e);
    return { success: false, errorCode: 'unknown', errorMessage: e?.message ?? '알 수 없는 오류' };
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
