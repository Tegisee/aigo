import { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../constants/theme';
import { TrackedItem } from '../types';
import { SparklineChart } from './SparklineChart';
import { useAppStore } from '../store/useAppStore';

interface Props {
  item: TrackedItem;
}

const SWIPE_THRESHOLD = -80;
const DELETE_BTN_WIDTH = 80;

export function ProductCard({ item }: Props) {
  const router = useRouter();
  const removeItem = useAppStore((s) => s.removeItem);
  const children = useAppStore((s) => s.children);
  const childName = item.childId ? children.find((c) => c.id === item.childId)?.name : null;
  const [showDeleteOverlay, setShowDeleteOverlay] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;

  const hasTarget = item.targetPrice != null && item.targetPrice > 0;
  const gap =
    item.currentPrice > 0 && hasTarget
      ? Math.round(((item.currentPrice - item.targetPrice!) / item.currentPrice) * 100)
      : 0;

  const isAchieved = item.currentPrice > 0 && hasTarget && item.currentPrice <= item.targetPrice!;

  const progress = hasTarget && item.currentPrice > 0
    ? Math.min(100, Math.max(0, Math.round((1 - (item.currentPrice - item.targetPrice!) / item.currentPrice) * 100)))
    : 0;

  const category = item.category || '기타';
  const purchaseCount = item.purchaseHistory?.length ?? 0;

  const repurchaseDday = item.repurchaseEnabled && item.repurchaseDays
    ? (() => {
        const base = item.lastPurchasedAt || new Date(item.createdAt).toISOString().slice(0, 10);
        const nextDate = new Date(base);
        nextDate.setDate(nextDate.getDate() + item.repurchaseDays);
        const diff = Math.ceil((nextDate.getTime() - Date.now()) / 86400000);
        return diff;
      })()
    : null;

  const confirmDelete = () => {
    Alert.alert(
      '관심상품 삭제',
      '관심상품에서 삭제하시겠어요?\n해당 상품의 알림도 자동 중단됩니다.',
      [
        { text: '취소', style: 'cancel', onPress: resetSwipe },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => removeItem(item.id),
        },
      ],
    );
  };

  const resetSwipe = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx < 0) {
          translateX.setValue(Math.max(gesture.dx, -DELETE_BTN_WIDTH));
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < SWIPE_THRESHOLD) {
          Animated.spring(translateX, { toValue: -DELETE_BTN_WIDTH, useNativeDriver: true }).start();
        } else {
          resetSwipe();
        }
      },
    }),
  ).current;

  const handleLongPress = () => {
    setShowDeleteOverlay(true);
  };

  const handlePress = () => {
    if (showDeleteOverlay) {
      setShowDeleteOverlay(false);
    } else {
      router.push(`/detail/${item.id}`);
    }
  };

  return (
    <View style={styles.swipeContainer}>
      {/* 스와이프 뒤 삭제 버튼 */}
      <TouchableOpacity style={styles.swipeDeleteBtn} onPress={confirmDelete} activeOpacity={0.8}>
        <Ionicons name="trash-outline" size={22} color="#fff" />
        <Text style={styles.swipeDeleteText}>삭제</Text>
      </TouchableOpacity>

      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.card}
          onPress={handlePress}
          onLongPress={handleLongPress}
          activeOpacity={0.7}
          delayLongPress={500}
        >
          {/* 길게 누르기 삭제 오버레이 */}
          {showDeleteOverlay && (
            <View style={styles.deleteOverlay}>
              <TouchableOpacity style={styles.deleteOverlayBtn} onPress={confirmDelete} activeOpacity={0.8}>
                <Ionicons name="trash-outline" size={20} color="#fff" />
                <Text style={styles.deleteOverlayText}>삭제</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 카테고리 태그 + 아이 이름 + 재구매 D-day */}
          <View style={styles.badgeRow}>
            {childName && (
              <View style={[styles.categoryBadge, styles.childBadge]}>
                <Text style={styles.childBadgeText}>{childName}</Text>
              </View>
            )}
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
            {purchaseCount > 0 && (
              <View style={[styles.categoryBadge, styles.purchaseBadge]}>
                <Text style={styles.purchaseText}>총 {purchaseCount}회 구매</Text>
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
                <Text style={styles.gap}>가격 알림 중</Text>
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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeContainer: {
    marginBottom: 12,
    overflow: 'hidden',
    borderRadius: 16,
  },
  swipeDeleteBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_BTN_WIDTH,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    gap: 4,
  },
  swipeDeleteText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  deleteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteOverlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  deleteOverlayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap',
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
  childBadge: {
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
  },
  childBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF9500',
  },
  purchaseBadge: {
    backgroundColor: 'rgba(90, 103, 216, 0.12)',
  },
  purchaseText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5A67D8',
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
