/**
 * Firestore → Zustand 데이터 복원 (구글 로그인 후 사용)
 * OnboardingScreen, login.tsx 에서 공통 호출
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../store/useAppStore';
import {
  fetchUserSettings,
  fetchItemsFromFirestore,
  getCurrentUid,
  waitForUid,
} from './firebase';

const RESTORE_DEBUG_KEY = 'aigo-restore-debug';

export interface RestoreResult {
  childrenCount: number;
  itemsCount: number;
  debugInfo: string;
}

/** 복원 디버그 로그 저장 (production 진단용) */
async function saveRestoreDebug(info: string) {
  try {
    const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    await AsyncStorage.setItem(RESTORE_DEBUG_KEY, `[${timestamp}]\n${info}`);
  } catch {}
}

/** 설정 화면에서 호출 — 최근 복원 로그 반환 */
export async function getRestoreDebugInfo(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(RESTORE_DEBUG_KEY)) || '디버그 정보 없음';
  } catch {
    return '읽기 실패';
  }
}

/** Firestore에서 유저 설정 + 관심상품을 복원하여 Zustand에 반영 */
export async function restoreDataFromFirestore(): Promise<RestoreResult> {
  const debugLines: string[] = [];

  // ── Step 1: uid 확정 대기 (linkGoogleAccount 직후 타이밍 보정) ──
  const beforeUid = getCurrentUid();
  debugLines.push(`uid(before wait): ${beforeUid ?? 'null'}`);
  const uid = await waitForUid(2000);
  debugLines.push(`uid(after wait): ${uid ?? 'null'}`);
  console.log('[Restore] 시작 — uid:', uid);

  if (!uid) {
    debugLines.push('ABORT: uid 확보 실패');
    await saveRestoreDebug(debugLines.join('\n'));
    return { childrenCount: 0, itemsCount: 0, debugInfo: debugLines.join('\n') };
  }

  // ── Step 2: settings / items 분리 조회 (silent fail 제거) ──
  const settings = await fetchUserSettings().catch((e: any) => {
    const msg = `settings fetch 실패: ${e?.code ?? ''} ${e?.message ?? e}`;
    console.error('[Restore]', msg);
    debugLines.push(msg);
    return null;
  });
  const items = await fetchItemsFromFirestore().catch((e: any) => {
    const msg = `items fetch 실패: ${e?.code ?? ''} ${e?.message ?? e}`;
    console.error('[Restore]', msg);
    debugLines.push(msg);
    return [] as Awaited<ReturnType<typeof fetchItemsFromFirestore>>;
  });

  debugLines.push(`settings: ${settings ? Object.keys(settings).join(',') : 'null'}`);
  debugLines.push(`items: ${items.length}건`);
  if (settings?.children) {
    console.log('[Restore] children 발견:', settings.children.length, '건 —', settings.children.map((c: any) => c.name));
    debugLines.push(`children: ${JSON.stringify(settings.children.map((c: any) => c.name))}`);
  } else {
    console.log('[Restore] children 없음');
    debugLines.push('children: (없음)');
  }
  if (settings?.babyName) debugLines.push(`babyName: ${settings.babyName}`);
  if (settings?.parentInfo) {
    debugLines.push(`parentInfo: ${Object.keys(settings.parentInfo).join(',') || '(빈 객체)'}`);
  }

  let childrenCount = 0;

  // ── Step 3: restoreKeys로 Zustand에 반영 ──
  if (settings) {
    const restoreKeys = [
      'children', 'selectedChildId',
      'babyName', 'babyGender', 'babyBirthDate',
      'parentInfo',
      'vaccinationRecords', 'checkupRecords',
      'vaccinationHospitals', 'checkupHospitals',
      'notificationEnabled', 'repurchaseNotificationEnabled',
      'isWowMember',
    ] as const;

    const restoreData: Record<string, any> = {};
    for (const key of restoreKeys) {
      if (settings[key] !== undefined) {
        restoreData[key] = settings[key];
      }
    }

    // children 배열이 있으면 selectedChild 데이터 동기화 보장
    if (restoreData.children?.length > 0) {
      childrenCount = restoreData.children.length;
      const selectedId = restoreData.selectedChildId;
      const selectedChild = restoreData.children.find((c: any) => c.id === selectedId) || restoreData.children[0];
      if (selectedChild) {
        restoreData.selectedChildId = selectedChild.id;
        restoreData.babyName = selectedChild.name;
        restoreData.babyGender = selectedChild.gender;
        restoreData.babyBirthDate = selectedChild.birthDate;
      }
    }

    if (Object.keys(restoreData).length > 0) {
      console.log('[Restore] Zustand setState — keys:', Object.keys(restoreData).join(','));
      useAppStore.setState(restoreData);
      debugLines.push(`restored: ${Object.keys(restoreData).join(',')}`);
    } else {
      console.log('[Restore] 복원할 데이터 없음 (restoreData 비어있음)');
      debugLines.push('restored: (복원할 필드 없음)');
    }
  } else {
    console.log('[Restore] settings null — Firestore 문서 없음 또는 조회 실패');
    debugLines.push('restored: (settings=null)');
  }

  if (items.length > 0) {
    console.log('[Restore] trackedItems setState —', items.length, '건');
    useAppStore.setState({ trackedItems: items });
  }

  const debugInfo = debugLines.join('\n');
  await saveRestoreDebug(debugInfo);
  return { childrenCount, itemsCount: items.length, debugInfo };
}
