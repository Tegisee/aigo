import { useEffect, useRef, useState } from 'react';
import { Platform, InteractionManager, Alert, Linking } from 'react-native';
import Constants from 'expo-constants';
import { Slot, Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { theme } from '../constants/theme';
import { initCoupangApi } from '../services/config';
import { syncLocalToFirestore, subscribeAuthState, getInitialAuthUser, callResolveAffiliate } from '../services/firebase';
import { backfillSettingsToFirestore, appendRestoreDebugLine } from '../services/restore';
import { checkAppVersion, snoozeUpdate, type UpdateCheckResult } from '../services/updateCheck';
import {
  registerForPushNotifications,
  routeFromNotification,
} from '../services/notifications';
import { useAppStore } from '../store/useAppStore';
import OnboardingScreen from '../components/OnboardingScreen';

const INSTALL_MARKER_KEY = 'aigo-install-marker';

/** Alert.alert 로 업데이트 안내 표시. forceUpdate=true 면 "나중에" 버튼 없음. */
function showUpdateAlert(r: UpdateCheckResult) {
  const versionLine = r.latestVersion
    ? `현재 버전: ${r.currentVersion}\n최신 버전: ${r.latestVersion}`
    : `현재 버전: ${r.currentVersion}\n필요 버전: ${r.minRequiredVersion}`;
  const message = r.releaseNotes
    ? `${versionLine}\n\n${r.releaseNotes}`
    : `${versionLine}\n\n더 나은 사용 경험을 위해 최신 버전으로 업데이트해주세요.`;

  const updateBtn = {
    text: '업데이트',
    onPress: () => {
      Linking.openURL(r.storeUrl).catch((e) => {
        console.warn('[Update] 스토어 열기 실패:', e);
        Alert.alert('오류', '스토어를 열 수 없습니다. 직접 검색해주세요.');
      });
    },
  };

  if (r.forceUpdate) {
    Alert.alert('업데이트 필요', message, [updateBtn], { cancelable: false });
    return;
  }

  Alert.alert(
    '업데이트 안내',
    message,
    [
      {
        text: '나중에',
        style: 'cancel',
        onPress: () => {
          snoozeUpdate('aigo', r.minRequiredVersion).catch(() => {});
        },
      },
      updateBtn,
    ],
    { cancelable: true },
  );
}

/** Zustand persist rehydration 완료 대기 */
function waitForHydration(): Promise<void> {
  if (useAppStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useAppStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

/** 전체 로컬 데이터 초기화 (재설치 시) */
async function clearLocalData() {
  // 1. AsyncStorage 전체 삭제 (Firebase Auth persistence 키는 보존)
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const keysToRemove = allKeys.filter(
      (key) => !key.startsWith('firebase:authUser:'),
    );
    if (keysToRemove.length > 0) await AsyncStorage.multiRemove(keysToRemove);
    console.log('[Install] AsyncStorage 초기화 — 삭제:', keysToRemove.length, '보존(Auth):', allKeys.length - keysToRemove.length);
  } catch {
    await AsyncStorage.removeItem('aigo-storage').catch(() => {});
  }
  // 2. Zustand 인메모리 상태 초기화
  useAppStore.setState({
    hasSeenOnboarding: false,
    children: [],
    selectedChildId: null,
    babyName: '',
    babyGender: 'unknown',
    babyBirthDate: null,
    parentInfo: {},
    trackedItems: [],
    vaccinationRecords: {},
    checkupRecords: {},
    vaccinationHospitals: {},
    checkupHospitals: {},
    isLinked: false,
    linkedProvider: null,
    isWowMember: false,
    notificationEnabled: true,
    repurchaseNotificationEnabled: true,
  });
}

/**
 * 재설치 감지 로직
 *
 * 핵심 원리:
 * - Android auto-backup이 AsyncStorage(SharedPreferences)를 복원하지만
 *   Keystore 키는 복원하지 않으므로 SecureStore 읽기가 실패하거나 null 반환
 * - SecureStore 읽기 실패 + hasSeenOnboarding=true → 재설치 확정
 * - 반드시 Zustand rehydration 완료 후 판단해야 올바른 상태를 확인 가능
 */
async function checkFreshInstall() {
  appendRestoreDebugLine('[Install] checkFreshInstall 시작');

  // 1. Zustand persist가 AsyncStorage에서 복원 완료될 때까지 대기
  await waitForHydration();
  appendRestoreDebugLine('[Install] hydration 완료');

  const state = useAppStore.getState();
  let markerValid = false;
  let markerValue: string | null = null;

  // 2. SecureStore 마커 확인
  try {
    markerValue = await SecureStore.getItemAsync(INSTALL_MARKER_KEY);
    markerValid = !!markerValue;
  } catch (e: any) {
    console.log('[Install] SecureStore 읽기 실패 — Keystore 키 소실:', e?.message);
    appendRestoreDebugLine(`[Install] SecureStore 읽기 실패: ${e?.message ?? e}`);
    markerValid = false;
  }

  // 2-1. 각 조건값 명시 로깅 (회귀 진단용)
  const hasSeenOnboarding = state.hasSeenOnboarding;
  const shouldReset = !markerValid && hasSeenOnboarding;
  const conditionLog = `markerValid=${markerValid}${
    markerValue ? `(${markerValue.slice(0, 19)})` : ''
  }, hasSeenOnboarding=${hasSeenOnboarding}, → reset=${shouldReset}`;
  console.log('[Install] 조건:', conditionLog);
  appendRestoreDebugLine(`[Install] ${conditionLog}`);

  // 3. 판단: 마커 없음 + 온보딩 완료 상태 = 백업 데이터가 복원된 재설치
  if (shouldReset) {
    console.log('[Install] 재설치 감지 — 백업 데이터 초기화');
    appendRestoreDebugLine('[Install] 재설치 감지 — clearLocalData 호출');
    await clearLocalData();
    appendRestoreDebugLine('[Install] clearLocalData 완료');
  } else {
    appendRestoreDebugLine('[Install] 재설치 아님 — 초기화 스킵');
  }

  // 4. 마커 (재)저장
  try {
    await SecureStore.setItemAsync(INSTALL_MARKER_KEY, new Date().toISOString());
    appendRestoreDebugLine('[Install] SecureStore 마커 저장 완료');
  } catch (e: any) {
    console.warn('[Install] SecureStore 마커 저장 실패:', e);
    appendRestoreDebugLine(`[Install] ❌ 마커 저장 실패: ${e?.message ?? e}`);
  }

  // 5. auth 초기 세션 확정 대기 후 방어 리셋
  // Android 12+ device-to-device transfer / Play "Restore on Install" 등으로
  // allowBackup:false를 우회해 AsyncStorage(hasSeenOnboarding 포함)가 복원되더라도
  // firebase:authUser:*는 함께 오지 않는 경우가 있음 → "온보딩 완료자인데 세션 없음"
  // 상태에서 holme 렌더 시 유저가 갇힘. OnboardingScreen으로 재진입 유도.
  try {
    const initial = await getInitialAuthUser();
    const authLog = `[Install] 초기 auth — uid=${initial?.uid ?? 'null'}, anon=${initial?.isAnonymous ?? 'n/a'}, providers=${JSON.stringify(initial?.providers ?? [])}`;
    console.log(authLog);
    appendRestoreDebugLine(authLog);

    if (!initial && useAppStore.getState().hasSeenOnboarding) {
      console.log('[Install] 세션 없음 + hasSeenOnboarding=true → 강제 리셋');
      appendRestoreDebugLine('[Install] 세션 없음 + hasSeenOnboarding=true → 강제 리셋 (leak 방어)');
      useAppStore.setState({ hasSeenOnboarding: false });
    }
  } catch (e: any) {
    console.warn('[Install] 초기 auth 확인 실패:', e);
    appendRestoreDebugLine(`[Install] 초기 auth 확인 실패: ${e?.message ?? e}`);
  }
}

/** 지금이야 fork 잔재 AsyncStorage 키 마이그레이션 */
async function migrateStorageKey() {
  try {
    const oldData = await AsyncStorage.getItem('jonber-alimi-storage');
    if (oldData) {
      const newData = await AsyncStorage.getItem('aigo-storage');
      if (!newData) {
        await AsyncStorage.setItem('aigo-storage', oldData);
        console.log('[Migration] jonber-alimi-storage → aigo-storage 완료');
      }
      await AsyncStorage.removeItem('jonber-alimi-storage');
    }
  } catch (e) {
    console.warn('[Migration] 키 마이그레이션 실패:', e);
  }
}

function extractCoupangUrl(shareIntent: any): string | null {
  const webUrl = shareIntent?.webUrl || '';
  if (webUrl.includes('coupang.com')) return webUrl;
  const text = shareIntent?.text || '';
  const urlMatch = text.match(/https?:\/\/[^\s]+coupang\.com[^\s]*/i);
  if (urlMatch) return urlMatch[0];
  const directUrl = shareIntent?.url || '';
  if (directUrl.includes('coupang.com')) return directUrl;
  return null;
}

/** Share Intent를 감지하여 add-item 모달로 라우팅 */
function ShareIntentHandler() {
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const processingRef = useRef(false);

  useEffect(() => {
    if (!hasShareIntent || processingRef.current) return;
    processingRef.current = true;

    const coupangUrl = extractCoupangUrl(shareIntent);
    const sharedText = shareIntent?.text || '';
    console.log('[ShareIntentHandler] coupangUrl:', coupangUrl);

    resetShareIntent();

    if (coupangUrl) {
      // 온보딩 완료 대기
      const { hasSeenOnboarding } = useAppStore.getState();
      const delay = Platform.OS === 'android' ? 600 : 300;
      const startDelay = hasSeenOnboarding ? delay : 2000;

      router.replace('/');
      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => {
          router.push({
            pathname: '/modal/add-item',
            params: { sharedUrl: coupangUrl, sharedText },
          });
          setTimeout(() => { processingRef.current = false; }, 1000);
        }, startDelay);
      });
    } else {
      // 비쿠팡 URL 공유 시 안내
      const sharedContent = shareIntent?.text || shareIntent?.webUrl || '';
      if (sharedContent) {
        Alert.alert(
          '지원하지 않는 링크',
          '현재 쿠팡 링크만 지원합니다.\n쿠팡 앱에서 상품을 공유해주세요.',
        );
      }
      processingRef.current = false;
    }
  }, [hasShareIntent]);

  return null;
}

