/**
 * 아이고 BabyCategory → 쿠팡 검색 키워드 매핑.
 *
 * 운영 정책:
 *   - cron이 카테고리당 1회 search API 호출 (limit=50)
 *   - 결과를 category_best_baby/{slug} 문서에 저장
 *   - 클라이언트는 BabyCategory.slug로 read 1회
 *   - '기타'는 검색 의미 없어 제외
 *
 * 호출량:
 *   - 23개 × 1콜 × 60초 sleep ≈ 약 23분
 *   - 합산 한도 100회/분 대비 분당 1회 → 안전
 *   - 지금이야 02:00 KST와 분리하여 04:00 KST 실행 권장
 */

/** 아이고 클라이언트 types.BabyCategory 와 동일. cron 독립 폴더라 string으로 둠. */
export type BabyCategory = string;

export interface BabyCategoryDef {
  category: BabyCategory;
  /** Firestore doc ID (ASCII slug, URL-safe) */
  slug: string;
  /** 쿠팡 search API 키워드 */
  keyword: string;
  displayOrder: number;
}

export const AIGO_BABY_CATEGORIES: BabyCategoryDef[] = [
  // 신생아 ~ 6개월
  { category: '기저귀',                slug: 'diaper',          keyword: '기저귀',         displayOrder: 1 },
  { category: '분유',                  slug: 'formula',         keyword: '분유',           displayOrder: 2 },
  { category: '물티슈',                slug: 'wipes',           keyword: '아기 물티슈',    displayOrder: 3 },
  { category: '수유용품',              slug: 'feeding',         keyword: '수유용품',       displayOrder: 4 },
  { category: '속싸개/배냇저고리',     slug: 'swaddle',         keyword: '속싸개',         displayOrder: 5 },
  { category: '신생아 스킨케어',       slug: 'newborn-skin',    keyword: '베이비 로션',    displayOrder: 6 },

  // 7 ~ 12개월
  { category: '이유식/이유식도구',     slug: 'baby-food',       keyword: '이유식',         displayOrder: 7 },
  { category: '보행기/점퍼루',         slug: 'walker',          keyword: '보행기',         displayOrder: 8 },

  // 13 ~ 24개월
  { category: '유아식',                slug: 'toddler-food',    keyword: '유아식',         displayOrder: 9 },
  { category: '안전용품',              slug: 'safety',          keyword: '아기 안전용품',  displayOrder: 10 },

  // 의류/신발/장난감 (성별 무관, 클라이언트에서 필터)
  { category: '의류',                  slug: 'clothing',        keyword: '아기 의류',      displayOrder: 11 },
  { category: '신발',                  slug: 'shoes',           keyword: '아기 신발',      displayOrder: 12 },
  { category: '장난감',                slug: 'toys',            keyword: '아기 장난감',    displayOrder: 13 },
  { category: '유모차/카시트',         slug: 'stroller',        keyword: '유모차',         displayOrder: 14 },

  // 25 ~ 48개월
  { category: '유아 도서/학습',        slug: 'toddler-books',   keyword: '유아 도서',      displayOrder: 15 },
  { category: '생활용품',              slug: 'daily',           keyword: '아기 생활용품',  displayOrder: 16 },

  // 49 ~ 84개월
  { category: '가구',                  slug: 'furniture',       keyword: '아기 가구',      displayOrder: 17 },
  { category: '학습교구',              slug: 'learning',        keyword: '학습교구',       displayOrder: 18 },
  { category: '도서',                  slug: 'books',           keyword: '아동 도서',      displayOrder: 19 },
  { category: '스포츠용품',            slug: 'sports',          keyword: '아동 스포츠',    displayOrder: 20 },

  // 85개월 ~ (8세+)
  { category: '학용품',                slug: 'stationery',      keyword: '학용품',         displayOrder: 21 },
  { category: '책가방',                slug: 'backpack',        keyword: '아동 책가방',    displayOrder: 22 },
  { category: '전자기기',              slug: 'electronics',     keyword: '키즈 태블릿',    displayOrder: 23 },
];

/** BabyCategory → slug 매핑 (클라이언트 read 시 사용) */
export const CATEGORY_TO_SLUG: Record<string, string> = Object.fromEntries(
  AIGO_BABY_CATEGORIES.map((c) => [c.category, c.slug]),
);
