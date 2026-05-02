/**
 * Apple Sign In 서비스 (iOS 전용)
 * expo-apple-authentication + Firebase Auth(OAuthProvider('apple.com')) 연동
 *
 * Apple은 nonce 기반 보안 → SHA256(rawNonce)을 request에 전달, Firebase에는 rawNonce 그대로 전달
 */

import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

export type AppleSignInResult =
  | { identityToken: string; rawNonce: string; email: string | null; fullName: string | null }
  | { error: string };

/** iOS 단말 + Apple Sign In 사용 가능 여부 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** rawNonce 32자 + SHA256 해시 생성 */
async function generateNoncePair(): Promise<{ rawNonce: string; hashedNonce: string }> {
  const rawBytes = await Crypto.getRandomBytesAsync(32);
  const rawNonce = Array.from(rawBytes, (b: number) => b.toString(16).padStart(2, '0')).join('');
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );
  return { rawNonce, hashedNonce };
}

/** Apple 로그인 → identityToken + rawNonce 반환 */
export async function signInWithApple(): Promise<AppleSignInResult> {
  if (Platform.OS !== 'ios') {
    return { error: 'Apple 로그인은 iOS에서만 사용 가능합니다.' };
  }

  try {
    const { rawNonce, hashedNonce } = await generateNoncePair();

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return { error: 'Apple ID 토큰을 받지 못했습니다.' };
    }

    const fullName = credential.fullName
      ? [credential.fullName.familyName, credential.fullName.givenName]
          .filter(Boolean)
          .join(' ')
          .trim() || null
      : null;

    return {
      identityToken: credential.identityToken,
      rawNonce,
      email: credential.email ?? null,
      fullName,
    };
  } catch (error: any) {
    if (error?.code === 'ERR_REQUEST_CANCELED') {
      return { error: '로그인이 취소되었습니다.' };
    }
    console.warn('[AppleAuth] 로그인 실패:', error);
    return { error: error?.message || 'Apple 로그인에 실패했습니다.' };
  }
}

/**
 * Apple 로그아웃 — Apple은 OS 차원의 명시적 로그아웃 API가 없음.
 * Firebase signOut만 호출하면 충분 (호출자에서 처리).
 * 일관성을 위해 함수 자체는 제공하되 no-op.
 */
export async function signOutApple(): Promise<void> {
  // intentionally no-op
}
