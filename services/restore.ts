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
  updateUserSettings,
} from './firebase';

const RESTORE_DEBUG_KEY = 'aigo-restore-debug';

export interface RestoreResult {
  childrenCount: number;
  itemsCount: number;
  hasMeaningfulSettings: boolean;
  debugInfo: string;
}

/**
 * 복원 디버그 로그 저장 — append 방식.
 * 기존 덮어쓰기 버전은 fetchUserSettings 내부 appendFirebaseDebug 기록([FetchSettings] 로그)까지
 * 모두 날려버려 진단 불가였으므로 prev를 보존한 뒤 뒤에 블록 추가.
 */
async function saveRestoreDebug(info: string) {
  try {
    const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const prev = await AsyncStorage.getItem(RESTORE_DEBUG_KEY);
    const block = `===== [${timestamp}] restore 결과 =====\n${info}`;
    await AsyncStorage.setItem(
      RESTORE_DEBUG_KEY,
      `${prev ?? ''}\n\n${block}`.trim(),
    );
  } catch {}
}

/** 설정 화면에서 호출 — 최근 복원 로그 반환 (Alert 가독성을 위해 최근 2000자만) */
const DEBUG_DISPLAY_MAX = 2000;
export async function getRestoreDebugInfo(): Promise<string> {
  try {
    const raw = (await AsyncStorage.getItem(RESTORE_DEBUG_KEY)) || '';
    if (!raw) return '디버그 정보 없음';
    if (raw.length <= DEBUG_DISPLAY_MAX) return raw;
    const omitted = raw.length - DEBUG_DISPLAY_MAX;
    return `…(앞부분 ${omitted}자 생략)…\n${raw.slice(-DEBUG_DISPLAY_MAX)}`;
  } catch {
    return '읽기 실패';
  }
}

