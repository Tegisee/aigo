/**
 * 아이고 BabyCategory → 쿠팡 검색 키워드 매핑 (Phase 3 월령 세분화).
 *
 * 운영 정책 (docs/019_Phase3_SharedProducts.md §3, §4):
 *   - 4개 그룹으로 분할 → GitHub Actions cron 4개 (시간대 분리)
 *   - 그룹당 1콜/분 보수 운영 (분당 50회 한도 안전 마진)
 *   - 결과를 category_best_baby/{slug} 문서에 저장
 *   - 클라이언트는 types.getCategorySlug(category, months)로 슬러그 결정 후 read 1회
 *
 * 키워드 다중화 (search API limit=10 보완):
 *   - 슬러그당 keywords[] 2~3개 → searchProducts 각각 호출 → productId dedupe → 15~25개 후보 확보
 *   - 키워드 사이 SLEEP_BETWEEN_KEYWORDS_MS (기본 2초) 대기
 *   - 카테고리 사이 SLEEP_BETWEEN_CATEGORIES_MS (기본 60초) 대기는 그대로
 *
 * 그룹별 호출량 (슬러그당 평균 ~2.5콜):
 *   group 1 (01:15) — toys×8 + clothing×8 = 16슬러그 × ~2.5 ≈ 40콜
 *   group 2 (01:30) — shoes×4 + books×5 + learning×5 = 14슬러그 × ~2.5 ≈ 35콜
 *   group 3 (03:00) — diaper×5 + formula×3 + wipes + feeding = 10슬러그 × ~2.5 ≈ 25콜
 *   group 4 (03:20) — 14슬러그 × ~2.5 ≈ 35콜
 */

export type BabyCategory = string;
export type CronGroup = 1 | 2 | 3 | 4;

export interface BabyCategoryDef {
  category: BabyCategory;
  /** Firestore doc ID (ASCII slug, URL-safe) */
  slug: string;
  /** 쿠팡 search API 키워드 배열 — 슬러그당 2~3개 권장 (limit=10 한도 보완용) */
  keywords: string[];
  /** 클라이언트 정렬 순서 (월령 무관, 카테고리 단위) */
  displayOrder: number;
  /** cron 그룹 (1~4) */
  group: CronGroup;
  /**
   * 상품명에 포함된 경우 적재 제외 (대소문자 무관, 단순 substring 매칭).
   * 모든 keywords 호출 결과 dedupe 후 동일 필터 적용.
   */
  excludeKeywords?: string[];
}

// ─── 그룹 1 (01:15 KST) — 장난감 + 의류 16슬러그 ─────────────────
const GROUP_1: BabyCategoryDef[] = [
  // 장난감 — 월령별 (영아 ↔ 학령기 차이 큼)
  { category: '장난감', slug: 'toys-0-3',   keywords: ['신생아 모빌', '아기 모빌', '신생아 장난감'],         displayOrder: 13, group: 1 },
  { category: '장난감', slug: 'toys-4-6',   keywords: ['4개월 아기 장난감', '치발기', '5개월 아기 장난감'],  displayOrder: 13, group: 1 },
  { category: '장난감', slug: 'toys-7-12',  keywords: ['돌전 아기 장난감', '소근육 장난감', '아기 블록'],    displayOrder: 13, group: 1 },
  { category: '장난감', slug: 'toys-13-24', keywords: ['두돌 장난감', '돌 장난감', '유아 블록'],             displayOrder: 13, group: 1 },
  { category: '장난감', slug: 'toys-25-36', keywords: ['3세 장난감', '소꿉놀이', '역할놀이 장난감'],         displayOrder: 13, group: 1 },
  { category: '장난감', slug: 'toys-37-48', keywords: ['4세 장난감', '5세 장난감', '유아 보드게임'],         displayOrder: 13, group: 1 },
  { category: '장난감', slug: 'toys-49-72', keywords: ['6세 장난감', '7세 장난감', '아동 보드게임'],         displayOrder: 13, group: 1 },
  { category: '장난감', slug: 'toys-73-84', keywords: ['초등 장난감', '초등 보드게임', '아동 과학 키트'],    displayOrder: 13, group: 1 },

  // 의류 — 월령별
  { category: '의류', slug: 'clothing-0-3',   keywords: ['신생아 의류', '신생아 옷', '배냇저고리'],          displayOrder: 11, group: 1 },
  { category: '의류', slug: 'clothing-4-6',   keywords: ['4개월 아기옷', '5개월 아기옷', '아기 우주복'],     displayOrder: 11, group: 1 },
  { category: '의류', slug: 'clothing-7-12',  keywords: ['돌 아기옷', '돌잔치 의상', '아기 외출복'],         displayOrder: 11, group: 1 },
  { category: '의류', slug: 'clothing-13-24', keywords: ['두돌 옷', '두돌 외출복', '유아 옷'],               displayOrder: 11, group: 1 },
  { category: '의류', slug: 'clothing-25-36', keywords: ['3세 아동복', '3세 옷', '유아 외출복'],             displayOrder: 11, group: 1 },
  { category: '의류', slug: 'clothing-37-48', keywords: ['4세 아동복', '5세 아동복', '유아동 옷'],           displayOrder: 11, group: 1 },
  { category: '의류', slug: 'clothing-49-72', keywords: ['아동복', '아동 외출복', '아동 셔츠'],              displayOrder: 11, group: 1 },
  { category: '의류', slug: 'clothing-73-84', keywords: ['초등 아동복', '초등 외출복', '주니어 의류'],       displayOrder: 11, group: 1 },
];

