/**
 * Firestore → Zustand 데이터 복원 (구글 로그인 후 사용)
 * OnboardingScreen, login.tsx 에서 공통 호출
 */
import { useAppStore } from '../store/useAppStore';
import { fetchUserSettings, fetchItemsFromFirestore, getCurrentUid } from './firebase';

export interface RestoreResult {
  childrenCount: number;
  itemsCount: number;
  debugInfo: string;
}

/** Firestore에서 유저 설정 + 관심상품을 복원하여 Zustand에 반영 */
export async function restoreDataFromFirestore(): Promise<RestoreResult> {
  const uid = getCurrentUid();
  const debugLines: string[] = [`uid: ${uid}`];
  console.log('[Restore] 시작 — uid:', uid);

  const [settings, items] = await Promise.all([
    fetchUserSettings(),
    fetchItemsFromFirestore(),
  ]);

  console.log('[Restore] Firestore 조회 완료 — settings:', settings ? Object.keys(settings).length + '개 키' : 'null', 'items:', items.length);
  debugLines.push(`settings: ${settings ? Object.keys(settings).join(',') : 'null'}`);
  debugLines.push(`items: ${items.length}건`);
  if (settings?.children) {
    console.log('[Restore] children 발견:', settings.children.length, '건 —', settings.children.map((c: any) => c.name));
    debugLines.push(`children: ${JSON.stringify(settings.children.map((c: any) => c.name))}`);
  } else {
    console.log('[Restore] children 없음');
  }
  if (settings?.babyName) debugLines.push(`babyName: ${settings.babyName}`);

  let childrenCount = 0;

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
    }
  } else {
    console.log('[Restore] settings null — Firestore 문서 없음');
  }

  if (items.length > 0) {
    console.log('[Restore] trackedItems setState —', items.length, '건');
    useAppStore.setState({ trackedItems: items });
  }

  return { childrenCount, itemsCount: items.length, debugInfo: debugLines.join('\n') };
}
