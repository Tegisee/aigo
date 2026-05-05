/**
 * 아이고 morning / evening 인사 알림 — KST 요일별 단일 문구.
 *
 * 인덱스 = KST 기준 요일 (0=일, 1=월, ..., 6=토).
 * title은 시간대 공통, body가 요일별로 다름.
 */
export interface GreetingMessage {
  title: string;
  body: string;
}

export type GreetingMode = 'morning' | 'evening';

const MORNING_BY_DOW: readonly GreetingMessage[] = [
  { title: '🌅 좋은 아침이에요', body: '일요일 아침, 가족과 함께 행복한 하루 되세요 ☀️' },          // 0=일
  { title: '🌅 좋은 아침이에요', body: '새로운 한 주 시작! 오늘 아이와 함께 좋은 하루 되세요 ☀️' }, // 1=월
  { title: '🌅 좋은 아침이에요', body: '오늘도 건강하고 행복한 하루 되세요 💚' },                   // 2=화
  { title: '🌅 좋은 아침이에요', body: '주중 힘내세요! 오늘도 좋은 하루 응원해요 💪' },             // 3=수
  { title: '🌅 좋은 아침이에요', body: '목요일 아침, 오늘도 파이팅이에요! ⚡' },                    // 4=목
  { title: '🌅 좋은 아침이에요', body: '드디어 금요일! 오늘도 우리 아이와 즐거운 하루 되세요 🎉' }, // 5=금
  { title: '🌅 좋은 아침이에요', body: '주말이에요! 아이와 함께 특별한 하루 보내세요 🌸' },         // 6=토
] as const;

const EVENING_BY_DOW: readonly GreetingMessage[] = [
  { title: '🌙 오늘도 수고했어요', body: '내일도 힘낼 수 있어요. 오늘 하루도 최고였어요 💛' },      // 0=일
  { title: '🌙 오늘도 수고했어요', body: '월요일도 육아 수고하셨어요. 푹 쉬세요 🌙' },              // 1=월
  { title: '🌙 오늘도 수고했어요', body: '화요일 저녁, 아이와 함께한 오늘 어떠셨나요? 😊' },         // 2=화
  { title: '🌙 오늘도 수고했어요', body: '수고하셨어요. 오늘 하루도 최고의 부모님이셨어요 🌟' },     // 3=수
  { title: '🌙 오늘도 수고했어요', body: '육아는 매일이 새로워요. 오늘도 수고하셨어요 🌈' },         // 4=목
  { title: '🌙 오늘도 수고했어요', body: '한 주 동안 정말 수고하셨어요. 푹 쉬세요 💗' },             // 5=금
  { title: '🌙 오늘도 수고했어요', body: '토요일 저녁도 수고하셨어요. 편안한 밤 되세요 🌙' },        // 6=토
] as const;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 요일 — 0=일, 1=월, ..., 6=토 */
export function getKstDayOfWeek(now: number = Date.now()): number {
  const kst = new Date(now + KST_OFFSET_MS);
  return kst.getUTCDay();
}

/** KST 기준 'YYYY-MM-DD' 날짜 문자열 (하루 1회 가드용) */
export function todayKstDateStr(now: number = Date.now()): string {
  const kst = new Date(now + KST_OFFSET_MS);
  return kst.toISOString().slice(0, 10);
}

export function pickGreetingMessage(mode: GreetingMode, now: number = Date.now()): GreetingMessage {
  const day = getKstDayOfWeek(now);
  const arr = mode === 'morning' ? MORNING_BY_DOW : EVENING_BY_DOW;
  return arr[day]!;
}
