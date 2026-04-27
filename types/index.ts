export type BabyCategory =
  | '기저귀' | '분유' | '물티슈' | '의류' | '장난감'
  | '유모차/카시트' | '수유용품' | '가구' | '기타'
  // 월령별 확장 카테고리
  | '속싸개/배냇저고리' | '신생아 스킨케어'
  | '이유식/이유식도구' | '보행기/점퍼루'
  | '유아식' | '신발' | '안전용품'
  | '유아 도서/학습' | '생활용품'
  | '학습교구' | '도서' | '스포츠용품'
  | '학용품' | '책가방' | '전자기기';

/** 전체 카테고리 (고정 목록 — 월령 무관 시 fallback) */
export const BABY_CATEGORIES: BabyCategory[] = ['기저귀', '분유', '물티슈', '의류', '장난감', '유모차/카시트', '수유용품', '가구', '기타'];

/** 월령(개월) 기반 동적 카테고리 반환 */
export function getCategoriesByMonth(months: number | null): BabyCategory[] {
  if (months === null) return BABY_CATEGORIES;

  if (months <= 6) {
    return ['기저귀', '분유', '수유용품', '물티슈', '속싸개/배냇저고리', '신생아 스킨케어', '기타'];
  }
  if (months <= 12) {
    return ['기저귀', '이유식/이유식도구', '수유용품', '물티슈', '장난감', '보행기/점퍼루', '기타'];
  }
  if (months <= 24) {
    return ['기저귀', '유아식', '장난감', '의류', '신발', '안전용품', '기타'];
  }
  if (months <= 48) {
    return ['의류', '장난감', '유모차/카시트', '신발', '유아 도서/학습', '생활용품', '기타'];
  }
  if (months <= 84) { // ~7세
    return ['장난감', '의류', '신발', '가구', '학습교구', '도서', '스포츠용품', '기타'];
  }
  // 8~13세 (85개월~)
  return ['의류', '신발', '학용품', '책가방', '도서', '스포츠용품', '전자기기', '기타'];
}

/** 월령(개월)에서 연령 구간 문자열 반환 (shared_products.ageGroup용) */
export function getAgeGroup(months: number): string {
  if (months <= 6) return '0-6';
  if (months <= 12) return '7-12';
  if (months <= 24) return '13-24';
  if (months <= 48) return '25-48';
  if (months <= 84) return '49-84';
  return '85+';
}

/** 상품명 키워드 기반 카테고리 자동 분류 */
export function classifyCategory(productName: string): BabyCategory {
  const name = productName.toLowerCase();
  if (/기저귀|팬티형|밴드형|신생아용|하기스|보솜이|팸퍼스|디어베이비/.test(name)) return '기저귀';
  if (/분유|액상분유|산양분유|남양|매일|앱솔루트|셀렉스/.test(name)) return '분유';
  if (/이유식|이유식도구|퓨레|미음/.test(name)) return '이유식/이유식도구';
  if (/유아식|아이밥|영양식/.test(name)) return '유아식';
  if (/물티슈|캡형|도톰한|순한|wet|wipe/.test(name)) return '물티슈';
  if (/유모차|카시트|바운서|하이체어|힙시트/.test(name)) return '유모차/카시트';
  if (/보행기|점퍼루|쏘서/.test(name)) return '보행기/점퍼루';
  if (/젖병|노리개|수유쿠션|유축기|수유|치발기|빨대컵/.test(name)) return '수유용품';
  if (/속싸개|배냇저고리|스와들/.test(name)) return '속싸개/배냇저고리';
  if (/신생아.*로션|신생아.*크림|베이비로션|베이비크림|아토팜|세타필베이비/.test(name)) return '신생아 스킨케어';
  if (/신발|운동화|샌들|부츠|실내화/.test(name)) return '신발';
  if (/의류|옷|바지|티셔츠|상의|하의|우주복|바디슈트|내복|내의|양말|모자|턱받이/.test(name)) return '의류';
  if (/장난감|완구|블록|레고|인형|놀이|러닝|피셔프라이스|뽀로로|모빌/.test(name)) return '장난감';
  if (/모서리|안전문|코너|보호대|콘센트커버/.test(name)) return '안전용품';
  if (/가구|침대|아기침대|범퍼|매트|쿠션|서랍장|책상|의자/.test(name)) return '가구';
  if (/학습교구|퍼즐|숫자|한글카드/.test(name)) return '학습교구';
  if (/도서|그림책|동화|전집/.test(name)) return '도서';
  if (/학용품|필통|색연필|크레파스/.test(name)) return '학용품';
  if (/책가방|가방|백팩|학생가방/.test(name)) return '책가방';
  if (/스포츠|자전거|킥보드|인라인|축구공/.test(name)) return '스포츠용품';
  if (/태블릿|키즈폰|키즈패드|전자기기/.test(name)) return '전자기기';
  return '기타';
}

/**
 * 월령 8단계 구간 (Phase 3 category_best_baby 슬러그용).
 * docs/019_Phase3_SharedProducts.md §4-1.
 */
