/**
 * 아이고 BabyCategory 베스트 업데이터 (cron, 비활성 상태로 시작)
 *
 * 동작:
 *   1. AIGO_BABY_CATEGORIES 순회 (또는 GROUP=N 지정 시 해당 그룹만)
 *   2. 카테고리당 keywords[] 다중 호출 → productId dedupe (limit=10 한도 보완용 2~3개 키워드)
 *   3. excludeKeywords 필터링 (예: stroller 강아지/반려견 제외)
 *   4. 기존 category_best_baby/{slug} 와 비교 → 가격 하락 5% 이상 또는 1,000원 이상 추출
 *   5. category_best_baby/{slug} 단일 문서 덮어쓰기
 *   6. 변동분 누적 → 그룹 종료 시 price_drops_baby/{YYYY-MM-DD KST} 에 merge
 *   7. 키워드 사이 SLEEP_BETWEEN_KEYWORDS_MS / 카테고리 사이 SLEEP_BETWEEN_CATEGORIES_MS 대기
 *   8. rate-limited 감지 시 즉시 중단
 *
 * 환경변수:
 *   FIREBASE_SERVICE_ACCOUNT_KEY    Admin SDK 인증 (필수, jigumiya 프로젝트)
 *   COUPANG_ACCESS_KEY               (필수)
 *   COUPANG_SECRET_KEY               (필수)
 *   SLEEP_BETWEEN_CATEGORIES_MS      카테고리 사이 sleep (기본 60000)
 *   SLEEP_BETWEEN_KEYWORDS_MS        키워드 사이 sleep (기본 2000)
 *   PRODUCTS_PER_KEYWORD             키워드당 가져올 상품 수 (기본 10, 쿠팡 search API 공식 한도)
 *   GROUP                            1|2|3|4 (미지정 시 전체)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { searchProducts, type SearchedProduct } from './coupang-api.js';
import {
  AIGO_BABY_CATEGORIES,
  getCategoriesByGroup,
  type BabyCategoryDef,
  type CronGroup,
} from './baby-categories.js';

const SLEEP_MS = Number(process.env.SLEEP_BETWEEN_CATEGORIES_MS || 60_000);
const SLEEP_KW_MS = Number(process.env.SLEEP_BETWEEN_KEYWORDS_MS || 2_000);
const PER_KEYWORD = Number(process.env.PRODUCTS_PER_KEYWORD || 10);
/** GROUP=1|2|3|4 → 해당 그룹만 실행. 미지정 시 전체. */
const GROUP_RAW = process.env.GROUP ? Number(process.env.GROUP) : null;
const GROUP: CronGroup | null =
  GROUP_RAW === 1 || GROUP_RAW === 2 || GROUP_RAW === 3 || GROUP_RAW === 4 ? GROUP_RAW : null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 가격 하락 임계값 — 5% 이상 OR 1,000원 이상 (둘 중 하나만 만족)
const DROP_RATE_THRESHOLD = 0.05;
const DROP_AMOUNT_THRESHOLD = 1000;

interface PriceDrop {
  productId: string;
  productName: string;
  productImage: string;
  productUrl: string;
  isRocket: boolean;
  prevPrice: number;
  newPrice: number;
  dropAmount: number;
  dropRate: number;
}

