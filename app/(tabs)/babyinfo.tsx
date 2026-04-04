import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { useAppStore } from '../../store/useAppStore';
import {
  getHealthCheckupSchedule,
  fetchVaccineCenters,
  fetchWelfareServices,
  fetchChildcareCenters,
  hasPublicApiKey,
  REGIONS,
  type VaccineCenter,
  type WelfareService,
  type ChildcareCenter,
} from '../../services/publicApi';

// ─── 예방접종 스케줄 (월령별) ───
const VACCINATION_SCHEDULE: { month: string; vaccines: string[]; note?: string }[] = [
  { month: '출생', vaccines: ['B형간염 1차', 'BCG(결핵)'] },
  { month: '1개월', vaccines: ['B형간염 2차'] },
  { month: '2개월', vaccines: ['DTaP 1차', 'IPV 1차', 'Hib 1차', 'PCV 1차', '로타바이러스 1차'] },
  { month: '4개월', vaccines: ['DTaP 2차', 'IPV 2차', 'Hib 2차', 'PCV 2차', '로타바이러스 2차'] },
  { month: '6개월', vaccines: ['DTaP 3차', 'IPV 3차', 'Hib 3차', 'PCV 3차', 'B형간염 3차', '인플루엔자(매년)'] },
  { month: '12개월', vaccines: ['MMR 1차', '수두 1차', 'Hib 4차', 'PCV 4차', 'A형간염 1차'] },
  { month: '15개월', vaccines: ['DTaP 4차'] },
  { month: '18개월', vaccines: ['A형간염 2차'] },
  { month: '만 4~6세', vaccines: ['DTaP 5차', 'IPV 4차', 'MMR 2차'], note: '취학 전 접종' },
  { month: '만 6세', vaccines: ['일본뇌염(사백신 4차 또는 생백신 2차)'] },
  { month: '만 11~12세', vaccines: ['Tdap/Td', 'HPV(자궁경부암) 1~2차', '일본뇌염 5차'] },
];

// ─── 정부 지원금 정보 ───
const SUPPORT_INFO: { title: string; desc: string; url: string; emoji: string }[] = [
  {
    title: '부모급여 (0~1세)',
    desc: '0세 월 100만원, 1세 월 50만원 지급',
    url: 'https://www.bokjiro.go.kr',
    emoji: '💰',
  },
  {
    title: '아동수당 (0~8세)',
    desc: '만 8세 미만 아동 월 10만원',
    url: 'https://www.bokjiro.go.kr',
    emoji: '👶',
  },
  {
    title: '영아수당 (0~1세)',
    desc: '바우처 월 30만원 (어린이집 미이용 시)',
    url: 'https://www.childcare.go.kr',
    emoji: '🍼',
  },
  {
    title: '양육수당 (어린이집 미이용)',
    desc: '가정 양육 시 월 10~20만원',
    url: 'https://www.childcare.go.kr',
    emoji: '🏠',
  },
  {
    title: '첫만남이용권',
    desc: '출생 시 바우처 200만원 (첫째 기준)',
    url: 'https://www.bokjiro.go.kr',
    emoji: '🎁',
  },
  {
    title: '출산급여/육아휴직급여',
    desc: '고용보험 가입자 대상, 소득의 80%',
    url: 'https://www.ei.go.kr',
    emoji: '📋',
  },
];

// ─── 어린이집/유치원 ───
const CHILDCARE_INFO: { title: string; desc: string; url: string; emoji: string }[] = [
  {
    title: '아이사랑포털',
    desc: '어린이집 검색, 대기 신청, 보육료 안내',
    url: 'https://www.childcare.go.kr',
    emoji: '🏫',
  },
  {
    title: '처음학교로',
    desc: '유치원 입학 신청 (매년 11월)',
    url: 'https://www.go-firstschool.com',
    emoji: '🎒',
  },
  {
    title: '정부24 어린이집 입소 대기',
    desc: '온라인 대기 신청 및 현황 조회',
    url: 'https://www.gov.kr',
    emoji: '📝',
  },
];

