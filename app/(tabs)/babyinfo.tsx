import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Linking, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { useAppStore } from '../../store/useAppStore';
import DatePickerButton from '../../components/DatePickerButton';
import { getHealthCheckupSchedule } from '../../services/publicApi';

// ─── 예방접종 스케줄 (정적 상세 데이터) ───
const VACCINATION_SCHEDULE = [
  { month: '출생', minMonth: 0, maxMonth: 0, vaccines: ['B형간염 1차', 'BCG(결핵)'] },
  { month: '1개월', minMonth: 1, maxMonth: 1, vaccines: ['B형간염 2차'] },
  { month: '2개월', minMonth: 2, maxMonth: 3, vaccines: ['DTaP 1차', 'IPV 1차', 'Hib 1차', 'PCV 1차', '로타바이러스 1차'] },
  { month: '4개월', minMonth: 4, maxMonth: 5, vaccines: ['DTaP 2차', 'IPV 2차', 'Hib 2차', 'PCV 2차', '로타바이러스 2차'] },
  { month: '6개월', minMonth: 6, maxMonth: 11, vaccines: ['DTaP 3차', 'IPV 3차', 'Hib 3차', 'PCV 3차', 'B형간염 3차', '인플루엔자(매년)'] },
  { month: '12개월', minMonth: 12, maxMonth: 14, vaccines: ['MMR 1차', '수두 1차', 'Hib 4차', 'PCV 4차', 'A형간염 1차'] },
  { month: '15개월', minMonth: 15, maxMonth: 17, vaccines: ['DTaP 4차'] },
  { month: '18개월', minMonth: 18, maxMonth: 47, vaccines: ['A형간염 2차'] },
  { month: '만 4~6세', minMonth: 48, maxMonth: 71, vaccines: ['DTaP 5차', 'IPV 4차', 'MMR 2차'], note: '취학 전 필수 접종' },
  { month: '만 6세', minMonth: 72, maxMonth: 83, vaccines: ['일본뇌염(사백신 4차 또는 생백신 2차)'] },
  { month: '만 11~12세', minMonth: 132, maxMonth: 155, vaccines: ['Tdap/Td', 'HPV(자궁경부암) 1~2차', '일본뇌염 5차'] },
];

// ─── 정부 지원금 상세 정보 (앱 내 표시) ───
const SUPPORT_DETAIL = [
  {
    emoji: '💰', title: '부모급여',
    target: '만 0~1세 아동의 부모',
    amount: '0세: 월 100만원 / 1세: 월 50만원',
    how: '주민등록 주소지 읍면동 행정복지센터 또는 복지로(bokjiro.go.kr) 온라인 신청',
    note: '어린이집 이용 시 보육료 차액 지급',
  },
  {
    emoji: '👶', title: '아동수당',
    target: '만 8세 미만 모든 아동 (소득 무관)',
    amount: '월 10만원',
    how: '출생신고 시 행복출산 원스톱 서비스로 자동 신청, 또는 읍면동 주민센터/복지로 신청',
    note: '매월 25일 지급',
  },
  {
    emoji: '🍼', title: '영아수당',
    target: '만 0~1세 어린이집 미이용 아동',
    amount: '바우처 월 30만원 (국민행복카드)',
    how: '읍면동 주민센터 또는 복지로 신청',
    note: '어린이집 이용 시 보육료로 전환',
  },
  {
    emoji: '🏠', title: '양육수당',
    target: '어린이집/유치원 미이용 만 2~5세',
    amount: '월 10만원',
    how: '읍면동 주민센터 또는 복지로 신청',
    note: '영아수당과 중복 불가',
  },
  {
    emoji: '🎁', title: '첫만남이용권',
    target: '출생아 (출생신고 후)',
    amount: '첫째 200만원 / 둘째 이상 300만원 (바우처)',
    how: '출생신고 시 자동 신청 (행복출산 원스톱)',
    note: '출생일로부터 1년 내 사용',
  },
  {
    emoji: '📋', title: '육아휴직급여',
    target: '고용보험 가입 근로자 (만 8세 이하 자녀)',
    amount: '통상임금 80% (상한 월 150만원)',
    how: '사업주에게 육아휴직 신청 → 고용센터에 급여 신청',
    note: '부부 동시 사용 가능 (6+6 부모육아휴직제)',
  },
];

