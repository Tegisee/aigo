/**
 * 아이고 이벤트 베스트 업데이터 (cron, 비활성 상태로 시작)
 *
 * 동작:
 *   1. AIGO_EVENTS 31개 순회
 *   2. 이벤트당 keywords[] 다중 호출 → productId dedupe → 가격 정렬 → 상위 LIMIT개
 *   3. event_best/{slug} 단일 문서 덮어쓰기
 *   4. 키워드 사이 SLEEP_BETWEEN_KEYWORDS_MS 대기 (이벤트 사이도 동일)
 *   5. rate-limited 감지 시 즉시 중단
 *
 * 호출 정책 (docs/019_Phase3_SharedProducts.md §3, §6):
 *   - 검색 API 분당 50회 한도
 *   - 31 × 평균 4 = 약 124 콜, sleep 2초 → 약 4~5분 소요
 *   - 권장 시각: 01:00 KST (지금이야 02:00 category-best 와 분리)
 *
 * 환경변수:
 *   FIREBASE_SERVICE_ACCOUNT_KEY    Admin SDK 인증 (필수, jigumiya 프로젝트)
 *   COUPANG_ACCESS_KEY               (필수)
 *   COUPANG_SECRET_KEY               (필수)
 *   SLEEP_BETWEEN_KEYWORDS_MS        키워드 사이 sleep (기본 2000)
 *   PRODUCTS_PER_EVENT               이벤트당 최종 상품 수 (기본 50)
 *   PRODUCTS_PER_KEYWORD             키워드당 가져올 상품 수 (기본 10, 쿠팡 search API 공식 한도)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { searchProducts } from './coupang-api.js';
import { AIGO_EVENTS, MIN_PRICE_KRW, type EventDef } from './events.js';

const SLEEP_MS = Number(process.env.SLEEP_BETWEEN_KEYWORDS_MS || 2_000);
const LIMIT = Number(process.env.PRODUCTS_PER_EVENT || 50);
const PER_KEYWORD = Number(process.env.PRODUCTS_PER_KEYWORD || 10);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SearchedProduct {
  productId: string;
  productName: string;
  productPrice: number;
  productImage: string;
  productUrl: string;
  isRocket: boolean;
}

async function updateOne(
  db: FirebaseFirestore.Firestore,
  ev: EventDef,
): Promise<{ ok: boolean; rateLimited: boolean; count: number }> {
  console.log(
    `[EventBest] ${ev.slug} (${ev.eventName}) keywords=[${ev.keywords.join(', ')}] perKeyword=${PER_KEYWORD} minPrice=${MIN_PRICE_KRW}`,
  );

  const dedupeMap = new Map<string, SearchedProduct>();
  let rawTotal = 0;

  for (let i = 0; i < ev.keywords.length; i++) {
    const kw = ev.keywords[i]!;
    const result = await searchProducts(kw, PER_KEYWORD, MIN_PRICE_KRW);

    if (result.rateLimited) {
      return { ok: false, rateLimited: true, count: 0 };
    }
    if (!result.ok) {
      console.warn(
        `[EventBest] ${ev.slug} kw="${kw}" 응답 비정상 (rCode=${result.rCode ?? 'N/A'}) — 스킵`,
      );
    } else {
      rawTotal += result.rawCount ?? result.products.length;
      for (const p of result.products) {
        if (!dedupeMap.has(p.productId)) dedupeMap.set(p.productId, p);
      }
    }

    if (i < ev.keywords.length - 1) await sleep(SLEEP_MS);
  }

  const merged = Array.from(dedupeMap.values());
  if (merged.length === 0) {
    console.warn(`[EventBest] ${ev.slug} 모든 키워드 결과 0개 — 미갱신`);
    return { ok: false, rateLimited: false, count: 0 };
  }

  // 가격 내림차순 정렬 후 상위 LIMIT개 (선물 가치 우선)
  merged.sort((a, b) => b.productPrice - a.productPrice);
  const finalProducts = merged.slice(0, LIMIT);

  const docPayload = {
    eventSlug: ev.slug,
    eventName: ev.eventName,
    eventType: ev.type,
    keywords: ev.keywords,
    minPrice: MIN_PRICE_KRW,
    updatedAt: Date.now(),
    products: finalProducts,
  };

  await db.collection('event_best').doc(ev.slug).set(docPayload);

  console.log(
    `[EventBest] ${ev.slug} 저장 완료 — ${finalProducts.length}개 (dedupe ${merged.length}/raw ${rawTotal})`,
  );
  return { ok: true, rateLimited: false, count: finalProducts.length };
}

async function main() {
  console.log('[EventBest] 시작:', new Date().toISOString());
  console.log(
    `[EventBest] 대상 ${AIGO_EVENTS.length}개, sleep=${SLEEP_MS}ms, perKeyword=${PER_KEYWORD}, limit=${LIMIT}, minPrice=${MIN_PRICE_KRW}`,
  );

  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}',
  );
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  let success = 0;
  let failed = 0;
  let totalProducts = 0;

  for (let i = 0; i < AIGO_EVENTS.length; i++) {
    const ev = AIGO_EVENTS[i]!;
    const r = await updateOne(db, ev);

    if (r.rateLimited) {
      console.error(
        `[EventBest] ⛔ rate-limited 감지 — 즉시 중단. 처리: ${i}/${AIGO_EVENTS.length}`,
      );
      break;
    }

    if (r.ok) {
      success += 1;
      totalProducts += r.count;
    } else {
      failed += 1;
    }

    if (i < AIGO_EVENTS.length - 1) {
      await sleep(SLEEP_MS);
    }
  }

  console.log(
    `[EventBest] 종료 — 성공 ${success} / 실패 ${failed} / 상품 누계 ${totalProducts}`,
  );
}

main().catch((e) => {
  console.error('[EventBest] 치명적 오류:', e);
  process.exit(1);
});
