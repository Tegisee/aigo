import { useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  Share,
  Image,
  ScrollView,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { useAppStore } from '../../store/useAppStore';
import { getCategoriesByMonth, type BabyCategory } from '../../types';
import { useRouter } from 'expo-router';
import { fetchGoldbox, searchProducts, hasCoupangApiKeys, generateDeepLink, type GoldboxProduct, type CoupangProduct } from '../../services/coupangApi';
import { fetchPopularByCategory, type SharedProduct } from '../../services/firebase';
import { getAppShareMessage } from '../../services/config';
import { getActiveEvents, type EventBanner } from '../../services/events';

export default function HomeScreen() {
  const router = useRouter();
  const { trackedItems, syncFromFirestore, babyBirthDate, babyName, babyGender, isLinked, children, selectedChildId, selectChild, parentInfo } = useAppStore();
  const appStateRef = useRef(AppState.currentState);
  const [goldbox, setGoldbox] = useState<GoldboxProduct[]>([]);
  const [categoryProducts, setCategoryProducts] = useState<Record<string, CoupangProduct[]>>({});
  const [loadingCategory, setLoadingCategory] = useState<string | null>(null);
  const [eventProducts, setEventProducts] = useState<Record<number, CoupangProduct[]>>({});
  const [loadingEvent, setLoadingEvent] = useState<number | null>(null);

  const displayName = babyName || '우리 아이';
  const babyMonths = babyBirthDate ? (() => {
    const birth = new Date(babyBirthDate);
    const now = new Date();
    return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  })() : null;
  const babyInfo = babyBirthDate ? (() => {
    const birth = new Date(babyBirthDate);
    const now = new Date();
    const days = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
    const ageText = babyMonths! < 1 ? '신생아' : `${babyMonths}개월`;
    return { ageText, days };
  })() : null;
  const categories = getCategoriesByMonth(babyMonths);
  const activeEvents = getActiveEvents(babyBirthDate, displayName, parentInfo);

  // 아이 전환 시 카테고리/추천 상품 초기화
  useEffect(() => {
    setCategoryProducts({});
    setEventProducts({});
  }, [selectedChildId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        syncFromFirestore();
      }
      appStateRef.current = nextState;
    });

    // 골드박스 로드 (필터링 없이 그대로 노출)
    AsyncStorage.getItem('goldbox-cache').then((cached) => {
      if (cached) {
        try { setGoldbox(JSON.parse(cached)); } catch {}
      }
    });
    if (hasCoupangApiKeys()) {
      fetchGoldbox('goldbox').then((data) => {
        if (data.length > 0) {
          setGoldbox(data);
          AsyncStorage.setItem('goldbox-cache', JSON.stringify(data)).catch(() => {});
        }
      }).catch(() => {});
    }

    return () => sub.remove();
  }, [syncFromFirestore]);

  const handleShareApp = async () => {
    try {
      await Share.share({ message: getAppShareMessage() });
    } catch {}
  };

  const categorySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCategoryPress = (cat: string) => {
    // 이미 로드된 경우 토글
    if (categoryProducts[cat]) {
      setCategoryProducts((prev) => {
        const next = { ...prev };
        delete next[cat];
        return next;
      });
      return;
    }
    // 디바운싱 300ms
    if (categorySearchTimer.current) clearTimeout(categorySearchTimer.current);
    setLoadingCategory(cat);
    categorySearchTimer.current = setTimeout(async () => {
      try {
        // 1순위: shared_products 인기 상품
        const popular = await fetchPopularByCategory(cat as BabyCategory, 5);
        if (popular.length > 0) {
          const mapped: CoupangProduct[] = popular.map((p) => ({
            productId: parseInt(p.productId) || 0,
            productName: p.productName,
            productPrice: p.currentPrice,
            productImage: p.thumbnail,
            productUrl: '', // shared_products는 URL 없음 → 상세로 이동
            categoryName: p.category,
            isRocket: false,
          }));
          setCategoryProducts((prev) => ({ ...prev, [cat]: mapped }));
          setLoadingCategory(null);
          return;
        }
      } catch {}

      // 2순위: 쿠팡 파트너스 API 검색 (월령+성별+카테고리 조합)
      if (hasCoupangApiKeys()) {
        const consumable = /기저귀|분유|물티슈|수유용품|이유식|유아식|스킨케어/.test(cat);
        const clothing = /의류|신발|장난감|가구|도서|학용품/.test(cat);

        let keyword = '';
        if (consumable) {
          // 소모품: "아기/유아 {카테고리}"
          const prefix = babyMonths !== null && babyMonths < 12 ? '아기' : '유아';
          keyword = `${prefix} ${cat}`;
        } else if (clothing && babyGender && babyGender !== 'unknown') {
          // 의류/신발/장난감: "남아/여아 아동 {카테고리}"
          const genderWord = babyGender === 'male' ? '남아' : '여아';
          keyword = `${genderWord} 아동 ${cat}`;
        } else {
          // 기본: "월령 {카테고리}"
          const ageKeyword = babyInfo ? `${babyInfo.ageText} ` : '';
          keyword = `${ageKeyword}${cat}`;
        }

        try {
          const products = await searchProducts(keyword, 10);
          setCategoryProducts((prev) => ({ ...prev, [cat]: products }));
        } catch {}
      }
      setLoadingCategory(null);
    }, 300);
  };

  const handleEventPress = useCallback(async (event: EventBanner, index: number) => {
    if (!event.keywords || event.keywords.length === 0) return;
    // 토글
    if (eventProducts[index]) {
      setEventProducts((prev) => { const n = { ...prev }; delete n[index]; return n; });
      return;
    }
    if (!hasCoupangApiKeys()) return;
    setLoadingEvent(index);
    try {
      const keyword = event.keywords[0];
      const products = await searchProducts(keyword, 5);
      setEventProducts((prev) => ({ ...prev, [index]: products }));
    } catch {}
    setLoadingEvent(null);
  }, [eventProducts]);

  const handleOpenCoupang = async () => {
    if (hasCoupangApiKeys()) {
      try {
        const deepLink = await generateDeepLink('https://www.coupang.com', 'home');
        if (deepLink?.shortenUrl) {
          Linking.openURL(deepLink.shortenUrl);
          return;
        }
      } catch {}
    }
    try {
      const canOpen = await Linking.canOpenURL('coupang://home');
      if (canOpen) { await Linking.openURL('coupang://home'); return; }
    } catch {}
    Linking.openURL('https://www.coupang.com');
  };

  const renderGoldboxItem = (product: GoldboxProduct) => (
    <TouchableOpacity
      key={product.productId}
      style={styles.goldboxCard}
      onPress={() => Linking.openURL(product.productUrl)}
      activeOpacity={0.8}
    >
      {product.productImage ? (
        <Image source={{ uri: product.productImage }} style={styles.goldboxImage} />
      ) : (
        <View style={[styles.goldboxImage, styles.goldboxImagePlaceholder]}>
          <Ionicons name="bag-outline" size={16} color={theme.subtext} />
        </View>
      )}
      <View style={styles.goldboxInfo}>
        <Text style={styles.goldboxName} numberOfLines={1}>{product.productName}</Text>
        <Text style={styles.goldboxPrice}>{product.productPrice.toLocaleString()}원</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 헤더 */}
        <View style={styles.headerRow}>
          <View style={styles.titleCol}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{displayName}</Text>
              {babyInfo && <View style={styles.ageBadge}><Text style={styles.ageBadgeText}>{babyInfo.ageText}</Text></View>}
            </View>
            {babyInfo && (
              <Text style={styles.dayCount}>태어난 지 {babyInfo.days.toLocaleString()}일째</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={handleShareApp} style={styles.headerIconBtn}>
              <Ionicons name="share-outline" size={22} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.profileBtn, !isLinked && styles.profileBtnWarn]}
              onPress={() => router.push('/modal/login')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isLinked ? 'person-circle' : 'person-circle-outline'}
                size={28}
                color={isLinked ? theme.primary : theme.subtext}
              />
              {!isLinked && <View style={styles.warnDot} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* 복수 아이 선택 */}
        {children.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.childSelector}
          >
            {children.map((child) => (
              <TouchableOpacity
                key={child.id}
                style={[styles.childChip, selectedChildId === child.id && styles.childChipActive]}
                onPress={() => selectChild(child.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.childChipText, selectedChildId === child.id && styles.childChipTextActive]}>
                  {child.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* 이벤트 배너 (기념일 / 시즌 / 부모) */}
        {activeEvents.length > 0 && (
          <View style={styles.eventSection}>
            {activeEvents.map((event, i) => (
              <View key={`${event.type}-${i}`}>
                <TouchableOpacity
                  style={[
                    styles.eventBanner,
                    event.type === 'anniversary' && styles.eventBannerAnniversary,
                    event.type === 'season' && styles.eventBannerSeason,
                    event.type === 'parent' && styles.eventBannerParent,
                  ]}
                  onPress={() => handleEventPress(event, i)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.eventEmoji}>{event.emoji}</Text>
                  <View style={styles.eventTextCol}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventSubtitle}>
                      {event.keywords ? '탭하여 추천 상품 보기' : event.subtitle}
                    </Text>
                  </View>
                  {event.daysLeft === 0 && (
                    <View style={styles.eventTodayBadge}>
                      <Text style={styles.eventTodayText}>TODAY</Text>
                    </View>
                  )}
                  {loadingEvent === i && (
                    <ActivityIndicator size="small" color={theme.primary} />
                  )}
                </TouchableOpacity>

                {/* 이벤트 추천 상품 */}
                {eventProducts[i] && eventProducts[i].length > 0 && (
                  <View style={styles.eventProductList}>
                    {eventProducts[i].map((p, pi) => (
                      <TouchableOpacity
                        key={`ev-${i}-${p.productId}-${pi}`}
                        style={styles.catProductCard}
                        onPress={() => Linking.openURL(p.productUrl)}
                        activeOpacity={0.8}
                      >
                        {p.productImage ? (
                          <Image source={{ uri: p.productImage }} style={styles.catProductImg} />
                        ) : (
                          <View style={[styles.catProductImg, styles.goldboxImagePlaceholder]}>
                            <Ionicons name="bag-outline" size={16} color={theme.subtext} />
                          </View>
                        )}
                        <View style={styles.catProductInfo}>
                          <Text style={styles.catProductName} numberOfLines={2}>{p.productName}</Text>
                          <Text style={styles.catProductPrice}>{p.productPrice.toLocaleString()}원</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* 관심상품 요약 */}
        {trackedItems.length > 0 && (
          <View style={styles.summaryCard}>
            <Ionicons name="heart" size={20} color={theme.primary} />
            <Text style={styles.summaryText}>관심상품 {trackedItems.length}개 알림 중</Text>
          </View>
        )}

        {/* 관심상품 가져오기 */}
        <TouchableOpacity style={styles.fetchBtn} onPress={handleOpenCoupang} activeOpacity={0.8}>
          <Ionicons name="cart-outline" size={22} color={theme.primary} />
          <View style={styles.fetchBtnText}>
            <Text style={styles.fetchBtnTitle}>관심상품 가져오기</Text>
            <Text style={styles.fetchBtnSub}>{displayName}에게 필요한 상품을 찾아보세요</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
        </TouchableOpacity>

        {/* 카테고리 추천 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {babyInfo ? `${babyInfo.ageText} 추천 카테고리` : '추천 카테고리'}
          </Text>
          <View style={styles.categoryGrid}>
            {categories.filter((c) => c !== '기타').map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryCard, categoryProducts[cat] && styles.categoryCardActive]}
                onPress={() => handleCategoryPress(cat)}
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryCardText, categoryProducts[cat] && styles.categoryCardTextActive]}>
                  {cat}
                </Text>
                {loadingCategory === cat && (
                  <Text style={styles.categoryLoading}>...</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* 카테고리별 추천 상품 리스트 */}
          {Object.entries(categoryProducts).map(([cat, products]) => (
            <View key={cat} style={styles.catProductSection}>
              <Text style={styles.catProductTitle}>{cat} 추천</Text>
              {products.length === 0 ? (
                <Text style={styles.catProductEmpty}>추천 상품을 불러올 수 없습니다</Text>
              ) : (
                products.slice(0, 5).map((p, idx) => (
                  <TouchableOpacity
                    key={`${cat}-${p.productId}-${idx}`}
                    style={styles.catProductCard}
                    onPress={() => Linking.openURL(p.productUrl)}
                    activeOpacity={0.8}
                  >
                    {p.productImage ? (
                      <Image source={{ uri: p.productImage }} style={styles.catProductImg} />
                    ) : (
                      <View style={[styles.catProductImg, styles.goldboxImagePlaceholder]}>
                        <Ionicons name="bag-outline" size={16} color={theme.subtext} />
                      </View>
                    )}
                    <View style={styles.catProductInfo}>
                      <Text style={styles.catProductName} numberOfLines={2}>{p.productName}</Text>
                      <Text style={styles.catProductPrice}>{p.productPrice.toLocaleString()}원</Text>
                    </View>
                    {p.isRocket && (
                      <View style={styles.rocketBadge}>
                        <Text style={styles.rocketText}>로켓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
          ))}
        </View>

        {/* 골드박스 */}
        {goldbox.length > 0 && (
          <View style={styles.section}>
            <View style={styles.goldboxHeader}>
              <Ionicons name="flash" size={14} color="#FFD700" />
              <Text style={styles.sectionTitle}>오늘의 특가</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.goldboxScroll}
            >
              {goldbox.map(renderGoldboxItem)}
            </ScrollView>
          </View>
        )}

        {/* 파트너스 안내 */}
        <Text style={styles.affiliateText}>
          이 앱은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
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
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  titleCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
  },
  dayCount: {
    fontSize: 12,
    color: theme.subtext,
    marginTop: 2,
  },
  ageBadge: {
    backgroundColor: 'rgba(255, 126, 103, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ageBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIconBtn: {
    padding: 6,
  },
  profileBtn: {
    padding: 2,
  },
  profileBtnWarn: {
    position: 'relative',
  },
  warnDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  childSelector: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  childChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  childChipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  childChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.subtext,
  },
  childChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  // ── 이벤트 배너 ──
  eventSection: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 4,
  },
  eventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  eventBannerAnniversary: {
    backgroundColor: 'rgba(255, 126, 103, 0.08)',
    borderColor: 'rgba(255, 126, 103, 0.2)',
  },
  eventBannerSeason: {
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderColor: 'rgba(255, 215, 0, 0.25)',
  },
  eventBannerParent: {
    backgroundColor: 'rgba(147, 112, 219, 0.08)',
    borderColor: 'rgba(147, 112, 219, 0.25)',
  },
  eventEmoji: {
    fontSize: 24,
  },
  eventTextCol: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  eventSubtitle: {
    fontSize: 12,
    color: theme.subtext,
    marginTop: 2,
  },
  eventTodayBadge: {
    backgroundColor: theme.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  eventTodayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  eventProductList: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 4,
  },

  // ── 관심상품 요약 ──
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: theme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },

  // ── 관심상품 가져오기 ──
  fetchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 14,
    backgroundColor: 'rgba(255, 126, 103, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 126, 103, 0.25)',
    borderRadius: 16,
  },
  fetchBtnText: {
    flex: 1,
  },
  fetchBtnTitle: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '600',
  },
  fetchBtnSub: {
    color: theme.subtext,
    fontSize: 12,
    marginTop: 2,
  },

  // ── 섹션 ──
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },

  // ── 카테고리 그리드 ──
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  categoryCardActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  categoryCardText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.text,
  },
  categoryCardTextActive: {
    color: '#fff',
  },
  categoryLoading: {
    fontSize: 12,
    color: theme.subtext,
    marginLeft: 4,
  },

  // ── 카테고리 추천 상품 ──
  catProductSection: {
    marginTop: 16,
  },
  catProductTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  catProductEmpty: {
    fontSize: 13,
    color: theme.subtext,
    textAlign: 'center',
    paddingVertical: 12,
  },
  catProductCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 10,
    gap: 10,
    marginBottom: 8,
  },
  catProductImg: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  catProductInfo: {
    flex: 1,
  },
  catProductName: {
    fontSize: 13,
    color: theme.text,
    lineHeight: 18,
  },
  catProductPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.primary,
    marginTop: 2,
  },
  rocketBadge: {
    backgroundColor: 'rgba(78, 205, 196, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  rocketText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4ECDC4',
  },

  // ── 골드박스 ──
  goldboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  goldboxScroll: {
    gap: 8,
  },
  goldboxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 8,
    gap: 8,
    width: 200,
  },
  goldboxImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  goldboxImagePlaceholder: {
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goldboxInfo: {
    flex: 1,
  },
  goldboxName: {
    color: theme.text,
    fontSize: 12,
    marginBottom: 2,
  },
  goldboxPrice: {
    color: theme.primary,
    fontSize: 13,
    fontWeight: 'bold',
  },

  affiliateText: {
    color: '#888888',
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 16,
  },
});