export default function RootLayout() {
  const router = useRouter();
  const notifListenerRef = useRef<Notifications.EventSubscription>(null);
  const { hasSeenOnboarding, completeOnboarding } = useAppStore();

  const [installChecked, setInstallChecked] = useState(false);

  // API 키 초기화 — AsyncStorage/Zustand과 무관, 즉시 실행 (ENV-1 수정)
  useEffect(() => {
    initCoupangApi();
  }, []);

  // BUG-42: Functions 콜드 스타트 워밍업 (앱 시작 3초 후 백그라운드 더미 호출)
  // 다음 쿠팡 공유 → 상품추가 시 첫 호출 지연 제거. 실패 무시.
  useEffect(() => {
    const t = setTimeout(() => {
      callResolveAffiliate('https://www.coupang.com/vp/products/warmup').catch(() => {});
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  // 재설치 감지 (최초 1회)
  useEffect(() => {
    checkFreshInstall().finally(() => setInstallChecked(true));
  }, []);

  // 업데이트 안내 — 첫 마운트 1회만 체크 (AppState 재체크 없음)
  useEffect(() => {
    if (!installChecked) return;
    let cancelled = false;
    checkAppVersion({
      appKey: 'aigo',
      currentVersion: Constants.expoConfig?.version ?? '0.0.0',
      androidPackageName: 'com.aigo.app',
      iosAppStoreId: undefined, // TODO: App Store 등록 후 갱신
    })
      .then((r) => {
        if (cancelled || !r) return;
        showUpdateAlert(r);
      })
      .catch((e) => {
        console.warn('[Layout] 업데이트 체크 실패:', e);
      });
    return () => {
      cancelled = true;
    };
  }, [installChecked]);

  useEffect(() => {
    if (!installChecked) return;
    migrateStorageKey();

    // uid 확정 시점마다 post-signin 작업 1회 실행 — 단, **온보딩 진행 중에는 skip**.
    // 이유: Google 로그인 중 signInWithCredential 직후 이 콜백이 fire되면 restore보다 먼저
    //   savePushToken/backfill이 users/{uid}를 merge:true로 write → 관찰된 read-after-write
    //   race로 restore가 방금 쓴 필드만 읽는 증상 재현.
    //   OnboardingScreen.handleGoogleStart / handleAnonymousStart가 restore-first 순서를
    //   직접 관리하고 push 등록도 자체 호출하므로, 온보딩 동안 이 callback은 no-op.
    //   온보딩 완료 후 앱 재시작 시 세션 복원 → 이 callback fire → 정상 post-signin.
    let lastProcessedUid: string | null = null;
    const unsubAuth = subscribeAuthState(async (uid, info) => {
      if (!uid) {
        lastProcessedUid = null;
        return;
      }
      if (lastProcessedUid === uid) return;
      lastProcessedUid = uid;

      const hasSeenOnboarding = useAppStore.getState().hasSeenOnboarding;
      await appendRestoreDebugLine(
        `[Layout] auth 확정 — uid=${uid}, anon=${info?.isAnonymous}, providers=${JSON.stringify(info?.providers ?? [])}, hasSeenOnboarding=${hasSeenOnboarding}`,
      );

      // Firebase auth 상태 ↔ store.isLinked 동기화 (재설치/store 비어있는 경로 방어)
      // Firestore는 read 안 함 — providerData만 보고 결정 → 빠르고 비용 0
      const providers = info?.providers ?? [];
      const detectedProvider: 'google' | 'apple' | null =
        providers.includes('google.com') ? 'google'
        : providers.includes('apple.com') ? 'apple'
        : null;
      if (detectedProvider && !info?.isAnonymous) {
        const { isLinked: storeLinked, linkedProvider: storeProv } = useAppStore.getState();
        if (!storeLinked || storeProv !== detectedProvider) {
          useAppStore.setState({ isLinked: true, linkedProvider: detectedProvider });
          await appendRestoreDebugLine(
            `[Layout] isLinked 자동 동기화 — provider=${detectedProvider} (store stale 방어)`,
          );
        }
      }

      if (!hasSeenOnboarding) {
        await appendRestoreDebugLine(
          '[Layout] 온보딩 진행 중 — post-signin 작업 skip (OnboardingScreen이 제어)',
        );
        return;
      }

      try {
        await registerForPushNotifications();
      } catch (e) {
        console.warn('[Layout] 푸시 등록 실패:', e);
      }
      const { trackedItems } = useAppStore.getState();
      if (trackedItems.length > 0) {
        syncLocalToFirestore(trackedItems);
      }
      backfillSettingsToFirestore().catch((e) => {
        console.warn('[Layout] backfill 실패:', e);
      });
    });

    // signInAnonymously 호출 제거:
    //   - 세션이 있으면 subscribeAuthState가 자동 fire → post-signin 작업 실행
    //   - 세션이 없으면 OnboardingScreen에서 사용자 선택(handleGoogleStart/handleAnonymousStart)
    //     시에만 signIn 실행 → 익명 uid 고아 생성을 원천 차단

    // 알림 클릭 리스너 (foreground/background 모두)
    notifListenerRef.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const route = routeFromNotification(response);
        if (route) router.push(route as any);
      });

    // 앱 종료 상태에서 알림 클릭으로 열린 경우
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const route = routeFromNotification(response);
      if (route) router.push(route as any);
    });

    return () => {
      unsubAuth();
      notifListenerRef.current?.remove();
    };
  }, [installChecked]);

  return (
    <ShareIntentProvider
      options={{
        debug: true,
        resetOnBackground: true,
        onResetShareIntent: () => router.replace('/'),
      }}
    >
      <StatusBar style="dark" />
      {!hasSeenOnboarding ? (
        <OnboardingScreen onComplete={completeOnboarding} />
      ) : (
        <>
          <ShareIntentHandler />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.background },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="shareintent" options={{ headerShown: false }} />
            <Stack.Screen
              name="detail/[id]"
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="modal/add-item"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="modal/login"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
          </Stack>
        </>
      )}
    </ShareIntentProvider>
  );
}
