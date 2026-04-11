import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { savePushToken, getCurrentUid } from './firebase';

const PUSH_DEBUG_KEY = 'aigo-push-debug';

/** production에서도 확인 가능한 디버그 정보 저장 */
async function savePushDebug(info: string) {
  try {
    const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    await AsyncStorage.setItem(PUSH_DEBUG_KEY, `[${timestamp}]\n${info}`);
  } catch {}
}

/** 설정 화면에서 호출 — 푸시 토큰 등록 상태 반환 */
export async function getPushDebugInfo(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(PUSH_DEBUG_KEY)) || '디버그 정보 없음';
  } catch {
    return '읽기 실패';
  }
}

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
  const debug: string[] = [];

  // ── Step 1: 디바이스 확인 ──
  const isReal = Device.isDevice;
  debug.push(`S1: device=${isReal ? '실기기' : '에뮬레이터'}`);

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
      debug.push('S2: 채널 OK');
    }
  } catch (e: any) {
    debug.push(`S2: 채널 실패 — ${e?.message}`);
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
      debug.push(`S3: 권한 거부 (${finalStatus})`);
      await savePushDebug(debug.join('\n'));
      return null;
    }
    debug.push('S3: 권한 OK');
  } catch (e: any) {
    debug.push(`S3: 권한 오류 — ${e?.message}`);
    await savePushDebug(debug.join('\n'));
    return null;
  }

  // ── Step 4: Expo Push Token 발급 ──
  let token: string;
  try {
    const projectId = resolveProjectId();
    const source =
      Constants.expoConfig?.extra?.eas?.projectId ? 'expoConfig' :
      (Constants as any).manifest2?.extra?.eas?.projectId ? 'manifest2' :
      (Constants as any).manifest?.extra?.eas?.projectId ? 'manifest' : 'hardcoded';
    debug.push(`S4: projectId=${projectId.slice(0, 12)}... (${source})`);

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    token = tokenData.data;
    debug.push(`S4: 토큰=${token.slice(0, 25)}...`);
  } catch (e: any) {
    debug.push(`S4: 토큰 실패 — ${e?.message || e}`);
    debug.push(`  code=${e?.code}, device=${isReal}, OS=${Platform.OS}, SDK=${Platform.Version}`);
    await savePushDebug(debug.join('\n'));
    return null;
  }

  // ── Step 5: Firestore 저장 ──
  const uid = getCurrentUid();
  debug.push(`S5: uid=${uid || '(없음)'}`);

  if (uid) {
    try {
      await savePushToken(token);
      debug.push('S5: Firestore 저장 OK');
    } catch (e: any) {
      debug.push(`S5: Firestore 저장 실패 — ${e?.message}`);
    }
  } else {
    debug.push('S5: uid 없음 — 재시도 예약');
    retryTokenSave(token, 1, debug);
  }

  await savePushDebug(debug.join('\n'));
  return token;
}

/** uid가 확보될 때까지 토큰 저장 재시도 (최대 3회) */
function retryTokenSave(token: string, attempt: number, debug: string[]) {
  if (attempt > 3) {
    debug.push('S5: 재시도 3회 실패');
    savePushDebug(debug.join('\n'));
    return;
  }
  setTimeout(async () => {
    const uid = getCurrentUid();
    if (uid) {
      try {
        await savePushToken(token);
        debug.push(`S5: 재시도#${attempt} OK — uid=${uid}`);
      } catch (e: any) {
        debug.push(`S5: 재시도#${attempt} 실패 — ${e?.message}`);
      }
      await savePushDebug(debug.join('\n'));
    } else {
      debug.push(`S5: 재시도#${attempt} — uid 아직 없음`);
      retryTokenSave(token, attempt + 1, debug);
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
