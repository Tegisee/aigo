/**
 * 월령별 가격 변동 알림용 랜덤 메시지.
 * 사용자당 1알림 요약 — 변동 슬러그가 N개여도 메시지는 1개.
 * 첫 번째 변형만 월령(개월) 토큰 치환을 사용.
 */
export interface BabyDropMessage {
  title: string;
  body: string;
}

export function pickBabyDropMessage(months: number): BabyDropMessage {
  const variants: BabyDropMessage[] = [
    { title: '아이고', body: `${months}개월 아이를 위한 추천 상품 가격이 변동됐어요 👶` },
    { title: '아이고', body: '우리 아이 월령 맞춤 상품! 가격이 내려갔어요 🎀' },
    { title: '아이고', body: '지금이 좋아요! 아이 월령별 추천 상품 가격을 확인해보세요' },
  ];
  return variants[Math.floor(Math.random() * variants.length)]!;
}
