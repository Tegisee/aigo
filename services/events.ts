// ─── 기념일 / 시즌 / 부모 이벤트 계산 ───

export interface EventBanner {
  type: 'anniversary' | 'season' | 'parent';
  emoji: string;
  title: string;
  subtitle: string;
  daysLeft: number; // 0 = 당일, 음수 = 지남
  keywords?: string[]; // 시즌 추천 검색 키워드
}

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
      if (diff === 0) {
        events.push({
          type: 'anniversary',
          emoji: day === 365 ? '🎂' : '🥳',
          title: `오늘은 ${babyName} ${label}이에요!`,
          subtitle: '축하해요!',
          daysLeft: 0,
        });
      } else {
        events.push({
          type: 'anniversary',
          emoji: day === 365 ? '🎂' : '🎉',
          title: `${babyName} ${label}까지 D-${diff}`,
          subtitle: `${birth.getFullYear()}.${String(birth.getMonth() + 1).padStart(2, '0')}.${String(birth.getDate()).padStart(2, '0')} 출생`,
          daysLeft: diff,
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
    if (birthdayDiff === 0) {
      events.push({
        type: 'anniversary',
        emoji: '🎁',
        title: `오늘은 ${babyName} ${age}번째 생일이에요!`,
        subtitle: '생일 축하해요!',
        daysLeft: 0,
      });
    } else {
      events.push({
        type: 'anniversary',
        emoji: '🎁',
        title: `${babyName} 생일까지 D-${birthdayDiff}`,
        subtitle: `${age}번째 생일`,
        daysLeft: birthdayDiff,
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
  }[] = [
    {
      name: '어린이날',
      emoji: '🎈',
      month: 5, day: 5, leadDays: 30,
      keywords: ['어린이날 선물', '어린이날 장난감', '키즈 선물세트'],
    },
    {
      name: '크리스마스',
      emoji: '🎄',
      month: 12, day: 25, leadDays: 30,
      keywords: ['크리스마스 선물 아이', '크리스마스 장난감', '산타 선물'],
    },
  ];

  // 음력 명절은 매년 날짜가 다르므로 근사값 사용 (향후 라이브러리 연동)
  // 2026년 설날: 2/17, 추석: 10/4 (예시)
  const lunarHolidays: { name: string; emoji: string; month: number; day: number; leadDays: number; keywords: string[] }[] = [
    {
      name: '설날',
      emoji: '🧧',
      month: 2, day: 17, leadDays: 14,
      keywords: ['설날 선물 아이', '세뱃돈 저금통', '한복 아기'],
    },
    {
      name: '추석',
      emoji: '🌕',
      month: 10, day: 4, leadDays: 14,
      keywords: ['추석 선물 아이', '송편 만들기', '한복 유아'],
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
        });
      } else {
        events.push({
          type: 'season',
          emoji: s.emoji,
          title: `${s.name}까지 D-${diff}`,
          subtitle: `${babyName} 선물 미리 준비하세요`,
          daysLeft: diff,
          keywords: s.keywords,
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
  }[] = [
    {
      name: '어버이날',
      emoji: '💐',
      month: 5, day: 8, leadDays: 7,
      subtitle: '부모님께 감사한 마음을 전하세요',
      keywords: ['어버이날 선물', '부모님 선물', '안마기 선물'],
    },
    {
      name: '부부의 날',
      emoji: '💑',
      month: 5, day: 21, leadDays: 7,
      subtitle: '열심히 육아하는 나에게 선물을',
      keywords: ['부부 선물', '육아맘 선물', '셀프 선물'],
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
      });
    }
  }

  return events;
}

// ─── 통합 API ───

/** 현재 표시할 모든 이벤트 배너 반환 (기념일 + 시즌 + 부모) */
export function getActiveEvents(birthDate: string | null, babyName: string): EventBanner[] {
  const name = babyName || '우리 아이';
  const events: EventBanner[] = [];

  if (birthDate) {
    events.push(...getUpcomingAnniversaries(birthDate, name));
  }
  events.push(...getSeasonEvents(name));
  events.push(...getParentEvents());

  // daysLeft 오름차순 (당일 > D-1 > D-2 ...)
  events.sort((a, b) => a.daysLeft - b.daysLeft);

  return events;
}