/** 설치/복원 공용 — 외부에서 한 줄씩 디버그 로그를 누적 기록 */
export async function appendRestoreDebugLine(line: string): Promise<void> {
  try {
    const ts = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const prev = await AsyncStorage.getItem(RESTORE_DEBUG_KEY);
    await AsyncStorage.setItem(
      RESTORE_DEBUG_KEY,
      `${prev ?? ''}\n[${ts}] ${line}`.trim(),
    );
  } catch {}
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
    return { childrenCount: 0, itemsCount: 0, hasMeaningfulSettings: false, debugInfo: debugLines.join('\n') };
  }

  // ── Step 2: settings / items 분리 조회 (silent fail 제거) ──
  // fetchUserSettings 내부 [FetchSettings] 로그를 debugLines에 직접 수집
  // (AsyncStorage append race / Alert.alert 문자 제한 우회)
  const settings = await fetchUserSettings((line) => debugLines.push(line)).catch((e: any) => {
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
  // children 필드 진단 (배열 vs 맵 vs undefined 구분)
  const rawChildren = settings?.children;
  debugLines.push(
    `children.field: isArray=${Array.isArray(rawChildren)}, ` +
    `length=${Array.isArray(rawChildren) ? rawChildren.length : 'n/a'}, ` +
    `type=${typeof rawChildren}`,
  );
  if (Array.isArray(rawChildren) && rawChildren.length > 0) {
    console.log('[Restore] children 발견:', rawChildren.length, '건 —', rawChildren.map((c: any) => c?.name));
    debugLines.push(`children.names: ${JSON.stringify(rawChildren.map((c: any) => c?.name))}`);
  } else {
    console.log('[Restore] children 없음 또는 빈 배열');
    debugLines.push('children.names: (없음/빈배열)');
  }
  if (settings?.babyName) debugLines.push(`babyName: ${settings.babyName}`);
  if (settings?.parentInfo) {
    debugLines.push(`parentInfo: ${Object.keys(settings.parentInfo).join(',') || '(빈 객체)'}`);
  }

  let childrenCount = 0;
  let hasMeaningfulSettings = false;

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
      'isLinked', 'linkedProvider',
    ] as const;

    const restoreData: Record<string, any> = {};
    for (const key of restoreKeys) {
      if (settings[key] !== undefined) {
        restoreData[key] = settings[key];
      }
    }

    // ── 단일 아이 → children[] 마이그레이션 (BUG-41) ──
    // 옛날 사용자: children[]가 없거나 빈 배열인데 babyName/babyBirthDate 있음
    // 마이그레이션 안 하면 childrenCount=0 → handleGoogleStart가 온보딩 재진행 강제
    const childrenIsEmpty = !Array.isArray(restoreData.children) || restoreData.children.length === 0;
    if (childrenIsEmpty && restoreData.babyName && restoreData.babyBirthDate) {
      const migratedChild = {
        id: `child-${Date.now()}`,
        name: restoreData.babyName,
        gender: restoreData.babyGender ?? 'unknown',
        birthDate: restoreData.babyBirthDate,
      };
      restoreData.children = [migratedChild];
      restoreData.selectedChildId = migratedChild.id;
      debugLines.push(`migrated: 단일 아이 → children[] (id=${migratedChild.id}, name=${migratedChild.name})`);

      // Firestore에도 백필 (다음 복원 때는 children[]에서 바로 읽도록)
      try {
        await updateUserSettings({
          children: restoreData.children,
          selectedChildId: restoreData.selectedChildId,
        });
        debugLines.push('migrated: Firestore 백필 성공');
      } catch (e: any) {
        debugLines.push(`migrated: Firestore 백필 실패 — ${e?.message ?? e}`);
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

    // 의미 필드 존재 여부 (childrenCount=0이라도 부모정보/접종기록 있으면 복원 분기)
    const parentHasData = restoreData.parentInfo && Object.keys(restoreData.parentInfo).length > 0;
    const vaccinationHasData =
      restoreData.vaccinationRecords && Object.keys(restoreData.vaccinationRecords).length > 0;
    const checkupHasData =
      restoreData.checkupRecords && Object.keys(restoreData.checkupRecords).length > 0;
    hasMeaningfulSettings =
      childrenCount > 0 ||
      Boolean(restoreData.babyName) ||
      Boolean(parentHasData) ||
      Boolean(vaccinationHasData) ||
      Boolean(checkupHasData);
    debugLines.push(`hasMeaningfulSettings: ${hasMeaningfulSettings}`);

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
  return { childrenCount, itemsCount: items.length, hasMeaningfulSettings, debugInfo };
}

/**
 * Zustand(로컬)에는 있는데 Firestore root 문서에 없는 필드를 재push.
 * uid 타이밍 이슈로 Zustand만 저장되고 Firestore 저장이 skip된 상태를 복구.
 * 앱 시작(signInAnonymously 후) + 로그인 완료(restore 후) 시점에서 호출.
 */
export async function backfillSettingsToFirestore(): Promise<void> {
  const uid = await waitForUid(3000);
  if (!uid) {
    console.log('[Backfill] uid 확보 실패 — 스킵');
    return;
  }

  const state = useAppStore.getState();
  const settings = await fetchUserSettings().catch((e) => {
    console.warn('[Backfill] settings 조회 실패:', e);
    return null;
  });

  const fields: Record<string, any> = {};

  // children 배열 — 로컬엔 있는데 Firestore엔 없거나 비어있음
  const remoteChildrenEmpty = !settings?.children || settings.children.length === 0;
  if (state.children.length > 0 && remoteChildrenEmpty) {
    fields.children = state.children;
    fields.selectedChildId = state.selectedChildId;
  }

  // 단일 아이 레거시 필드
  if (state.babyName && !settings?.babyName) {
    fields.babyName = state.babyName;
    fields.babyGender = state.babyGender;
    fields.babyBirthDate = state.babyBirthDate;
  }

  // parentInfo (map)
  const localParentHasData =
    state.parentInfo && Object.keys(state.parentInfo).length > 0;
  const remoteParentEmpty =
    !settings?.parentInfo || Object.keys(settings.parentInfo).length === 0;
  if (localParentHasData && remoteParentEmpty) {
    fields.parentInfo = state.parentInfo;
  }

  // 접종/검진 기록
  if (Object.keys(state.vaccinationRecords).length > 0 && !settings?.vaccinationRecords) {
    fields.vaccinationRecords = state.vaccinationRecords;
    fields.vaccinationHospitals = state.vaccinationHospitals;
  }
  if (Object.keys(state.checkupRecords).length > 0 && !settings?.checkupRecords) {
    fields.checkupRecords = state.checkupRecords;
    fields.checkupHospitals = state.checkupHospitals;
  }

  if (Object.keys(fields).length > 0) {
    console.log('[Backfill] 로컬→Firestore 누락 필드 push:', Object.keys(fields).join(','));
    try {
      await updateUserSettings(fields);
      const info = `[Backfill] pushed: ${Object.keys(fields).join(',')}`;
      const prev = await AsyncStorage.getItem(RESTORE_DEBUG_KEY);
      const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      await AsyncStorage.setItem(
        RESTORE_DEBUG_KEY,
        `${prev ?? ''}\n[${timestamp}] ${info}`.trim(),
      );
    } catch (e) {
      console.warn('[Backfill] push 실패:', e);
    }
  } else {
    console.log('[Backfill] 누락 필드 없음 — skip');
  }
}
