/**
 * 공공데이터포털 API 클라이언트
 * API 키 발급 후 실제 호출 로직 구현 예정
 * 현재: 타입 정의 + 스켈레톤 + 건강검진 정적 데이터
 */

const DATA_BASE_URL = 'http://apis.data.go.kr';
let API_KEY = '';

/** 앱 시작 시 호출 — .env에서 API 키 로드 */
export function initPublicApi() {
  API_KEY = process.env.EXPO_PUBLIC_DATA_GO_KR_KEY || '';
  if (API_KEY) {
    console.log('[PublicAPI] 공공데이터 API 키 로드 완료');
  }
}

export function hasPublicApiKey(): boolean {
  return API_KEY.length > 0;
}

// ─── 예방접종 기관 검색 ───

export interface VaccineCenter {
  name: string;
  address: string;
  tel: string;
  vaccines: string[];
}

export async function fetchVaccineCenters(
  region: string,
  district?: string,
): Promise<VaccineCenter[]> {
  if (!API_KEY) return [];

  try {
    const params = new URLSearchParams({
      serviceKey: API_KEY,
      시도명: region,
      ...(district ? { 시군구명: district } : {}),
      numOfRows: '20',
      pageNo: '1',
      type: 'json',
    });

    const res = await fetch(
      `${DATA_BASE_URL}/1790387/vcninfo/getVcnList?${params}`,
    );
    const json = await res.json();

    // TODO: 실제 응답 구조에 맞게 파싱
    const items = json?.response?.body?.items?.item || [];
    return items.map((item: any) => ({
      name: item.orgNm || '',
      address: item.orgAddr || '',
      tel: item.orgTlno || '',
      vaccines: [], // 상세 API에서 별도 조회
    }));
  } catch (e) {
    console.warn('[PublicAPI] 예방접종 기관 조회 실패:', e);
    return [];
  }
}

// ─── 복지 서비스 조회 ───

export interface WelfareService {
  id: string;
  name: string;
  summary: string;
  targetAge: string;
  amount: string;
  howToApply: string;
  detailUrl: string;
}

export async function fetchWelfareServices(
  childAgeMonths: number,
  region?: string,
): Promise<WelfareService[]> {
  if (!API_KEY) return [];

  try {
    const lifeArray = childAgeMonths < 84 ? '영유아' : '아동';
    const params = new URLSearchParams({
      serviceKey: API_KEY,
      lifeArray,
      ...(region ? { arrgOrgNm: region } : {}),
      numOfRows: '20',
      pageNo: '1',
      type: 'json',
    });

    const res = await fetch(
      `${DATA_BASE_URL}/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist?${params}`,
    );
    const json = await res.json();

    // TODO: 실제 응답 구조에 맞게 파싱
    const items = json?.response?.body?.items?.item || [];
    return items.map((item: any) => ({
      id: item.servId || '',
      name: item.servNm || '',
      summary: item.servDgst || '',
      targetAge: item.trgterIndvdlArray || '',
      amount: item.sprtCycNm || '',
      howToApply: item.aplyMtdNm || '',
      detailUrl: item.servDtlLink || '',
    }));
  } catch (e) {
    console.warn('[PublicAPI] 복지 서비스 조회 실패:', e);
    return [];
  }
}

// ─── 어린이집 검색 ───

export interface ChildcareCenter {
  name: string;
  type: string;
  address: string;
  tel: string;
  capacity: number;
  currentCount: number;
  rating: string;
}

export async function fetchChildcareCenters(
  region: string,
  district?: string,
): Promise<ChildcareCenter[]> {
  if (!API_KEY) return [];

  try {
    const params = new URLSearchParams({
      serviceKey: API_KEY,
      sidoname: region,
      ...(district ? { sigunguname: district } : {}),
      numOfRows: '20',
      pageNo: '1',
      type: 'json',
    });

    const res = await fetch(
      `${DATA_BASE_URL}/1741000/ChildCareOpenAPIService/getChildCareInfo?${params}`,
    );
    const json = await res.json();

    // TODO: 실제 응답 구조에 맞게 파싱
    const items = json?.response?.body?.items?.item || [];
    return items.map((item: any) => ({
      name: item.crname || '',
      type: item.crtypename || '',
      address: item.craddr || '',
      tel: item.crtelno || '',
      capacity: parseInt(item.crcapat) || 0,
      currentCount: parseInt(item.crchcnt) || 0,
      rating: item.accridnbyn || '-',
    }));
  } catch (e) {
    console.warn('[PublicAPI] 어린이집 조회 실패:', e);
    return [];
  }
}

// ─── 영유아 건강검진 스케줄 (정적) ───

export interface HealthCheckup {
  round: number;
  ageRange: string;
  minMonth: number;
  maxMonth: number;
  items: string[];
  isCurrent: boolean;
  isPast: boolean;
}

export function getHealthCheckupSchedule(babyMonths: number | null): HealthCheckup[] {
  const schedule = [
    { round: 1, ageRange: '4~6개월', minMonth: 4, maxMonth: 6, items: ['문진', '신체계측', '건강교육'] },
    { round: 2, ageRange: '9~12개월', minMonth: 9, maxMonth: 12, items: ['문진', '신체계측', '발달선별검사'] },
    { round: 3, ageRange: '18~24개월', minMonth: 18, maxMonth: 24, items: ['문진', '신체계측', '발달선별검사', '구강검진'] },
    { round: 4, ageRange: '30~36개월', minMonth: 30, maxMonth: 36, items: ['문진', '신체계측', '발달선별검사', '구강검진'] },
    { round: 5, ageRange: '42~48개월', minMonth: 42, maxMonth: 48, items: ['문진', '신체계측', '발달선별검사', '구강검진', '시력검사'] },
    { round: 6, ageRange: '54~60개월', minMonth: 54, maxMonth: 60, items: ['문진', '신체계측', '발달선별검사', '구강검진', '시력검사'] },
    { round: 7, ageRange: '66~72개월', minMonth: 66, maxMonth: 72, items: ['문진', '신체계측', '발달선별검사', '구강검진', '시력검사'] },
  ];

  const months = babyMonths ?? -1;
  return schedule.map((s) => ({
    ...s,
    isCurrent: months >= s.minMonth && months <= s.maxMonth,
    isPast: months > s.maxMonth,
  }));
}
