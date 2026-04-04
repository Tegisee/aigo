import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  TextInput,
  Modal,
  ActivityIndicator,
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import { theme } from '../../constants/theme';
import { useAppStore } from '../../store/useAppStore';
import { generateDeepLink, hasCoupangApiKeys } from '../../services/coupangApi';
import CoupangScraper, { ScrapedProduct } from '../../components/CoupangScraper';
import DatePickerButton from '../../components/DatePickerButton';
import { estimateRepurchaseDays, isConsumableCategory } from '../../services/repurchase';

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { trackedItems, removeItem, updateTargetPrice, updateItemPrice, addPurchase } = useAppStore();

  const item = trackedItems.find((i) => i.id === id);

  const [showPriceModal, setShowPriceModal] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [refreshing, setRefreshing] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRefresh = useCallback(() => {
    if (!item || refreshing) return;
    setRefreshing(true);
    const targetUrl = item.resolvedUrl || item.url;
    setScrapeUrl(targetUrl);
    timeoutRef.current = setTimeout(() => {
      setRefreshing(false);
      setScrapeUrl(null);
    }, 15000);
  }, [item, refreshing]);

  const handleScrapeResult = useCallback((data: ScrapedProduct) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (item && data.price > 0) {
      updateItemPrice(item.id, data.price);
    }
    setRefreshing(false);
    setScrapeUrl(null);
  }, [item, updateItemPrice]);

  const handleScrapeError = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    Alert.alert('실패', '가격 정보를 가져올 수 없습니다');
    setRefreshing(false);
    setScrapeUrl(null);
  }, []);

  if (!item) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>상품을 찾을 수 없습니다</Text>
      </SafeAreaView>
    );
  }

  const prices = item.priceHistory.map((p) => p.price);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const hasChartData = item.priceHistory.length > 1;
  const isAllSamePrice = hasChartData && new Set(prices).size === 1;

  // 추적 기간 계산 (일)
  const trackingDays = item.priceHistory.length >= 2
    ? Math.max(1, Math.round(
        (new Date(item.priceHistory[item.priceHistory.length - 1].date).getTime() -
         new Date(item.priceHistory[0].date).getTime()) / 86400000
      ))
    : 0;

  const chartData = item.priceHistory.map((entry, i) => {
    const total = item.priceHistory.length;
    const showLabel = i === 0 || i === total - 1 ||
      (total > 4 && i === Math.floor(total / 2));
    const dateLabel = showLabel
      ? `${entry.date.slice(5, 7)}/${entry.date.slice(8, 10)}`
      : '';
    return {
      value: entry.price,
      label: dateLabel,
      labelTextStyle: { color: theme.subtext, fontSize: 10 },
    };
  });

  const hasTarget = item.targetPrice != null && item.targetPrice > 0;
  const targetLineData = hasTarget
    ? item.priceHistory.map(() => ({ value: item.targetPrice! }))
    : [];

  const createdDate = new Date(item.createdAt);
  const dateStr = `${createdDate.getFullYear()}.${String(createdDate.getMonth() + 1).padStart(2, '0')}.${String(createdDate.getDate()).padStart(2, '0')}`;

  // 다음 가격 확인 시간 계산 (KST 08/14/21시)
  const getNextCheckTime = () => {
    const now = new Date();
    const kstOffset = 9 * 60;
    const kstMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + kstOffset;
    const kstHour = Math.floor((kstMinutes % 1440) / 60);
    const checkHours = [8, 14, 21];
    const next = checkHours.find((h) => h > kstHour);
    if (next !== undefined) return `오늘 ${next}:00`;
    return '내일 08:00';
  };

  // 가격 하락 여부 (이전 가격 대비)
  const hasPriceDrop = item.priceHistory.length >= 2 &&
    item.currentPrice < item.priceHistory[item.priceHistory.length - 2]?.price;

  // 가격 인사이트 메시지 생성
  const priceInsights: { icon: string; text: string; color: string }[] = [];
  if (item.priceHistory.length >= 2) {
    // 현재가 = 최저가
    if (item.currentPrice <= minPrice) {
      priceInsights.push({ icon: '🔥', text: `현재가가 ${trackingDays}일간 최저가입니다`, color: theme.success });
    }
    // 목표가 도달 (목표가 설정된 경우만)
    if (hasTarget && item.currentPrice <= item.targetPrice!) {
      priceInsights.push({ icon: '🎯', text: `목표가(${item.targetPrice!.toLocaleString()}원) 이하입니다`, color: theme.primary });
    }
    // 목표가까지 남은 금액 (목표가 설정된 경우만)
    if (hasTarget && item.currentPrice > item.targetPrice!) {
      const diff = item.currentPrice - item.targetPrice!;
      const pct = Math.round((diff / item.currentPrice) * 100);
      priceInsights.push({ icon: '📉', text: `목표가까지 ${diff.toLocaleString()}원 (${pct}%) 남음`, color: theme.subtext });
    }
    // N일간 가격 변동 없음 (동일가가 아닌 경우에도, 최근 3일 이상 동일 시)
    if (!isAllSamePrice && prices.length >= 3) {
      let noChangeDays = 1;
      for (let i = prices.length - 2; i >= 0; i--) {
        if (prices[i] === prices[prices.length - 1]) noChangeDays++;
        else break;
      }
      if (noChangeDays >= 3) {
        priceInsights.push({ icon: '➡️', text: `최근 ${noChangeDays}일간 가격변동 없음`, color: theme.subtext });
      }
    }
    // 최저가 대비 현재가
    if (item.currentPrice > minPrice) {
      const diff = item.currentPrice - minPrice;
      priceInsights.push({ icon: '💰', text: `${trackingDays}일간 최저가 ${minPrice.toLocaleString()}원 (현재보다 ${diff.toLocaleString()}원 낮음)`, color: theme.subtext });
    }
  }

  const [showShareSheet, setShowShareSheet] = useState(false);
  const [customMent, setCustomMent] = useState('');

  const shareMentTemplates = [
    '{name}가 이거 갖고 싶대요!',
    '할머니~ {name} 선물로 이거 어때요?',
    '{name} 생일선물로 점찍어뒀어요',
    '{name}에게 딱 맞는 상품 발견!',
    '이거 {name}한테 사주면 좋겠다~',
  ];

  const handleShareWithMent = async (ment: string) => {
    setShowShareSheet(false);
    setCustomMent('');
    let shareUrl = item.url;
    if (!shareUrl.includes('link.coupang.com') && !shareUrl.includes('coupa.ng') && hasCoupangApiKeys()) {
      try {
        const target = item.resolvedUrl || item.url;
        const deepLink = await generateDeepLink(target, 'share');
        if (deepLink?.shortenUrl) shareUrl = deepLink.shortenUrl;
      } catch {}
    }
    const drop = hasPriceDrop
      ? `${item.priceHistory[item.priceHistory.length - 2].price.toLocaleString()}원 → ${item.currentPrice.toLocaleString()}원으로 하락!`
      : `현재 ${item.currentPrice.toLocaleString()}원`;
    const babyName = useAppStore.getState().babyName || '우리 아이';
    const mentText = ment ? ment.replace(/\{name\}/g, babyName) : '';
    const mentLine = mentText ? `${mentText}\n\n` : '';
    const message = `${mentLine}${item.productName}\n${drop}\n\n${shareUrl}\n\n이 앱은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.`;
    try {
      await Share.share({ message });
    } catch {}
  };

  const handleDelete = () => {
    Alert.alert('관심상품 삭제', '관심상품에서 삭제하시겠어요?\n해당 상품의 알림도 자동 중단됩니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          removeItem(item.id);
          router.back();
        },
      },
    ]);
  };

  const handleUpdatePrice = () => {
    const price = parseInt(newPrice, 10);
    if (!price || price <= 0) {
      Alert.alert('오류', '올바른 가격을 입력해주세요');
      return;
    }
    updateTargetPrice(item.id, price);
    setShowPriceModal(false);
    setNewPrice('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
          <Text style={styles.headerBtnText}>홈</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={handleRefresh}
            style={styles.headerBtn}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons name="refresh" size={22} color={theme.text} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.headerBtn}>
            <Ionicons name="trash-outline" size={22} color="#FF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Product Info */}
        <View style={styles.productSection}>
          {item.thumbnail ? (
            <Image source={{ uri: item.thumbnail }} style={styles.thumbnailLargeImg} />
          ) : (
            <View style={styles.thumbnailLarge}>
              <Ionicons name="bag-handle-outline" size={48} color={theme.subtext} />
            </View>
          )}
          <Text style={styles.productName}>{item.productName}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>쿠팡</Text>
            <View style={styles.metaDot} />
            <Text style={styles.metaText}>등록일 {dateStr}</Text>
          </View>
        </View>

        {/* 목표가 */}
        <TouchableOpacity
          style={styles.targetRow}
          onPress={() => {
            setNewPrice(hasTarget ? String(item.targetPrice) : '');
            setShowPriceModal(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.gridLabelRow}>
            <Text style={styles.gridLabel}>목표가</Text>
            <Ionicons name="pencil" size={12} color={theme.subtext} />
          </View>
          {hasTarget ? (
            <Text style={[styles.gridValue, { color: theme.primary }]}>
              {item.targetPrice!.toLocaleString()}원
            </Text>
          ) : (
            <Text style={[styles.gridValue, { color: theme.subtext }]}>
              설정하기
            </Text>
          )}
        </TouchableOpacity>

        {/* Price Stats */}
        <View style={styles.gridSection}>
          <View style={styles.gridRow}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>현재가</Text>
              <Text style={styles.gridValue}>
                {item.currentPrice.toLocaleString()}원
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>최저가</Text>
              <Text style={[styles.gridValue, { color: theme.success }]}>
                {minPrice.toLocaleString()}원
              </Text>
            </View>
          </View>
          <View style={styles.gridRow}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>최고가</Text>
              <Text style={[styles.gridValue, { color: '#FF4444' }]}>
                {maxPrice.toLocaleString()}원
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>평균가</Text>
              <Text style={styles.gridValue}>
                {avgPrice.toLocaleString()}원
              </Text>
            </View>
          </View>
        </View>

        {/* Chart */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>가격 변동</Text>
          {hasChartData ? (
            <View style={styles.chartWrap}>
              <LineChart
                data={chartData}
                {...(hasTarget ? { data2: targetLineData } : {})}
                width={300}
                height={140}
                color={theme.primary}
                {...(hasTarget ? { color2: theme.primary, thickness2: 1, strokeDashArray2: [6, 4], hideDataPoints2: true } : {})}
                thickness={2}
                hideDataPoints={false}
                dataPointsColor={theme.primary}
                dataPointsRadius={3}
                hideYAxisText
                hideRules
                yAxisColor="transparent"
                xAxisColor={theme.border}
                xAxisThickness={1}
                curved
                isAnimated={false}
                initialSpacing={10}
                endSpacing={10}
                spacing={45}
                adjustToWidth
                startFillColor={theme.primary}
                endFillColor="transparent"
                startOpacity={0.15}
                endOpacity={0}
                areaChart
              />
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendLine, { backgroundColor: theme.primary }]} />
                  <Text style={styles.legendText}>가격</Text>
                </View>
                {hasTarget && (
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDash, { borderColor: theme.primary }]} />
                    <Text style={styles.legendText}>목표가 {item.targetPrice!.toLocaleString()}원</Text>
                  </View>
                )}
              </View>
              {isAllSamePrice && (
                <Text style={styles.noChangeText}>
                  최근 {trackingDays}일간 가격변동이 없었습니다
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.chartEmpty}>
              <View style={styles.emptyPriceRow}>
                <Text style={styles.chartSinglePrice}>
                  {item.currentPrice > 0
                    ? `${item.currentPrice.toLocaleString()}원`
                    : '가격 정보 없음'}
                </Text>
                {item.currentPrice > 0 && hasTarget && item.currentPrice > item.targetPrice! && (
                  <Text style={styles.emptyTargetDiff}>
                    목표가까지 -{(item.currentPrice - item.targetPrice!).toLocaleString()}원
                  </Text>
                )}
                {item.currentPrice > 0 && hasTarget && item.currentPrice <= item.targetPrice! && (
                  <Text style={[styles.emptyTargetDiff, { color: theme.success }]}>
                    목표가 이하
                  </Text>
                )}
                {item.currentPrice > 0 && !hasTarget && (
                  <Text style={styles.emptyTargetDiff}>
                    최저가 갱신 시 알림을 보내드려요
                  </Text>
                )}
              </View>
              <View style={styles.emptyDivider} />
              <View style={styles.emptyInfoList}>
                <View style={styles.emptyInfoRow}>
                  <Ionicons name="calendar-outline" size={14} color={theme.subtext} />
                  <Text style={styles.emptyInfoText}>알림 시작: {dateStr}</Text>
                </View>
                <View style={styles.emptyInfoRow}>
                  <Ionicons name="time-outline" size={14} color={theme.subtext} />
                  <Text style={styles.emptyInfoText}>다음 확인: {getNextCheckTime()}</Text>
                </View>
                <View style={styles.emptyInfoRow}>
                  <Ionicons name="bar-chart-outline" size={14} color={theme.subtext} />
                  <Text style={styles.emptyInfoText}>데이터 축적 중 — 내일부터 그래프가 표시됩니다</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Price Insights */}
        {priceInsights.length > 0 && (
          <View style={styles.insightSection}>
            {priceInsights.map((insight, i) => (
              <View key={i} style={styles.insightRow}>
                <Text style={styles.insightIcon}>{insight.icon}</Text>
                <Text style={[styles.insightText, { color: insight.color }]}>{insight.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 구매 이력 */}
        <View style={styles.purchaseSection}>
          <View style={styles.purchaseHeader}>
            <Text style={styles.sectionTitle}>구매 이력</Text>
            <TouchableOpacity
              style={styles.addPurchaseBtn}
              onPress={() => {
                setPurchasePrice(String(item.currentPrice));
                setPurchaseDate(new Date().toISOString().slice(0, 10));
                setShowPurchaseModal(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={18} color={theme.primary} />
              <Text style={styles.addPurchaseText}>구매 추가</Text>
            </TouchableOpacity>
          </View>
          {/* 소모품 자동 소진 예상 */}
          {isConsumableCategory(item.category) && item.repurchaseEnabled && item.repurchaseDays && (
            <View style={styles.estimateCard}>
              <View style={styles.estimateRow}>
                <Ionicons name="timer-outline" size={16} color={theme.primary} />
                <Text style={styles.estimateText}>
                  예상 소진 주기: 약 {item.repurchaseDays}일
                </Text>
              </View>
              {(() => {
                const babyMonths = useAppStore.getState().babyBirthDate ? (() => {
                  const birth = new Date(useAppStore.getState().babyBirthDate!);
                  const now = new Date();
                  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
                })() : null;
                const est = estimateRepurchaseDays(item.productName, item.category, babyMonths);
                if (est) {
                  return <Text style={styles.estimateDesc}>{est.description}</Text>;
                }
                return null;
              })()}
            </View>
          )}

          {item.purchaseHistory && item.purchaseHistory.length > 0 ? (
            <View style={styles.purchaseList}>
              {[...item.purchaseHistory].reverse().map((p, i) => (
                <View key={i} style={styles.purchaseRow}>
                  <View style={styles.purchaseDot} />
                  <Text style={styles.purchaseDate}>{p.date}</Text>
                  <Text style={styles.purchasePrice}>{p.price.toLocaleString()}원</Text>
                </View>
              ))}
              <Text style={styles.purchaseSummary}>
                총 {item.purchaseHistory.length}회 구매
              </Text>
            </View>
          ) : (
            <View style={styles.purchaseEmpty}>
              <Text style={styles.purchaseEmptyText}>아직 구매 이력이 없어요</Text>
            </View>
          )}
        </View>

        <Text style={styles.affiliateText}>
          이 앱은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
        </Text>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={async () => {
              // 이미 제휴 링크이면 바로 이동
              if (item.url.includes('link.coupang.com') || item.url.includes('coupa.ng')) {
                Linking.openURL(item.url);
                return;
              }
              // 제휴 링크 없는 기존 상품 → 실시간 딥링크 생성
              if (hasCoupangApiKeys()) {
                try {
                  const target = item.resolvedUrl || item.url;
                  const deepLink = await generateDeepLink(target, 'tracked');
                  if (deepLink?.shortenUrl) {
                    Linking.openURL(deepLink.shortenUrl);
                    return;
                  }
                } catch {}
              }
              Linking.openURL(item.url);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.ctaText}>지금 구매하기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={() => setShowShareSheet(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="share-outline" size={22} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Target Price Edit Modal */}
      <Modal visible={showPriceModal} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>목표가 수정</Text>
            <TextInput
              style={styles.modalInput}
              value={newPrice}
              onChangeText={setNewPrice}
              keyboardType="number-pad"
              placeholder="목표 가격 입력"
              placeholderTextColor={theme.subtext}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowPriceModal(false);
                  setNewPrice('');
                }}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleUpdatePrice}
              >
                <Text style={styles.modalConfirmText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Purchase Add Modal */}
      <Modal visible={showPurchaseModal} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>구매 기록 추가</Text>

            <DatePickerButton
              label="구매 날짜"
              value={purchaseDate}
              onChange={setPurchaseDate}
              placeholder="날짜를 선택하세요"
            />

            <View style={{ height: 12 }} />
            <Text style={styles.inputLabel}>구매 가격</Text>
            <TextInput
              style={styles.modalInput}
              value={purchasePrice}
              onChangeText={setPurchasePrice}
              keyboardType="number-pad"
              placeholder="구매 가격 입력"
              placeholderTextColor={theme.subtext}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowPurchaseModal(false);
                  setPurchasePrice('');
                }}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => {
                  const price = parseInt(purchasePrice, 10);
                  if (!price || price <= 0) {
                    Alert.alert('오류', '올바른 가격을 입력해주세요');
                    return;
                  }
                  if (!purchaseDate) {
                    Alert.alert('오류', '구매 날짜를 선택해주세요');
                    return;
                  }
                  addPurchase(item.id, purchaseDate, price);
                  setShowPurchaseModal(false);
                  setPurchasePrice('');
                }}
              >
                <Text style={styles.modalConfirmText}>추가</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Share Ment Sheet */}
      <Modal visible={showShareSheet} transparent animationType="slide">
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setShowShareSheet(false)}
        >
          <View style={styles.sheetContent}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>사주세요 멘트 선택</Text>
            {shareMentTemplates.map((ment, i) => {
              const babyName = useAppStore.getState().babyName || '우리 아이';
              return (
                <TouchableOpacity
                  key={i}
                  style={styles.sheetItem}
                  onPress={() => handleShareWithMent(ment)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sheetItemText}>
                    {ment.replace(/\{name\}/g, babyName)}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {/* 직접 입력 */}
            <View style={styles.sheetCustomRow}>
              <TextInput
                style={styles.sheetCustomInput}
                placeholder="직접 입력..."
                placeholderTextColor={theme.subtext}
                value={customMent}
                onChangeText={setCustomMent}
                maxLength={50}
              />
              <TouchableOpacity
                style={[styles.sheetCustomBtn, !customMent.trim() && { opacity: 0.4 }]}
                onPress={() => {
                  if (customMent.trim()) handleShareWithMent(customMent.trim());
                }}
                disabled={!customMent.trim()}
                activeOpacity={0.7}
              >
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.sheetItem, styles.sheetItemPlain]}
              onPress={() => handleShareWithMent('')}
              activeOpacity={0.7}
            >
              <Text style={[styles.sheetItemText, { color: theme.subtext }]}>멘트 없이 공유</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Hidden WebView — 수동 가격 새로고침 */}
      <CoupangScraper
        url={scrapeUrl}
        onResult={handleScrapeResult}
        onError={handleScrapeError}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  errorText: {
    color: theme.subtext,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  headerBtnText: {
    color: theme.text,
    fontSize: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  productSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  thumbnailLarge: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: theme.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  thumbnailLargeImg: {
    width: 96,
    height: 96,
    borderRadius: 16,
    marginBottom: 16,
  },
  productName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    textAlign: 'center',
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    color: theme.subtext,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.subtext,
  },
  targetRow: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginTop: 8,
  },
  gridSection: {
    gap: 10,
    marginTop: 10,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  gridItem: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  gridLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridLabel: {
    fontSize: 12,
    color: theme.subtext,
    marginBottom: 6,
  },
  gridValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
  },
  chartSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
  chartWrap: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    overflow: 'hidden',
  },
  chartLegend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
  },
  legendDash: {
    width: 16,
    height: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  legendText: {
    fontSize: 11,
    color: theme.subtext,
  },
  chartEmpty: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 8,
  },
  emptyPriceRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  chartSinglePrice: {
    color: theme.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  emptyTargetDiff: {
    color: theme.subtext,
    fontSize: 12,
    marginTop: 4,
  },
  emptyDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 4,
  },
  emptyInfoList: {
    gap: 10,
    paddingVertical: 4,
  },
  emptyInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyInfoText: {
    color: theme.subtext,
    fontSize: 13,
    flex: 1,
  },
  noChangeText: {
    color: theme.subtext,
    fontSize: 12,
    marginTop: 10,
  },
  insightSection: {
    marginTop: 12,
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 10,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  insightIcon: {
    fontSize: 14,
    width: 20,
    textAlign: 'center',
  },
  insightText: {
    fontSize: 13,
    flex: 1,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: theme.background,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ctaButton: {
    flex: 1,
    backgroundColor: theme.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  shareButton: {
    width: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  affiliateText: {
    color: '#888888',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 20,
  },
  // ── 구매 이력 ──
  purchaseSection: {
    marginTop: 24,
  },
  purchaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addPurchaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addPurchaseText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  estimateCard: {
    backgroundColor: 'rgba(255, 126, 103, 0.08)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 4,
  },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  estimateText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  estimateDesc: {
    fontSize: 12,
    color: theme.subtext,
    marginLeft: 22,
  },
  purchaseList: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 12,
  },
  purchaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  purchaseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.primary,
  },
  purchaseDate: {
    fontSize: 13,
    color: theme.subtext,
    flex: 1,
  },
  purchasePrice: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  purchaseSummary: {
    fontSize: 12,
    color: theme.subtext,
    textAlign: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  purchaseEmpty: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  purchaseEmptyText: {
    fontSize: 14,
    color: theme.subtext,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 6,
  },
  dateInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  todayBtn: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 126, 103, 0.12)',
  },
  todayBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  // ── 공유 멘트 시트 ──
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
  sheetItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  sheetCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  sheetCustomInput: {
    flex: 1,
    backgroundColor: theme.background,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sheetCustomBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetItemPlain: {
    borderBottomWidth: 0,
    marginTop: 4,
  },
  sheetItemText: {
    fontSize: 15,
    color: theme.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
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
  modalInput: {
    backgroundColor: theme.background,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
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
    borderRadius: 10,
    backgroundColor: theme.primary,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