// ─── 그룹 2 (01:30 KST) — 신발 4 + 도서 5 + 학습교구 5 ────────────
const GROUP_2: BabyCategoryDef[] = [
  // 신발 4구간
  { category: '신발', slug: 'shoes-7-12',  keywords: ['돌 신발', '아기 첫신발', '걸음마 신발'],     displayOrder: 12, group: 2 },
  { category: '신발', slug: 'shoes-13-24', keywords: ['두돌 신발', '유아 운동화', '아기 운동화'],   displayOrder: 12, group: 2 },
  { category: '신발', slug: 'shoes-25-48', keywords: ['유아 운동화', '유아 신발', '유아 샌들'],     displayOrder: 12, group: 2 },
  { category: '신발', slug: 'shoes-49-84', keywords: ['아동 운동화', '아동 신발', '아동 샌들'],     displayOrder: 12, group: 2 },

  // 도서 5구간
  { category: '도서', slug: 'books-4-6',   keywords: ['초점책', '아기 헝겊책', '아기 사운드북'],    displayOrder: 19, group: 2 },
  { category: '도서', slug: 'books-7-12',  keywords: ['아기 그림책', '돌아기 책', '아기 보드북'],   displayOrder: 19, group: 2 },
  { category: '도서', slug: 'books-13-24', keywords: ['두돌 그림책', '돌 그림책', '유아 한글책'],   displayOrder: 19, group: 2 },
  { category: '도서', slug: 'books-25-48', keywords: ['유아 그림책', '유아 동화책', '유아 영어책'], displayOrder: 19, group: 2 },
  { category: '도서', slug: 'books-49-84', keywords: ['아동 도서', '아동 동화책', '초등 도서'],     displayOrder: 19, group: 2 },

  // 학습교구 5구간
  { category: '학습교구', slug: 'learning-7-12',  keywords: ['아기 원목교구', '아기 모양 맞추기', '아기 도형 교구'],   displayOrder: 18, group: 2 },
  { category: '학습교구', slug: 'learning-13-24', keywords: ['두돌 교구', '유아 모양 맞추기', '유아 원목교구'],         displayOrder: 18, group: 2 },
  { category: '학습교구', slug: 'learning-25-48', keywords: ['유아 교구', '유아 학습 교구', '유아 한글 교구'],          displayOrder: 18, group: 2 },
  { category: '학습교구', slug: 'learning-49-72', keywords: ['한글 교구', '한글 학습', '아동 학습 교구'],               displayOrder: 18, group: 2 },
  { category: '학습교구', slug: 'learning-73-84', keywords: ['초등 학습교구', '초등 한자 교구', '초등 수학 교구'],      displayOrder: 18, group: 2 },
];

