/**
 * 아이고 이벤트(기념일/시즌/부모) → 쿠팡 검색 키워드 매핑.
 *
 * 운영 정책 (docs/019_Phase3_SharedProducts.md §5):
 *   - 31개 슬러그 × 1콜 = 31분 소요 (1콜/분 보수)
 *   - minPrice=50,000 클라이언트 필터 (search API 자체 미지원)
 *   - event_best/{slug} 단일 문서 덮어쓰기
 *   - 활성 기간 외에는 stale 데이터 그대로 둠 (cron이 매일 갱신)
 *
 * 클라이언트 services/events.ts 의 EventBanner 와 sync 유지 필수.
 */

export type EventType = 'anniversary' | 'season' | 'parent';

export interface EventDef {
  /** Firestore doc ID (ASCII slug, URL-safe) */
  slug: string;
  /** 사람이 읽는 이벤트 이름 */
  eventName: string;
  type: EventType;
  /** 쿠팡 search API 키워드 */
  keyword: string;
}

// ─── 아이 기념일 (anniversary) — 19개 ────────────────────────────
const ANNIVERSARY: EventDef[] = [
  { slug: 'anniv-100',   eventName: '백일',     type: 'anniversary', keyword: '백일 선물세트' },
  { slug: 'anniv-200',   eventName: '200일',    type: 'anniversary', keyword: '아기 200일 선물' },
  { slug: 'anniv-300',   eventName: '300일',    type: 'anniversary', keyword: '아기 300일 선물' },
  { slug: 'anniv-500',   eventName: '500일',    type: 'anniversary', keyword: '아기 500일 선물' },
  { slug: 'anniv-1000',  eventName: '1000일',   type: 'anniversary', keyword: '아기 1000일 선물' },
  { slug: 'anniv-365',   eventName: '돌',       type: 'anniversary', keyword: '돌잔치 선물' },

  // 만 1세 ~ 만 13세 생일 (13개)
  { slug: 'birthday-1',  eventName: '만1세 생일',  type: 'anniversary', keyword: '1세 생일선물' },
  { slug: 'birthday-2',  eventName: '만2세 생일',  type: 'anniversary', keyword: '2세 생일선물' },
  { slug: 'birthday-3',  eventName: '만3세 생일',  type: 'anniversary', keyword: '3세 생일선물' },
  { slug: 'birthday-4',  eventName: '만4세 생일',  type: 'anniversary', keyword: '4세 생일선물' },
  { slug: 'birthday-5',  eventName: '만5세 생일',  type: 'anniversary', keyword: '5세 생일선물' },
  { slug: 'birthday-6',  eventName: '만6세 생일',  type: 'anniversary', keyword: '6세 생일선물' },
  { slug: 'birthday-7',  eventName: '만7세 생일',  type: 'anniversary', keyword: '7세 생일선물' },
  { slug: 'birthday-8',  eventName: '만8세 생일',  type: 'anniversary', keyword: '8세 생일선물' },
  { slug: 'birthday-9',  eventName: '만9세 생일',  type: 'anniversary', keyword: '9세 생일선물' },
  { slug: 'birthday-10', eventName: '만10세 생일', type: 'anniversary', keyword: '10세 생일선물' },
  { slug: 'birthday-11', eventName: '만11세 생일', type: 'anniversary', keyword: '11세 생일선물' },
  { slug: 'birthday-12', eventName: '만12세 생일', type: 'anniversary', keyword: '12세 생일선물' },
  { slug: 'birthday-13', eventName: '만13세 생일', type: 'anniversary', keyword: '13세 생일선물' },
];

// ─── 시즌 (season) — 5개 ─────────────────────────────────────────
const SEASON: EventDef[] = [
  { slug: 'season-children-day', eventName: '어린이날',   type: 'season', keyword: '어린이날 선물세트' },
  { slug: 'season-christmas',    eventName: '크리스마스', type: 'season', keyword: '크리스마스 선물 아이' },
  { slug: 'season-halloween',    eventName: '핼러윈',     type: 'season', keyword: '핼러윈 선물 아이' },
  { slug: 'season-newyear',      eventName: '설날',       type: 'season', keyword: '설날 선물 아이' },
  { slug: 'season-chuseok',      eventName: '추석',       type: 'season', keyword: '추석 선물 아이' },
];

// ─── 부모 자축 (parent) — 7개 ────────────────────────────────────
const PARENT: EventDef[] = [
  { slug: 'parent-parents-day', eventName: '어버이날',     type: 'parent', keyword: '어버이날 선물' },
  { slug: 'parent-valentine',   eventName: '발렌타인데이', type: 'parent', keyword: '발렌타인 선물' },
  { slug: 'parent-whiteday',    eventName: '화이트데이',   type: 'parent', keyword: '화이트데이 선물' },
  { slug: 'parent-couple-day',  eventName: '부부의 날',    type: 'parent', keyword: '부부의 날 선물' },
  { slug: 'parent-mom-birthday',eventName: '엄마 생일',    type: 'parent', keyword: '엄마 생일선물' },
  { slug: 'parent-dad-birthday',eventName: '아빠 생일',    type: 'parent', keyword: '아빠 생일선물' },
  { slug: 'parent-wedding',     eventName: '결혼기념일',   type: 'parent', keyword: '결혼기념일 선물' },
];

export const AIGO_EVENTS: EventDef[] = [
  ...ANNIVERSARY,
  ...SEASON,
  ...PARENT,
];

/** docs §5-2: 선물 가치 있는 상품만 적재 */
export const MIN_PRICE_KRW = 50_000;
