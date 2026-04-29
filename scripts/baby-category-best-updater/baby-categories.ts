/**
 * 아이고 BabyCategory → 쿠팡 검색 키워드 매핑 (Phase 3 월령 세분화).
 *
 * 운영 정책 (docs/019_Phase3_SharedProducts.md §3, §4):
 *   - 4개 그룹으로 분할 → GitHub Actions cron 4개 (시간대 분리)
 *   - 그룹당 1콜/분 보수 운영 (분당 50회 한도 안전 마진)
 *   - 결과를 category_best_baby/{slug} 문서에 저장
 *   - 클라이언트는 types.getCategorySlug(category, months)로 슬러그 결정 후 read 1회
 *
 * 그룹별 호출량:
 *   group 1 (01:15) — 16콜: toys×8 + clothing×8
 *   group 2 (01:30) — 14콜: shoes×4 + books×5 + learning×5
 *   group 3 (03:00) — 10콜: diaper×5 + formula×3 + wipes + feeding
 *   group 4 (03:20) — 14콜: 단일 슬러그
 *
 *   합계 54콜 (지금이야 02:00 KST 와 시간대 분리)
 */

export type BabyCategory = string;
export type CronGroup = 1 | 2 | 3 | 4;

export interface BabyCategoryDef {
  category: BabyCategory;
  /** Firestore doc ID (ASCII slug, URL-safe) */
  slug: string;
  /** 쿠팡 search API 키워드 */
  keyword: string;
  /** 클라이언트 정렬 순서 (월령 무관, 카테고리 단위) */
  displayOrder: number;
  /** cron 그룹 (1~4) */
  group: CronGroup;
  /**
   * 상품명에 포함된 경우 적재 제외 (대소문자 무관, 단순 substring 매칭).
   * 예: stroller는 강아지 유모차 노이즈 제거.
   */
  excludeKeywords?: string[];
}

// ─── 그룹 1 (01:15 KST) — 장난감 + 의류 8구간 × 2 = 16콜 ───────
const GROUP_1: BabyCategoryDef[] = [
  // 장난감 — 월령별 키워드 강화 (영아 ↔ 학령기 차이 큼)
  { category: '장난감', slug: 'toys-0-3',   keyword: '신생아 모빌',     displayOrder: 13, group: 1 },
  { category: '장난감', slug: 'toys-4-6',   keyword: '4개월 아기 장난감',displayOrder: 13, group: 1 },
  { category: '장난감', slug: 'toys-7-12',  keyword: '돌전 아기 장난감', displayOrder: 13, group: 1 },
  { category: '장난감', slug: 'toys-13-24', keyword: '두돌 장난감',     displayOrder: 13, group: 1 },
  { category: '장난감', slug: 'toys-25-36', keyword: '3세 장난감',      displayOrder: 13, group: 1 },
  { category: '장난감', slug: 'toys-37-48', keyword: '4세 장난감',      displayOrder: 13, group: 1 },
  { category: '장난감', slug: 'toys-49-72', keyword: '6세 장난감',      displayOrder: 13, group: 1 },
  { category: '장난감', slug: 'toys-73-84', keyword: '초등 장난감',     displayOrder: 13, group: 1 },

  // 의류 — 월령별
  { category: '의류', slug: 'clothing-0-3',   keyword: '신생아 의류',   displayOrder: 11, group: 1 },
  { category: '의류', slug: 'clothing-4-6',   keyword: '4개월 아기옷',  displayOrder: 11, group: 1 },
  { category: '의류', slug: 'clothing-7-12',  keyword: '돌 아기옷',     displayOrder: 11, group: 1 },
  { category: '의류', slug: 'clothing-13-24', keyword: '두돌 옷',       displayOrder: 11, group: 1 },
  { category: '의류', slug: 'clothing-25-36', keyword: '3세 아동복',    displayOrder: 11, group: 1 },
  { category: '의류', slug: 'clothing-37-48', keyword: '4세 아동복',    displayOrder: 11, group: 1 },
  { category: '의류', slug: 'clothing-49-72', keyword: '아동복',        displayOrder: 11, group: 1 },
  { category: '의류', slug: 'clothing-73-84', keyword: '초등 아동복',   displayOrder: 11, group: 1 },
];

