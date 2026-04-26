import { useState } from 'react';
import { View, Text, TextInput, Switch, TouchableOpacity, Alert, Modal, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../constants/theme';
import { useAppStore, type BabyGender, type Child, type ParentInfo } from '../../store/useAppStore';
import DatePickerButton from '../../components/DatePickerButton';
import { getRestoreDebugInfo } from '../../services/restore';
import { deleteAccount, getAuthState } from '../../services/firebase';
import { signInWithGoogle, signOutGoogle } from '../../services/googleAuth';

const appVersion = Constants.expoConfig?.version ?? '1.0.0';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function SettingsScreen() {
  const router = useRouter();
  const {
    isWowMember, toggleWowMember,
    notificationEnabled, toggleNotification,
    repurchaseNotificationEnabled, toggleRepurchaseNotification,
    isLinked, linkedProvider,
    children, addChild, updateChild, removeChild, selectedChildId, selectChild,
    babyBirthDate, setBabyBirthDate, babyName,
    parentInfo, setParentInfo,
    resetAllData,
  } = useAppStore();

  // 부모 정보 모달
  const [showParentModal, setShowParentModal] = useState(false);
  const [parentField, setParentField] = useState<'mom' | 'dad' | 'anniversary'>('mom');
  const [parentDate, setParentDate] = useState('');
  const [parentIsLunar, setParentIsLunar] = useState(false);

  const openParentEdit = (field: 'mom' | 'dad' | 'anniversary') => {
    setParentField(field);
    if (field === 'mom' && parentInfo.momBirthday) {
      setParentDate(parentInfo.momBirthday.date);
      setParentIsLunar(parentInfo.momBirthday.isLunar);
    } else if (field === 'dad' && parentInfo.dadBirthday) {
      setParentDate(parentInfo.dadBirthday.date);
      setParentIsLunar(parentInfo.dadBirthday.isLunar);
    } else if (field === 'anniversary' && parentInfo.anniversary) {
      setParentDate(parentInfo.anniversary);
      setParentIsLunar(false);
    } else {
      setParentDate('');
      setParentIsLunar(false);
    }
    setShowParentModal(true);
  };

  const handleSaveParent = () => {
    if (!parentDate) {
      Alert.alert('알림', '날짜를 선택해주세요.');
      return;
    }
    if (parentField === 'mom') {
      setParentInfo({ momBirthday: { date: parentDate, isLunar: parentIsLunar } });
    } else if (parentField === 'dad') {
      setParentInfo({ dadBirthday: { date: parentDate, isLunar: parentIsLunar } });
    } else {
      setParentInfo({ anniversary: parentDate });
    }
    setShowParentModal(false);
  };

  const handleDeleteParent = () => {
    if (parentField === 'mom') setParentInfo({ momBirthday: undefined });
    else if (parentField === 'dad') setParentInfo({ dadBirthday: undefined });
    else setParentInfo({ anniversary: undefined });
    setShowParentModal(false);
  };

  // 아이 추가/수정 모달
  const [showChildModal, setShowChildModal] = useState(false);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [childName, setChildName] = useState('');
  const [childGender, setChildGender] = useState<BabyGender>('unknown');
  const [childBirthDate, setChildBirthDate] = useState<string | null>(null);

  const openAddChild = () => {
    setEditingChildId(null);
    setChildName('');
    setChildGender('unknown');
    setChildBirthDate(null);
    setShowChildModal(true);
  };

  const openEditChild = (child: Child) => {
    setEditingChildId(child.id);
    setChildName(child.name);
    setChildGender(child.gender);
    setChildBirthDate(child.birthDate);
    setShowChildModal(true);
  };

  const handleSaveChild = () => {
    if (!childName.trim()) {
      Alert.alert('알림', '이름을 입력해주세요.');
      return;
    }
    if (!childBirthDate) {
      Alert.alert('알림', '생년월일을 선택해주세요.');
      return;
    }
    const birthDate = childBirthDate;

    if (editingChildId) {
      updateChild(editingChildId, { name: childName.trim(), gender: childGender, birthDate });
    } else {
      addChild({ id: generateId(), name: childName.trim(), gender: childGender, birthDate });
    }
    setShowChildModal(false);
  };

  const handleDeleteChild = (child: Child) => {
    Alert.alert(
      '아이 삭제',
      `${child.name} 정보를 삭제하시겠어요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => removeChild(child.id),
        },
      ],
    );
  };

  const [deleting, setDeleting] = useState(false);

  const performDeleteAccount = async () => {
    setDeleting(true);
    try {
      const authState = getAuthState();
      let googleIdToken: string | undefined;

      // 구글 계정이면 재인증을 위해 idToken 획득
      if (authState.provider === 'google') {
        const googleResult = await signInWithGoogle();
        if ('error' in googleResult) {
          setDeleting(false);
          if (googleResult.error !== '로그인이 취소되었습니다.') {
            Alert.alert('재인증 실패', googleResult.error);
          }
          return;
        }
        googleIdToken = googleResult.idToken;
      }

      const result = await deleteAccount(googleIdToken);

      if (!result.success) {
        setDeleting(false);
        const message =
          result.errorCode === 'network'
            ? '네트워크 연결을 확인한 뒤 다시 시도해주세요.'
            : result.errorCode === 'reauth_failed'
              ? '재인증에 실패했습니다. 다시 로그인 후 시도해주세요.'
              : result.errorMessage || '계정 삭제 중 오류가 발생했습니다.';
        Alert.alert('계정 삭제 실패', message);
        return;
      }

      // 구글 세션 정리
      await signOutGoogle().catch(() => {});

      // 로컬 데이터 초기화 (hasSeenOnboarding도 리셋 → 온보딩 화면으로 이동)
      await resetAllData();
      useAppStore.setState({ hasSeenOnboarding: false });

      setDeleting(false);
      Alert.alert('삭제 완료', '계정과 모든 데이터가 삭제되었습니다.');
    } catch (e: any) {
      setDeleting(false);
      Alert.alert('계정 삭제 실패', e?.message ?? '알 수 없는 오류가 발생했습니다.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '계정 삭제',
      '계정을 삭제하면 모든 데이터가 삭제됩니다. 계속하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            void performDeleteAccount();
          },
        },
      ],
    );
  };

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
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>설정</Text>

        {/* 계정 */}
        <Text style={styles.sectionTitle}>계정</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons
                name={isLinked ? 'shield-checkmark' : 'shield-outline'}
                size={20}
                color={isLinked ? theme.success : theme.subtext}
              />
              <View style={styles.rowText}>
                <Text style={styles.label}>{isLinked ? '구글 계정 연동됨' : '익명 사용 중'}</Text>
                <Text style={styles.desc}>
                  {isLinked
                    ? '기기 변경 시에도 데이터가 유지됩니다'
                    : '앱 삭제 시 데이터가 초기화됩니다'
                  }
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 알림 */}
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

        {/* 아이 정보 */}
        <Text style={styles.sectionTitle}>아이 정보</Text>
        <View style={styles.card}>
          {children.map((child, i) => (
            <View key={child.id}>
              {i > 0 && <View style={styles.divider} />}
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Ionicons
                    name={child.gender === 'male' ? 'male' : child.gender === 'female' ? 'female' : 'happy-outline'}
                    size={20}
                    color={selectedChildId === child.id ? theme.primary : theme.subtext}
                  />
                  <View style={styles.rowText}>
                    <Text style={[styles.label, selectedChildId === child.id && { color: theme.primary }]}>
                      {child.name}
                    </Text>
                    <Text style={styles.desc}>{child.birthDate}</Text>
                  </View>
                </View>
                <View style={styles.childActions}>
                  {selectedChildId !== child.id && (
                    <TouchableOpacity
                      onPress={() => selectChild(child.id)}
                      style={styles.selectBtn}
                    >
                      <Text style={styles.selectBtnText}>선택</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => openEditChild(child)} hitSlop={8}>
                    <Ionicons name="create-outline" size={18} color={theme.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteChild(child)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color="#FF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          {children.length > 0 && <View style={styles.divider} />}

          <TouchableOpacity style={styles.row} onPress={openAddChild} activeOpacity={0.6}>
            <View style={styles.rowLeft}>
              <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
              <Text style={[styles.label, { color: theme.primary }]}>아이 추가</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 부모 정보 */}
        <Text style={styles.sectionTitle}>부모 정보 (선택사항)</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => openParentEdit('mom')} activeOpacity={0.6}>
            <View style={styles.rowLeft}>
              <Ionicons name="heart-outline" size={20} color={theme.primary} />
              <View style={styles.rowText}>
                <Text style={styles.label}>엄마 생일</Text>
                <Text style={styles.desc}>
                  {parentInfo.momBirthday
                    ? `${parentInfo.momBirthday.date} (${parentInfo.momBirthday.isLunar ? '음력' : '양력'})`
                    : '미설정'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={() => openParentEdit('dad')} activeOpacity={0.6}>
            <View style={styles.rowLeft}>
              <Ionicons name="heart-outline" size={20} color={theme.primary} />
              <View style={styles.rowText}>
                <Text style={styles.label}>아빠 생일</Text>
                <Text style={styles.desc}>
                  {parentInfo.dadBirthday
                    ? `${parentInfo.dadBirthday.date} (${parentInfo.dadBirthday.isLunar ? '음력' : '양력'})`
                    : '미설정'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={() => openParentEdit('anniversary')} activeOpacity={0.6}>
            <View style={styles.rowLeft}>
              <Ionicons name="gift-outline" size={20} color={theme.primary} />
              <View style={styles.rowText}>
                <Text style={styles.label}>결혼기념일</Text>
                <Text style={styles.desc}>
                  {parentInfo.anniversary ? `${parentInfo.anniversary} (양력)` : '미설정'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
          </TouchableOpacity>
        </View>

        {/* 일반 */}
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

        {/* 정보 */}
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
          {__DEV__ && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.row}
                onPress={async () => {
                  const info = await getRestoreDebugInfo();
                  Alert.alert('복원 디버그', info);
                }}
                activeOpacity={0.6}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name="bug-outline" size={20} color={theme.subtext} />
                  <Text style={styles.label}>복원 디버그</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* 데이터 */}
        <Text style={styles.sectionTitle}>데이터</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={handleReset} activeOpacity={0.6}>
            <View style={styles.rowLeft}>
              <Ionicons name="trash-outline" size={20} color="#FF4444" />
              <View style={styles.rowText}>
                <Text style={[styles.label, { color: '#FF4444' }]}>전체 데이터 초기화</Text>
                <Text style={styles.desc}>모든 상품 및 설정 삭제</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={handleDeleteAccount} activeOpacity={0.6}>
            <View style={styles.rowLeft}>
              <Ionicons name="person-remove-outline" size={20} color="#FF4444" />
              <View style={styles.rowText}>
                <Text style={[styles.label, { color: '#FF4444' }]}>계정 삭제</Text>
                <Text style={styles.desc}>계정 및 모든 데이터 영구 삭제</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
          </TouchableOpacity>
        </View>

        {/* 개발자용 */}
        {__DEV__ && (
          <>
            <Text style={styles.sectionTitle}>개발자</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  Alert.alert(
                    '앱 데이터 초기화',
                    'AsyncStorage 전체 삭제 후 온보딩부터 다시 시작합니다.',
                    [
                      { text: '취소', style: 'cancel' },
                      {
                        text: '초기화 + 재시작',
                        style: 'destructive',
                        onPress: async () => {
                          // 모든 키를 명시적으로 삭제
                          try {
                            const allKeys = await AsyncStorage.getAllKeys();
                            if (allKeys.length > 0) {
                              await AsyncStorage.multiRemove(allKeys);
                            }
                          } catch {
                            await AsyncStorage.clear();
                          }
                          // zustand 메모리 상태도 초기화
                          useAppStore.persist.clearStorage();
                          try {
                            const Updates = require('expo-updates');
                            if (!__DEV__ && typeof Updates.reloadAsync === 'function') {
                              await Updates.reloadAsync();
                              return;
                            }
                          } catch {}
                          Alert.alert(
                            '초기화 완료',
                            '모든 데이터가 삭제되었습니다.\n앱을 종료 후 다시 시작하면 온보딩부터 진행됩니다.',
                          );
                        },
                      },
                    ],
                  );
                }}
                activeOpacity={0.6}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name="refresh-circle-outline" size={20} color="#FF9500" />
                  <View style={styles.rowText}>
                    <Text style={[styles.label, { color: '#FF9500' }]}>앱 데이터 초기화 (DEV)</Text>
                    <Text style={styles.desc}>AsyncStorage 전체 클리어 + 온보딩 재시작</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
              </TouchableOpacity>
            </View>
          </>
        )}

        <Text style={styles.affiliate}>
          이 앱은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
        </Text>
      </ScrollView>

      {/* 계정 삭제 로딩 */}
      <Modal visible={deleting} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>계정을 삭제하는 중…</Text>
          </View>
        </View>
      </Modal>

      {/* 아이 추가/수정 모달 */}
      <Modal visible={showChildModal} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingChildId ? '아이 정보 수정' : '아이 추가'}
            </Text>

            <TextInput
              style={styles.nameInput}
              placeholder="이름 또는 애칭 (예: 쪼꼬미)"
              placeholderTextColor={theme.subtext}
              value={childName}
              onChangeText={setChildName}
              maxLength={20}
              autoFocus
            />

            <View style={styles.genderRow}>
              {([
                { key: 'male' as const, label: '남아', emoji: '👦' },
                { key: 'female' as const, label: '여아', emoji: '👧' },
                { key: 'unknown' as const, label: '비공개', emoji: '🤍' },
              ]).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.genderBtn, childGender === opt.key && styles.genderBtnActive]}
                  onPress={() => setChildGender(opt.key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.genderEmoji}>{opt.emoji}</Text>
                  <Text style={[styles.genderLabel, childGender === opt.key && styles.genderLabelActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <DatePickerButton
              label="생년월일"
              value={childBirthDate}
              onChange={setChildBirthDate}
              placeholder="생년월일을 선택하세요"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowChildModal(false)}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSaveChild}>
                <Text style={styles.modalConfirmText}>{editingChildId ? '수정' : '추가'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 부모 정보 수정 모달 */}
      <Modal visible={showParentModal} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {parentField === 'mom' ? '엄마 생일' : parentField === 'dad' ? '아빠 생일' : '결혼기념일'}
            </Text>

            <DatePickerButton
              value={parentDate || null}
              onChange={setParentDate}
              placeholder="날짜를 선택하세요"
            />

            {parentField !== 'anniversary' && (
              <View style={styles.lunarRow}>
                <TouchableOpacity
                  style={[styles.lunarBtn, !parentIsLunar && styles.lunarBtnActive]}
                  onPress={() => setParentIsLunar(false)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.lunarBtnText, !parentIsLunar && styles.lunarBtnTextActive]}>양력</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.lunarBtn, parentIsLunar && styles.lunarBtnActive]}
                  onPress={() => setParentIsLunar(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.lunarBtnText, parentIsLunar && styles.lunarBtnTextActive]}>음력</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowParentModal(false)}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              {((parentField === 'mom' && parentInfo.momBirthday) ||
                (parentField === 'dad' && parentInfo.dadBirthday) ||
                (parentField === 'anniversary' && parentInfo.anniversary)) && (
                <TouchableOpacity style={styles.modalCancelBtn} onPress={handleDeleteParent}>
                  <Text style={[styles.modalCancelText, { color: '#FF4444' }]}>삭제</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSaveParent}>
                <Text style={styles.modalConfirmText}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    flex: 1,
  },
  rowText: {
    gap: 2,
    flex: 1,
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
  childActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 126, 103, 0.12)',
  },
  selectBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.primary,
  },
  affiliate: {
    fontSize: 11,
    color: theme.subtext,
    textAlign: 'center',
    lineHeight: 16,
    opacity: 0.6,
    marginBottom: 20,
  },

  // ── 모달 ──
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
    width: '85%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 16,
  },
  nameInput: {
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: theme.text,
    marginBottom: 12,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  genderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
  },
  genderBtnActive: {
    borderColor: theme.primary,
    backgroundColor: 'rgba(255, 126, 103, 0.1)',
  },
  genderEmoji: {
    fontSize: 14,
  },
  genderLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.subtext,
  },
  genderLabelActive: {
    color: theme.primary,
  },
  birthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 20,
  },
  birthInput: {
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    width: 80,
    textAlign: 'center',
  },
  birthLabel: {
    fontSize: 14,
    color: theme.text,
  },
  lunarRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  lunarBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  lunarBtnActive: {
    borderColor: theme.primary,
    backgroundColor: 'rgba(255, 126, 103, 0.1)',
  },
  lunarBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.subtext,
  },
  lunarBtnTextActive: {
    color: theme.primary,
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
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: theme.card,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 12,
    minWidth: 200,
  },
  loadingText: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '500',
  },
});