export default function BabyInfoScreen() {
  const { babyBirthDate, babyName } = useAppStore();
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [vaccineCenters, setVaccineCenters] = useState<VaccineCenter[]>([]);
  const [loadingCenters, setLoadingCenters] = useState(false);
  const [centersError, setCentersError] = useState('');

  // 복지 서비스
  const [welfareResults, setWelfareResults] = useState<WelfareService[]>([]);
  const [loadingWelfare, setLoadingWelfare] = useState(false);
  const [welfareLoaded, setWelfareLoaded] = useState(false);

  // 어린이집
  const [showChildcareRegion, setShowChildcareRegion] = useState(false);
  const [childcareRegion, setChildcareRegion] = useState('');
  const [childcareResults, setChildcareResults] = useState<ChildcareCenter[]>([]);
  const [loadingChildcare, setLoadingChildcare] = useState(false);
  const [childcareError, setChildcareError] = useState('');

  const handleSearchWelfare = useCallback(async () => {
    setLoadingWelfare(true);
    try {
      const results = await fetchWelfareServices(babyMonths ?? 12);
      setWelfareResults(results);
    } catch {}
    setLoadingWelfare(false);
    setWelfareLoaded(true);
  }, [babyMonths]);

  const handleSearchChildcare = useCallback(async (region: string) => {
    setChildcareRegion(region);
    setShowChildcareRegion(false);
    setLoadingChildcare(true);
    setChildcareError('');
    try {
      const results = await fetchChildcareCenters(region);
      setChildcareResults(results);
      if (results.length === 0) setChildcareError('검색 결과가 없습니다');
    } catch {
      setChildcareError('조회에 실패했습니다');
    }
    setLoadingChildcare(false);
  }, []);

  const handleSearchCenters = useCallback(async (region: string) => {
    setSelectedRegion(region);
    setShowRegionPicker(false);
    setLoadingCenters(true);
    setCentersError('');
    try {
      const results = await fetchVaccineCenters(region);
      setVaccineCenters(results);
      if (results.length === 0) setCentersError('검색 결과가 없습니다');
    } catch {
      setCentersError('조회에 실패했습니다');
    }
    setLoadingCenters(false);
  }, []);

  const displayName = babyName || '우리 아이';
  const babyMonths = babyBirthDate ? (() => {
    const birth = new Date(babyBirthDate);
    const now = new Date();
    return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  })() : null;

  // 현재 월령에 해당하는 접종 하이라이트
  const getCurrentVaccineIndex = (): number => {
    if (babyMonths === null) return -1;
    if (babyMonths < 1) return 0;
    if (babyMonths < 2) return 1;
    if (babyMonths < 4) return 2;
    if (babyMonths < 6) return 3;
    if (babyMonths < 12) return 4;
    if (babyMonths < 15) return 5;
    if (babyMonths < 18) return 6;
    if (babyMonths < 48) return 7;
    if (babyMonths < 72) return 8;
    if (babyMonths < 84) return 9;
    return 10;
  };

  const currentVaccineIdx = getCurrentVaccineIndex();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>육아정보</Text>
        {babyMonths !== null && (
          <Text style={styles.subtitle}>{displayName} {babyMonths < 1 ? '신생아' : `${babyMonths}개월`} 맞춤 정보</Text>
        )}

        {/* 예방접종 스케줄 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>💉</Text>
            <Text style={styles.sectionTitle}>예방접종 스케줄</Text>
          </View>
          <View style={styles.card}>
            {VACCINATION_SCHEDULE.map((item, i) => {
              const isPast = i < currentVaccineIdx;
              const isCurrent = i === currentVaccineIdx;
              return (
                <View key={i}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={[styles.vaccineRow, isCurrent && styles.vaccineRowCurrent]}>
                    <View style={styles.vaccineLeft}>
                      <View style={[
                        styles.vaccineDot,
                        isPast && styles.vaccineDotDone,
                        isCurrent && styles.vaccineDotCurrent,
                      ]}>
                        {isPast && <Ionicons name="checkmark" size={10} color="#fff" />}
                      </View>
                      <Text style={[styles.vaccineMonth, isCurrent && styles.vaccineMonthCurrent]}>
                        {item.month}
                      </Text>
                    </View>
                    <View style={styles.vaccineRight}>
                      {item.vaccines.map((v, j) => (
                        <Text key={j} style={[styles.vaccineName, isPast && styles.vaccineNameDone]}>
                          {v}
                        </Text>
                      ))}
                      {item.note && <Text style={styles.vaccineNote}>{item.note}</Text>}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
          {/* 접종기관 검색 */}
          {hasPublicApiKey() ? (
            <View style={styles.searchSection}>
              <TouchableOpacity
                style={styles.searchBtn}
                onPress={() => setShowRegionPicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="search" size={16} color="#fff" />
                <Text style={styles.searchBtnText}>
                  {selectedRegion ? `${selectedRegion} 접종기관` : '가까운 접종기관 검색'}
                </Text>
              </TouchableOpacity>

              {loadingCenters && (
                <ActivityIndicator style={{ marginTop: 12 }} color={theme.primary} />
              )}

              {centersError ? (
                <Text style={styles.centersError}>{centersError}</Text>
              ) : null}

              {vaccineCenters.length > 0 && (
                <View style={styles.centersList}>
                  {vaccineCenters.slice(0, 10).map((c, i) => (
                    <View key={`${c.orgCode}-${i}`} style={styles.centerCard}>
                      <Text style={styles.centerName}>{c.name}</Text>
                      <Text style={styles.centerAddr}>{c.address}</Text>
                      {c.tel ? (
                        <TouchableOpacity
                          onPress={() => Linking.openURL(`tel:${c.tel.replace(/[^0-9-]/g, '')}`)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.centerTel}>{c.tel}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                  {vaccineCenters.length > 10 && (
                    <Text style={styles.centersMore}>외 {vaccineCenters.length - 10}곳</Text>
                  )}
                </View>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => Linking.openURL('https://nip.kdca.go.kr')}
              activeOpacity={0.7}
            >
              <Text style={styles.linkBtnText}>질병관리청 예방접종 도우미 바로가기</Text>
              <Ionicons name="open-outline" size={14} color={theme.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* 영유아 건강검진 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>🩺</Text>
            <Text style={styles.sectionTitle}>영유아 건강검진</Text>
          </View>
          <View style={styles.card}>
            {getHealthCheckupSchedule(babyMonths).map((item, i) => (
              <View key={i}>
                {i > 0 && <View style={styles.divider} />}
                <View style={[styles.vaccineRow, item.isCurrent && styles.vaccineRowCurrent]}>
                  <View style={styles.vaccineLeft}>
                    <View style={[
                      styles.vaccineDot,
                      item.isPast && styles.vaccineDotDone,
                      item.isCurrent && styles.vaccineDotCurrent,
                    ]}>
                      {item.isPast && <Ionicons name="checkmark" size={10} color="#fff" />}
                    </View>
                    <Text style={[styles.vaccineMonth, item.isCurrent && styles.vaccineMonthCurrent]}>
                      {item.round}차
                    </Text>
                  </View>
                  <View style={styles.vaccineRight}>
                    <Text style={[styles.vaccineName, item.isPast && styles.vaccineNameDone]}>
                      {item.ageRange}
                    </Text>
                    <Text style={styles.vaccineNote}>{item.items.join(', ')}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => Linking.openURL('https://www.nhis.or.kr')}
            activeOpacity={0.7}
          >
            <Text style={styles.linkBtnText}>건강보험공단 검진 일정 확인</Text>
            <Ionicons name="open-outline" size={14} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* 정부 지원금 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>💰</Text>
            <Text style={styles.sectionTitle}>정부 지원금</Text>
          </View>

          {/* 정적 기본 카드 (항상 표시) */}
          {SUPPORT_INFO.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={styles.infoCard}
              onPress={() => Linking.openURL(item.url)}
              activeOpacity={0.7}
            >
              <Text style={styles.infoEmoji}>{item.emoji}</Text>
              <View style={styles.infoText}>
                <Text style={styles.infoTitle}>{item.title}</Text>
                <Text style={styles.infoDesc}>{item.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
            </TouchableOpacity>
          ))}

          {/* API 연동: 추가 복지 서비스 */}
          {hasPublicApiKey() && (
            <View style={styles.apiSection}>
              {!welfareLoaded ? (
                <TouchableOpacity
                  style={styles.searchBtn}
                  onPress={handleSearchWelfare}
                  activeOpacity={0.7}
                >
                  {loadingWelfare ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="search" size={16} color="#fff" />
                  )}
                  <Text style={styles.searchBtnText}>
                    {babyMonths !== null ? `${babyMonths}개월 맞춤 복지 서비스 더보기` : '맞춤 복지 서비스 검색'}
                  </Text>
                </TouchableOpacity>
              ) : welfareResults.length > 0 ? (
                <>
                  <Text style={styles.apiResultTitle}>복지로 검색 결과</Text>
                  {welfareResults.slice(0, 10).map((w, i) => (
                    <TouchableOpacity
                      key={`${w.id}-${i}`}
                      style={styles.welfareCard}
                      onPress={() => w.detailUrl && Linking.openURL(w.detailUrl)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.welfareName}>{w.name}</Text>
                      {w.summary ? <Text style={styles.welfareSummary} numberOfLines={2}>{w.summary}</Text> : null}
                      <View style={styles.welfareMeta}>
                        {w.amount ? <Text style={styles.welfareAmount}>{w.amount}</Text> : null}
                        {w.howToApply ? <Text style={styles.welfareApply}>{w.howToApply}</Text> : null}
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              ) : (
                <Text style={styles.centersError}>추가 복지 서비스를 찾지 못했습니다</Text>
              )}
            </View>
          )}
        </View>

        {/* 어린이집/유치원 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>🏫</Text>
            <Text style={styles.sectionTitle}>어린이집 / 유치원</Text>
          </View>

          {/* 정적 외부 링크 (항상 표시) */}
          {CHILDCARE_INFO.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={styles.infoCard}
              onPress={() => Linking.openURL(item.url)}
              activeOpacity={0.7}
            >
              <Text style={styles.infoEmoji}>{item.emoji}</Text>
              <View style={styles.infoText}>
                <Text style={styles.infoTitle}>{item.title}</Text>
                <Text style={styles.infoDesc}>{item.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
            </TouchableOpacity>
          ))}

          {/* API 연동: 주변 어린이집 검색 */}
          {hasPublicApiKey() && (
            <View style={styles.apiSection}>
              <TouchableOpacity
                style={styles.searchBtn}
                onPress={() => setShowChildcareRegion(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="search" size={16} color="#fff" />
                <Text style={styles.searchBtnText}>
                  {childcareRegion ? `${childcareRegion} 어린이집` : '주변 어린이집 검색'}
                </Text>
              </TouchableOpacity>

              {loadingChildcare && (
                <ActivityIndicator style={{ marginTop: 12 }} color={theme.primary} />
              )}

              {childcareError ? (
                <Text style={styles.centersError}>{childcareError}</Text>
              ) : null}

              {childcareResults.length > 0 && (
                <View style={styles.centersList}>
                  {childcareResults.slice(0, 10).map((c, i) => (
                    <View key={`cc-${i}`} style={styles.centerCard}>
                      <View style={styles.ccHeader}>
                        <Text style={styles.centerName}>{c.name}</Text>
                        <View style={styles.ccBadgeRow}>
                          <View style={styles.ccTypeBadge}>
                            <Text style={styles.ccTypeBadgeText}>{c.type}</Text>
                          </View>
                          {c.rating && c.rating !== '-' && (
                            <View style={[styles.ccTypeBadge, styles.ccRatingBadge]}>
                              <Text style={styles.ccRatingText}>{c.rating}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Text style={styles.centerAddr}>{c.address}</Text>
                      <View style={styles.ccMeta}>
                        <Text style={styles.ccMetaText}>정원 {c.capacity}명 / 현원 {c.currentCount}명</Text>
                        {c.tel ? (
                          <TouchableOpacity
                            onPress={() => Linking.openURL(`tel:${c.tel.replace(/[^0-9-]/g, '')}`)}
                          >
                            <Text style={styles.centerTel}>{c.tel}</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  ))}
                  {childcareResults.length > 10 && (
                    <Text style={styles.centersMore}>외 {childcareResults.length - 10}곳</Text>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        {/* 유용한 사이트 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>🔗</Text>
            <Text style={styles.sectionTitle}>유용한 사이트</Text>
          </View>
          {[
            { name: '복지로', url: 'https://www.bokjiro.go.kr', desc: '맞춤형 복지 서비스 검색' },
            { name: '정부24', url: 'https://www.gov.kr', desc: '출생신고, 각종 민원' },
            { name: '건강보험공단', url: 'https://www.nhis.or.kr', desc: '영유아 건강검진 일정' },
            { name: '육아종합지원센터', url: 'https://central.childcare.go.kr', desc: '양육 상담, 장난감 도서관' },
          ].map((item, i) => (
            <TouchableOpacity
              key={i}
              style={styles.linkCard}
              onPress={() => Linking.openURL(item.url)}
              activeOpacity={0.7}
            >
              <View style={styles.linkCardText}>
                <Text style={styles.linkCardTitle}>{item.name}</Text>
                <Text style={styles.linkCardDesc}>{item.desc}</Text>
              </View>
              <Ionicons name="open-outline" size={14} color={theme.subtext} />
            </TouchableOpacity>
          ))}
        </View>

        {/* 어린이집 지역 선택 모달 */}
        <Modal visible={showChildcareRegion} transparent animationType="slide">
          <TouchableOpacity
            style={styles.regionOverlay}
            activeOpacity={1}
            onPress={() => setShowChildcareRegion(false)}
          >
            <View style={styles.regionSheet}>
              <View style={styles.regionHandle} />
              <Text style={styles.regionTitle}>어린이집 검색 지역</Text>
              <ScrollView style={styles.regionList}>
                {REGIONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.regionItem, childcareRegion === r && styles.regionItemActive]}
                    onPress={() => handleSearchChildcare(r)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.regionItemText, childcareRegion === r && styles.regionItemTextActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* 접종기관 지역 선택 모달 */}
        <Modal visible={showRegionPicker} transparent animationType="slide">
          <TouchableOpacity
            style={styles.regionOverlay}
            activeOpacity={1}
            onPress={() => setShowRegionPicker(false)}
          >
            <View style={styles.regionSheet}>
              <View style={styles.regionHandle} />
              <Text style={styles.regionTitle}>지역 선택</Text>
              <ScrollView style={styles.regionList}>
                {REGIONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.regionItem, selectedRegion === r && styles.regionItemActive]}
                    onPress={() => handleSearchCenters(r)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.regionItemText, selectedRegion === r && styles.regionItemTextActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        <Text style={styles.disclaimer}>
          위 정보는 참고용이며, 정확한 내용은 해당 기관 공식 사이트를 확인하세요.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
    paddingTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 20,
  },

  // ── 섹션 ──
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionEmoji: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.text,
  },

  // ── 예방접종 ──
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  vaccineRow: {
    flexDirection: 'row',
    padding: 14,
    gap: 12,
  },
  vaccineRowCurrent: {
    backgroundColor: 'rgba(255, 126, 103, 0.06)',
  },
  vaccineLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: 90,
  },
  vaccineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  vaccineDotDone: {
    backgroundColor: theme.success,
    borderColor: theme.success,
  },
  vaccineDotCurrent: {
    borderColor: theme.primary,
    backgroundColor: theme.primary,
  },
  vaccineMonth: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.subtext,
    flex: 1,
  },
  vaccineMonthCurrent: {
    color: theme.primary,
    fontWeight: '700',
  },
  vaccineRight: {
    flex: 1,
    gap: 2,
  },
  vaccineName: {
    fontSize: 13,
    color: theme.text,
    lineHeight: 20,
  },
  vaccineNameDone: {
    color: theme.subtext,
    textDecorationLine: 'line-through',
  },
  vaccineNote: {
    fontSize: 11,
    color: theme.subtext,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: theme.border,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
  },
  linkBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.primary,
  },

  // ── 정보 카드 ──
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginBottom: 8,
  },
  infoEmoji: {
    fontSize: 22,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  infoDesc: {
    fontSize: 12,
    color: theme.subtext,
    marginTop: 2,
  },

  // ── 링크 카드 ──
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginBottom: 8,
  },
  linkCardText: {
    flex: 1,
  },
  linkCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  linkCardDesc: {
    fontSize: 12,
    color: theme.subtext,
    marginTop: 1,
  },

  // ── 접종기관 검색 ──
  searchSection: {
    marginTop: 12,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 12,
  },
  searchBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  centersError: {
    fontSize: 13,
    color: theme.subtext,
    textAlign: 'center',
    marginTop: 12,
  },
  centersList: {
    marginTop: 12,
    gap: 8,
  },
  centerCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 12,
    gap: 4,
  },
  centerName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  centerAddr: {
    fontSize: 12,
    color: theme.subtext,
  },
  centerTel: {
    fontSize: 13,
    color: theme.primary,
    fontWeight: '500',
    marginTop: 2,
  },
  centersMore: {
    fontSize: 12,
    color: theme.subtext,
    textAlign: 'center',
  },

  // ── API 결과 공통 ──
  apiSection: {
    marginTop: 12,
  },
  apiResultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },

  // ── 복지 서비스 카드 ──
  welfareCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 12,
    marginBottom: 8,
    gap: 4,
  },
  welfareName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  welfareSummary: {
    fontSize: 12,
    color: theme.subtext,
    lineHeight: 18,
  },
  welfareMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  welfareAmount: {
    fontSize: 11,
    color: theme.primary,
    fontWeight: '600',
  },
  welfareApply: {
    fontSize: 11,
    color: theme.subtext,
  },

  // ── 어린이집 카드 ──
  ccHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  ccBadgeRow: {
    flexDirection: 'row',
    gap: 4,
  },
  ccTypeBadge: {
    backgroundColor: 'rgba(255, 126, 103, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ccTypeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.primary,
  },
  ccRatingBadge: {
    backgroundColor: 'rgba(78, 205, 196, 0.12)',
  },
  ccRatingText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4ECDC4',
  },
  ccMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  ccMetaText: {
    fontSize: 12,
    color: theme.subtext,
  },

  // ── 지역 선택 모달 ──
  regionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  regionSheet: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
  },
  regionHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  regionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
  regionList: {
    paddingBottom: 20,
  },
  regionItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  regionItemActive: {
    backgroundColor: 'rgba(255, 126, 103, 0.08)',
  },
  regionItemText: {
    fontSize: 15,
    color: theme.text,
  },
  regionItemTextActive: {
    color: theme.primary,
    fontWeight: '600',
  },

  disclaimer: {
    fontSize: 11,
    color: theme.subtext,
    textAlign: 'center',
    opacity: 0.6,
    lineHeight: 16,
  },
});
