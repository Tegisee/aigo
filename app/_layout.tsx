import { useEffect, useRef, useState } from 'react';
import { Platform, InteractionManager, Alert } from 'react-native';
import { Slot, Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { theme } from '../constants/theme';
import { initCoupangApi } from '../services/config';
import { signInAnonymously, syncLocalToFirestore, updateUserSettings } from '../services/firebase';
import { backfillSettingsToFirestore, appendRestoreDebugLine } from '../services/restore';
import {
  registerForPushNotifications,
  getItemIdFromNotification,
} from '../services/notifications';
import { useAppStore } from '../store/useAppStore';
import OnboardingScreen from '../components/OnboardingScreen';

const INSTALL_MARKER_KEY = 'aigo-install-marker';

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
 * Zustand 상태에서 Firestore root 문서로 push 가능한 필드 스냅샷 생성.
 * 비어 있는 필드는 제외 — Firestore 기존 값 덮어쓰기 방지.
 */
function buildBackfillSnapshot(
  state: ReturnType<typeof useAppStore.getState>,
): Record<string, any> {
  const snapshot: Record<string, any> = {};
  if (state.children.length > 0) {
    snapshot.children = state.children;
    snapshot.selectedChildId = state.selectedChildId;
  }
  if (state.babyName) {
    snapshot.babyName = state.babyName;
    snapshot.babyGender = state.babyGender;
    snapshot.babyBirthDate = state.babyBirthDate;
  }
  if (state.parentInfo && Object.keys(state.parentInfo).length > 0) {
    snapshot.parentInfo = state.parentInfo;
  }
  if (Object.keys(state.vaccinationRecords).length > 0) {
    snapshot.vaccinationRecords = state.vaccinationRecords;
    snapshot.vaccinationHospitals = state.vaccinationHospitals;
  }
  if (Object.keys(state.checkupRecords).length > 0) {
    snapshot.checkupRecords = state.checkupRecords;
    snapshot.checkupHospitals = state.checkupHospitals;
  }
  return snapshot;
}

/**
 * 재설치 감지 로직
 *
 * 핵심 원리:
 * - Android auto-backup이 AsyncStorage(SharedPreferences)를 복원하지만
 *   Keystore 키는 복원하지 않으므로 SecureStore 읽기가 실패하거나 null 반환
 * - SecureStore 읽기 실패 + hasSeenOnboarding=true → 재설치 확정
 * - 반드시 Zustand rehydration 완료 후 판단해야 올바른 상태를 확인 가능
 * - ENV-2 대응: clearLocalData 전에 Zustand → Firestore 사전 백필
 *   (Firebase Auth persistence가 auto-backup으로 복원되면 기존 uid 복귀 가능 →
 *    Firestore에 저장 안 됐던 children/parentInfo를 이 시점에 저장하고 clear)
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

  // 2-1. 각 조건값 명시 로깅
  const hasSeenOnboarding = state.hasSeenOnboarding;
  const shouldReset = !markerValid && hasSeenOnboarding;
  const conditionLog = `markerValid=${markerValid}${
    markerValue ? `(${markerValue.slice(0, 19)})` : ''
  }, hasSeenOnboarding=${hasSeenOnboarding}, → reset=${shouldReset}`;
  console.log('[Install] 조건:', conditionLog);
  appendRestoreDebugLine(`[Install] ${conditionLog}`);

  // 3. 판단: 마커 없음 + 온보딩 완료 상태 = 백업 데이터가 복원된 재설치
  if (shouldReset) {
    console.log('[Install] 재설치 감지');
    appendRestoreDebugLine('[Install] 재설치 감지 — 사전 백필 시도');

    // 3-a. 사전 백필
    try {
      const snapshot = buildBackfillSnapshot(state);
      const snapshotKeys = Object.keys(snapshot);
      const snapshotSummary = {
        keys: snapshotKeys.join(',') || '(empty)',
        childrenLen: (snapshot.children as any[] | undefined)?.length ?? 0,
        babyName: snapshot.babyName ?? '(none)',
        parentInfoKeys: snapshot.parentInfo
          ? Object.keys(snapshot.parentInfo).length
          : 0,
        vaccineRecordsKeys: snapshot.vaccinationRecords
          ? Object.keys(snapshot.vaccinationRecords).length
          : 0,
        checkupRecordsKeys: snapshot.checkupRecords
          ? Object.keys(snapshot.checkupRecords).length
          : 0,
      };
      console.log('[Install] snapshot:', snapshotSummary);
      appendRestoreDebugLine(`[Install] snapshot: ${JSON.stringify(snapshotSummary)}`);

      if (snapshotKeys.length > 0) {
        appendRestoreDebugLine('[Install] signInAnonymously 호출');
        const uid = await signInAnonymously();
        appendRestoreDebugLine(`[Install] signInAnonymously 결과 uid=${uid ?? 'null'}`);

        if (uid) {
          appendRestoreDebugLine(`[Install] updateUserSettings 호출 (uid=${uid}, keys=${snapshotKeys.join(',')})`);
          await updateUserSettings(snapshot);
          console.log('[Install] 사전 백필 완료 — uid:', uid, 'keys:', snapshotKeys.join(','));
          appendRestoreDebugLine(`[Install] ✅ 사전 백필 완료 — Firestore push 성공`);
        } else {
          console.warn('[Install] 사전 백필 스킵 — uid 확보 실패 (Auth persistence 미복원)');
          appendRestoreDebugLine('[Install] ❌ 사전 백필 스킵 — uid 확보 실패');
        }
      } else {
        console.log('[Install] 사전 백필 불필요 — Zustand 유효 데이터 없음');
        appendRestoreDebugLine('[Install] 사전 백필 불필요 (snapshot 비어있음)');
      }
    } catch (e: any) {
      console.warn('[Install] 사전 백필 실패:', e);
      appendRestoreDebugLine(`[Install] ❌ 사전 백필 예외: ${e?.message ?? e}`);
    }

    // 3-b. 로컬 데이터 초기화
    console.log('[Install] 백업 데이터 초기화');
    appendRestoreDebugLine('[Install] clearLocalData 호출');
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

  // 재설치 감지 (최초 1회)
  useEffect(() => {
    checkFreshInstall().finally(() => setInstallChecked(true));
  }, []);

  useEffect(() => {
    if (!installChecked) return;
    migrateStorageKey();

    (async () => {
      const uid = await signInAnonymously();
      if (uid) {
        await registerForPushNotifications();
      } else {
        console.warn('[Layout] uid 확보 실패 — 푸시 토큰 등록 스킵');
      }
      // 로컬 데이터 Firestore 초기 동기화
      const { trackedItems } = useAppStore.getState();
      if (trackedItems.length > 0) {
        syncLocalToFirestore(trackedItems);
      }
      // 설정 필드 backfill — uid 타이밍 이슈로 Firestore 저장 실패한 children/parentInfo 등 복구
      backfillSettingsToFirestore().catch((e) => {
        console.warn('[Layout] backfill 실패:', e);
      });
    })();

    // 알림 클릭 리스너
    notifListenerRef.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const itemId = getItemIdFromNotification(response);
        if (itemId) {
          router.push(`/detail/${itemId}`);
        }
      });

    // 앱 종료 상태에서 알림 클릭으로 열린 경우
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const itemId = getItemIdFromNotification(response);
        if (itemId) router.push(`/detail/${itemId}`);
      }
    });

    return () => {
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
