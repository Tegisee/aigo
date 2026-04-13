import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrackedItem } from '../types';
import { estimateRepurchaseDays, isConsumableCategory } from '../services/repurchase';
import {
  saveItemToFirestore,
  removeItemFromFirestore,
  updateItemInFirestore,
  updateNotificationEnabled,
  updateUserSettings,
  fetchItemsFromFirestore,
  upsertSharedProduct,
  decrementTrackerCount,
  incrementPurchaseCount,
} from '../services/firebase';

export type BabyGender = 'male' | 'female' | 'unknown';

export interface Child {
  id: string;
  name: string;
  gender: BabyGender;
  birthDate: string; // YYYY-MM-DD
}

export interface ParentBirthday {
  date: string; // YYYY-MM-DD
  isLunar: boolean;
}

export interface ParentInfo {
  momBirthday?: ParentBirthday;
  dadBirthday?: ParentBirthday;
  anniversary?: string; // YYYY-MM-DD (양력만)
}

interface AppState {
  isWowMember: boolean;
  notificationEnabled: boolean;
  repurchaseNotificationEnabled: boolean;
  hasSeenOnboarding: boolean;
  isLinked: boolean; // 소셜 로그인 연동 여부
  linkedProvider: string | null; // 'google' | null
  babyName: string;
  babyGender: BabyGender;
  babyBirthDate: string | null;
  children: Child[];
  selectedChildId: string | null;
  parentInfo: ParentInfo;
  vaccinationRecords: Record<string, string>; // { '{childId}::B형간염 1차': '2026-01-15', ... } (아이별 독립)
  checkupRecords: Record<string, string>;     // { '{childId}::1': '2026-05-01', ... } (아이별 독립)
  vaccinationHospitals: Record<string, string>; // { '{childId}::B형간염 1차': '서울소아과', ... }
  checkupHospitals: Record<string, string>;     // { '{childId}::1': '건강소아과', ... }
  trackedItems: TrackedItem[];
  addItem: (item: TrackedItem) => void;
  removeItem: (id: string) => void;
  updateTargetPrice: (id: string, price: number) => void;
  updateItemPrice: (id: string, price: number) => void;
  addPurchase: (id: string, date: string, price: number) => void;
  updateItemRepurchase: (id: string, data: { repurchaseEnabled?: boolean; repurchaseDays?: number }) => void;
  syncFromFirestore: () => Promise<void>;
  toggleWowMember: () => void;
  toggleNotification: () => void;
  toggleRepurchaseNotification: () => void;
  completeOnboarding: () => void;
  setBabyName: (name: string) => void;
  setBabyGender: (gender: BabyGender) => void;
  setBabyBirthDate: (date: string | null) => void;
  setLinked: (provider: string) => void;
  addChild: (child: Child) => void;
  updateChild: (id: string, data: Partial<Omit<Child, 'id'>>) => void;
  removeChild: (id: string) => void;
  selectChild: (id: string | null) => void;
  setParentInfo: (info: Partial<ParentInfo>) => void;
  setVaccinationDate: (vaccineKey: string, date: string | null, hospital?: string) => void;
  setCheckupDate: (round: string, date: string | null, hospital?: string) => void;
  resetAllData: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isWowMember: false,
      notificationEnabled: true,
      repurchaseNotificationEnabled: true,
      hasSeenOnboarding: false,
      isLinked: false,
      linkedProvider: null,
      babyName: '',
      babyGender: 'unknown',
      babyBirthDate: null,
      children: [],
      selectedChildId: null,
      parentInfo: {},
      vaccinationRecords: {},
      checkupRecords: {},
      vaccinationHospitals: {},
      checkupHospitals: {},
      trackedItems: [],
      addItem: (item) => {
        // 소모품이면 자동 재구매 주기 계산
        if (isConsumableCategory(item.category) && !item.repurchaseDays) {
          const babyMonths = useAppStore.getState().babyBirthDate ? (() => {
            const birth = new Date(useAppStore.getState().babyBirthDate!);
            const now = new Date();
            return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
          })() : null;
          const estimate = estimateRepurchaseDays(item.productName, item.category, babyMonths);
          if (estimate) {
            item.repurchaseEnabled = true;
            item.repurchaseDays = estimate.estimatedDays;
          }
        }
        set((state) => ({ trackedItems: [...state.trackedItems, item] }));
        saveItemToFirestore(item);
        // 현재 선택된 아이 성별을 shared_products gender로 전달
        const { babyGender } = useAppStore.getState();
        const gender = babyGender === 'male' || babyGender === 'female' ? babyGender : 'both';
        upsertSharedProduct(item, gender);
      },
      removeItem: (id) => {
        const item = useAppStore.getState().trackedItems.find((i) => i.id === id);
        const productId = item?.productId || id;
        set((state) => ({
          trackedItems: state.trackedItems.filter((i) => i.id !== id),
        }));
        removeItemFromFirestore(id);
        decrementTrackerCount(productId);
      },
      updateTargetPrice: (id, price) => {
        set((state) => ({
          trackedItems: state.trackedItems.map((item) =>
            item.id === id ? { ...item, targetPrice: price } : item,
          ),
        }));
        updateItemInFirestore(id, { targetPrice: price });
      },
      updateItemPrice: (id, newPrice) => {
        const today = new Date().toISOString().slice(0, 10);
        set((state) => ({
          trackedItems: state.trackedItems.map((item) => {
            if (item.id !== id || newPrice === 0) return item;
            const history = [...item.priceHistory];
            const last = history[history.length - 1];
            if (last?.date === today) {
              last.price = newPrice;
            } else {
              history.push({ date: today, price: newPrice });
            }
            return {
              ...item,
              currentPrice: newPrice,
              priceHistory: history.slice(-30),
            };
          }),
        }));
        // priceHistory도 Firestore에 동기화
        const updated = useAppStore.getState().trackedItems.find((i) => i.id === id);
        if (updated) {
          updateItemInFirestore(id, {
            currentPrice: newPrice,
            priceHistory: updated.priceHistory,
          });
        }
      },
      syncFromFirestore: async () => {
        const items = await fetchItemsFromFirestore();
        if (items.length > 0) {
          set({ trackedItems: items });
        }
      },
      toggleWowMember: () =>
        set((state) => {
          const next = !state.isWowMember;
          updateUserSettings({ isWowMember: next });
          return { isWowMember: next };
        }),
      addPurchase: (id, date, price) => {
        set((state) => {
          const babyMonths = state.babyBirthDate ? (() => {
            const birth = new Date(state.babyBirthDate!);
            const now = new Date();
            return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
          })() : null;

          return {
            trackedItems: state.trackedItems.map((item) => {
              if (item.id !== id) return item;
              const history = [...(item.purchaseHistory || []), { date, price }];
              const updates: Partial<TrackedItem> = {
                purchaseHistory: history,
                lastPurchasedAt: date,
              };

              // 소모품이고 사용자가 직접 주기를 설정하지 않은 경우 자동 계산
              if (isConsumableCategory(item.category) && !item.repurchaseDays) {
                const estimate = estimateRepurchaseDays(item.productName, item.category, babyMonths);
                if (estimate) {
                  updates.repurchaseEnabled = true;
                  updates.repurchaseDays = estimate.estimatedDays;
                }
              }

              return { ...item, ...updates };
            }),
          };
        });
        const updated = useAppStore.getState().trackedItems.find((i) => i.id === id);
        if (updated) {
          updateItemInFirestore(id, {
            purchaseHistory: updated.purchaseHistory,
            lastPurchasedAt: updated.lastPurchasedAt,
            repurchaseEnabled: updated.repurchaseEnabled ?? false,
            repurchaseDays: updated.repurchaseDays,
          });
          // shared_products purchaseCount 증가
          const productId = updated.productId || id;
          incrementPurchaseCount(productId);
        }
      },
      updateItemRepurchase: (id, data) => {
        set((state) => ({
          trackedItems: state.trackedItems.map((item) =>
            item.id === id ? { ...item, ...data } : item,
          ),
        }));
        updateItemInFirestore(id, data);
      },
      completeOnboarding: () => set({ hasSeenOnboarding: true }),
      setBabyName: (name) => {
        set({ babyName: name });
        updateUserSettings({ babyName: name });
      },
      setBabyGender: (gender) => {
        set({ babyGender: gender });
        updateUserSettings({ babyGender: gender });
      },
      setBabyBirthDate: (date) => {
        set({ babyBirthDate: date });
        updateUserSettings({ babyBirthDate: date });
      },
      setLinked: (provider) => {
        set({ isLinked: true, linkedProvider: provider });
        updateUserSettings({ isLinked: true, linkedProvider: provider });
      },
      addChild: (child) => {
        set((state) => {
          const children = [...state.children, child];
          const selectedChildId = children.length === 1 ? child.id : state.selectedChildId;
          updateUserSettings({ children, selectedChildId });
          // 첫 아이 추가 시 기본 정보 동기화
          if (children.length === 1) {
            return {
              children,
              selectedChildId,
              babyName: child.name,
              babyGender: child.gender,
              babyBirthDate: child.birthDate,
            };
          }
          return { children, selectedChildId };
        });
      },
      updateChild: (id, data) => {
        set((state) => {
          const children = state.children.map((c) =>
            c.id === id ? { ...c, ...data } : c,
          );
          const updated = children.find((c) => c.id === id);
          const isCurrent = state.selectedChildId === id;
          updateUserSettings({ children });
          if (isCurrent && updated) {
            return {
              children,
              babyName: updated.name,
              babyGender: updated.gender,
              babyBirthDate: updated.birthDate,
            };
          }
          return { children };
        });
      },
      removeChild: (id) => {
        set((state) => {
          const children = state.children.filter((c) => c.id !== id);
          const selectedChildId = state.selectedChildId === id
            ? (children[0]?.id ?? null)
            : state.selectedChildId;
          const active = children.find((c) => c.id === selectedChildId);
          updateUserSettings({ children, selectedChildId });
          return {
            children,
            selectedChildId,
            babyName: active?.name ?? '',
            babyGender: active?.gender ?? 'unknown',
            babyBirthDate: active?.birthDate ?? null,
          };
        });
      },
      selectChild: (id) => {
        set((state) => {
          const child = state.children.find((c) => c.id === id);
          updateUserSettings({ selectedChildId: id });
          if (child) {
            return {
              selectedChildId: id,
              babyName: child.name,
              babyGender: child.gender,
              babyBirthDate: child.birthDate,
            };
          }
          return { selectedChildId: id };
        });
      },
      setParentInfo: (info) => {
        set((state) => {
          const merged = { ...state.parentInfo, ...info };
          updateUserSettings({ parentInfo: merged });
          return { parentInfo: merged };
        });
      },
      setVaccinationDate: (vaccineKey, date, hospital) => {
        set((state) => {
          const records = { ...state.vaccinationRecords };
          const hospitals = { ...state.vaccinationHospitals };
          if (date) {
            records[vaccineKey] = date;
            if (hospital !== undefined) {
              if (hospital) hospitals[vaccineKey] = hospital;
              else delete hospitals[vaccineKey];
            }
          } else {
            delete records[vaccineKey];
            delete hospitals[vaccineKey];
          }
          updateUserSettings({ vaccinationRecords: records, vaccinationHospitals: hospitals });
          return { vaccinationRecords: records, vaccinationHospitals: hospitals };
        });
      },
      setCheckupDate: (round, date, hospital) => {
        set((state) => {
          const records = { ...state.checkupRecords };
          const hospitals = { ...state.checkupHospitals };
          if (date) {
            records[round] = date;
            if (hospital !== undefined) {
              if (hospital) hospitals[round] = hospital;
              else delete hospitals[round];
            }
          } else {
            delete records[round];
            delete hospitals[round];
          }
          updateUserSettings({ checkupRecords: records, checkupHospitals: hospitals });
          return { checkupRecords: records, checkupHospitals: hospitals };
        });
      },
      toggleNotification: () =>
        set((state) => {
          const next = !state.notificationEnabled;
          updateNotificationEnabled(next);
          return { notificationEnabled: next };
        }),
      toggleRepurchaseNotification: () =>
        set((state) => {
          const next = !state.repurchaseNotificationEnabled;
          updateUserSettings({ repurchaseNotificationEnabled: next });
          return { repurchaseNotificationEnabled: next };
        }),
      resetAllData: async () => {
        const { trackedItems: items } = useAppStore.getState();
        for (const item of items) {
          removeItemFromFirestore(item.id);
        }
        set({
          trackedItems: [],
          isWowMember: false,
          notificationEnabled: true,
          repurchaseNotificationEnabled: true,
          isLinked: false,
          linkedProvider: null,
          babyName: '',
          babyGender: 'unknown',
          babyBirthDate: null,
          children: [],
          selectedChildId: null,
          parentInfo: {},
          vaccinationRecords: {},
          checkupRecords: {},
          vaccinationHospitals: {},
          checkupHospitals: {},
        });
        try {
          const allKeys = await AsyncStorage.getAllKeys();
          if (allKeys.length > 0) await AsyncStorage.multiRemove(allKeys);
        } catch {
          await AsyncStorage.removeItem('aigo-storage');
        }
      },
    }),
    {
      name: 'aigo-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
