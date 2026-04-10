import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { useAppStore } from '../../store/useAppStore';
import { getAuthState, linkGoogleAccount, fetchUserSettings, fetchItemsFromFirestore } from '../../services/firebase';
import { signInWithGoogle } from '../../services/googleAuth';

export default function LoginScreen() {
  const router = useRouter();
  const { isLinked, linkedProvider, setLinked } = useAppStore();
  const authState = getAuthState();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // 1. Google Sign-In으로 idToken 획득
      const googleResult = await signInWithGoogle();
      if ('error' in googleResult) {
        if (googleResult.error !== '로그인이 취소되었습니다.') {
          Alert.alert('로그인 실패', googleResult.error);
        }
        setLoading(false);
        return;
      }

      // 2. Firebase에 연동 (익명 → 구글 merge)
      const firebaseResult = await linkGoogleAccount(googleResult.idToken);
      if (firebaseResult.success) {
        setLinked('google');

        // 3. Firestore에서 기존 데이터 복원 (재설치 시)
        try {
          const [settings, items] = await Promise.all([
            fetchUserSettings(),
            fetchItemsFromFirestore(),
          ]);
          if (settings) {
            const restoreKeys = ['children', 'selectedChildId', 'babyName', 'babyGender', 'babyBirthDate', 'parentInfo', 'vaccinationRecords', 'checkupRecords', 'vaccinationHospitals', 'checkupHospitals', 'notificationEnabled', 'repurchaseNotificationEnabled', 'isWowMember'] as const;
            const restoreData: Record<string, any> = {};
            for (const key of restoreKeys) {
              if (settings[key] !== undefined) restoreData[key] = settings[key];
            }
            if (Object.keys(restoreData).length > 0) {
              useAppStore.setState(restoreData);
            }
          }
          if (items.length > 0) {
            useAppStore.setState({ trackedItems: items });
          }
          const restoredCount = items.length;
          Alert.alert('연동 완료', `${googleResult.email}\n구글 계정이 연동되었습니다.${restoredCount > 0 ? `\n관심상품 ${restoredCount}건 복원됨` : ''}`);
        } catch (e) {
          console.warn('[Login] 데이터 복원 실패:', e);
          Alert.alert('연동 완료', `${googleResult.email}\n구글 계정이 연동되었습니다.`);
        }
      } else {
        Alert.alert('연동 실패', firebaseResult.error || '다시 시도해주세요.');
      }
    } catch (e: any) {
      Alert.alert('오류', e.message || '구글 로그인 중 오류가 발생했습니다.');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Ionicons
          name={isLinked ? 'shield-checkmark' : 'shield-outline'}
          size={64}
          color={isLinked ? theme.success : theme.subtext}
        />

        <Text style={styles.title}>
          {isLinked ? '계정 연동 완료' : '계정 연동'}
        </Text>

        {isLinked ? (
          <View style={styles.linkedInfo}>
            <View style={styles.linkedRow}>
              <Ionicons name="logo-google" size={20} color="#4285F4" />
              <Text style={styles.linkedText}>
                {authState.email || '구글 계정 연동됨'}
              </Text>
            </View>
            <Text style={styles.linkedDesc}>
              기기 변경 시에도 데이터가 유지됩니다.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.desc}>
              계정을 연동하면 앱 삭제나 기기 변경 시에도{'\n'}데이터가 안전하게 보관됩니다.
            </Text>

            <View style={styles.warnCard}>
              <Ionicons name="warning-outline" size={20} color="#FF9500" />
              <Text style={styles.warnText}>
                현재 익명 사용 중입니다.{'\n'}앱 삭제 또는 기기 변경 시 모든 데이터가 초기화됩니다.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.googleBtn, loading && { opacity: 0.7 }]}
              onPress={handleGoogleLogin}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="logo-google" size={20} color="#fff" />
              )}
              <Text style={styles.googleBtnText}>
                {loading ? '연동 중...' : '구글 계정으로 연동'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.skipBtnText}>나중에 할게요</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
    marginTop: 20,
    marginBottom: 12,
  },
  desc: {
    fontSize: 15,
    color: theme.subtext,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  warnCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 32,
    width: '100%',
  },
  warnText: {
    flex: 1,
    fontSize: 13,
    color: '#FF9500',
    lineHeight: 20,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#4285F4',
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
    marginBottom: 12,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  skipBtn: {
    paddingVertical: 12,
  },
  skipBtnText: {
    fontSize: 15,
    color: theme.subtext,
  },
  linkedInfo: {
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  linkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  linkedText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.text,
  },
  linkedDesc: {
    fontSize: 14,
    color: theme.subtext,
  },
});
