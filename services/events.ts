import KoreanLunarCalendar from 'korean-lunar-calendar';

// ─── 기념일 / 시즌 / 부모 이벤트 계산 ───

/** 음력 날짜(MM-DD)를 해당 연도의 양력 Date로 변환 */
function lunarToSolar(year: number, month: number, day: number): Date | null {
  try {
    const calendar = new KoreanLunarCalendar();
    calendar.setLunarDate(year, month, day, false);
    const solar = calendar.getSolarCalendar();
    return new Date(solar.year, solar.month - 1, solar.day);
  } catch {
    return null;
  }
}

export interface EventBanner {
  type: 'anniversary' | 'season' | 'parent';
  emoji: string;
  title: string;
  subtitle: string;
  daysLeft: number; // 0 = 당일, 음수 = 지남
  keywords?: string[]; // 시즌 추천 검색 키워드
  /** event_best/{eventSlug} 문서 ID — 없으면 추천 상품 미지원 (클릭 시 빈 결과) */
  eventSlug?: string;
}

// ─── event_best 슬러그 매핑 (scripts/event-best-updater/events.ts 와 sync) ───

/** 특별 일수 → cron 적재 슬러그 (그 외 일수는 미적재 → 슬러그 없음) */
const ANNIVERSARY_DAY_SLUG: Record<number, string> = {
  100: 'anniv-100',
  200: 'anniv-200',
  300: 'anniv-300',
  365: 'anniv-365',
  500: 'anniv-500',
  1000: 'anniv-1000',
};

// ─── 29번: 기념일 D-Day ───

const SPECIAL_DAYS = [100, 200, 300, 365, 500, 1000, 1111, 1500, 2000, 2222, 2500, 3000, 3333, 4000, 4444, 5000];

function getUpcomingAnniversaries(birthDate: string, babyName: string): EventBanner[] {
  const birth = new Date(birthDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceBirth = Math.floor((today.getTime() - birth.getTime()) / 86400000);
  const events: EventBanner[] = [];

  // 특별 일수 기념일
  for (const day of SPECIAL_DAYS) {
    const diff = day - daysSinceBirth;
    if (diff >= -0 && diff <= 7) {
      const label = day === 365 ? '돌' : `${day}일`;
      const keywords = day === 365
        ? ['돌잔치 선물', '돌잔치 용품', '돌반지']
        : day === 100
          ? ['백일 선물', '백일 잔치', '아기 선물']
          : ['아기 기념일 선물', '아기 선물', '아기 파티용품'];
      const eventSlug = ANNIVERSARY_DAY_SLUG[day];
      if (diff === 0) {
        events.push({
          type: 'anniversary',
          emoji: day === 365 ? '🎂' : '🥳',
          title: `오늘은 ${babyName} ${label}이에요!`,
          subtitle: '축하해요!',
          daysLeft: 0,
          keywords,
          eventSlug,
        });
      } else {
        events.push({
          type: 'anniversary',
          emoji: day === 365 ? '🎂' : '🎉',
          title: `${babyName} ${label}까지 D-${diff}`,
          subtitle: `${birth.getFullYear()}.${String(birth.getMonth() + 1).padStart(2, '0')}.${String(birth.getDate()).padStart(2, '0')} 출생`,
          daysLeft: diff,
          keywords,
          eventSlug,
        });
      }
    }
  }

  // 매년 생일
  const thisYearBirthday = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
  let nextBirthday = thisYearBirthday;
  if (thisYearBirthday < today) {
    nextBirthday = new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate());
  }
  const birthdayDiff = Math.floor((nextBirthday.getTime() - today.getTime()) / 86400000);
  const age = nextBirthday.getFullYear() - birth.getFullYear();

  if (birthdayDiff >= 0 && birthdayDiff <= 7 && age > 1) {
    const birthdayKeywords = ['아이 생일 선물', '생일 파티 용품', '생일 케이크'];
    // birthday-1 ~ birthday-13 만 cron 적재 (만 14세 이상 미적재)
    const birthdaySlug = age >= 1 && age <= 13 ? `birthday-${age}` : undefined;
    if (birthdayDiff === 0) {
      events.push({
        type: 'anniversary',
        emoji: '🎁',
        title: `오늘은 ${babyName} ${age}번째 생일이에요!`,
        subtitle: '생일 축하해요!',
        daysLeft: 0,
        keywords: birthdayKeywords,
        eventSlug: birthdaySlug,
      });
    } else {
      events.push({
        type: 'anniversary',
        emoji: '🎁',
        title: `${babyName} 생일까지 D-${birthdayDiff}`,
        subtitle: `${age}번째 생일`,
        daysLeft: birthdayDiff,
        keywords: birthdayKeywords,
        eventSlug: birthdaySlug,
      });
    }
  }

  return events;
}