export type AgeBucket = '0-3' | '4-6' | '7-12' | '13-24' | '25-36' | '37-48' | '49-72' | '73-84';

export function getAgeBucket(months: number | null): AgeBucket | null {
  if (months === null || months < 0) return null;
  if (months <= 3) return '0-3';
  if (months <= 6) return '4-6';
  if (months <= 12) return '7-12';
  if (months <= 24) return '13-24';
  if (months <= 36) return '25-36';
  if (months <= 48) return '37-48';
  if (months <= 72) return '49-72';
  return '73-84';
}

/**
 * BabyCategory + 월령 → category_best_baby Firestore doc slug.
 * scripts/baby-category-best-updater/baby-categories.ts 와 sync 유지 필수.
 * '기타'는 검색 의미 없어 null 반환.
 */
export function getCategorySlug(category: BabyCategory, months: number | null): string | null {
  const bucket = getAgeBucket(months);

  // 월령 8구간 모두 적재 (그룹 1)
  if (category === '장난감') return `toys-${bucket ?? '13-24'}`;
  if (category === '의류') return `clothing-${bucket ?? '13-24'}`;

  // 그룹 2 — 신발 4구간 / 도서 5구간 / 학습교구 5구간
  if (category === '신발') {
    if (!bucket || bucket === '0-3' || bucket === '4-6' || bucket === '7-12') return 'shoes-7-12';
    if (bucket === '13-24') return 'shoes-13-24';
    if (bucket === '25-36' || bucket === '37-48') return 'shoes-25-48';
    return 'shoes-49-84';
  }
  if (category === '도서') {
    if (!bucket || bucket === '0-3' || bucket === '4-6') return 'books-4-6';
    if (bucket === '7-12') return 'books-7-12';
    if (bucket === '13-24') return 'books-13-24';
    if (bucket === '25-36' || bucket === '37-48') return 'books-25-48';
    return 'books-49-84';
  }
  if (category === '학습교구') {
    if (!bucket || bucket === '0-3' || bucket === '4-6' || bucket === '7-12') return 'learning-7-12';
    if (bucket === '13-24') return 'learning-13-24';
    if (bucket === '25-36' || bucket === '37-48') return 'learning-25-48';
    if (bucket === '49-72') return 'learning-49-72';
    return 'learning-73-84';
  }

  // 그룹 3 — 소모품
  if (category === '기저귀') {
    if (!bucket) return 'diaper-7-12';
    if (bucket === '37-48' || bucket === '49-72' || bucket === '73-84') return 'diaper-25-36';
    return `diaper-${bucket}`;
  }
  if (category === '분유') {
    if (!bucket || bucket === '0-3') return 'formula-0-3';
    if (bucket === '4-6') return 'formula-4-6';
    return 'formula-7-12';
  }
  if (category === '물티슈') return 'wipes';
  if (category === '수유용품') return 'feeding-0-12';

  // 그룹 4 — 단일 슬러그
  const single: Partial<Record<BabyCategory, string>> = {
    '속싸개/배냇저고리': 'swaddle',
    '신생아 스킨케어': 'newborn-skin',
    '이유식/이유식도구': 'baby-food',
    '보행기/점퍼루': 'walker',
    '유아식': 'toddler-food',
    '안전용품': 'safety',
    '유모차/카시트': 'stroller',
    '유아 도서/학습': 'toddler-books',
    '생활용품': 'daily',
    '가구': 'furniture',
    '스포츠용품': 'sports',
    '학용품': 'stationery',
    '책가방': 'backpack',
    '전자기기': 'electronics',
  };
  return single[category] ?? null;
}

/** category_best_baby/{slug} 문서 형태 (cron 적재) */
export interface CategoryBestBaby {
  category: BabyCategory;
  slug: string;
  keyword: string;
  displayOrder: number;
  updatedAt: number;
  products: Array<{
    productId: string;
    productName: string;
    productPrice: number;
    productImage: string;
    productUrl: string;
    isRocket: boolean;
  }>;
}

export interface SharedProduct {
  productId: string;
  productName: string;
  category: BabyCategory;
  ageGroup: string;
  gender?: 'male' | 'female' | 'both'; // 아이 성별 기반 필터링용
  currentPrice: number;
  previousPrice: number;
  thumbnail: string;
  priceHistory: { date: string; price: number }[];
  trackerCount: number;
  purchaseCount: number;
  lastCheckedAt: string;
}

export interface TrackedItem {
  id: string;
  url: string;
  resolvedUrl?: string;
  productId?: string;
  vendorItemId?: string;
  productName: string;
  category?: BabyCategory;
  currentPrice: number;
  targetPrice?: number;
  thumbnail: string;
  priceHistory: { date: string; price: number }[];
  createdAt: number;
  // 아이 귀속
  childId?: string;
  // 구매 이력
  purchaseHistory?: { date: string; price: number }[];
  // 재구매 알림
  repurchaseEnabled?: boolean;
  repurchaseDays?: number; // 재구매 주기 (일)
  lastPurchasedAt?: string; // ISO date (마지막 구매일)
}