// ─── 그룹 3 (03:00 KST) — 소모품 10슬러그 ───────────────────────
const GROUP_3: BabyCategoryDef[] = [
  // 기저귀 5구간 (성인/반려동물 노이즈 제거 — excludeKeywords 동일 적용)
  { category: '기저귀', slug: 'diaper-0-3',   keywords: ['신생아 기저귀', '갓난아기 기저귀', '신생아 팬티 기저귀'], displayOrder: 1, group: 3,
    excludeKeywords: ['성인', '강아지', '애견', '펫', '반려'] },
  { category: '기저귀', slug: 'diaper-4-6',   keywords: ['소형 기저귀', '아기 소형 기저귀', '베이비 기저귀'],       displayOrder: 1, group: 3,
    excludeKeywords: ['성인', '강아지', '애견', '펫', '반려'] },
  { category: '기저귀', slug: 'diaper-7-12',  keywords: ['유아 중형 기저귀', '아기 중형 기저귀', '중형 팬티 기저귀'], displayOrder: 1, group: 3,
    excludeKeywords: ['성인', '강아지', '애견', '펫', '반려'] },
  { category: '기저귀', slug: 'diaper-13-24', keywords: ['유아 대형 기저귀', '아기 대형 기저귀', '대형 팬티 기저귀'], displayOrder: 1, group: 3,
    excludeKeywords: ['성인', '강아지', '애견', '펫', '반려'] },
  { category: '기저귀', slug: 'diaper-25-36', keywords: ['걸음마 기저귀', '팬티형 기저귀 4단계', '유아 팬티 기저귀'], displayOrder: 1, group: 3,
    excludeKeywords: ['성인', '강아지', '애견', '펫', '반려'] },

  // 분유 3구간 (formula-0-3만 임산부 분유 차단)
  { category: '분유', slug: 'formula-0-3',  keywords: ['신생아 분유', '1단계 분유', '신생아 산양 분유'], displayOrder: 2, group: 3,
    excludeKeywords: ['임산부', '마더 포뮬라', '수유일지'] },
  { category: '분유', slug: 'formula-4-6',  keywords: ['2단계 분유', '4개월 분유', '6개월 분유'],         displayOrder: 2, group: 3 },
  { category: '분유', slug: 'formula-7-12', keywords: ['3단계 분유', '돌 분유', '아기 성장 분유'],        displayOrder: 2, group: 3 },

  // 공통
  { category: '물티슈',   slug: 'wipes',        keywords: ['아기 물티슈', '베이비 물티슈', '신생아 물티슈'], displayOrder: 3, group: 3 },
  { category: '수유용품', slug: 'feeding-0-12', keywords: ['수유용품', '젖병 소독기', '아기 젖병'],          displayOrder: 4, group: 3 },
];

// ─── 그룹 4 (03:20 KST) — 단일 슬러그 14개 ──────────────────────
const GROUP_4: BabyCategoryDef[] = [
  { category: '속싸개/배냇저고리', slug: 'swaddle',       keywords: ['속싸개', '배냇저고리', '신생아 속싸개'],           displayOrder: 5,  group: 4 },
  { category: '신생아 스킨케어',   slug: 'newborn-skin',  keywords: ['베이비 로션', '아기 보습제', '신생아 스킨케어'],   displayOrder: 6,  group: 4 },
  { category: '이유식/이유식도구', slug: 'baby-food',     keywords: ['이유식', '이유식 큐브', '베이비푸드'],             displayOrder: 7,  group: 4 },
  { category: '보행기/점퍼루',     slug: 'walker',        keywords: ['아기 보행기', '아기 점퍼루', '유아 보행기'],       displayOrder: 8,  group: 4,
    excludeKeywords: ['노인', '고령자', '워커', '보행보조', '실버'] },
  { category: '유아식',            slug: 'toddler-food',  keywords: ['유아식', '유아 간편식', '유아 비빔밥'],            displayOrder: 9,  group: 4 },
  { category: '안전용품',          slug: 'safety',        keywords: ['아기 안전용품', '아기 모서리 보호', '아기 안전문'], displayOrder: 10, group: 4 },
  { category: '유모차/카시트',     slug: 'stroller',      keywords: ['유모차', '아기 유모차', '카시트'],                 displayOrder: 14, group: 4,
    excludeKeywords: ['애완견', '반려견', '강아지', '반려동물', '개모차', '펫'] },
  { category: '유아 도서/학습',    slug: 'toddler-books', keywords: ['유아 도서', '유아 동화책', '유아 학습 도서'],      displayOrder: 15, group: 4 },
  { category: '생활용품',          slug: 'daily',         keywords: ['신생아 생활용품', '아기 생활용품', '아기 욕조'],   displayOrder: 16, group: 4 },
  { category: '가구',              slug: 'furniture',     keywords: ['아기 가구', '아기 침대', '유아 책상'],             displayOrder: 17, group: 4 },
  { category: '스포츠용품',        slug: 'sports',        keywords: ['어린이 스포츠용품', '아동 자전거', '어린이 운동화'], displayOrder: 20, group: 4,
    excludeKeywords: ['성인', '남성', '여성'] },
  { category: '학용품',            slug: 'stationery',    keywords: ['학용품', '초등 학용품', '아동 필기구'],            displayOrder: 21, group: 4 },
  { category: '책가방',            slug: 'backpack',      keywords: ['아동 책가방', '초등 책가방', '아동 가방'],         displayOrder: 22, group: 4 },
  { category: '전자기기',          slug: 'electronics',   keywords: ['어린이 학습 태블릿', '키즈 태블릿', '어린이 코딩 로봇'], displayOrder: 23, group: 4 },
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
