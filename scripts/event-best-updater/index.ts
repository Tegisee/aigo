/**
 * 아이고 이벤트 베스트 업데이터 (cron, 비활성 상태로 시작)
 *
 * 동작:
 *   1. AIGO_EVENTS 31개 순회
 *   2. 이벤트당 searchProducts(keyword, 50, MIN_PRICE_KRW) 1콜
 *   3. event_best/{slug} 단일 문서 덮어쓰기
 *   4. 다음 호출 전 SLEEP_BETWEEN_EVENTS_MS 대기
 *   5. rate-limited 감지 시 즉시 중단
 *
 * 호출 정책 (docs/019_Phase3_SharedProducts.md §3, §6):
 *   - 검색 API 분당 50회 한도 → 1콜/분 보수 운영
 *   - 31개 × 60초 sleep ≈ 약 31분 소요
 *   - 권장 시각: 01:00 KST (지금이야 02:00 category-best 와 분리)
 *
 * 환경변수:
 *   FIREBASE_SERVICE_ACCOUNT_KEY    Admin SDK 인증 (필수, jigumiya 프로젝트)
 *   COUPANG_ACCESS_KEY               (필수)
 *   COUPANG_SECRET_KEY               (필수)
 *   SLEEP_BETWEEN_EVENTS_MS          이벤트 사이 sleep (기본 60000)
 *   PRODUCTS_PER_EVENT               이벤트당 가져올 상품 수 (기본 50)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { searchProducts } from './coupang-api.js';
import { AIGO_EVENTS, MIN_PRICE_KRW, type EventDef } from './events.js';

const SLEEP_MS = Number(process.env.SLEEP_BETWEEN_EVENTS_MS || 60_000);
const LIMIT = Number(process.env.PRODUCTS_PER_EVENT || 50);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function updateOne(
  db: FirebaseFirestore.Firestore,
  ev: EventDef,
): Promise<{ ok: boolean; rateLimited: boolean; count: number }> {
  console.log(
    `[EventBest] ${ev.slug} (${ev.eventName}) keyword="${ev.keyword}" limit=${LIMIT} minPrice=${MIN_PRICE_KRW}`,
  );
  const result = await searchProducts(ev.keyword, LIMIT, MIN_PRICE_KRW);

  if (result.rateLimited) {
    return { ok: false, rateLimited: true, count: 0 };
  }
  if (!result.ok || result.products.length === 0) {
    console.warn(
      `[EventBest] ${ev.slug} 응답 비정상 또는 minPrice 통과 0개 (rCode=${result.rCode ?? 'N/A'}, raw=${result.rawCount ?? 'N/A'}) — 미갱신`,
    );
    return { ok: false, rateLimited: false, count: 0 };
  }

  const docPayload = {
    eventSlug: ev.slug,
    eventName: ev.eventName,
    eventType: ev.type,
    keyword: ev.keyword,
    minPrice: MIN_PRICE_KRW,
    updatedAt: Date.now(),
    products: result.products,
  };

  await db.collection('event_best').doc(ev.slug).set(docPayload);

  console.log(
    `[EventBest] ${ev.slug} 저장 완료 — ${result.products.length}/${result.rawCount ?? '?'}개 (필터 통과/원본)`,
  );
  return { ok: true, rateLimited: false, count: result.products.length };
}

async function main() {
  console.log('[EventBest] 시작:', new Date().toISOString());
  console.log(
    `[EventBest] 대상 ${AIGO_EVENTS.length}개, sleep=${SLEEP_MS}ms, limit=${LIMIT}, minPrice=${MIN_PRICE_KRW}`,
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
