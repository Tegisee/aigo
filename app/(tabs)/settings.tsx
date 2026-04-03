import { useState } from 'react';
import { View, Text, TextInput, Switch, TouchableOpacity, Alert, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { useAppStore } from '../../store/useAppStore';

const appVersion = Constants.expoConfig?.version ?? '1.0.0';

export default function SettingsScreen() {
  const router = useRouter();
  const { isWowMember, toggleWowMember, notificationEnabled, toggleNotification, repurchaseNotificationEnabled, toggleRepurchaseNotification, babyBirthDate, setBabyBirthDate, resetAllData } = useAppStore();
  const [showBirthModal, setShowBirthModal] = useState(false);
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');

  const babyAgeText = babyBirthDate ? (() => {
    const birth = new Date(babyBirthDate);
    const now = new Date();
    const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (months < 1) return '신생아';
    if (months < 24) return `${months}개월`;
    return `${Math.floor(months / 12)}세 ${months % 12}개월`;
  })() : null;

  const handleReset = () => {
    Alert.alert(
      '전체 데이터 초기화',
      '등록된 모든 상품과 설정이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '초기화',
          style: 'destructive',
          onPress: () => {
            resetAllData();
            Alert.alert('완료', '모든 데이터가 초기화되었습니다.');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>설정</Text>

      <Text style={styles.sectionTitle}>알림</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="notifications-outline" size={20} color={theme.primary} />
            <View style={styles.rowText}>
              <Text style={styles.label}>가격 알림</Text>
              <Text style={styles.desc}>가격 하락 시 푸시 알림 받기</Text>
            </View>
          </View>
          <Switch
            value={notificationEnabled}
            onValueChange={toggleNotification}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="repeat-outline" size={20} color={theme.primary} />
            <View style={styles.rowText}>
              <Text style={styles.label}>재구매 알림</Text>
              <Text style={styles.desc}>소모품 재구매 주기 알림 받기</Text>
            </View>
          </View>
          <Switch
            value={repurchaseNotificationEnabled}
            onValueChange={toggleRepurchaseNotification}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>아이 정보</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => {
            if (babyBirthDate) {
              const [y, m] = babyBirthDate.split('-');
              setBirthYear(y);
              setBirthMonth(String(parseInt(m)));
            } else {
              setBirthYear('');
              setBirthMonth('');
            }
            setShowBirthModal(true);
          }}
          activeOpacity={0.6}
        >
          <View style={styles.rowLeft}>
            <Ionicons name="happy-outline" size={20} color={theme.primary} />
            <View style={styles.rowText}>
              <Text style={styles.label}>아이 생년월</Text>
              <Text style={styles.desc}>{babyAgeText || '설정하면 나이별 추천을 받을 수 있어요'}</Text>
            </View>
          </View>
          <Text style={styles.versionText}>{babyBirthDate ? `${babyBirthDate.slice(0, 7)}` : '미설정'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>일반</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="star-outline" size={20} color={theme.primary} />
            <View style={styles.rowText}>
              <Text style={styles.label}>와우 회원</Text>
              <Text style={styles.desc}>와우 회원가로 목표가 비교</Text>
            </View>
          </View>
          <Switch
            value={isWowMember}
            onValueChange={toggleWowMember}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>정보</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('/modal/privacy')}
          activeOpacity={0.6}
        >
          <View style={styles.rowLeft}>
            <Ionicons name="document-text-outline" size={20} color={theme.subtext} />
            <Text style={styles.label}>개인정보처리방침</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="information-circle-outline" size={20} color={theme.subtext} />
            <Text style={styles.label}>버전</Text>
          </View>
          <Text style={styles.versionText}>{appVersion}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>데이터</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.row}
          onPress={handleReset}
          activeOpacity={0.6}
        >
          <View style={styles.rowLeft}>
            <Ionicons name="trash-outline" size={20} color="#FF4444" />
            <View style={styles.rowText}>
              <Text style={[styles.label, { color: '#FF4444' }]}>전체 데이터 초기화</Text>
              <Text style={styles.desc}>모든 상품 및 설정 삭제</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
        </TouchableOpacity>
      </View>

      <Text style={styles.affiliate}>
        이 앱은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </Text>

      {/* 생년월일 수정 모달 */}
      <Modal visible={showBirthModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>아이 생년월 설정</Text>
            <View style={styles.birthRow}>
              <TextInput
                style={styles.birthInput}
                placeholder="2024"
                placeholderTextColor={theme.subtext}
                value={birthYear}
                onChangeText={(t) => setBirthYear(t.replace(/[^0-9]/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
              />
              <Text style={styles.birthLabel}>년</Text>
              <TextInput
                style={[styles.birthInput, { width: 60 }]}
                placeholder="1"
                placeholderTextColor={theme.subtext}
                value={birthMonth}
                onChangeText={(t) => {
                  const num = t.replace(/[^0-9]/g, '');
                  if (num === '' || (parseInt(num) >= 1 && parseInt(num) <= 12)) setBirthMonth(num);
                }}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.birthLabel}>월</Text>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowBirthModal(false)}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              {babyBirthDate && (
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => { setBabyBirthDate(null); setShowBirthModal(false); }}
                >
                  <Text style={[styles.modalCancelText, { color: theme.danger }]}>삭제</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => {
                  if (birthYear.length === 4 && birthMonth) {
                    setBabyBirthDate(`${birthYear}-${birthMonth.padStart(2, '0')}-01`);
                  }
                  setShowBirthModal(false);
                }}
              >
                <Text style={styles.modalConfirmText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.text,
    paddingTop: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.subtext,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 24,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    gap: 2,
  },
  label: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '500',
  },
  desc: {
    fontSize: 13,
    color: theme.subtext,
  },
  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginHorizontal: 16,
  },
  versionText: {
    fontSize: 15,
    color: theme.subtext,
  },
  affiliate: {
    fontSize: 11,
    color: theme.subtext,
    textAlign: 'center',
    lineHeight: 16,
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 24,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 16,
  },
  birthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 20,
  },
  birthInput: {
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    width: 90,
    textAlign: 'center',
  },
  birthLabel: {
    fontSize: 15,
    color: theme.text,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  modalCancelText: {
    color: theme.subtext,
    fontSize: 15,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.primary,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
