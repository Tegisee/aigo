import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { useAppStore } from '../../store/useAppStore';
import { ProductCard } from '../../components/ProductCard';
import { BabyCategory, getCategoriesByMonth } from '../../types';
import { hasCoupangApiKeys, generateDeepLink } from '../../services/coupangApi';

export default function WishlistScreen() {
  const router = useRouter();
  const { trackedItems, babyBirthDate, babyName, children, selectedChildId, selectChild } = useAppStore();

  const displayName = babyName || '우리 아이';
  const babyMonths = babyBirthDate ? (() => {
    const birth = new Date(babyBirthDate);
    const now = new Date();
    return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  })() : null;
  const categories = getCategoriesByMonth(babyMonths);
  const [selectedCategory, setSelectedCategory] = useState<BabyCategory | null>(null);
  const [filterChildId, setFilterChildId] = useState<string | null>(null);

  // 아이 전환 시 필터 초기화
  useEffect(() => {
    setSelectedCategory(null);
    setFilterChildId(null);
  }, [selectedChildId]);

  const childFilteredItems = filterChildId
    ? trackedItems.filter((item) => item.childId === filterChildId)
    : trackedItems;

  const filteredItems = selectedCategory
    ? childFilteredItems.filter((item) => (item.category || '기타') === selectedCategory)
    : childFilteredItems;

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>관심상품</Text>
        <Text style={styles.countText}>{trackedItems.length}개</Text>
      </View>

      {/* 아이별 필터 */}
      {children.length >= 2 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.childFilter}
        >
          <TouchableOpacity
            style={[styles.childFilterChip, !filterChildId && styles.childFilterChipActive]}
            onPress={() => setFilterChildId(null)}
            activeOpacity={0.7}
          >
            <Text style={[styles.childFilterText, !filterChildId && styles.childFilterTextActive]}>전체</Text>
          </TouchableOpacity>
          {children.map((child) => (
            <TouchableOpacity
              key={child.id}
              style={[styles.childFilterChip, filterChildId === child.id && styles.childFilterChipActive]}
              onPress={() => {
              const newId = filterChildId === child.id ? null : child.id;
              setFilterChildId(newId);
              if (newId) selectChild(newId);
            }}
              activeOpacity={0.7}
            >
              <Text style={[styles.childFilterText, filterChildId === child.id && styles.childFilterTextActive]}>
                {child.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* 관심상품 가져오기 */}
      <TouchableOpacity
        style={styles.fetchBtn}
        onPress={async () => {
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
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="cart-outline" size={22} color={theme.primary} />
        <View style={styles.fetchBtnText}>
          <Text style={styles.fetchBtnTitle}>관심상품 가져오기</Text>
          <Text style={styles.fetchBtnSub}>{displayName}에게 필요한 상품을 찾아보세요</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
      </TouchableOpacity>

      {/* 카테고리 필터 + 섹션 헤더 — 고정 영역 */}
      <View style={styles.categoryFixed}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChips}
        >
          <TouchableOpacity
            style={[styles.chip, !selectedCategory && styles.chipActive]}
            onPress={() => setSelectedCategory(null)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>전체</Text>
          </TouchableOpacity>
          {categories.filter((c) => c !== '기타').map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, selectedCategory === cat && styles.chipActive]}
              onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>가격 알림 중</Text>
          <Text style={styles.sectionCount}>{filteredItems.length}개</Text>
        </View>
      </View>

      {/* 상품 리스트 */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ProductCard item={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={48} color={theme.border} />
            <Text style={styles.emptyTitle}>관심상품이 없어요</Text>
            <Text style={styles.emptyText}>
              쿠팡에서 상품 공유하기를 눌러보세요
            </Text>
          </View>
        }
        ListFooterComponent={
          filteredItems.length > 0 ? (
            <Text style={styles.affiliateText}>
              이 앱은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
            </Text>
          ) : null
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/modal/add-item')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
  },
  countText: {
    fontSize: 14,
    color: theme.subtext,
  },

  // ── 아이별 필터 ──
  childFilter: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
  },
  childFilterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    marginRight: 8,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  childFilterChipActive: {
    backgroundColor: '#FF9500',
    borderColor: '#FF9500',
  },
  childFilterText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.subtext,
  },
  childFilterTextActive: {
    color: '#fff',
    fontWeight: '600',
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

  // ── 카테고리 필터 칩 (고정 영역) ──
  categoryFixed: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  categoryChips: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    marginRight: 8,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.subtext,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // ── 섹션 헤더 ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  sectionCount: {
    fontSize: 13,
    color: theme.subtext,
  },

  // ── 리스트 ──
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  empty: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    marginTop: 8,
  },
  emptyText: {
    color: theme.subtext,
    fontSize: 14,
  },
  affiliateText: {
    color: '#888888',
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 28,
    color: '#FFFFFF',
    lineHeight: 30,
  },
});