export default function BabyInfoScreen() {
  const { babyBirthDate, babyName, vaccinationRecords, setVaccinationDate, checkupRecords, setCheckupDate, vaccinationHospitals, checkupHospitals } = useAppStore();

  // 날짜 입력 모달
  const [dateModalTarget, setDateModalTarget] = useState<{ type: 'vaccine' | 'checkup'; key: string; label: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hospitalInput, setHospitalInput] = useState('');

  // 추가 항목
  const [customVaccines, setCustomVaccines] = useState<{ name: string; date?: string; hospital?: string }[]>([]);
  const [customCheckups, setCustomCheckups] = useState<{ name: string; date?: string; hospital?: string }[]>([]);
  const [showAddInput, setShowAddInput] = useState<'vaccine' | 'checkup' | null>(null);
  const [addInputText, setAddInputText] = useState('');

  // 지원금 상세 펼침
  const [expandedSupport, setExpandedSupport] = useState<number | null>(null);

  const displayName = babyName || '우리 아이';
  const babyMonths = babyBirthDate ? (() => {
    const birth = new Date(babyBirthDate);
    const now = new Date();
    return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  })() : null;


  // 접종 상태 분류 (날짜 기록 기반)
  const isVaccineGroupDone = (item: typeof VACCINATION_SCHEDULE[0]) => {
    return item.vaccines.every((v) => !!vaccinationRecords[v]);
  };

  const getVaccineStatus = (item: typeof VACCINATION_SCHEDULE[0]) => {
    if (isVaccineGroupDone(item)) return 'done';
    if (babyMonths !== null && babyMonths >= item.minMonth && babyMonths <= item.maxMonth) return 'current';
    if (babyMonths !== null && babyMonths > item.maxMonth) return 'overdue'; // 시기 지남 + 미완료
    return 'pending';
  };

  const doneCount = VACCINATION_SCHEDULE.filter((v) => isVaccineGroupDone(v)).length;
  const currentItem = VACCINATION_SCHEDULE.find((v) => getVaccineStatus(v) === 'current' || getVaccineStatus(v) === 'overdue');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>육아정보</Text>
        {babyMonths !== null && (
          <Text style={styles.subtitle}>{displayName} {babyMonths < 1 ? '신생아' : `${babyMonths}개월`} 맞춤 정보</Text>
        )}

        {/* ── 예방접종 ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>💉</Text>
            <Text style={styles.sectionTitle}>예방접종</Text>
            {babyMonths !== null && (
              <View style={styles.progressBadge}>
                <Text style={styles.progressBadgeText}>{doneCount}/{VACCINATION_SCHEDULE.length} 완료</Text>
              </View>
            )}
          </View>

          {/* 현재 접종 하이라이트 */}
          {currentItem && (
            <View style={styles.currentHighlight}>
              <Ionicons name="alert-circle" size={18} color={theme.primary} />
              <Text style={styles.currentHighlightText}>
                {currentItem.month} 접종 시기예요: {currentItem.vaccines.join(', ')}
              </Text>
            </View>
          )}

          <View style={styles.card}>
            {VACCINATION_SCHEDULE.map((item, i) => {
              const status = getVaccineStatus(item);
              return (
                <View key={i}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={[styles.vaccineRow, (status === 'current' || status === 'overdue') && styles.vaccineRowCurrent]}>
                    <View style={styles.vaccineLeft}>
                      <View style={[
                        styles.vaccineDot,
                        status === 'done' && styles.vaccineDotDone,
                        status === 'current' && styles.vaccineDotCurrent,
                        status === 'overdue' && styles.vaccineDotOverdue,
                      ]}>
                        {status === 'done' && <Ionicons name="checkmark" size={10} color="#fff" />}
                        {status === 'current' && <Ionicons name="time" size={10} color="#fff" />}
                        {status === 'overdue' && <Ionicons name="alert" size={10} color="#fff" />}
                      </View>
                      <View>
                        <Text style={[
                          styles.vaccineMonth,
                          status === 'current' && styles.vaccineMonthCurrent,
                          status === 'overdue' && { color: '#FF3B30' },
                          status === 'done' && { color: theme.subtext },
                        ]}>
                          {item.month}
                        </Text>
                        <Text style={[styles.vaccineStatus, status === 'overdue' && { color: '#FF3B30' }]}>
                          {status === 'done' ? '완료' : status === 'current' ? '접종 시기' : status === 'overdue' ? '미접종' : '예정'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.vaccineRight}>
                      {item.vaccines.map((v, j) => {
                        const recordDate = vaccinationRecords[v];
                        return (
                          <TouchableOpacity
                            key={j}
                            style={styles.vaccineItem}
                            onPress={() => {
                              if (recordDate) {
                                const hospital = vaccinationHospitals[v];
                                const info = [`접종일: ${recordDate}`, hospital ? `병원: ${hospital}` : ''].filter(Boolean).join('\n');
                                Alert.alert(v, info, [
                                  { text: '닫기' },
                                  { text: '수정', onPress: () => { setSelectedDate(recordDate); setHospitalInput(vaccinationHospitals[v] || ''); setDateModalTarget({ type: 'vaccine', key: v, label: v }); } },
                                  { text: '기록 삭제', style: 'destructive', onPress: () => setVaccinationDate(v, null) },
                                ]);
                              } else {
                                setHospitalInput('');
                                setDateModalTarget({ type: 'vaccine', key: v, label: v });
                              }
                            }}
                            activeOpacity={0.6}
                          >
                            <Ionicons
                              name={recordDate ? 'checkmark-circle' : 'ellipse-outline'}
                              size={16}
                              color={recordDate ? theme.success : theme.border}
                            />
                            <Text style={[styles.vaccineName, recordDate && styles.vaccineNameDone]}>
                              {v}
                            </Text>
                            {recordDate && <Text style={styles.vaccineDate}>{recordDate}{vaccinationHospitals[v] ? ` · ${vaccinationHospitals[v]}` : ''}</Text>}
                          </TouchableOpacity>
                        );
                      })}
                      {item.note && <Text style={styles.vaccineNote}>{item.note}</Text>}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {/* 사용자 추가 접종 항목 */}
          {customVaccines.map((cv, i) => (
            <View key={`cv-${i}`} style={styles.customItemRow}>
              <Ionicons
                name={cv.date ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={cv.date ? theme.success : theme.border}
              />
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => { setSelectedDate(cv.date || null); setHospitalInput(cv.hospital || ''); setDateModalTarget({ type: 'vaccine', key: `custom-v-${i}`, label: cv.name }); }}
              >
                <Text style={styles.customItemName}>{cv.name}</Text>
                <Text style={styles.vaccineDate}>{cv.date ? `${cv.date}${cv.hospital ? ` · ${cv.hospital}` : ''}` : '탭하여 접종일 기록'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setCustomVaccines((prev) => prev.filter((_, j) => j !== i))}>
                <Ionicons name="close-circle-outline" size={18} color={theme.subtext} />
              </TouchableOpacity>
            </View>
          ))}

          {/* 접종 항목 추가 */}
          {showAddInput === 'vaccine' ? (
            <View style={styles.addInputRow}>
              <TextInput
                style={styles.addInput}
                placeholder="접종 항목명 입력"
                placeholderTextColor={theme.subtext}
                value={addInputText}
                onChangeText={setAddInputText}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => {
                  if (addInputText.trim()) {
                    const name = addInputText.trim();
                    const newIndex = customVaccines.length;
                    setCustomVaccines((prev) => [...prev, { name }]);
                    setAddInputText('');
                    setShowAddInput(null);
                    // 추가 후 바로 날짜 입력 모달 열기
                    setTimeout(() => setDateModalTarget({ type: 'vaccine', key: `custom-v-${newIndex}`, label: name }), 300);
                  }
                }}
              >
                <Ionicons name="checkmark-circle" size={28} color={theme.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowAddInput(null); setAddInputText(''); }}>
                <Ionicons name="close-circle" size={28} color={theme.subtext} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddInput('vaccine')} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={18} color={theme.primary} />
              <Text style={styles.addBtnText}>접종 항목 추가</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('https://nip.kdca.go.kr')} activeOpacity={0.7}>
            <Ionicons name="open-outline" size={14} color={theme.primary} />
            <Text style={styles.linkRowText}>예방접종도우미 (접종기관 검색)</Text>
          </TouchableOpacity>
        </View>

        {/* ── 영유아 건강검진 ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>🩺</Text>
            <Text style={styles.sectionTitle}>영유아 건강검진</Text>
          </View>
          <View style={styles.card}>
            {getHealthCheckupSchedule(babyMonths).map((item, i) => {
              const roundKey = String(item.round);
              const recordDate = checkupRecords[roundKey];
              const isDone = !!recordDate;
              const isOverdue = !isDone && item.isPast;
              return (
                <View key={i}>
                  {i > 0 && <View style={styles.divider} />}
                  <TouchableOpacity
                    style={[styles.vaccineRow, (item.isCurrent || isOverdue) && styles.vaccineRowCurrent]}
                    onPress={() => {
                      if (recordDate) {
                        const hospital = checkupHospitals[roundKey];
                        const info = [`검진일: ${recordDate}`, hospital ? `병원: ${hospital}` : ''].filter(Boolean).join('\n');
                        Alert.alert(`${item.round}차 검진`, info, [
                          { text: '닫기' },
                          { text: '수정', onPress: () => { setSelectedDate(recordDate); setHospitalInput(checkupHospitals[roundKey] || ''); setDateModalTarget({ type: 'checkup', key: roundKey, label: `${item.round}차 검진` }); } },
                          { text: '기록 삭제', style: 'destructive', onPress: () => setCheckupDate(roundKey, null) },
                        ]);
                      } else {
                        setHospitalInput('');
                        setDateModalTarget({ type: 'checkup', key: roundKey, label: `${item.round}차 검진 (${item.ageRange})` });
                      }
                    }}
                    activeOpacity={0.6}
                  >
                    <View style={styles.vaccineLeft}>
                      <View style={[
                        styles.vaccineDot,
                        isDone && styles.vaccineDotDone,
                        isOverdue && styles.vaccineDotOverdue,
                        item.isCurrent && !isDone && !isOverdue && styles.vaccineDotCurrent,
                      ]}>
                        {isDone && <Ionicons name="checkmark" size={10} color="#fff" />}
                        {isOverdue && <Ionicons name="alert" size={10} color="#fff" />}
                        {item.isCurrent && !isDone && <Ionicons name="time" size={10} color="#fff" />}
                      </View>
                      <Text style={[
                        styles.vaccineMonth,
                        item.isCurrent && !isDone && styles.vaccineMonthCurrent,
                        isOverdue && { color: '#FF3B30' },
                      ]}>
                        {item.round}차
                      </Text>
                    </View>
                    <View style={styles.vaccineRight}>
                      <Text style={[styles.vaccineName, isDone && styles.vaccineNameDone]}>{item.ageRange}</Text>
                      <Text style={styles.vaccineNote}>{item.items.join(', ')}</Text>
                      {recordDate && <Text style={styles.vaccineDate}>{recordDate}{checkupHospitals[roundKey] ? ` · ${checkupHospitals[roundKey]}` : ''}</Text>}
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* 사용자 추가 검진 항목 */}
          {customCheckups.map((cc, i) => (
            <View key={`cc-${i}`} style={styles.customItemRow}>
              <Ionicons
                name={cc.date ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={cc.date ? theme.success : theme.border}
              />
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => { setSelectedDate(cc.date || null); setHospitalInput(cc.hospital || ''); setDateModalTarget({ type: 'checkup', key: `custom-c-${i}`, label: cc.name }); }}
              >
                <Text style={styles.customItemName}>{cc.name}</Text>
                {cc.date && <Text style={styles.vaccineDate}>{cc.date}{cc.hospital ? ` · ${cc.hospital}` : ''}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setCustomCheckups((prev) => prev.filter((_, j) => j !== i))}>
                <Ionicons name="close-circle-outline" size={18} color={theme.subtext} />
              </TouchableOpacity>
            </View>
          ))}

          {showAddInput === 'checkup' ? (
            <View style={styles.addInputRow}>
              <TextInput
                style={styles.addInput}
                placeholder="검진 항목명 입력"
                placeholderTextColor={theme.subtext}
                value={addInputText}
                onChangeText={setAddInputText}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => {
                  if (addInputText.trim()) {
                    setCustomCheckups((prev) => [...prev, { name: addInputText.trim() }]);
                    setAddInputText('');
                    setShowAddInput(null);
                  }
                }}
              >
                <Ionicons name="checkmark-circle" size={28} color={theme.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowAddInput(null); setAddInputText(''); }}>
                <Ionicons name="close-circle" size={28} color={theme.subtext} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddInput('checkup')} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={18} color={theme.primary} />
              <Text style={styles.addBtnText}>검진 항목 추가</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── 정부 지원금 (앱 내 상세) ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>💰</Text>
            <Text style={styles.sectionTitle}>정부 지원금</Text>
          </View>
          {SUPPORT_DETAIL.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.supportCard, expandedSupport === i && styles.supportCardExpanded]}
              onPress={() => setExpandedSupport(expandedSupport === i ? null : i)}
              activeOpacity={0.7}
            >
              <View style={styles.supportHeader}>
                <Text style={styles.supportEmoji}>{item.emoji}</Text>
                <Text style={styles.supportTitle}>{item.title}</Text>
                <Ionicons
                  name={expandedSupport === i ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.subtext}
                />
              </View>
              {expandedSupport === i && (
                <View style={styles.supportBody}>
                  <View style={styles.supportRow}>
                    <Text style={styles.supportLabel}>지원대상</Text>
                    <Text style={styles.supportValue}>{item.target}</Text>
                  </View>
                  <View style={styles.supportRow}>
                    <Text style={styles.supportLabel}>지원금액</Text>
                    <Text style={[styles.supportValue, { color: theme.primary, fontWeight: '600' }]}>{item.amount}</Text>
                  </View>
                  <View style={styles.supportRow}>
                    <Text style={styles.supportLabel}>신청방법</Text>
                    <Text style={styles.supportValue}>{item.how}</Text>
                  </View>
                  {item.note && (
                    <View style={styles.supportNoteRow}>
                      <Ionicons name="information-circle-outline" size={14} color={theme.subtext} />
                      <Text style={styles.supportNote}>{item.note}</Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))}

        </View>

        {/* ── 어린이집 / 유치원 ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>🏫</Text>
            <Text style={styles.sectionTitle}>어린이집 / 유치원</Text>
          </View>

          {/* 외부 사이트 */}
          <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('https://www.childcare.go.kr')} activeOpacity={0.7}>
            <Ionicons name="open-outline" size={14} color={theme.primary} />
            <Text style={styles.linkRowText}>아이사랑포털 (어린이집 검색/대기 신청)</Text>
          </TouchableOpacity>
        </View>

        {/* ── 유용한 사이트 ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>🔗</Text>
            <Text style={styles.sectionTitle}>유용한 사이트</Text>
          </View>
          {[
            { name: '복지로', desc: '맞춤형 복지 서비스 검색', url: 'https://www.bokjiro.go.kr' },
            { name: '정부24', desc: '출생신고, 각종 민원', url: 'https://www.gov.kr' },
          ].map((item, i) => (
            <TouchableOpacity key={i} style={styles.linkRow} onPress={() => Linking.openURL(item.url)} activeOpacity={0.7}>
              <Ionicons name="open-outline" size={14} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.linkRowText}>{item.name}</Text>
                <Text style={styles.linkRowDesc}>{item.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.disclaimer}>
          위 정보는 {new Date().getFullYear()}년 기준 참고용이며, 정확한 내용은 해당 기관에 확인하세요.
        </Text>
      </ScrollView>

      {/* 날짜 선택 모달 (접종/검진 공용) */}
      {dateModalTarget && (() => {
        const today = new Date().toISOString().slice(0, 10);
        const confirmSave = () => {
          const date = selectedDate;
          if (!date) return;
          const hospital = hospitalInput.trim();
          if (dateModalTarget.type === 'vaccine') {
            if (dateModalTarget.key.startsWith('custom-v-')) {
              const idx = parseInt(dateModalTarget.key.split('-')[2]);
              setCustomVaccines((prev) => prev.map((v, i) => i === idx ? { ...v, date, hospital: hospital || undefined } : v));
            } else {
              setVaccinationDate(dateModalTarget.key, date, hospital);
            }
          } else {
            if (dateModalTarget.key.startsWith('custom-c-')) {
              const idx = parseInt(dateModalTarget.key.split('-')[2]);
              setCustomCheckups((prev) => prev.map((c, i) => i === idx ? { ...c, date, hospital: hospital || undefined } : c));
            } else {
              setCheckupDate(dateModalTarget.key, date, hospital);
            }
          }
          setSelectedDate(null);
          setHospitalInput('');
          setDateModalTarget(null);
        };
        return (
          <Modal visible transparent animationType="fade">
            <View style={styles.dateModalOverlay}>
              <View style={styles.dateModalContent}>
                <Text style={styles.dateModalTitle}>{dateModalTarget.label}</Text>
                <Text style={styles.dateModalDesc}>1. 날짜를 선택하세요</Text>
                <DatePickerButton
                  value={selectedDate}
                  onChange={(date) => setSelectedDate(date)}
                  placeholder="캘린더에서 선택"
                  minimumDate={babyBirthDate ? new Date(babyBirthDate + 'T00:00:00') : undefined}
                />
                <TouchableOpacity
                  style={styles.todayRecordBtn}
                  onPress={() => setSelectedDate(today)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.todayRecordText}>오늘({today}) 선택</Text>
                </TouchableOpacity>
                <Text style={[styles.dateModalDesc, { marginTop: 4 }]}>2. 병원명 (선택사항)</Text>
                <TextInput
                  style={styles.hospitalInput}
                  placeholder="예: 서울소아과"
                  placeholderTextColor={theme.subtext}
                  value={hospitalInput}
                  onChangeText={setHospitalInput}
                />
                <TouchableOpacity
                  style={[styles.confirmBtn, !selectedDate && styles.confirmBtnDisabled]}
                  onPress={confirmSave}
                  disabled={!selectedDate}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.confirmBtnText, !selectedDate && styles.confirmBtnTextDisabled]}>
                    {selectedDate ? '기록 완료' : '날짜를 먼저 선택하세요'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateModalCancel}
                  onPress={() => { setSelectedDate(null); setHospitalInput(''); setDateModalTarget(null); }}
                >
                  <Text style={styles.dateModalCancelText}>취소</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        );
      })()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scrollContent: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', color: theme.text, paddingTop: 16 },
  subtitle: { fontSize: 14, color: theme.primary, fontWeight: '600', marginTop: 4, marginBottom: 20 },

  // ── 섹션 ──
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  sectionEmoji: { fontSize: 18 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: theme.text },
  progressBadge: { marginLeft: 'auto', backgroundColor: 'rgba(78,205,196,0.12)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  progressBadgeText: { fontSize: 12, fontWeight: '600', color: '#4ECDC4' },

  // ── 현재 접종 하이라이트 ──
  currentHighlight: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(255,126,103,0.08)', borderRadius: 12, padding: 12, marginBottom: 10 },
  currentHighlightText: { flex: 1, fontSize: 13, color: theme.text, lineHeight: 20 },

  // ── 예방접종/건강검진 카드 ──
  card: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  vaccineRow: { flexDirection: 'row', padding: 14, gap: 12 },
  vaccineRowCurrent: { backgroundColor: 'rgba(255,126,103,0.06)' },
  vaccineLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, width: 100 },
  vaccineDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: theme.border, backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  vaccineDotDone: { backgroundColor: theme.success, borderColor: theme.success },
  vaccineDotCurrent: { borderColor: theme.primary, backgroundColor: theme.primary },
  vaccineDotOverdue: { borderColor: '#FF3B30', backgroundColor: '#FF3B30' },
  vaccineMonth: { fontSize: 13, fontWeight: '600', color: theme.subtext },
  vaccineMonthCurrent: { color: theme.primary, fontWeight: '700' },
  vaccineStatus: { fontSize: 10, color: theme.subtext, marginTop: 1 },
  vaccineRight: { flex: 1, gap: 2 },
  vaccineName: { fontSize: 13, color: theme.text, lineHeight: 20 },
  vaccineNameDone: { color: theme.subtext, textDecorationLine: 'line-through' },
  vaccineItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },

  // ── 항목 추가 ──
  customItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: theme.border },
  customItemName: { fontSize: 13, color: theme.text },
  addInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  addInput: { flex: 1, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, fontSize: 14, color: theme.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  addBtnText: { fontSize: 14, fontWeight: '600', color: theme.primary },

  // ── 날짜 선택 모달 ──
  dateModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  dateModalContent: { backgroundColor: theme.card, borderRadius: 16, padding: 24, width: '85%', gap: 16 },
  dateModalTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text },
  dateModalDesc: { fontSize: 14, color: theme.subtext },
  hospitalInput: { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, fontSize: 14, color: theme.text },
  todayRecordBtn: { backgroundColor: 'rgba(255,126,103,0.1)', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  todayRecordText: { fontSize: 14, fontWeight: '600', color: theme.primary },
  confirmBtn: { backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  confirmBtnDisabled: { backgroundColor: theme.border },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  confirmBtnTextDisabled: { color: theme.subtext },
  dateModalCancel: { alignItems: 'center', paddingVertical: 10 },
  dateModalCancelText: { fontSize: 15, color: theme.subtext },
  vaccineDate: { fontSize: 11, color: theme.success, marginLeft: 'auto' },
  vaccineNote: { fontSize: 11, color: theme.subtext, marginTop: 2 },
  divider: { height: 1, backgroundColor: theme.border },

  // ── 정부 지원금 (아코디언) ──
  supportCard: { backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 8, overflow: 'hidden' },
  supportCardExpanded: { borderColor: theme.primary },
  supportHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  supportEmoji: { fontSize: 20 },
  supportTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.text },
  supportBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  supportRow: { gap: 2 },
  supportLabel: { fontSize: 11, fontWeight: '600', color: theme.subtext },
  supportValue: { fontSize: 14, color: theme.text, lineHeight: 20 },
  supportNoteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 8, padding: 10 },
  supportNote: { flex: 1, fontSize: 12, color: theme.subtext, lineHeight: 18 },

  // ── API 공통 ──
  apiSection: { marginTop: 12 },
  searchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 12 },
  searchBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  apiError: { fontSize: 13, color: theme.subtext, textAlign: 'center', marginTop: 12 },
  apiResultTitle: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 8 },
  resultList: { marginTop: 12, gap: 8 },
  resultCard: { backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 12, gap: 4 },
  resultName: { fontSize: 14, fontWeight: '600', color: theme.text },
  resultAddr: { fontSize: 12, color: theme.subtext },
  resultTel: { fontSize: 13, color: theme.primary, fontWeight: '500', marginTop: 2 },

  // ── 어린이집 ──
  ccRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ccBadges: { flexDirection: 'row', gap: 4 },
  ccBadge: { backgroundColor: 'rgba(255,126,103,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  ccBadgeText: { fontSize: 10, fontWeight: '600', color: theme.primary },
  ccRatingBadge: { backgroundColor: 'rgba(78,205,196,0.12)' },
  ccRatingText: { fontSize: 10, fontWeight: '600', color: '#4ECDC4' },
  ccCapacity: { fontSize: 12, color: theme.subtext },

  // ── 링크 ──
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  linkRowText: { fontSize: 14, color: theme.primary, fontWeight: '500' },
  linkRowDesc: { fontSize: 12, color: theme.subtext },

  // ── 지역 선택 모달 ──
  regionOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  regionSheet: { backgroundColor: theme.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  regionHandle: { width: 36, height: 5, borderRadius: 2.5, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 12 },
  regionTitle: { fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 12 },
  regionList: { paddingBottom: 20 },
  regionItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  regionItemText: { fontSize: 15, color: theme.text },

  disclaimer: { fontSize: 11, color: theme.subtext, textAlign: 'center', opacity: 0.6, lineHeight: 16 },
});
