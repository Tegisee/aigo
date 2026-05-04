/**
 * 아이고 이벤트(기념일/시즌/부모) → 쿠팡 검색 키워드 매핑.
 *
 * 운영 정책 (docs/019_Phase3_SharedProducts.md §5):
 *   - 31개 슬러그 × 평균 4 키워드 ≈ 124 콜 (배열로 여러 키워드 검색 후 dedupe)
 *   - minPrice=30,000 클라이언트 필터 (search API 자체 미지원)
 *   - event_best/{slug} 단일 문서 덮어쓰기
 *   - 활성 기간 외에는 stale 데이터 그대로 둠 (cron이 매일 갱신)
 *
 * 키워드 설계 원칙 (네이버쇼핑/쿠팡 연관검색어 리서치):
 *   1. 모호한 키워드 회피 ("선물" 단독 X)
 *   2. 연령/대상 한정어 포함 ("아기", "유아", "어린이", "초등")
 *   3. 카테고리 좁히는 키워드 (선물세트/장난감/한복 등)
 *   4. 성인/노인/반려동물 노이즈 회피
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
  /** 쿠팡 search API 키워드 (3~5개, 결과 합쳐서 dedupe) */
  keywords: string[];
}

// ─── 아이 기념일 (anniversary) — 19개 ────────────────────────────
const ANNIVERSARY: EventDef[] = [
  { slug: 'anniv-100',   eventName: '백일',     type: 'anniversary',
    keywords: ['아기 백일선물', '백일 답례품', '백일상 소품', '백일 의상', '신생아 선물세트'] },
  { slug: 'anniv-200',   eventName: '200일',    type: 'anniversary',
    keywords: ['아기 200일 선물', '200일 토퍼', '아기 성장앨범', '셀프촬영 소품', '아기 기념품'] },
  { slug: 'anniv-300',   eventName: '300일',    type: 'anniversary',
    keywords: ['아기 300일 선물', '300일 케이크 토퍼', '아기 셀프촬영 소품', '아기 우주복', '베이비 기념일 데코'] },
  { slug: 'anniv-500',   eventName: '500일',    type: 'anniversary',
    keywords: ['아기 500일 선물', '500일 토퍼', '유아 기념일 의상', '아기 치아보관함', '아기 사진앨범'] },
  { slug: 'anniv-1000',  eventName: '1000일',   type: 'anniversary',
    keywords: ['아기 1000일 선물', '아기 외출복', '유아 촉감책', '아기 이름 자수담요', '유아 식기세트'] },
  { slug: 'anniv-365',   eventName: '돌',       type: 'anniversary',
    keywords: ['아기 돌선물', '돌반지', '돌잔치 답례품', '유아 발달완구', '돌 한복'] },

  // 만 1세 ~ 만 13세 생일 (13개)
  { slug: 'birthday-1',  eventName: '만1세 생일',  type: 'anniversary',
    keywords: ['1살 생일선물', '아기 발달장난감', '유아 걸음마 보조기', '아기 책 전집', '유아 자석블록'] },
  { slug: 'birthday-2',  eventName: '만2세 생일',  type: 'anniversary',
    keywords: ['2살 생일선물', '유아 자석블록', '유아 주방놀이 세트', '유아 그림책 전집', '유아 세발자전거'] },
  { slug: 'birthday-3',  eventName: '만3세 생일',  type: 'anniversary',
    keywords: ['3살 생일선물', '유아 역할놀이 장난감', '유아 소꿉놀이 세트', '캐치티니핑 장난감', '유아 음악 장난감'] },
  { slug: 'birthday-4',  eventName: '만4세 생일',  type: 'anniversary',
    keywords: ['4살 생일선물', '레고 듀플로', '캐치티니핑 장난감', '유아 보드게임', '유아 자동차 장난감'] },
  { slug: 'birthday-5',  eventName: '만5세 생일',  type: 'anniversary',
    keywords: ['5살 생일선물', '유아 화장대 놀이', '실바니안 인형의집', '유아 색칠놀이 세트', '레고 듀플로'] },
  { slug: 'birthday-6',  eventName: '만6세 생일',  type: 'anniversary',
    keywords: ['6살 생일선물', '유아 보드게임', '어린이 학용품 세트', '미술놀이 키트', '캐릭터 인형'] },
  { slug: 'birthday-7',  eventName: '만7세 생일',  type: 'anniversary',
    keywords: ['7살 생일선물', '어린이 입학선물', '어린이 캐릭터 가방', '어린이 자전거', '어린이 보드게임'] },
  { slug: 'birthday-8',  eventName: '만8세 생일',  type: 'anniversary',
    keywords: ['초등학생 생일선물', '초등 학용품 세트', '어린이 시계', '어린이 캐릭터 크로스백', '몰랑이 학용품'] },
  { slug: 'birthday-9',  eventName: '만9세 생일',  type: 'anniversary',
    keywords: ['초등 생일선물', '초등 다이어리 꾸미기', '산리오 캐릭터 굿즈', '어린이 보드게임', '어린이 무드등'] },
  { slug: 'birthday-10', eventName: '만10세 생일', type: 'anniversary',
    keywords: ['초등 여아 생일선물', '초등 남아 생일선물', '폴라로이드 카메라', 'DIY 만들기 키트', '어린이 텀블러'] },
  { slug: 'birthday-11', eventName: '만11세 생일', type: 'anniversary',
    keywords: ['초등 고학년 생일선물', '레고 시리즈', '젤리캣 키링 인형', '산리오 다이어리 세트', '어린이 무선이어폰'] },
  { slug: 'birthday-12', eventName: '만12세 생일', type: 'anniversary',
    keywords: ['초등 6학년 생일선물', '태블릿 스마트펜슬', 'DIY 미니어처 하우스', '청소년 무선이어폰', '레고 시리즈'] },
  { slug: 'birthday-13', eventName: '만13세 생일', type: 'anniversary',
    keywords: ['중학생 생일선물', '청소년 무선이어폰', '레고 청소년 세트', '10대 텀블러', '청소년 백팩'] },
];

