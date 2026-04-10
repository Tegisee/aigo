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
import { signInAnonymously, syncLocalToFirestore } from '../services/firebase';
import {
  registerForPushNotifications,
  getItemIdFromNotification,
} from '../services/notifications';
import { useAppStore } from '../store/useAppStore';
import OnboardingScreen from '../components/OnboardingScreen';

const INSTALL_MARKER_KEY = 'aigo-install-marker';

/** 재설치 감지: SecureStore 마커가 없으면 AsyncStorage를 초기화하여 온보딩 재표시 */
async function checkFreshInstall() {
  try {
    const marker = await SecureStore.getItemAsync(INSTALL_MARKER_KEY);
    if (!marker) {
      // SecureStore에 마커 없음 = 신규 설치 또는 재설치
      console.log('[Install] 신규/재설치 감지 — AsyncStorage 초기화');
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        if (allKeys.length > 0) {
          await AsyncStorage.multiRemove(allKeys);
        }
      } catch {
        await AsyncStorage.removeItem('aigo-storage');
      }
      // Zustand 상태도 리셋 (persist에서 복원된 값 덮어쓰기)
      useAppStore.setState({ hasSeenOnboarding: false });
      // 마커 저장
      await SecureStore.setItemAsync(INSTALL_MARKER_KEY, new Date().toISOString());
    }
  } catch (e) {
    console.warn('[Install] 설치 확인 실패:', e);
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

  // 재설치 감지 (최초 1회)
  useEffect(() => {
    checkFreshInstall().finally(() => setInstallChecked(true));
  }, []);

  useEffect(() => {
    if (!installChecked) return;
    migrateStorageKey();
    initCoupangApi();

    (async () => {
      await signInAnonymously();
      await registerForPushNotifications();
      // 로컬 데이터 Firestore 초기 동기화
      const { trackedItems } = useAppStore.getState();
      if (trackedItems.length > 0) {
        syncLocalToFirestore(trackedItems);
      }
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
