import type { BabyCategory } from '../types';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shorten(name: string, max = 20): string {
  return name.length > max ? name.slice(0, max) + '…' : name;
}

/** 가격 하락 알림 문구 */
export function priceDrop(productName: string, category?: BabyCategory): { title: string; body: string } {
  const short = shorten(productName);
  const titles = [
    '아이고~ 가격 떨어졌다!',
    '찜해둔 상품, 가격 내려갔어요!',
    '지금 확인해보세요!',
  ];
  const bodies: string[] = [];
  if (category === '기저귀') {
    bodies.push(`찜해둔 기저귀, 가격 내려갔어요! 지금 확인해보세요`);
  } else if (category === '분유') {
    bodies.push(`우리 아이 분유 가격이 떨어졌어요! 얼른 확인해보세요`);
  } else {
    bodies.push(`${short} 가격이 내려갔어요. 지금 확인해보세요`);
  }
  bodies.push(`${short} 가격 하락! 지금이 기회예요`);

  return { title: `[아이고] ${pick(titles)}`, body: pick(bodies) };
}

/** 목표가 도달 알림 문구 */
export function targetReached(productName: string, price: number): { title: string; body: string } {
  const short = shorten(productName);
  const pairs: { title: string; body: string }[] = [
    {
      title: '[아이고] 드디어 목표가 달성!',
      body: `${short} ${price.toLocaleString()}원 — 지금 구매하러 가볼까요?`,
    },
    {
      title: '[아이고] 기다렸던 그 가격!',
      body: `${short} 최저가 도달! 지금이 기회예요`,
    },
    {
      title: '[아이고] 목표가 이하로 떨어졌어요!',
      body: `${short} ${price.toLocaleString()}원 — 놓치지 마세요!`,
    },
  ];
  return pick(pairs);
}

/** 재구매 알림 문구 */
export function repurchaseReminder(
  productName: string,
  category: BabyCategory | undefined,
  currentPrice?: number,
): { title: string; body: string } {
  const priceStr = currentPrice ? `현재 ${currentPrice.toLocaleString()}원` : '최저가 확인하기';

  const byCategory: Record<string, { title: string; body: string }[]> = {
    기저귀: [
      { title: '[아이고] 기저귀 재구매할 때가 됐어요', body: `${priceStr}` },
      { title: '[아이고] 기저귀 떨어질 때쯤이죠?', body: `지금 ${priceStr}이에요` },
    ],
    분유: [
      { title: '[아이고] 분유 떨어질 때쯤이죠?', body: `지금 ${priceStr}이에요` },
      { title: '[아이고] 분유 재구매 타이밍!', body: priceStr },
    ],
    물티슈: [
      { title: '[아이고] 물티슈 주문할 타이밍!', body: priceStr },
      { title: '[아이고] 물티슈 재구매할 때가 됐어요', body: priceStr },
    ],
  };

  const cat = category || '기타';
  const candidates = byCategory[cat] || [
    { title: '[아이고] 재구매할 때가 됐어요', body: `${shorten(productName)} — ${priceStr}` },
  ];

  return pick(candidates);
}

/** 카테고리별 재구매 기본 주기 (일) */
export function defaultRepurchaseDays(category?: BabyCategory): number {
  switch (category) {
    case '기저귀': return 14;
    case '분유': return 21;
    case '물티슈': return 30;
    default: return 30;
  }
}

/** 소모품 카테고리 여부 */
export function isConsumable(category?: BabyCategory): boolean {
  return category === '기저귀' || category === '분유' || category === '물티슈';
}