// ─── 30번: 시즌 컬렉션 ───

function getSeasonEvents(babyName: string): EventBanner[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const events: EventBanner[] = [];

  const seasonDates: {
    name: string;
    emoji: string;
    month: number;
    day: number;
    leadDays: number;
    keywords: string[];
    slug: string;
  }[] = [
    {
      name: '어린이날',
      emoji: '🎈',
      month: 5, day: 5, leadDays: 30,
      keywords: ['어린이날 선물', '어린이 선물세트', '어린이날 장난감'],
      slug: 'season-children-day',
    },
    {
      name: '크리스마스',
      emoji: '🎄',
      month: 12, day: 25, leadDays: 30,
      keywords: ['크리스마스 선물 아이', '산타 선물세트', '크리스마스 장난감'],
      slug: 'season-christmas',
    },
    {
      name: '핼러윈',
      emoji: '🎃',
      month: 10, day: 31, leadDays: 14,
      keywords: ['핼러윈 코스튬 아이', '핼러윈 장난감', '핼러윈 파티용품'],
      slug: 'season-halloween',
    },
  ];

  // 음력 명절은 매년 날짜가 다르므로 근사값 사용 (향후 라이브러리 연동)
  // 2026년 설날: 2/17, 추석: 10/4 (예시)
  const lunarHolidays: { name: string; emoji: string; month: number; day: number; leadDays: number; keywords: string[]; slug: string }[] = [
    {
      name: '설날',
      emoji: '🧧',
      month: 2, day: 17, leadDays: 14,
      keywords: ['설날 선물 아이', '세뱃돈 저금통', '한복 아기'],
      slug: 'season-newyear',
    },
    {
      name: '추석',
      emoji: '🌕',
      month: 10, day: 4, leadDays: 14,
      keywords: ['추석 선물 아이', '송편 만들기', '한복 유아'],
      slug: 'season-chuseok',
    },
  ];

  const allDates = [...seasonDates, ...lunarHolidays];

  for (const s of allDates) {
    const eventDate = new Date(now.getFullYear(), s.month - 1, s.day);
    const diff = Math.floor((eventDate.getTime() - today.getTime()) / 86400000);

    if (diff >= 0 && diff <= s.leadDays) {
      if (diff === 0) {
        events.push({
          type: 'season',
          emoji: s.emoji,
          title: `오늘은 ${s.name}이에요!`,
          subtitle: `${babyName}에게 특별한 하루를 선물하세요`,
          daysLeft: 0,
          keywords: s.keywords,
          eventSlug: s.slug,
        });
      } else {
        events.push({
          type: 'season',
          emoji: s.emoji,
          title: `${s.name}까지 D-${diff}`,
          subtitle: `${babyName} 선물 미리 준비하세요`,
          daysLeft: diff,
          keywords: s.keywords,
          eventSlug: s.slug,
        });
      }
    }
  }

  return events;
}

// ─── 31번: 부모 자축 선물 ───

