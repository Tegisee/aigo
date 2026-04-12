import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';
import { signInWithGoogle } from '../services/googleAuth';
import { signInAnonymously, linkGoogleAccount, getCurrentUid } from '../services/firebase';
import { registerForPushNotifications } from '../services/notifications';
import { restoreDataFromFirestore } from '../services/restore';
import DatePickerButton from './DatePickerButton';

const { width } = Dimensions.get('window');

interface Props {
  onComplete: () => void;
}

// ─── Step 0: 앱 소개 + 구글/익명 선택 ───
function Step1({ onNext, onRestore }: { onNext: () => void; onRestore: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const { setLinked } = useAppStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  /** Alert을 Promise로 래핑 — 확인 누를 때까지 대기 */
  const debugAlert = (title: string, msg: string): Promise<void> =>
    new Promise((resolve) => Alert.alert(title, msg, [{ text: '확인', onPress: () => resolve() }]));

  const handleGoogleStart = async () => {
    setLoading(true);
    try {
      // 1. 익명 로그인 보장
      await signInAnonymously();
      const anonUid = getCurrentUid();
      await debugAlert('[1/5] 익명 로그인', `uid: ${anonUid}`);

      // 2. Google Sign-In
      const googleResult = await signInWithGoogle();
      if ('error' in googleResult) {
        if (googleResult.error !== '로그인이 취소되었습니다.') {
          Alert.alert('로그인 실패', googleResult.error);
        }
        setLoading(false);
        return;
      }
      await debugAlert('[2/5] 구글 로그인 완료', `email: ${googleResult.email}\nuid: ${getCurrentUid()}`);

      // 3. Firebase 연동
      const firebaseResult = await linkGoogleAccount(googleResult.idToken);
      if (!firebaseResult.success) {
        Alert.alert('연동 실패', firebaseResult.error || '다시 시도해주세요.');
        setLoading(false);
        return;
      }
      setLinked('google');
      await debugAlert('[3/5] Firebase 연동', `recovered: ${firebaseResult.recoveredAccount}\nuid: ${getCurrentUid()}`);

      // push token 재등록
      if (firebaseResult.recoveredAccount) {
        registerForPushNotifications().catch(() => {});
      }

      // 4. Firestore 데이터 복원
      const { childrenCount, itemsCount, debugInfo } = await restoreDataFromFirestore();
      await debugAlert('[4/5] 데이터 복원', `children: ${childrenCount}건\nitems: ${itemsCount}건\n\n${debugInfo}`);

      // 5. 최종 진입
      if (childrenCount > 0 || itemsCount > 0) {
        Alert.alert(
          '[5/5] 복원 완료 → 홈 진입',
          `아이 ${childrenCount}건, 관심상품 ${itemsCount}건\n확인 누르면 completeOnboarding 호출`,
          [{ text: '확인', onPress: onRestore }],
        );
      } else {
        Alert.alert(
          '[5/5] 데이터 없음 → 아이 정보 입력',
          `recovered: ${firebaseResult.recoveredAccount}\n확인 누르면 Step 1로 이동`,
          [{ text: '확인', onPress: onNext }],
        );
      }
    } catch (e: any) {
      Alert.alert('오류', e.message || '구글 로그인 중 오류가 발생했습니다.');
    }
    setLoading(false);
  };

  const handleAnonymousStart = () => {
    Alert.alert(
      '익명으로 시작',
      '구글 계정으로 시작하지 않으면 앱 재설치 시 데이터가 복원되지 않습니다.\n\n익명으로 계속하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { text: '익명으로 시작', onPress: onNext },
      ],
    );
  };

  return (
    <View style={styles.step}>
      <Animated.View style={[styles.iconCircle, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Image source={require('../assets/icon.png')} style={styles.iconImage} />
      </Animated.View>
      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.stepTitle}>아이고</Text>
        <Text style={styles.stepDesc}>
          육아용품 최저가를 알려드려요{'\n'}원하는 가격에 딱 맞게
        </Text>
        <View style={styles.featureList}>
          <FeatureRow icon="notifications-outline" text="목표가 도달 시 푸시 알림" />
          <FeatureRow icon="analytics-outline" text="가격 변동 그래프 제공" />
          <FeatureRow icon="time-outline" text="매일 3회 자동 가격 확인" />
        </View>
      </Animated.View>

      {/* 구글 계정으로 시작 (권장) */}
      <TouchableOpacity
        style={[styles.googleStartBtn, loading && { opacity: 0.6 }]}
        onPress={handleGoogleStart}
        activeOpacity={0.8}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="logo-google" size={20} color="#fff" />
        )}
        <Text style={styles.googleStartBtnText}>
          {loading ? '연결 중...' : '구글 계정으로 시작'}
        </Text>
      </TouchableOpacity>

      {/* 익명으로 시작 */}
      <TouchableOpacity
        style={styles.anonymousBtn}
        onPress={handleAnonymousStart}
        activeOpacity={0.7}
      >
        <Text style={styles.anonymousBtnText}>익명으로 시작</Text>
      </TouchableOpacity>
    </View>
  );
}

function FeatureRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureRow}>
      <Ionicons name={icon as any} size={18} color={theme.primary} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

// ─── Step 2: 아이 정보 입력 (이름 + 성별 + 생년월일) ───
function StepBabyInfo({ onNext }: { onNext: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { setBabyName, setBabyGender, setBabyBirthDate, addChild, children } = useAppStore();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [birthDate, setBirthDate] = useState<string | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const isComplete = name.trim().length > 0 && gender !== null && birthDate !== null;

  const handleSave = () => {
    if (!isComplete) {
      Alert.alert(
        '필수 정보 입력',
        '아이 이름, 성별, 생년월일을 모두 입력해야 월령별 맞춤 서비스를 이용할 수 있어요.',
      );
      return;
    }

    const babyName = name.trim();
    const selectedGender = gender!; // isComplete 체크 후이므로 non-null
    const selectedBirthDate = birthDate!;

    setBabyName(babyName);
    setBabyGender(selectedGender);
    setBabyBirthDate(selectedBirthDate);

    // children[] 배열에도 동시 저장 (중복 방지)
    if (children.length === 0) {
      addChild({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        name: babyName,
        gender: selectedGender,
        birthDate: selectedBirthDate,
      });
    }

    onNext();
  };

  return (
    <KeyboardAvoidingView
      style={styles.step}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.stepScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.babyInfoContent, { opacity: fadeAnim }]}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconEmoji}>👶</Text>
          </View>
          <Text style={styles.stepTitle}>아이 정보</Text>
          <Text style={styles.stepDesc}>
            아이 정보를 입력하면{'\n'}맞춤 상품을 추천해드려요
          </Text>

          {/* 이름 입력 */}
          <TextInput
            style={styles.nameInput}
            placeholder="이름 또는 애칭 (예: 쪼꼬미, 콩이)"
            placeholderTextColor={theme.subtext}
            value={name}
            onChangeText={setName}
            maxLength={20}
          />

          {/* 성별 선택 */}
          <View style={styles.genderRow}>
            {([
              { key: 'male' as const, label: '남아', emoji: '👦' },
              { key: 'female' as const, label: '여아', emoji: '👧' },
            ]).map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.genderBtn, gender === opt.key && styles.genderBtnActive]}
                onPress={() => setGender(opt.key)}
                activeOpacity={0.7}
              >
                <Text style={styles.genderEmoji}>{opt.emoji}</Text>
                <Text style={[styles.genderLabel, gender === opt.key && styles.genderLabelActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 생년월일 입력 (캘린더) */}
          <View style={styles.birthDateWrap}>
            <DatePickerButton
              label="생년월일"
              value={birthDate}
              onChange={setBirthDate}
              placeholder="생년월일을 선택하세요"
            />
          </View>
        </Animated.View>
      </ScrollView>

      <View style={styles.birthButtons}>
        <TouchableOpacity style={styles.skipBirthBtn} onPress={onNext} activeOpacity={0.7}>
          <Text style={styles.skipBirthText}>건너뛰기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, !isComplete && styles.nextBtnDisabled]}
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Text style={[styles.nextBtnText, !isComplete && styles.nextBtnTextDisabled]}>다음</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Step 3: 쿠팡 공유 버튼 안내 ───
function Step3Share({ onNext }: { onNext: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pointerY = useRef(new Animated.Value(0)).current;
  const pointerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start(() => {
      // 포인터 바운스 애니메이션
      Animated.timing(pointerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(pointerY, { toValue: -8, duration: 500, useNativeDriver: true }),
          Animated.timing(pointerY, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
      ).start();
    });
  }, []);

  return (
    <View style={styles.step}>
      <Animated.View style={[styles.mockPhone, { opacity: fadeAnim }]}>
        {/* 가상 쿠팡 상품 화면 */}
        <View style={styles.mockHeader}>
          <View style={styles.mockHeaderBar} />
          <Text style={styles.mockHeaderText}>쿠팡</Text>
        </View>
        <View style={styles.mockProduct}>
          <View style={styles.mockImagePlaceholder}>
            <Ionicons name="bag-handle-outline" size={32} color={theme.primary} />
          </View>
          <Text style={styles.mockProductName}>하기스 네이처메이드 기저귀 4단계</Text>
          <Text style={styles.mockProductPrice}>43,900원</Text>
        </View>
        {/* 공유 버튼 영역 */}
        <View style={styles.mockActionBar}>
          <View style={styles.mockActionBtn}>
            <Ionicons name="heart-outline" size={20} color="#999" />
          </View>
          <View style={styles.mockActionBtn}>
            <Ionicons name="cart-outline" size={20} color="#999" />
          </View>
          <View style={[styles.mockActionBtn, styles.mockShareBtn]}>
            <Ionicons name="share-outline" size={20} color={theme.primary} />
          </View>
        </View>
        {/* 포인터 */}
        <Animated.View style={[
          styles.pointer,
          { opacity: pointerOpacity, transform: [{ translateY: pointerY }] },
        ]}>
          <View style={styles.pointerArrow} />
          <Text style={styles.pointerText}>공유 버튼을 눌러요!</Text>
        </Animated.View>
      </Animated.View>

      <TouchableOpacity style={styles.primaryBtn} onPress={onNext} activeOpacity={0.8}>
        <Text style={styles.primaryBtnText}>다음</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Step 3: 공유 시트에서 아이고 선택 ───
function Step3({ onNext }: { onNext: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const tapScale = useRef(new Animated.Value(1)).current;
  const tapOpacity = useRef(new Animated.Value(0)).current;
  const [tapped, setTapped] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start(() => {
      // 탭 유도 펄스 애니메이션
      Animated.loop(
        Animated.sequence([
          Animated.timing(tapOpacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          Animated.timing(tapOpacity, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]),
      ).start();
    });
  }, []);

  const handleTap = () => {
    setTapped(true);
    Animated.sequence([
      Animated.timing(tapScale, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.timing(tapScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(onNext, 400);
    });
  };

  const isIOS = Platform.OS === 'ios';

  return (
    <View style={styles.step}>
      <Animated.View style={[styles.mockShareSheet, { opacity: fadeAnim }]}>
        <View style={styles.shareSheetHandle} />
        <Text style={styles.shareSheetTitle}>
          {isIOS ? '공유' : '다음으로 공유'}
        </Text>
        <View style={styles.shareSheetGrid}>
          <ShareIcon name="메시지" icon="chatbubble" color="#34C759" />
          <ShareIcon name="카카오톡" icon="chatbubbles" color="#FEE500" />
          {/* 아이고 아이콘 — 탭 가능 */}
          <TouchableOpacity onPress={handleTap} activeOpacity={0.7}>
            <Animated.View style={[
              styles.shareIconItem,
              { transform: [{ scale: tapScale }] },
            ]}>
              <Animated.View style={[styles.tapPulse, { opacity: tapOpacity }]} />
              <View style={[styles.shareIconCircle, { backgroundColor: tapped ? theme.primary : '#FFF8F0' }]}>
                <Image source={require('../assets/icon.png')} style={{ width: 24, height: 24, borderRadius: 6 }} />
              </View>
              <Text style={[styles.shareIconLabel, tapped && { color: theme.primary }]}>아이고</Text>
              {tapped && (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark" size={12} color="#000" />
                </View>
              )}
            </Animated.View>
          </TouchableOpacity>
          <ShareIcon name="더보기" icon="ellipsis-horizontal" color="#8E8E93" />
        </View>
      </Animated.View>

      <Text style={styles.step3Hint}>
        {tapped ? '선택 완료!' : '"아이고"를 탭해보세요'}
      </Text>
    </View>
  );
}

function ShareIcon({ name, icon, color }: { name: string; icon: string; color: string }) {
  return (
    <View style={styles.shareIconItem}>
      <View style={[styles.shareIconCircle, { backgroundColor: color }]}>
        <Ionicons name={icon as any} size={22} color="#fff" />
      </View>
      <Text style={styles.shareIconLabel}>{name}</Text>
    </View>
  );
}

// ─── Step 4: 등록 완료 + 목표가 안내 ───
function Step4({ onComplete }: { onComplete: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    Animated.spring(checkScale, { toValue: 1, friction: 4, delay: 300, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={styles.step}>
      <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
        <Ionicons name="checkmark" size={48} color="#000" />
      </Animated.View>
      <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
        <Text style={styles.stepTitle}>준비 완료!</Text>
        <Text style={styles.stepDesc}>
          상품을 등록하면 목표가를 설정할 수 있어요{'\n'}
          가격이 목표가 이하로 떨어지면{'\n'}
          바로 알림을 보내드려요
        </Text>

        {/* 가상 알림 미리보기 */}
        <View style={styles.mockNotif}>
          <View style={styles.mockNotifIcon}>
            <Image source={require('../assets/icon.png')} style={{ width: 20, height: 20, borderRadius: 4 }} />
          </View>
          <View style={styles.mockNotifContent}>
            <Text style={styles.mockNotifTitle}>아이고, 지금이 기회!</Text>
            <Text style={styles.mockNotifBody}>하기스 기저귀 4단계 38,900원 — 목표가 도달!</Text>
          </View>
        </View>
      </Animated.View>

      <TouchableOpacity style={styles.primaryBtn} onPress={onComplete} activeOpacity={0.8}>
        <Text style={styles.primaryBtnText}>시작하기</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main ───
export default function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const transitionAnim = useRef(new Animated.Value(1)).current;

  const goNext = () => {
    Animated.timing(transitionAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setStep((s) => s + 1);
      Animated.timing(transitionAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 진행 인디케이터 */}
      <View style={styles.progressBar}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              i === step && styles.progressDotActive,
              i < step && styles.progressDotDone,
            ]}
          />
        ))}
      </View>

      {step > 0 && step < 4 && (
        <TouchableOpacity style={styles.skipButton} onPress={onComplete}>
          <Text style={styles.skipText}>건너뛰기</Text>
        </TouchableOpacity>
      )}

      <Animated.View style={[styles.stepContainer, { opacity: transitionAnim }]}>
        {step === 0 && <Step1 onNext={goNext} onRestore={onComplete} />}
        {step === 1 && <StepBabyInfo onNext={goNext} />}
        {step === 2 && <Step3Share onNext={goNext} />}
        {step === 3 && <Step3 onNext={goNext} />}
        {step === 4 && <Step4 onComplete={onComplete} />}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 16,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.border,
  },
  progressDotActive: {
    width: 24,
    backgroundColor: theme.primary,
  },
  progressDotDone: {
    backgroundColor: 'rgba(255, 126, 103, 0.4)',
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
  },
  skipText: {
    color: theme.subtext,
    fontSize: 15,
  },
  stepContainer: {
    flex: 1,
  },

  // ── 공통 ──
  step: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  stepScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 126, 103, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 126, 103, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconEmoji: {
    fontSize: 44,
  },
  iconImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  stepDesc: {
    fontSize: 15,
    color: theme.subtext,
    textAlign: 'center',
    lineHeight: 24,
  },
  primaryBtn: {
    backgroundColor: theme.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 60,
    marginTop: 32,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  googleStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#4285F4',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 32,
    width: '100%',
  },
  googleStartBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  anonymousBtn: {
    paddingVertical: 14,
    marginTop: 12,
  },
  anonymousBtnText: {
    fontSize: 15,
    color: theme.subtext,
    fontWeight: '500',
  },

  // ── Step 2: Baby Info ──
  babyInfoContent: {
    alignItems: 'center',
    width: '100%',
  },
  nameInput: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: theme.text,
    width: '100%',
    marginTop: 20,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  genderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  genderBtnActive: {
    borderColor: theme.primary,
    backgroundColor: 'rgba(255, 126, 103, 0.1)',
  },
  genderEmoji: {
    fontSize: 18,
  },
  genderLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.subtext,
  },
  genderLabelActive: {
    color: theme.primary,
  },
  birthDateWrap: {
    width: '100%',
    marginTop: 16,
  },
  birthButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 30,
    paddingBottom: 20,
    marginTop: 32,
    width: '100%',
  },
  skipBirthBtn: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBirthText: {
    color: theme.subtext,
    fontSize: 15,
    fontWeight: '600',
  },
  nextBtn: {
    flex: 1,
    backgroundColor: theme.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnDisabled: {
    backgroundColor: theme.border,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  nextBtnTextDisabled: {
    color: theme.subtext,
  },

  // ── Step 1 ──
  featureList: {
    marginTop: 24,
    gap: 12,
    alignSelf: 'stretch',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
  },
  featureText: {
    color: theme.text,
    fontSize: 14,
  },

  // ── Step 2: Mock Phone ──
  mockPhone: {
    width: width * 0.75,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'visible',
    marginBottom: 16,
  },
  mockHeader: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  mockHeaderBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginBottom: 8,
  },
  mockHeaderText: {
    color: '#2D2D2D',
    fontSize: 15,
    fontWeight: '600',
  },
  mockProduct: {
    padding: 16,
    alignItems: 'center',
  },
  mockImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F5F0EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  mockProductName: {
    color: '#2D2D2D',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  mockProductPrice: {
    color: theme.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  mockActionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  mockActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F0EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockShareBtn: {
    borderWidth: 2,
    borderColor: theme.primary,
    backgroundColor: 'rgba(255, 126, 103, 0.1)',
  },
  pointer: {
    position: 'absolute',
    bottom: -36,
    right: 24,
    alignItems: 'center',
  },
  pointerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: theme.primary,
  },
  pointerText: {
    color: theme.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },

  // ── Step 3: Share Sheet ──
  mockShareSheet: {
    width: width * 0.85,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  shareSheetHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#CCC',
    alignSelf: 'center',
    marginBottom: 16,
  },
  shareSheetTitle: {
    color: '#2D2D2D',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  shareSheetGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  shareIconItem: {
    alignItems: 'center',
    width: 64,
  },
  shareIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  shareAppEmoji: {
    fontSize: 24,
  },
  shareIconLabel: {
    color: '#8E8E93',
    fontSize: 11,
  },
  tapPulse: {
    position: 'absolute',
    top: -4,
    left: 3,
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: theme.primary,
  },
  checkBadge: {
    position: 'absolute',
    top: -2,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  step3Hint: {
    color: theme.subtext,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },

  // ── Step 4 ──
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  mockNotif: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginTop: 24,
    gap: 12,
    alignItems: 'center',
    width: '100%',
  },
  mockNotifIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F5F0EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockNotifContent: {
    flex: 1,
  },
  mockNotifTitle: {
    color: '#2D2D2D',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  mockNotifBody: {
    color: '#8E8E93',
    fontSize: 12,
  },
});
