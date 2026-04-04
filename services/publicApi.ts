/**
 * 공공데이터포털 API 클라이언트
 * 환경변수: EXPO_PUBLIC_DATA_GO_KR_KEY
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const DATA_BASE_URL = 'https://apis.data.go.kr';
let API_KEY = '';          // 예방접종/어린이집 등 범용
let WELFARE_API_KEY = '';  // 복지로 전용 (별도 발급)

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간

/** 앱 시작 시 호출 */
export function initPublicApi() {
  API_KEY = process.env.EXPO_PUBLIC_DATA_GO_KR_KEY || '';
  WELFARE_API_KEY = process.env.EXPO_PUBLIC_WELFARE_API_KEY || API_KEY; // 별도 키 없으면 범용 키 사용
  if (API_KEY) console.log('[PublicAPI] 공공데이터 API 키 로드 완료');
  if (WELFARE_API_KEY && WELFARE_API_KEY !== API_KEY) console.log('[PublicAPI] 복지로 API 키 로드 완료');
}

export function hasPublicApiKey(): boolean {
  return API_KEY.length > 0 || WELFARE_API_KEY.length > 0;
}

// ─── 캐싱 유틸 ───

async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data as T;
  } catch {
    return null;
  }
}

async function setCache(key: string, data: any): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

// ─── 시/도, 시/군/구 목록 ───

export const REGIONS = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시',
  '광주광역시', '대전광역시', '울산광역시', '세종특별자치시',
  '경기도', '강원특별자치도', '충청북도', '충청남도',
  '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도',
];

// ─── 예방접종 지정 의료기관 검색 ───

export interface VaccineCenter {
  name: string;
  address: string;
  tel: string;
  orgCode: string;
}

