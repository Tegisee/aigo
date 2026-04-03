import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../constants/theme';
import { TrackedItem } from '../types';
import { SparklineChart } from './SparklineChart';

interface Props {
  item: TrackedItem;
}

export function ProductCard({ item }: Props) {
  const router = useRouter();
  const hasTarget = item.targetPrice != null && item.targetPrice > 0;
  const gap =
    item.currentPrice > 0 && hasTarget
      ? Math.round(((item.currentPrice - item.targetPrice!) / item.currentPrice) * 100)
      : 0;

  const isAchieved = item.currentPrice > 0 && hasTarget && item.currentPrice <= item.targetPrice!;

  // 달성률 (0~100)
  const progress = hasTarget && item.currentPrice > 0
    ? Math.min(100, Math.max(0, Math.round((1 - (item.currentPrice - item.targetPrice!) / item.currentPrice) * 100)))
    : 0;

  const category = item.category || '기타';

  // 재구매 D-day 계산
  const repurchaseDday = item.repurchaseEnabled && item.repurchaseDays
    ? (() => {
        const base = item.lastPurchasedAt || new Date(item.createdAt).toISOString().slice(0, 10);
        const nextDate = new Date(base);
        nextDate.setDate(nextDate.getDate() + item.repurchaseDays);
        const diff = Math.ceil((nextDate.getTime() - Date.now()) / 86400000);
        return diff;
      })()
    : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/detail/${item.id}`)}
      activeOpacity={0.7}
    >
      {/* 카테고리 태그 + 재구매 D-day */}
      <View style={styles.badgeRow}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{category}</Text>
        </View>
        {repurchaseDday !== null && (
          <View style={[styles.categoryBadge, styles.ddayBadge]}>
            <Text style={styles.ddayText}>
              {repurchaseDday <= 0 ? '재구매 시기!' : `재구매 D-${repurchaseDday}`}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.row}>
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={styles.thumbnailImg} />
        ) : (
          <View style={styles.thumbnail}>
            <Ionicons name="bag-handle-outline" size={28} color={theme.subtext} />
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {item.productName}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.currentPrice}>
              {item.currentPrice.toLocaleString()}원
            </Text>
            {hasTarget && (
              <Text style={styles.targetPrice}>
                목표 {item.targetPrice!.toLocaleString()}원
              </Text>
            )}
          </View>
          {hasTarget ? (
            <Text style={[styles.gap, isAchieved && styles.gapAchieved]}>
              {isAchieved ? '목표 달성!' : `목표까지 -${gap}%`}
            </Text>
          ) : (
            <Text style={styles.gap}>가격 추적 중</Text>
          )}
        </View>
      </View>

      {/* 달성률 프로그레스바 */}
      {hasTarget && (
        <View style={styles.progressWrap}>
          <View style={styles.progressBar}>
            <LinearGradient
              colors={[theme.primary, theme.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${progress}%` as any }]}
            />
          </View>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>
      )}

      {item.priceHistory.length > 1 && (
        <View style={styles.chartWrap}>
          <SparklineChart priceHistory={item.priceHistory} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 126, 103, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  ddayBadge: {
    backgroundColor: 'rgba(78, 205, 196, 0.12)',
  },
  ddayText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4ECDC4',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  thumbnailImg: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '600',
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  currentPrice: {
    fontSize: 17,
    fontWeight: 'bold',
    color: theme.text,
  },
  targetPrice: {
    fontSize: 13,
    color: theme.subtext,
  },
  gap: {
    fontSize: 13,
    color: theme.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  gapAchieved: {
    color: theme.success,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
    width: 32,
    textAlign: 'right',
  },
  chartWrap: {
    marginTop: 12,
    alignItems: 'center',
  },
});
