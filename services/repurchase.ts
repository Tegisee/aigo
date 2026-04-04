import type { BabyCategory } from '../types';

/** 재구매 알림 대상 카테고리 (소모품만) */
const CONSUMABLE_CATEGORIES: BabyCategory[] = [
  '기저귀', '분유', '물티슈',
  '이유식/이유식도구', '유아식', '신생아 스킨케어',
];

export function isConsumableCategory(category: BabyCategory | undefined): boolean {
  if (!category) return false;
  return CONSUMABLE_CATEGORIES.includes(category);
}

// ─── 상품명에서 수량/용량 추출 ───

/** 기저귀: "100매", "50매x2팩" 등에서 총 매수 추출 */
function extractDiaperCount(name: string): number | null {
  // "100매 x 2팩", "50매x3", "200매" 패턴
  const multiMatch = name.match(/(\d+)\s*매\s*[x×*]\s*(\d+)/i);
  if (multiMatch) return parseInt(multiMatch[1]) * parseInt(multiMatch[2]);

  const singleMatch = name.match(/(\d+)\s*매/);
  if (singleMatch) return parseInt(singleMatch[1]);

  return null;
}

/** 분유: "800g", "1.6kg" 등에서 g 단위로 추출 */
function extractFormulaGrams(name: string): number | null {
  const kgMatch = name.match(/([\d.]+)\s*kg/i);
  if (kgMatch) return parseFloat(kgMatch[1]) * 1000;

  const gMatch = name.match(/(\d+)\s*g/i);
  if (gMatch) return parseInt(gMatch[1]);

  return null;
}

/** 물티슈: "100매 10팩", "80매x5" 등에서 총 매수 추출 */
function extractWipeCount(name: string): number | null {
  // "100매 10팩", "80매x5팩"
  const multiMatch = name.match(/(\d+)\s*매\s*[x×*]?\s*(\d+)\s*팩?/i);
  if (multiMatch) return parseInt(multiMatch[1]) * parseInt(multiMatch[2]);

  const singleMatch = name.match(/(\d+)\s*매/);
  if (singleMatch) return parseInt(singleMatch[1]);

  return null;
}

// ─── 월령별 하루 사용량 ───

/** 기저귀 하루 사용량 (매) */
function dailyDiaperUsage(months: number): number {
  if (months <= 3) return 10;
  if (months <= 12) return 7;
  return 5;
}

/** 분유 하루 소비량 (g) — 분유 1ml ≈ 약 0.13g (7스쿱=200ml 기준) */
function dailyFormulaGrams(months: number): number {
  // 0~3개월: 600ml/일 ≈ 80g/일
  // 4~6개월: 800ml/일 ≈ 105g/일
  // 7~12개월: 600ml/일 ≈ 80g/일 (이유식 병행)
  if (months <= 3) return 80;
  if (months <= 6) return 105;
  return 80;
}

/** 물티슈 하루 사용량 (매) */
function dailyWipeUsage(_months: number): number {
  return 20;
}

// ─── 메인 계산 함수 ───

export interface RepurchaseEstimate {
  estimatedDays: number;
  description: string;
}

/**
 * 상품명 + 카테고리 + 월령으로 소진 예상 일수 자동 계산
 * @returns null이면 자동 계산 불가 (사용자 직접 설정 필요)
 */
export function estimateRepurchaseDays(
  productName: string,
  category: BabyCategory | undefined,
  babyMonths: number | null,
): RepurchaseEstimate | null {
  if (!category || !isConsumableCategory(category)) return null;

  const months = babyMonths ?? 6; // 월령 미입력 시 6개월 기본값

  if (category === '기저귀') {
    const count = extractDiaperCount(productName);
    if (!count) return null;
    const daily = dailyDiaperUsage(months);
    const days = Math.round(count / daily);
    return {
      estimatedDays: days,
      description: `${count}매 ÷ 하루 ${daily}매 = 약 ${days}일`,
    };
  }

  if (category === '분유') {
    const grams = extractFormulaGrams(productName);
    if (!grams) return null;
    const daily = dailyFormulaGrams(months);
    const days = Math.round(grams / daily);
    return {
      estimatedDays: days,
      description: `${grams}g ÷ 하루 ${daily}g = 약 ${days}일`,
    };
  }

  if (category === '물티슈') {
    const count = extractWipeCount(productName);
    if (!count) return null;
    const daily = dailyWipeUsage(months);
    const days = Math.round(count / daily);
    return {
      estimatedDays: days,
      description: `${count}매 ÷ 하루 ${daily}매 = 약 ${days}일`,
    };
  }

  // 이유식/유아식/스킨케어 — 표준 수량 패턴이 다양해서 자동 계산 어려움
  // 사용자 직접 주기 설정 유도
  return null;
}

/** 재구매 알림 문구 생성 */
export function getRepurchaseMessage(
  productName: string,
  category: BabyCategory,
  daysLeft: number,
): string {
  const shortName = productName.length > 20
    ? productName.slice(0, 20) + '...'
    : productName;

  if (daysLeft <= 0) {
    if (category === '기저귀') return `${shortName}, 슬슬 다 떨어질 때가 됐어요! 지금 가격 확인해보세요`;
    if (category === '분유') return `${shortName}, 소진 예정이에요. 지금 최저가로 구매해요!`;
    if (category === '물티슈') return `${shortName}, 재구매할 시간이에요!`;
    return `${shortName}, 재구매 시기입니다!`;
  }

  return `${shortName}, 약 ${daysLeft}일 후 소진 예정이에요`;
}
