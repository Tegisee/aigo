import { setCoupangApiKeys, hasCoupangApiKeys } from './coupangApi';
import { initPublicApi } from './publicApi';
import { configureGoogleSignIn } from './googleAuth';

/** 앱 시작 시 호출 — EAS Secrets에서 쿠팡 파트너스 API 키 초기화 */
export function initCoupangApi() {
  const accessKey = process.env.EXPO_PUBLIC_COUPANG_ACCESS_KEY || '';
  const secretKey = process.env.EXPO_PUBLIC_COUPANG_SECRET_KEY || '';

  console.log('[Config] 쿠팡 API 키 확인 — access:', accessKey ? `${accessKey.slice(0, 8)}...` : '(없음)', 'secret:', secretKey ? `${secretKey.slice(0, 4)}...` : '(없음)');

  if (accessKey && secretKey) {
    setCoupangApiKeys(accessKey, secretKey);
    console.log('[Config] 쿠팡 파트너스 API 키 로드 완료');
  } else {
    console.log('[Config] 쿠팡 파트너스 API 키 없음 — eas.json에 "environment": "production" 확인 필요');
  }

  // 공공데이터 API 초기화
  initPublicApi();

  // Google Sign-In 초기화
  configureGoogleSignIn();
}

export { hasCoupangApiKeys };

/** 쿠팡 API 키 상태 디버그 (설정 화면용) */
export function getCoupangApiDebug(): string {
  const accessKey = process.env.EXPO_PUBLIC_COUPANG_ACCESS_KEY || '';
  const secretKey = process.env.EXPO_PUBLIC_COUPANG_SECRET_KEY || '';
  return [
    `access: ${accessKey ? accessKey.slice(0, 12) + '...' : '(없음)'}`,
    `secret: ${secretKey ? secretKey.slice(0, 8) + '...' : '(없음)'}`,
    `hasCoupangApiKeys(): ${hasCoupangApiKeys()}`,
  ].join('\n');
}

// 스토어 링크 (출시 후 업데이트)
export const STORE_LINKS = {
  ios: '', // App Store URL
  android: 'https://play.google.com/store/apps/details?id=com.aigo.app',
};

export function getAppShareMessage(): string {
  const links = [STORE_LINKS.ios, STORE_LINKS.android].filter(Boolean);
  const linkText = links.length > 0 ? `\n\n${links.join('\n')}` : '';
  return `육아용품, 이제 제값에 사세요! 👶\n아이 월령에 맞는 상품 추천부터 최저가 알림까지\n'아이고'가 다 알려드려요.\n내 아이 것은 내가 고른다. 💪${linkText}`;
}