// ─── 그룹 2 (01:30 KST) — 신발 4 + 도서 5 + 학습교구 5 = 14콜 ───
const GROUP_2: BabyCategoryDef[] = [
  // 신발 4구간
  { category: '신발', slug: 'shoes-7-12',  keyword: '돌 신발',       displayOrder: 12, group: 2 },
  { category: '신발', slug: 'shoes-13-24', keyword: '두돌 신발',     displayOrder: 12, group: 2 },
  { category: '신발', slug: 'shoes-25-48', keyword: '유아 운동화',   displayOrder: 12, group: 2 },
  { category: '신발', slug: 'shoes-49-84', keyword: '아동 운동화',   displayOrder: 12, group: 2 },

  // 도서 5구간
  { category: '도서', slug: 'books-4-6',   keyword: '초점책',         displayOrder: 19, group: 2 },
  { category: '도서', slug: 'books-7-12',  keyword: '돌전 책',        displayOrder: 19, group: 2 },
  { category: '도서', slug: 'books-13-24', keyword: '두돌 그림책',    displayOrder: 19, group: 2 },
  { category: '도서', slug: 'books-25-48', keyword: '유아 그림책',    displayOrder: 19, group: 2 },
  { category: '도서', slug: 'books-49-84', keyword: '아동 도서',      displayOrder: 19, group: 2 },

  // 학습교구 5구간
  { category: '학습교구', slug: 'learning-7-12',  keyword: '돌전 교구',    displayOrder: 18, group: 2 },
  { category: '학습교구', slug: 'learning-13-24', keyword: '두돌 교구',    displayOrder: 18, group: 2 },
  { category: '학습교구', slug: 'learning-25-48', keyword: '유아 교구',    displayOrder: 18, group: 2 },
  { category: '학습교구', slug: 'learning-49-72', keyword: '한글 교구',    displayOrder: 18, group: 2 },
  { category: '학습교구', slug: 'learning-73-84', keyword: '초등 학습교구',displayOrder: 18, group: 2 },
];

// ─── 그룹 3 (03:00 KST) — 소모품 = 10콜 ─────────────────────────
const GROUP_3: BabyCategoryDef[] = [
  // 기저귀 5구간
  { category: '기저귀', slug: 'diaper-0-3',   keyword: '신생아 기저귀', displayOrder: 1, group: 3 },
  { category: '기저귀', slug: 'diaper-4-6',   keyword: '소형 기저귀',   displayOrder: 1, group: 3 },
  { category: '기저귀', slug: 'diaper-7-12',  keyword: '중형 기저귀',   displayOrder: 1, group: 3 },
  { category: '기저귀', slug: 'diaper-13-24', keyword: '대형 기저귀',   displayOrder: 1, group: 3 },
  { category: '기저귀', slug: 'diaper-25-36', keyword: '팬티 기저귀',   displayOrder: 1, group: 3 },

  // 분유 3구간
  { category: '분유', slug: 'formula-0-3',  keyword: '신생아 분유', displayOrder: 2, group: 3 },
  { category: '분유', slug: 'formula-4-6',  keyword: '2단계 분유',  displayOrder: 2, group: 3 },
  { category: '분유', slug: 'formula-7-12', keyword: '3단계 분유',  displayOrder: 2, group: 3 },

  // 공통
  { category: '물티슈',   slug: 'wipes',        keyword: '아기 물티슈', displayOrder: 3, group: 3 },
  { category: '수유용품', slug: 'feeding-0-12', keyword: '수유용품',    displayOrder: 4, group: 3 },
];

// ─── 그룹 4 (03:20 KST) — 단일 슬러그 14콜 ──────────────────────
const GROUP_4: BabyCategoryDef[] = [
  { category: '속싸개/배냇저고리', slug: 'swaddle',       keyword: '속싸개',         displayOrder: 5,  group: 4 },
  { category: '신생아 스킨케어',   slug: 'newborn-skin',  keyword: '베이비 로션',    displayOrder: 6,  group: 4 },
  { category: '이유식/이유식도구', slug: 'baby-food',     keyword: '이유식',         displayOrder: 7,  group: 4 },
  { category: '보행기/점퍼루',     slug: 'walker',        keyword: '보행기',         displayOrder: 8,  group: 4 },
  { category: '유아식',            slug: 'toddler-food',  keyword: '유아식',         displayOrder: 9,  group: 4 },
  { category: '안전용품',          slug: 'safety',        keyword: '아기 안전용품',  displayOrder: 10, group: 4 },
  { category: '유모차/카시트',     slug: 'stroller',      keyword: '유모차',         displayOrder: 14, group: 4, excludeKeywords: ['애완견', '반려견', '강아지'] },
  { category: '유아 도서/학습',    slug: 'toddler-books', keyword: '유아 도서',      displayOrder: 15, group: 4 },
  { category: '생활용품',          slug: 'daily',         keyword: '아기 생활용품',  displayOrder: 16, group: 4 },
  { category: '가구',              slug: 'furniture',     keyword: '아기 가구',      displayOrder: 17, group: 4 },
  { category: '스포츠용품',        slug: 'sports',        keyword: '아동 스포츠',    displayOrder: 20, group: 4 },
  { category: '학용품',            slug: 'stationery',    keyword: '학용품',         displayOrder: 21, group: 4 },
  { category: '책가방',            slug: 'backpack',      keyword: '아동 책가방',    displayOrder: 22, group: 4 },
  { category: '전자기기',          slug: 'electronics',   keyword: '키즈 태블릿',    displayOrder: 23, group: 4 },
];

export const AIGO_BABY_CATEGORIES: BabyCategoryDef[] = [
  ...GROUP_1,
  ...GROUP_2,
  ...GROUP_3,
  ...GROUP_4,
];

export function getCategoriesByGroup(group: CronGroup): BabyCategoryDef[] {
  return AIGO_BABY_CATEGORIES.filter((c) => c.group === group);
}
