import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAppConfig } from './firebase';

/**
 * 업데이트 안내 체크 (재사용 가능 — 지금이야와 동일 인터페이스).
 *
 * Firestore 문서:
 *   meta/config_{appKey} {
 *     minRequiredVersion: string,    // 이 버전 미만이면 알림
 *     latestVersion?: string,
 *     forceUpdate?: boolean,         // true면 "나중에" 버튼 없음
 *     releaseNotes?: string,
 *     updatedAt: number
 *   }
 *
 * Firestore Rules: meta/{docId} read public (인증 전 체크).
 */

export interface UpdateCheckConfig {
  /** 'aigo' | 'jigumiya' — meta/config_{appKey} 매핑 */
  appKey: string;
  /** Constants.expoConfig?.version 등에서 추출한 현재 버전 */
  currentVersion: string;
  /** Android 패키지명 (예: 'com.aigo.app') — Play Store 이동용 */
  androidPackageName: string;
  /** iOS App Store ID — 미정 시 undefined (fallback URL 사용) */
  iosAppStoreId?: string;
}

export interface UpdateCheckResult {
  needsUpdate: boolean;
  forceUpdate: boolean;
  currentVersion: string;
  minRequiredVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  storeUrl: string;
}

const SNOOZE_KEY_PREFIX = 'aigo-update-snoozed-';

/** semver 단순 비교 — a < b: -1, a == b: 0, a > b: 1 */
function compareVersions(a: string, b: string): number {
  const ap = a.split('.').map((n) => Number(n) || 0);
  const bp = b.split('.').map((n) => Number(n) || 0);
  const len = Math.max(ap.length, bp.length);
  for (let i = 0; i < len; i++) {
    const ax = ap[i] ?? 0;
    const bx = bp[i] ?? 0;
    if (ax < bx) return -1;
    if (ax > bx) return 1;
  }
  return 0;
}

function getStoreUrl(config: UpdateCheckConfig): string {
  if (Platform.OS === 'android') {
    return `market://details?id=${config.androidPackageName}`;
  }
  if (Platform.OS === 'ios') {
    if (config.iosAppStoreId) {
      return `itms-apps://apps.apple.com/app/id${config.iosAppStoreId}`;
    }
    // TODO: App Store ID 등록 후 호출자가 iosAppStoreId 채울 것
    return 'https://apps.apple.com/kr/';
  }
  return '';
}

/**
 * 버전 체크 + snooze 정책 적용.
 * - null 반환 = 업데이트 불필요 또는 정책 미설정 또는 snooze 적용
 * - UpdateCheckResult 반환 = 알림 표시 필요
 */
export async function checkAppVersion(
  config: UpdateCheckConfig,
): Promise<UpdateCheckResult | null> {
  const data = await fetchAppConfig(config.appKey);
  if (!data) return null;

  const minRequiredVersion = data.minRequiredVersion;
  const latestVersion = data.latestVersion;
  const forceUpdate = !!data.forceUpdate;
  const releaseNotes = data.releaseNotes;

  if (!minRequiredVersion) return null;

  const needsUpdate =
    compareVersions(config.currentVersion, minRequiredVersion) < 0;
  if (!needsUpdate) return null;

  // forceUpdate=false 일 때만 snooze 정책 적용.
  // snoozed 버전이 minRequiredVersion 이상이면 "나중에" 누른 사용자 → skip.
  // minRequiredVersion 이 더 올라가면 snooze 무효 → 다시 표시.
  if (!forceUpdate) {
    try {
      const snoozed = await AsyncStorage.getItem(
        SNOOZE_KEY_PREFIX + config.appKey,
      );
      if (snoozed && compareVersions(snoozed, minRequiredVersion) >= 0) {
        return null;
      }
    } catch {}
  }

  return {
    needsUpdate: true,
    forceUpdate,
    currentVersion: config.currentVersion,
    minRequiredVersion,
    latestVersion,
    releaseNotes,
    storeUrl: getStoreUrl(config),
  };
}

/** "나중에" 버튼 처리 — minRequiredVersion 을 AsyncStorage에 저장. */
export async function snoozeUpdate(
  appKey: string,
  minRequiredVersion: string,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      SNOOZE_KEY_PREFIX + appKey,
      minRequiredVersion,
    );
  } catch {}
}
