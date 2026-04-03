export type BabyCategory = '기저귀' | '분유' | '물티슈' | '의류' | '장난감' | '유모차/카시트' | '수유용품' | '가구' | '기타';

export const BABY_CATEGORIES: BabyCategory[] = ['기저귀', '분유', '물티슈', '의류', '장난감', '유모차/카시트', '수유용품', '가구', '기타'];

/** 상품명 키워드 기반 카테고리 자동 분류 */
export function classifyCategory(productName: string): BabyCategory {
  const name = productName.toLowerCase();
  if (/기저귀|팬티형|밴드형|신생아용|하기스|보솜이|팸퍼스|디어베이비/.test(name)) return '기저귀';
  if (/분유|액상분유|이유식|유아식|산양분유|남양|매일|앱솔루트|셀렉스/.test(name)) return '분유';
  if (/물티슈|캡형|도톰한|순한|wet|wipe/.test(name)) return '물티슈';
  if (/유모차|카시트|바운서|하이체어|힙시트|보행기/.test(name)) return '유모차/카시트';
  if (/젖병|노리개|수유쿠션|유축기|수유|치발기|빨대컵/.test(name)) return '수유용품';
  if (/의류|옷|바지|티셔츠|상의|하의|우주복|바디슈트|내복|내의|양말|신발|모자|턱받이/.test(name)) return '의류';
  if (/장난감|완구|블록|레고|인형|놀이|러닝|피셔프라이스|뽀로로/.test(name)) return '장난감';
  if (/가구|침대|아기침대|범퍼|매트|쿠션|서랍장/.test(name)) return '가구';
  return '기타';
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
  // 재구매 알림
  repurchaseEnabled?: boolean;
  repurchaseDays?: number; // 재구매 주기 (일)
  lastPurchasedAt?: string; // ISO date (마지막 구매일)
}
