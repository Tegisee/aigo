import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { savePushToken, getCurrentUid } from './firebase';

// 포그라운드에서도 알림 표시
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** EAS projectId를 여러 경로에서 탐색 */
function resolveProjectId(): string {
  // EAS production 빌드: expoConfig에 포함
  const fromConfig = Constants.expoConfig?.extra?.eas?.projectId;
  if (fromConfig) return fromConfig;

  // EAS Update / manifest2 경로
  const fromManifest2 = (Constants as any).manifest2?.extra?.eas?.projectId;
  if (fromManifest2) return fromManifest2;

  // Classic manifest 경로 (구버전 호환)
  const fromManifest = (Constants as any).manifest?.extra?.eas?.projectId;
  if (fromManifest) return fromManifest;

  // 하드코딩 fallback
  return 'caf70306-f2c6-40d7-8e12-817fa67b6477';
}

/** 푸시 알림 권한 요청 + Expo Push Token 발급 → Firestore 저장 */
export async function registerForPushNotifications(): Promise<string | null> {
  // ── Step 1: 디바이스 확인 ──
  if (!Device.isDevice) {
    console.warn('[Notifications] 실물 기기가 아님 — 에뮬레이터에서는 푸시 토큰 발급이 불안정합니다');
    // 에뮬레이터에서도 시도는 하되, 실패해도 무시
  }

  // ── Step 2: Android 알림 채널 생성 ──
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('price', {
        name: '가격 알림',
        description: '상품 가격 하락 및 목표가 도달 알림',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
      await Notifications.setNotificationChannelAsync('repurchase', {
        name: '재구매 알림',
        description: '소모품 재구매 주기 알림',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
      console.log('[Notifications] Step2: 알림 채널 생성 완료');
    }
  } catch (e) {
    console.warn('[Notifications] Step2: 알림 채널 생성 실패:', e);
  }

  // ── Step 3: 권한 요청 ──
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Step3: 알림 권한 미허용:', finalStatus);
      return null;
    }
    console.log('[Notifications] Step3: 알림 권한 허용됨');
  } catch (e) {
    console.warn('[Notifications] Step3: 권한 요청 실패:', e);
    return null;
  }

  // ── Step 4: Expo Push Token 발급 ──
  let token: string;
  try {
    const projectId = resolveProjectId();
    console.log('[Notifications] Step4: 토큰 발급 시도 — projectId:', projectId, 'source:',
      Constants.expoConfig?.extra?.eas?.projectId ? 'expoConfig' :
      (Constants as any).manifest2?.extra?.eas?.projectId ? 'manifest2' :
      (Constants as any).manifest?.extra?.eas?.projectId ? 'manifest' : 'hardcoded'
    );

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    token = tokenData.data;
    console.log('[Notifications] Step4: 토큰 발급 성공:', token?.slice(0, 30), '...');
  } catch (e: any) {
    console.error('[Notifications] Step4: 토큰 발급 실패:', e?.message || e, '— code:', e?.code);
    console.error('[Notifications] 디버그 — isDevice:', Device.isDevice, 'OS:', Platform.OS, 'SDK:', Platform.Version);
    return null;
  }

  // ── Step 5: Firestore 저장 ──
  const uid = getCurrentUid();
  console.log('[Notifications] Step5: Firestore 저장 시도 — uid:', uid || '(없음)');

  if (uid) {
    try {
      await savePushToken(token);
      console.log('[Notifications] Step5: Firestore 저장 완료');
    } catch (e) {
      console.warn('[Notifications] Step5: Firestore 저장 실패:', e);
    }
  } else {
    // signInAnonymously 이후 호출되므로 uid가 없으면 비정상
    // 최대 3회 재시도 (2초 간격)
    console.warn('[Notifications] Step5: uid 없음 — 재시도 예약');
    retryTokenSave(token, 1);
  }

  return token;
}

/** uid가 확보될 때까지 토큰 저장 재시도 (최대 3회) */
function retryTokenSave(token: string, attempt: number) {
  if (attempt > 3) {
    console.error('[Notifications] 토큰 저장 재시도 3회 실패 — uid 확보 불가');
    return;
  }
  setTimeout(async () => {
    const uid = getCurrentUid();
    if (uid) {
      try {
        await savePushToken(token);
        console.log(`[Notifications] 토큰 저장 재시도 #${attempt} 성공 — uid:`, uid);
      } catch (e) {
        console.warn(`[Notifications] 토큰 저장 재시도 #${attempt} 실패:`, e);
      }
    } else {
      console.warn(`[Notifications] 재시도 #${attempt} — uid 아직 없음`);
      retryTokenSave(token, attempt + 1);
    }
  }, 2000 * attempt);
}

/** 알림 클릭 시 itemId 추출 */
export function getItemIdFromNotification(
  response: Notifications.NotificationResponse,
): string | null {
  const data = response.notification.request.content.data;
  return (data?.itemId as string) ?? null;
}