function getParentEvents(): EventBanner[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const events: EventBanner[] = [];

  const parentDates: {
    name: string;
    emoji: string;
    month: number;
    day: number;
    leadDays: number;
    subtitle: string;
    keywords: string[];
    slug: string;
  }[] = [
    {
      name: '어버이날',
      emoji: '💐',
      month: 5, day: 8, leadDays: 7,
      subtitle: '부모님께 감사한 마음을 전하세요',
      keywords: ['어버이날 선물', '부모님 선물', '안마기 선물'],
      slug: 'parent-parents-day',
    },
    {
      name: '발렌타인데이',
      emoji: '💝',
      month: 2, day: 14, leadDays: 14,
      subtitle: '사랑하는 사람에게 마음을 전하세요',
      keywords: ['발렌타인 선물', '커플 선물', '초콜릿 선물세트'],
      slug: 'parent-valentine',
    },
    {
      name: '화이트데이',
      emoji: '🤍',
      month: 3, day: 14, leadDays: 14,
      subtitle: '달콤한 답례 선물을 준비하세요',
      keywords: ['화이트데이 선물', '커플 선물', '사탕 선물세트'],
      slug: 'parent-whiteday',
    },
    {
      name: '부부의 날',
      emoji: '💑',
      month: 5, day: 21, leadDays: 7,
      subtitle: '열심히 육아하는 나에게 선물을',
      keywords: ['부부 선물', '육아맘 선물', '셀프 선물'],
      slug: 'parent-couple-day',
    },
  ];

  for (const p of parentDates) {
    const eventDate = new Date(now.getFullYear(), p.month - 1, p.day);
    const diff = Math.floor((eventDate.getTime() - today.getTime()) / 86400000);

    if (diff >= 0 && diff <= p.leadDays) {
      events.push({
        type: 'parent',
        emoji: p.emoji,
        title: diff === 0 ? `오늘은 ${p.name}이에요!` : `${p.name}까지 D-${diff}`,
        subtitle: p.subtitle,
        daysLeft: diff,
        keywords: p.keywords,
        eventSlug: p.slug,
      });
    }
  }

  return events;
}

// ─── 통합 API ───

/** 현재 표시할 모든 이벤트 배너 반환 (기념일 + 시즌 + 부모) */
export function getActiveEvents(birthDate: string | null, babyName: string, parentInfo?: { momBirthday?: { date: string; isLunar: boolean }; dadBirthday?: { date: string; isLunar: boolean }; anniversary?: string }): EventBanner[] {
  const name = babyName || '우리 아이';
  const events: EventBanner[] = [];

  if (birthDate) {
    events.push(...getUpcomingAnniversaries(birthDate, name));
  }
  events.push(...getSeasonEvents(name));
  events.push(...getParentEvents());

  // 부모 생일 / 결혼기념일
  if (parentInfo) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const pEntries: { label: string; emoji: string; date: string; isLunar: boolean; kw: string[]; slug: string }[] = [];
    if (parentInfo.momBirthday) pEntries.push({ label: '엄마 생일', emoji: '👩', date: parentInfo.momBirthday.date, isLunar: parentInfo.momBirthday.isLunar, kw: ['엄마 선물', '여성 선물', '엄마 생일 선물'], slug: 'parent-mom-birthday' });
    if (parentInfo.dadBirthday) pEntries.push({ label: '아빠 생일', emoji: '👨', date: parentInfo.dadBirthday.date, isLunar: parentInfo.dadBirthday.isLunar, kw: ['아빠 선물', '남성 선물', '아빠 생일 선물'], slug: 'parent-dad-birthday' });
    if (parentInfo.anniversary) pEntries.push({ label: '결혼기념일', emoji: '💍', date: parentInfo.anniversary, isLunar: false, kw: ['결혼기념일 선물', '커플 선물', '기념일 선물세트'], slug: 'parent-wedding' });

    for (const e of pEntries) {
      const [, m, d] = e.date.split('-').map(Number);
      let eventDate: Date;
      if (e.isLunar) {
        // 음력 → 양력 변환
        const converted = lunarToSolar(now.getFullYear(), m, d);
        if (!converted) continue;
        eventDate = converted;
        if (eventDate < today) {
          const nextConverted = lunarToSolar(now.getFullYear() + 1, m, d);
          if (nextConverted) eventDate = nextConverted;
        }
      } else {
        eventDate = new Date(now.getFullYear(), m - 1, d);
        if (eventDate < today) eventDate.setFullYear(now.getFullYear() + 1);
      }
      const diff = Math.floor((eventDate.getTime() - today.getTime()) / 86400000);
      if (diff >= 0 && diff <= 14) {
        events.push({
          type: 'parent',
          emoji: e.emoji,
          title: diff === 0 ? `오늘은 ${e.label}이에요!` : `${e.label}까지 D-${diff}`,
          subtitle: diff === 0 ? '축하해요!' : '선물 준비하셨나요?',
          daysLeft: diff,
          keywords: e.kw,
          eventSlug: e.slug,
        });
      }
    }
  }

  // daysLeft 오름차순 (당일 > D-1 > D-2 ...)
  events.sort((a, b) => a.daysLeft - b.daysLeft);

  return events;
}
