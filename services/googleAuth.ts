/**
 * Google Sign-In 서비스
 * @react-native-google-signin/google-signin + Firebase Auth 연동
 */

import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

const WEB_CLIENT_ID = '250441543259-i9f0jqbl1g2vcbja49hja9u7epmq7vuq.apps.googleusercontent.com';

let isConfigured = false;

/** 앱 시작 시 1회 호출 */
export function configureGoogleSignIn() {
  if (isConfigured) return;
  try {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      offlineAccess: false,
    });
    isConfigured = true;
    console.log('[GoogleAuth] 설정 완료');
  } catch (e) {
    console.warn('[GoogleAuth] 설정 실패:', e);
  }
}

/** 구글 로그인 → idToken 반환 */
export async function signInWithGoogle(): Promise<{ idToken: string; email: string } | { error: string }> {
  try {
    configureGoogleSignIn();
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();

    const idToken = response.data?.idToken;
    const email = response.data?.user?.email || '';

    if (!idToken) {
      return { error: 'Google ID 토큰을 받지 못했습니다.' };
    }

    return { idToken, email };
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      return { error: '로그인이 취소되었습니다.' };
    }
    if (error.code === statusCodes.IN_PROGRESS) {
      return { error: '로그인이 이미 진행 중입니다.' };
    }
    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { error: 'Google Play 서비스를 사용할 수 없습니다.' };
    }
    console.warn('[GoogleAuth] 로그인 실패:', error);
    return { error: error.message || '구글 로그인에 실패했습니다.' };
  }
}

/** 구글 로그아웃 */
export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {}
}