// ─── 시즌 (season) — 5개 ─────────────────────────────────────────
const SEASON: EventDef[] = [
  { slug: 'season-children-day', eventName: '어린이날',   type: 'season',
    keywords: ['어린이날 선물', '어린이날 장난감', '레고 어린이날', '캐치티니핑 선물', '어린이 변신로봇'] },
  { slug: 'season-christmas',    eventName: '크리스마스', type: 'season',
    keywords: ['어린이 크리스마스 선물', '키즈 크리스마스 장난감', '레고 크리스마스', 'LED 트리 무드등', '어린이 봉제인형'] },
  { slug: 'season-halloween',    eventName: '핼러윈',     type: 'season',
    keywords: ['핼러윈 아동코스튬', '어린이 할로윈 의상', '유아 마녀 코스튬', '어린이 호박 의상', '아동 캐릭터 코스튬'] },
  { slug: 'season-newyear',      eventName: '설날',       type: 'season',
    keywords: ['설날 한복', '아동 한복', '세뱃돈 봉투', '아기 설빔', '어린이 명절 의상'] },
  { slug: 'season-chuseok',      eventName: '추석',       type: 'season',
    keywords: ['추석 한복', '아동 한복', '아기 한복', '어린이 명절 의상', '추석 어린이 선물'] },
];

// ─── 부모 자축 (parent) — 7개 ────────────────────────────────────
const PARENT: EventDef[] = [
  { slug: 'parent-parents-day', eventName: '어버이날',     type: 'parent',
    keywords: ['어버이날 선물', '어버이날 카네이션', '어버이날 용돈박스', '부모님 건강식품', '카네이션 비누꽃'] },
  { slug: 'parent-valentine',   eventName: '발렌타인데이', type: 'parent',
    keywords: ['발렌타인데이 초콜릿', '수제 초콜릿 선물세트', '발렌타인 초콜릿 박스', '프리미엄 초콜릿', '발렌타인 선물'] },
  { slug: 'parent-whiteday',    eventName: '화이트데이',   type: 'parent',
    keywords: ['화이트데이 사탕', '화이트데이 선물세트', '수제 마카롱 세트', '캐러멜 선물세트', '디저트 선물박스'] },
  { slug: 'parent-couple-day',  eventName: '부부의 날',    type: 'parent',
    keywords: ['부부의 날 선물', '부부 커플 선물', '아내 향수', '커플 주얼리', '부부 꽃다발'] },
  { slug: 'parent-mom-birthday',eventName: '엄마 생일',    type: 'parent',
    keywords: ['엄마 생일선물', '엄마 생신선물', '50대 여성 선물', '엄마 핸드백', '엄마 건강식품'] },
  { slug: 'parent-dad-birthday',eventName: '아빠 생일',    type: 'parent',
    keywords: ['아빠 생일선물', '아버지 생신선물', '50대 남성 선물', '아빠 무선마사지기', '아빠 홍삼 선물세트'] },
  { slug: 'parent-wedding',     eventName: '결혼기념일',   type: 'parent',
    keywords: ['결혼기념일 선물', '부부 커플 선물', '아내 꽃다발', '커플 주얼리', '부부 사진앨범'] },
];

export const AIGO_EVENTS: EventDef[] = [
  ...ANNIVERSARY,
  ...SEASON,
  ...PARENT,
];

/** docs §5-2: 선물 가치 있는 상품만 적재 */
export const MIN_PRICE_KRW = 30_000;
