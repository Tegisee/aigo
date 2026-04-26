/**
 * 아이고 BabyCategory 베스트 업데이터 (cron, 비활성 상태로 시작)
 *
 * 동작:
 *   1. AIGO_BABY_CATEGORIES 순회
 *   2. 카테고리당 searchProducts(keyword, 50) 1콜
 *   3. category_best_baby/{slug} 단일 문서 덮어쓰기
 *   4. 다음 카테고리 호출 전 SLEEP_BETWEEN_CATEGORIES_MS 대기
 *   5. rate-limited 감지 시 즉시 중단
 *
 * 호출 정책 (지금이야 category-best-updater 와 동일 패턴):
 *   - 검색 API 분당 50회 한도 → 1콜/분 보수 운영
 *   - 23개 × 60초 sleep ≈ 약 23분 소요
 *   - 지금이야 02:00 KST 와 분리하여 04:00 KST 권장
 *
 * 환경변수:
 *   FIREBASE_SERVICE_ACCOUNT_KEY    Admin SDK 인증 (필수, jigumiya 프로젝트)
 *   COUPANG_ACCESS_KEY               (필수)
 *   COUPANG_SECRET_KEY               (필수)
 *   SLEEP_BETWEEN_CATEGORIES_MS      카테고리 사이 sleep (기본 60000)
 *   PRODUCTS_PER_CATEGORY            카테고리당 가져올 상품 수 (기본 50)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { searchProducts } from './coupang-api.js';
import { AIGO_BABY_CATEGORIES, type BabyCategoryDef } from './baby-categories.js';

const SLEEP_MS = Number(process.env.SLEEP_BETWEEN_CATEGORIES_MS || 60_000);
const LIMIT = Number(process.env.PRODUCTS_PER_CATEGORY || 50);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function updateOne(
  db: FirebaseFirestore.Firestore,
  cat: BabyCategoryDef,
): Promise<{ ok: boolean; rateLimited: boolean; count: number }> {
  console.log(
    `[BabyBest] ${cat.slug} (${cat.category}) keyword="${cat.keyword}" limit=${LIMIT}`,
  );
  const result = await searchProducts(cat.keyword, LIMIT);

  if (result.rateLimited) {
    return { ok: false, rateLimited: true, count: 0 };
  }
  if (!result.ok || result.products.length === 0) {
    console.warn(
      `[BabyBest] ${cat.slug} 응답 비정상 (rCode=${result.rCode ?? 'N/A'}) — 미갱신`,
    );
    return { ok: false, rateLimited: false, count: 0 };
  }

  const docPayload = {
    category: cat.category,
    slug: cat.slug,
    keyword: cat.keyword,
    displayOrder: cat.displayOrder,
    updatedAt: Date.now(),
    products: result.products,
  };

  await db
    .collection('category_best_baby')
    .doc(cat.slug)
    .set(docPayload);

  console.log(
    `[BabyBest] ${cat.slug} 저장 완료 — ${result.products.length}개`,
  );
  return { ok: true, rateLimited: false, count: result.products.length };
}

async function main() {
  console.log('[BabyBest] 시작:', new Date().toISOString());
  console.log(
    `[BabyBest] 대상 ${AIGO_BABY_CATEGORIES.length}개, sleep=${SLEEP_MS}ms, limit=${LIMIT}`,
  );

  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}',
  );
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  let success = 0;
  let failed = 0;
  let totalProducts = 0;

  for (let i = 0; i < AIGO_BABY_CATEGORIES.length; i++) {
    const cat = AIGO_BABY_CATEGORIES[i]!;
    const r = await updateOne(db, cat);

    if (r.rateLimited) {
      console.error(
        `[BabyBest] ⛔ rate-limited 감지 — 즉시 중단. 처리: ${i}/${AIGO_BABY_CATEGORIES.length}`,
      );
      break;
    }

    if (r.ok) {
      success += 1;
      totalProducts += r.count;
    } else {
      failed += 1;
    }

    if (i < AIGO_BABY_CATEGORIES.length - 1) {
      await sleep(SLEEP_MS);
    }
  }

  console.log(
    `[BabyBest] 종료 — 성공 ${success} / 실패 ${failed} / 상품 누계 ${totalProducts}`,
  );
}

main().catch((e) => {
  console.error('[BabyBest] 치명적 오류:', e);
  process.exit(1);
});
