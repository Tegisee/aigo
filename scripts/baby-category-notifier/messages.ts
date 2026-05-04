/**
 * 월령별 가격 변동 알림 메시지 빌더.
 *
 * 사용자당 1알림 요약 — 변동 슬러그가 N개여도 메시지는 1개.
 * 대표 상품(가장 큰 dropAmount)을 골라 본문에 상품명 + 가격 변동(prev → curr) 표시.
 * 대표 상품이 없으면 (가격 정보 누락 등) 일반 메시지로 fallback.
 *
 * 운영 정책 (D, 2026-05-04 jigumiya 이식):
 *   - body는 항상 "상품명 prev원 → curr원" 패턴 사용 (사용자 클릭 동기 확보)
 *   - title은 월령 토큰 치환 사용
 *   - 메시지 변형은 랜덤 1개 pick (알림 폭탄 회피)
 */
export interface BabyDropMessage {
  title: string;
  body: string;
}

export interface PrimaryDrop {
  productName: string;
  prevPrice: number;
  newPrice: number;
  dropAmount: number;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function pickBabyDropMessage(
  months: number,
  primary?: PrimaryDrop,
): BabyDropMessage {
  if (primary) {
    const name = primary.productName.slice(0, 18);
    const prev = primary.prevPrice.toLocaleString();
    const curr = primary.newPrice.toLocaleString();
    const variants: BabyDropMessage[] = [
      { title: `${months}개월 추천 📉`, body: `${name} ${prev}원 → ${curr}원` },
      { title: '아이고 — 가격이 내려갔어요', body: `${name} ${prev}원 → ${curr}원 ↓` },
      { title: `${months}개월 아이 추천템`, body: `${name} 가격 변동! 지금 확인해보세요` },
    ];
    return pickRandom(variants);
  }
  // fallback — 대표 상품 정보 누락 시 (현실에서 거의 발생 X)
  const variants: BabyDropMessage[] = [
    { title: '아이고', body: `${months}개월 아이를 위한 추천 상품 가격이 변동됐어요 👶` },
    { title: '아이고', body: '우리 아이 월령 맞춤 상품! 가격이 내려갔어요 🎀' },
    { title: '아이고', body: '지금이 좋아요! 아이 월령별 추천 상품 가격을 확인해보세요' },
  ];
  return pickRandom(variants);
}