export async function fetchVaccineCenters(
  region: string,
  district?: string,
): Promise<VaccineCenter[]> {
  if (!API_KEY) return [];

  const cacheKey = `pubapi-vaccine-${region}-${district || 'all'}`;
  const cached = await getCached<VaccineCenter[]>(cacheKey);
  if (cached) return cached;

  try {
    // 공공데이터포털 예방접종도우미 API
    // 서비스키는 URL 인코딩하지 않고 직접 전달 (공공데이터포털 특성)
    const queryParts = [
      `serviceKey=${API_KEY}`,
      `numOfRows=30`,
      `pageNo=1`,
      `type=json`,
    ];
    if (region) queryParts.push(`시도명=${encodeURIComponent(region)}`);
    if (district) queryParts.push(`시군구명=${encodeURIComponent(district)}`);

    const url = `${DATA_BASE_URL}/1790387/vcninfo/getVcnList?${queryParts.join('&')}`;
    console.log('[PublicAPI] 예방접종 기관 요청:', url.slice(0, 100));

    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await res.text();

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      // XML 응답인 경우 간단 파싱
      console.warn('[PublicAPI] JSON 파싱 실패, XML 응답 가능:', text.slice(0, 200));
      return [];
    }

    // 응답 구조: { response: { header: {...}, body: { items: { item: [...] }, totalCount } } }
    const items = json?.response?.body?.items?.item;
    if (!items) {
      console.warn('[PublicAPI] 예방접종 응답 items 없음:', JSON.stringify(json).slice(0, 300));
      return [];
    }

    const list = (Array.isArray(items) ? items : [items]).map((item: any) => ({
      name: item.orgNm || item.orgnm || '',
      address: item.orgAddr || item.orgaddr || '',
      tel: item.orgTlno || item.orgTlno || '',
      orgCode: item.orgCd || '',
    }));

    await setCache(cacheKey, list);
    return list;
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
  const key = WELFARE_API_KEY || API_KEY;
  if (!key) return [];

  // 복지로 API 생애주기 코드: 영유아 003, 아동 004
  const lifeArray = childAgeMonths < 84 ? '003' : '004';
  const cacheKey = `pubapi-welfare-${lifeArray}-${region || 'all'}`;
  const cached = await getCached<WelfareService[]>(cacheKey);
  if (cached) return cached;

  try {
    // 복지로 API: /B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist
    // 필수: serviceKey, callTp(L=목록)
    // 선택: lifeArray(생애주기), arrgOrgNm(지역), numOfRows, pageNo, type
    const queryParts = [
      `serviceKey=${key}`,
      `callTp=L`,
      `pageNo=1`,
      `numOfRows=20`,
      `lifeArray=${lifeArray}`,
    ];
    if (region) queryParts.push(`arrgOrgNm=${encodeURIComponent(region)}`);

    const url = `${DATA_BASE_URL}/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist?${queryParts.join('&')}`;
    console.log('[PublicAPI] 복지 서비스 요청:', url.slice(0, 120));

    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await res.text();

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      // XML 응답 fallback
      console.warn('[PublicAPI] 복지로 JSON 파싱 실패:', text.slice(0, 200));
      return [];
    }

    // 에러 응답 체크
    const resultCode = json?.response?.header?.resultCode;
    if (resultCode && resultCode !== '00') {
      console.warn('[PublicAPI] 복지로 API 에러:', json?.response?.header?.resultMsg);
      return [];
    }

    // 응답 구조: { response: { body: { items: { item: [...] }, totalCount } } }
    const items = json?.response?.body?.items?.item;
    if (!items) {
      console.warn('[PublicAPI] 복지로 items 없음:', JSON.stringify(json).slice(0, 300));
      return [];
    }

    const rawList = Array.isArray(items) ? items : [items];

    const list: WelfareService[] = rawList.map((item: any) => ({
      id: item.servId || item.SERV_ID || '',
      name: item.servNm || item.SERV_NM || '',
      summary: item.servDgst || item.SERV_DGST || '',
      targetAge: item.trgterIndvdlArray || item.TRGT_INDVDL_ARRAY || '',
      amount: item.sprtCycNm || item.SPRT_CYC_NM || '',
      howToApply: item.aplyMtdNm || item.APLY_MTD_NM || '',
      detailUrl: item.servDtlLink || item.SERV_DTL_LINK || '',
    }));

    // 육아/아동 관련 키워드로 관련성 높은 서비스 우선
    const babyKeywords = /아동|영유아|육아|양육|보육|출산|임산|신생아|어린이|부모급여|아이돌봄/;
    list.sort((a, b) => {
      const aMatch = babyKeywords.test(a.name + a.summary) ? 0 : 1;
      const bMatch = babyKeywords.test(b.name + b.summary) ? 0 : 1;
      return aMatch - bMatch;
    });

    await setCache(cacheKey, list);
    return list;
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

  const cacheKey = `pubapi-childcare-${region}-${district || 'all'}`;
  const cached = await getCached<ChildcareCenter[]>(cacheKey);
  if (cached) return cached;

  try {
    const queryParts = [
      `serviceKey=${API_KEY}`,
      `sidoname=${encodeURIComponent(region)}`,
      `numOfRows=20`,
      `pageNo=1`,
      `type=json`,
    ];
    if (district) queryParts.push(`sigunguname=${encodeURIComponent(district)}`);

    const url = `${DATA_BASE_URL}/1741000/ChildCareOpenAPIService/getChildCareInfo?${queryParts.join('&')}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await res.text();

    let json: any;
    try { json = JSON.parse(text); } catch { return []; }

    const items = json?.response?.body?.items?.item;
    if (!items) return [];

    const list = (Array.isArray(items) ? items : [items]).map((item: any) => ({
      name: item.crname || '',
      type: item.crtypename || '',
      address: item.craddr || '',
      tel: item.crtelno || '',
      capacity: parseInt(item.crcapat) || 0,
      currentCount: parseInt(item.crchcnt) || 0,
      rating: item.accridnbyn || '-',
    }));

    await setCache(cacheKey, list);
    return list;
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