/** YYYY-MM-DD (KST) */
function todayKstDateStr(): string {
  const now = new Date();
  // KST = UTC + 9h
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function applyExcludeFilter(
  products: SearchedProduct[],
  excludeKeywords: string[] | undefined,
  slug: string,
): SearchedProduct[] {
  if (!excludeKeywords || excludeKeywords.length === 0) return products;
  const before = products.length;
  const filtered = products.filter(
    (p) => !excludeKeywords.some((kw) => (p.productName ?? '').includes(kw)),
  );
  if (filtered.length !== before) {
    console.log(
      `[BabyBest] ${slug} 제외 필터 적용: ${before} → ${filtered.length} (제외 ${before - filtered.length})`,
    );
  }
  return filtered;
}

function detectDrops(
  prevProducts: SearchedProduct[] | undefined,
  newProducts: SearchedProduct[],
): PriceDrop[] {
  if (!prevProducts || prevProducts.length === 0) return [];
  const prevById = new Map(prevProducts.map((p) => [p.productId, p]));
  const drops: PriceDrop[] = [];
  for (const np of newProducts) {
    const prev = prevById.get(np.productId);
    if (!prev) continue;
    if (prev.productPrice <= 0 || np.productPrice <= 0) continue;
    if (np.productPrice >= prev.productPrice) continue; // 상승/동일 제외
    const dropAmount = prev.productPrice - np.productPrice;
    const dropRate = dropAmount / prev.productPrice;
    if (dropAmount < DROP_AMOUNT_THRESHOLD && dropRate < DROP_RATE_THRESHOLD) continue;
    drops.push({
      productId: np.productId,
      productName: np.productName,
      productImage: np.productImage,
      productUrl: np.productUrl,
      isRocket: np.isRocket,
      prevPrice: prev.productPrice,
      newPrice: np.productPrice,
      dropAmount,
      dropRate,
    });
  }
  return drops;
}

async function updateOne(
  db: FirebaseFirestore.Firestore,
  cat: BabyCategoryDef,
): Promise<{
  ok: boolean;
  rateLimited: boolean;
  count: number;
  drops: PriceDrop[];
}> {
  console.log(
    `[BabyBest] ${cat.slug} (${cat.category}) keywords=[${cat.keywords.join(', ')}] perKeyword=${PER_KEYWORD}`,
  );

  // 다중 키워드 호출 → productId 기준 dedupe (먼저 등장한 키워드 결과 우선 보존)
  const dedupeMap = new Map<string, SearchedProduct>();
  let rawTotal = 0;
  for (let i = 0; i < cat.keywords.length; i++) {
    const kw = cat.keywords[i]!;
    const result = await searchProducts(kw, PER_KEYWORD);

    if (result.rateLimited) {
      return { ok: false, rateLimited: true, count: 0, drops: [] };
    }
    if (!result.ok) {
      console.warn(
        `[BabyBest] ${cat.slug} kw="${kw}" 응답 비정상 (rCode=${result.rCode ?? 'N/A'}) — 스킵`,
      );
    } else {
      rawTotal += result.products.length;
      for (const p of result.products) {
        if (!dedupeMap.has(p.productId)) dedupeMap.set(p.productId, p);
      }
    }

    if (i < cat.keywords.length - 1) await sleep(SLEEP_KW_MS);
  }

  const merged = Array.from(dedupeMap.values());
  if (merged.length === 0) {
    console.warn(`[BabyBest] ${cat.slug} 모든 키워드 결과 0개 — 미갱신`);
    return { ok: false, rateLimited: false, count: 0, drops: [] };
  }

  const filtered = applyExcludeFilter(merged, cat.excludeKeywords, cat.slug);
  if (filtered.length === 0) {
    console.warn(`[BabyBest] ${cat.slug} 필터 후 0개 — 미갱신`);
    return { ok: false, rateLimited: false, count: 0, drops: [] };
  }

  // 기존 문서 read → 가격 비교
  const docRef = db.collection('category_best_baby').doc(cat.slug);
  let prevProducts: SearchedProduct[] | undefined;
  try {
    const prevSnap = await docRef.get();
    if (prevSnap.exists) {
      prevProducts = prevSnap.data()?.products as SearchedProduct[] | undefined;
    }
  } catch (e) {
    console.warn(`[BabyBest] ${cat.slug} 기존 문서 read 실패:`, e);
  }
  const drops = detectDrops(prevProducts, filtered);
  if (drops.length > 0) {
    console.log(`[BabyBest] ${cat.slug} 가격 하락 감지: ${drops.length}개`);
  }

  const docPayload = {
    category: cat.category,
    slug: cat.slug,
    keywords: cat.keywords,
    displayOrder: cat.displayOrder,
    updatedAt: Date.now(),
    products: filtered,
  };
  await docRef.set(docPayload);

  console.log(
    `[BabyBest] ${cat.slug} 저장 완료 — ${filtered.length}개 (dedupe ${merged.length}/raw ${rawTotal})`,
  );
  return { ok: true, rateLimited: false, count: filtered.length, drops };
}

/** 7일 이전 price_drops_baby 문서 정리 */
async function cleanupOldDrops(db: FirebaseFirestore.Firestore) {
  const KEEP_DAYS = 7;
  const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000);
  const cutoffStr = new Date(cutoff.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  try {
    const snap = await db
      .collection('price_drops_baby')
      .where('__name__', '<', cutoffStr)
      .get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    console.log(`[BabyBest] price_drops_baby 7일 이전 ${snap.size}개 정리 완료`);
  } catch (e) {
    console.warn('[BabyBest] price_drops_baby 정리 실패:', e);
  }
}

async function main() {
  console.log('[BabyBest] 시작:', new Date().toISOString());

  const targets = GROUP ? getCategoriesByGroup(GROUP) : AIGO_BABY_CATEGORIES;
  console.log(
    `[BabyBest] group=${GROUP ?? 'ALL'} 대상 ${targets.length}개, sleep=${SLEEP_MS}ms, kwSleep=${SLEEP_KW_MS}ms, perKeyword=${PER_KEYWORD}`,
  );

  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}',
  );
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  let success = 0;
  let failed = 0;
  let totalProducts = 0;
  const dropsBySlug: Record<string, PriceDrop[]> = {};

  for (let i = 0; i < targets.length; i++) {
    const cat = targets[i]!;
    const r = await updateOne(db, cat);

    if (r.rateLimited) {
      console.error(
        `[BabyBest] ⛔ rate-limited 감지 — 즉시 중단. 처리: ${i}/${targets.length}`,
      );
      break;
    }

    if (r.ok) {
      success += 1;
      totalProducts += r.count;
      if (r.drops.length > 0) {
        dropsBySlug[cat.slug] = r.drops;
      }
    } else {
      failed += 1;
    }

    if (i < targets.length - 1) {
      await sleep(SLEEP_MS);
    }
  }

  // 변동분 적재 (그룹별 merge로 같은 날짜 문서에 누적)
  const slugCount = Object.keys(dropsBySlug).length;
  if (slugCount > 0) {
    const dateStr = todayKstDateStr();
    try {
      await db
        .collection('price_drops_baby')
        .doc(dateStr)
        .set(
          {
            bySlug: dropsBySlug,
            groupsCompleted: FieldValue.arrayUnion(GROUP ?? 0),
            updatedAt: Date.now(),
          },
          { merge: true },
        );
      console.log(
        `[BabyBest] price_drops_baby/${dateStr} 적재 — 슬러그 ${slugCount}개, group=${GROUP ?? 'ALL'}`,
      );
    } catch (e) {
      console.warn('[BabyBest] price_drops_baby 적재 실패:', e);
    }
  }

  // 7일 이전 문서 정리 (그룹마다 호출돼도 멱등)
  await cleanupOldDrops(db);

  console.log(
    `[BabyBest] 종료 — 성공 ${success} / 실패 ${failed} / 상품 누계 ${totalProducts} / 변동 슬러그 ${slugCount}`,
  );
}

main().catch((e) => {
  console.error('[BabyBest] 치명적 오류:', e);
  process.exit(1);
});
