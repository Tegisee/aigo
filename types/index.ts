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

export interface SharedProduct {
  productId: string;
  productName: string;
  category: BabyCategory;
  ageGroup: string;
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
