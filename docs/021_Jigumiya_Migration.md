---
created: 2026-05-08
updated: 2026-05-08
status: 작성 — 지금이야 1.0.12~1.0.15 변경사항 이식 가이드
선행: 지금이야 `~/jigumiya/CLAUDE.md` (커밋 `aa90f1a`까지 반영) / 아이고 `~/aigo/aigo/CLAUDE.md`
---

# 021. 지금이야 → 아이고 이식 가이드 (1.0.12~1.0.15)

> 본 문서는 지금이야 1.0.12~1.0.15에서 적용된 fix/feat를 아이고로 이식하기 위한 작업 가이드.
> 각 항목은 **지금이야 변경 → 아이고 현황 → 이식 방법 → 주의사항** 순으로 정리.
> 아이고 고유 구조 (Google/Apple 로그인 / `~/aigo/aigo/scripts/price-checker/` / `aigo-daily-greeter` / 육아 카테고리) 차이 명시.

## 0. 이식 우선순위 (요약)

| # | 항목 | 우선도 | 변경 규모 | 비고 |
|---|------|--------|-----------|------|
| 1 | priceHistory Fix B (syncFromFirestore 머지) | 🔴 High | 1 파일 ~15줄 | Fix A는 이미 적용됨 |
| 2 | ProductCard trend 뱃지 (Fix C) | 🟡 Mid | 1 파일 ~25줄 | UI 추가 |
| 3 | CoupangScraper 1.0.14 fixes | 🔴 High | 1 파일 ~30줄 | iOS 무한로딩 차단 |
| 4 | add-item.tsx HTML redirectWebUrl 파싱 | 🔴 High | 1 파일 ~50줄 | link.coupang.com 단축 URL |
| 5 | price-checker token-dedup + swap | 🟡 Mid | 1 파일 ~50줄 | dedup 자체가 없는 상태 |
| 6 | expo-image 마이그레이션 | 🟡 Mid | 다수 파일 | Android 스크롤 성능 |
| 7 | SparklineChart MIN_POINTS=5 가드 | 🟢 Low | 1 파일 ~5줄 | 검증 후 결정 |
| 8 | 가격그래프 개선 (detail) | 🟢 Low | 1 파일 ~150줄 | UI 전면 교체 |
| 9 | "사달라고 조르기" 모달 | 🟢 Low | 1 파일 ~80줄 | 신규 기능 |
| 10 | Functions ensureUserDoc 패턴 | 🟢 Low | 합의 후 결정 | 아이고는 anon 미사용 |

이미 적용 완료 (이식 불필요):
- ✅ `app: 'aigo'` 필드 (`savePushToken` 내, line 495)
- ✅ Fix A — priceHistory를 `updateItemInFirestore`에 함께 저장 (line 158-165)
- ✅ aigo-daily-greeter token-dedup (5/6 커밋 `540035a`)
- ✅ aigo-daily-greeter schedule 비활성화 (5/7 커밋 `fe58515`)
- ✅ `vendorItemId` 옵션 매칭 — 아이고 price-checker도 동일 처리 검토 필요

---

## 1. priceHistory Fix B — `syncFromFirestore` 머지 정책

### 지금이야 변경 (커밋 `2037437`)
백그라운드 → 포그라운드 전환 시 `syncFromFirestore`가 store를 무조건 덮어쓰면, Firestore의 priceHistory가 짧을 때 로컬 누적분이 사라지는 문제. id 단위 매칭해서 `local.priceHistory.length > remote.priceHistory.length`이면 local 보존.

### 아이고 현황
`store/useAppStore.ts:167-172`:
```ts
syncFromFirestore: async () => {
  const items = await fetchItemsFromFirestore();
  if (items.length > 0) {
    set({ trackedItems: items });   // ← 무조건 덮어쓰기
  }
},
```

### 이식 방법 (대상: `~/aigo/aigo/store/useAppStore.ts:167-172`)

```ts
syncFromFirestore: async () => {
  const remote = await fetchItemsFromFirestore();
  if (remote.length === 0) return;
  // 머지 정책: id 단위 매칭 — local.priceHistory가 remote보다 길면 local 보존.
  // 이전 버전은 무조건 remote로 set → 백그라운드 복귀마다 priceHistory 1개로 리셋되는 사고가 있었음.
  const local = useAppStore.getState().trackedItems;
  const localById = new Map(local.map((i) => [i.id, i]));
  const merged = remote.map((r) => {
    const l = localById.get(r.id);
    if (l && l.priceHistory.length > r.priceHistory.length) {
      return {
        ...r,
        priceHistory: l.priceHistory,
        currentPrice: l.currentPrice,
      };
    }
    return r;
  });
  set({ trackedItems: merged });
},
```

### 주의사항
- 아이고는 `purchaseHistory` / `lastPurchasedAt` / `repurchaseDays` 등 추가 필드 보유 — 머지 시 r(remote) 채택이 기본이므로 영향 없음
- Google 로그인 시 `restoreFromFirestore` 분기와 충돌 없는지 확인 (별도 함수)

---

## 2. ProductCard trend 뱃지 (Fix C)

### 지금이야 변경 (커밋 `2037437` + `aa90f1a`)
홈 추적 카드 우측하단에 priceHistory 첫값/마지막값 비교 trend 뱃지. 이모지 없는 텍스트만.
- 가격하락감지 (#FF4444 빨강) / 가격상승감지 (#3B82F6 파랑) / 가격변동없음 (theme.subtext 그레이)
- priceHistory 2개 미만이면 미표시
- gap 텍스트와 좌우 split (`flexDirection: 'row', justifyContent: 'space-between'`)

### 아이고 현황
`components/ProductCard.tsx`에 trend 뱃지 없음. SparklineChart는 `priceHistory.length > 1` 시 표시.

### 이식 방법 (대상: `~/aigo/aigo/components/ProductCard.tsx`)

1. **trendBadge 계산** — `hasTarget`/`gap`/`isAchieved` 계산부 직후 (line 41 부근):

```tsx
// Trend 뱃지 — priceHistory 첫값 vs 마지막값 비교
const trendBadge: { text: string; color: string } | null = (() => {
  if (item.priceHistory.length < 2) return null;
  const first = item.priceHistory[0].price;
  const last = item.priceHistory[item.priceHistory.length - 1].price;
  if (last < first) return { text: '가격하락감지', color: '#FF4444' };
  if (last > first) return { text: '가격상승감지', color: '#3B82F6' };
  return { text: '가격변동없음', color: theme.subtext };
})();
```

2. **JSX 렌더** — 기존 gap/목표 텍스트 행을 `View`로 감싸고 우측에 뱃지 추가:

```tsx
<View style={styles.bottomRow}>
  {/* 기존 hasTarget / gap 텍스트 그대로 */}
  {trendBadge && (
    <Text style={[styles.trendBadge, { color: trendBadge.color }]}>
      {trendBadge.text}
    </Text>
  )}
</View>
```

3. **스타일 추가**:

```tsx
bottomRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 4,
  gap: 8,
},
trendBadge: {
  fontSize: 12,
  fontWeight: '600',
},
```

### 주의사항
- 아이고는 `repurchaseDday` / `purchaseCount` / `category` 라벨 등 추가 메타 표시가 많음 — bottomRow 위치 결정 시 기존 레이아웃과 충돌 없도록 검토
- 육아 톤 UI(따뜻한 톤)와 trend 뱃지 컬러 (#FF4444/#3B82F6) 호환성 확인. 필요 시 채도 낮춘 톤 (`#E55E5E` / `#5BA0F2`) 검토

---

## 3. CoupangScraper 1.0.14 fixes

### 지금이야 변경 (커밋 `75d97f4`)
1. **재시도 소진 시 즉시 `onError()` 호출** (line 253-262) — 1.0.13까지: `console.warn` 만 찍고 콜백 미발사 → 외부 20s timeout만 의존 → 사용자 체감 50s+ 무한로딩
2. **TDZ 잠재 버그 제거** (line 177-183) — `retryIndexRef`/`retryDelays` 선언을 `sourceKey` if 블록 위로 이동

### 아이고 현황
`components/CoupangScraper.tsx` 동일 컴포넌트 — 같은 로직 가능성 높음. 직접 비교 후 이식 결정.

### 이식 방법
```bash
diff -u ~/aigo/aigo/components/CoupangScraper.tsx ~/jigumiya/jigumiya/components/CoupangScraper.tsx | head -200
```
일치 부분이 많으면 jigumiya 버전을 그대로 가져오고 아이고 고유 부분만 보존. 일치도 낮으면 위 두 fix만 패치.

### 주의사항
- 아이고도 iOS 상품 추가 무한로딩 사고 보고 가능성 — 같은 메커니즘이면 동일 fix
- `userAgent` / 쿠팡 앱 다운로드 차단 CSS 등 모든 fix가 일관되게 들어있는지 확인

---

## 4. add-item.tsx HTML redirectWebUrl 파싱

### 지금이야 변경 (커밋 `75d97f4`, line 63-79 + 222-273)
`link.coupang.com/a/...` 단축 URL이 30x Location 미발사 + `200 OK + JS hex-escape redirectWebUrl` 응답 → fallback이 vp URL을 못 얻어 WebView 빈 페이지 무한 실패.
- `extractRedirectUrlFromHtml()` 헬퍼 신설 (`functions/src/index.ts` 로직 클라이언트 미러)
- fallback 순서: Location 헤더 → HTML body `redirectWebUrl` 파싱 → `redirect:'follow'` 본문 파싱
- Functions timeout 5s → 8s 복원

### 아이고 현황
`app/modal/add-item.tsx` — 이식 필요 여부는 단축 URL 처리 흐름 확인 후 결정. 아이고는 ShareIntent로 들어오는 URL이 마트/쿠팡 다양 → 단축 URL fallback 동일 적용 필요.

### 이식 방법 (대상: `~/aigo/aigo/app/modal/add-item.tsx`)
지금이야 add-item.tsx의 `extractRedirectUrlFromHtml` 헬퍼 + fallback 흐름 그대로 복사. Functions 호출은 jigumiya 통합 프로젝트라 동일 endpoint(`resolveAndGenerateAffiliateUrl`).

### 주의사항
- 아이고는 `linkAccountToCoupang` 등 부가 흐름 가능성 — Functions 호출 직전 auth 대기 패턴 정합성 검토
- 5s → 8s timeout 변경은 cold start 대응 (`minInstances: 1` 적용된 jigumiya Functions에선 사실상 효과 미미하지만 보수적 마진)

---

## 5. price-checker token-dedup + swap 정책

### 지금이야 변경 (커밋 `51d5dac` + `2a9e359`)
1. **token-dedup** (5/6, `51d5dac`): 동일 expoPushToken을 공유하는 uid 다수일 때 첫 등장 uid만 보존. 갤럭시S21+ 4회 푸시 사고 fix
2. **swap 정책** (5/7, `2a9e359`): 충돌 시 신 uid만 tracked 보유하면 swap (kept 교체). orphan tracker (anon 재로그인 후 신 uid에만 tracked 추가) 영구 미발송 regression fix
   - 사전: `collectionGroup('tracked').get()` 1회 → `trackedUids: Set<string>`
   - 충돌 분기: 신 uid만 보유 → swap / 그 외 → first 유지

### 아이고 현황
`scripts/price-checker/index.ts`에 token-dedup 로직 **자체가 없음**:
- line 113, 255, 417에서 `userDoc.data().expoPushToken` 직접 사용
- 동일 token으로 N회 push 발생 가능 (multi-anon 재로그인 시)

`aigo-daily-greeter`는 5/6에 token-dedup 적용 완료 (`540035a`) — 단, 첫 uid 보존 정책 (swap 미적용)

### 이식 방법 (대상: `~/aigo/aigo/scripts/price-checker/index.ts`)

1. **token-dedup 기본 도입** — 지금이야 `fetchActiveUsers` 패턴 그대로:
```ts
const seenTokens = new Map<string, string>();
// users 순회 시 token 중복 체크 → 첫 등장 uid만 발송 대상
```

2. **swap 정책 추가** — orphan tracker 방어:
```ts
const trackedSnap = await client.collectionGroup('tracked').get();
const trackedUids = new Set<string>();
for (const doc of trackedSnap.docs) {
  const uid = doc.ref.parent.parent?.id;
  if (uid) trackedUids.add(uid);
}
// 충돌 시: 신 uid만 보유 → map.delete(firstUid) + 신 uid 등록
```

3. **`aigo-daily-greeter`도 swap 정책 통일 검토** — 현재 first-uid 정책이라 같은 regression 가능. 단 인사 알림은 이미 schedule 비활성화 → 우선순위 낮음

### 주의사항
- **app 필터 strict**: `app === 'aigo'` 사용자만 발송 (지금이야 cron의 mirror)
- 아이고는 `users/{uid}.babyBirthDate` / `children` 필드 보유 — 이식 시 무관, dedup만 적용
- 전환 사이클 한정 1회성 24h 가드 orphan으로 알림 1건 추가 가능 (페어당 최대 1회) — 지금이야와 동일

---

## 6. expo-image 마이그레이션

### 지금이야 변경 (커밋 `75d97f4`)
8개 사용처 일괄 마이그레이션 (`<Image>` from 'react-native' → from 'expo-image'). `cachePolicy="memory-disk"` + `recyclingKey` + `contentFit="cover"` + `transition={0}`. Android 스크롤 성능 ↑.

### 아이고 현황
`components/ProductCard.tsx:5` — `from 'react-native'` 그대로. 이식 가능.

### 이식 방법
1. `package.json` + `app.config.js plugins`에 `expo-image` 등록
2. 모든 `import { Image } from 'react-native'` → `from 'expo-image'`
3. `<Image source={...}>` → `<Image source={...} cachePolicy="memory-disk" recyclingKey={...} contentFit="cover" transition={0}>`

### 주의사항
- 아이고도 ProductCard / detail / 카테고리 베스트 등 이미지 사용처 다수 → 일괄 변경
- iOS는 expo-image 내부 SDImage 캐싱 정책 다름 — 메모리 사용량 모니터링

---

## 7. SparklineChart MIN_POINTS=5 가드

### 지금이야 변경 (커밋 `75d97f4`)
`components/SparklineChart.tsx`: `MIN_POINTS = 5`. 5개 미만이면 `null` 반환 (의미 없음 + Android SVG 부담). ProductCard도 `length >= 5` 조건으로 mount 회피.

### 아이고 현황
`components/SparklineChart.tsx` — 동일 컴포넌트 이름. 가드 적용 여부 확인 필요.

### 이식 방법
파일 비교 후 가드 로직 동기화. ProductCard 측 `priceHistory.length >= 5` 조건도 함께.

### 주의사항
- **아이고는 priceHistory가 적은 사용자 비중이 더 높을 수 있음** (육아용품 추적은 단발성) — 5개 임계가 너무 엄격할 가능성. 지금이야는 길게 추적하는 패턴이라 5개 가드 OK. 아이고는 3개로 완화 검토 가치 있음

---

## 8. 가격그래프 개선 (detail page)

### 지금이야 변경 (커밋 `48c1fed` + 1.0.13/14 갱신)
`app/detail/[id].tsx`:
- 트렌드 색상 자동 (drop=red `#FF4444` / up=blue `#3B82F6` / flat=gray)
- 직선 그래프 + 모든 변곡점 dot
- 참조선 3개: 최고가(파란 점선) / 최저가(빨간 점선) / 목표가(초록 점선 `#22C55E`)
- `yAxisOffset` + `maxValue` y 범위 보정
- X축 라벨 균등 배치
- pointerConfig tooltip — 터치 시 `YYYY.MM.DD` + `N원` 말풍선

### 아이고 현황
`app/detail/` 구조 + 가격그래프 — 단순 표시 위주 가능성. 검토 후 결정.

### 이식 방법
지금이야 `app/detail/[id].tsx` 파일 일부(`hasChartData` ~ `chartData` ~ `<LineChart .../>`) 그대로 가져오기. 아이고 detail의 다른 영역(구매 이력 / 재구매 D-day / 아이 정보)은 보존.

### 주의사항
- 아이고는 `purchaseHistory` 마커도 그래프에 표시할 가치 (구매 시점을 dot 색상 분리). 별도 스코프
- 육아 톤 UI에 빨강 강조 부담 가능 — 톤 다운 검토

---

## 9. "사달라고 조르기" 모달

### 지금이야 변경 (커밋 `489339e`)
`app/detail/[id].tsx:514-566`:
- "사달라고 조르기 🥺" 버튼 + slide-up 시트 모달
- 6개 프리셋 멘트 + 직접 입력 TextInput
- 포맷: `{멘트}\n\n{productName}\n{item.url}` → `Share.share`
- iOS Share 350ms delay (모달 dismiss 후)

### 아이고 현황
없음.

### 이식 방법
지금이야 detail의 `ASK_MESSAGES` / `handleSendAsk` / `<Modal visible={showAskModal} ...>` 블록 전체 복사. 스타일도 같이.

### 주의사항
- 아이고는 **육아 컨텍스트** — 멘트를 부부/가족용으로 변경 권장. 예시:
  - "아기한테 필요해요 🍼"
  - "아빠 이거 어때요? 👀"
  - "둘째 태어나면 사야 해요 👶"
  - "지금 안 사면 후회할 가격이에요 ⚡"
  - "할인할 때 미리 사놔요 💰"
- 메시지 빌드 시 `babyName` (아이 이름)을 자동 삽입 옵션 가치 있음

---

## 10. ensureUserDoc 패턴

### 지금이야 변경 (커밋 `48c1fed`)
`signInAnonymously` 직후 `users/{uid}` doc을 무조건 생성 (`{ app:'jigumiya', platform:Platform.OS, createdAt }`). 알림 권한 거부/토큰 발급 실패 시에도 cron 발송 대상 보장.

### 아이고 현황
- `signInAnonymously` 호출 제거됨 (`_layout.tsx:411` 코멘트)
- Google/Apple 로그인 위주 — `signInWithCredential` 직후 `users/{uid}` 생성 흐름
- `app: 'aigo'` 필드는 `savePushToken` 내부에서만 박힘 (line 495)

### 이식 결정
- ❌ **직접 이식 불필요** — 아이고는 anon 미사용. 로그인 사용자만 user doc 생성.
- ✅ **별도 검토 필요**: 알림 권한 거부 후 `savePushToken` 호출 안 됐을 때 user doc 미생성 가능. Google 로그인 직후 `setDoc(users/{uid}, { app:'aigo', platform, createdAt }, merge)` 명시 호출 추가 검토.

### 주의사항
- Google 로그인 + 토큰 발급 실패 케이스 추적 (지금이야 갤럭시 사고와 동일 메커니즘 잠재)

---

## 11. 버전 bump + 빌드

### 지금이야 변경 (커밋 `aa90f1a`)
- `app.config.js`: `version` / `ios.buildNumber` / `android.versionCode` 동시 갱신
- `android/app/build.gradle`: `versionCode` / `versionName` 동기화 (gitignored, 수동 sync 필수)

### 아이고 현황
동일 정책 (`docs/016_버전관리규칙.md` 참조).

### 주의사항
- 아이고도 양쪽 동기화 필수 — `app.config.js` 변경 시 `android/app/build.gradle`도 같이
- `production.autoIncrement`는 미사용 (실패 빌드가 버전 먹지 않도록)

---

## 작업 순서 권장

1. **🔴 High 묶음 — iOS 상품 추가 무한로딩 / priceHistory 보호** (3~4일)
   - CoupangScraper 1.0.14 fixes
   - add-item.tsx HTML redirectWebUrl 파싱
   - priceHistory Fix B 머지 정책
   - → 빌드 + iOS/Android 검증

2. **🟡 Mid 묶음 — UI 개선 + 성능** (2~3일)
   - ProductCard trend 뱃지 (Fix C)
   - expo-image 마이그레이션
   - price-checker token-dedup + swap
   - → 빌드 + 스크롤 성능 / 알림 검증

3. **🟢 Low 묶음 — 신규 기능** (4~5일)
   - 가격그래프 개선 (detail)
   - "사달라고 조르기" 모달 (육아 톤 멘트 별도 작성)
   - SparklineChart MIN_POINTS 가드 (검증 후 결정)
   - → 빌드 + 사용자 피드백

4. **별도 검토**
   - ensureUserDoc 패턴 — 아이고 anon 미사용 구조에 맞게 재설계
   - Functions Resolver 단일 배포 (jigumiya 통합 프로젝트) — 합의 후

---

## 참고

- 지금이야 1.0.15 출시 후 **데이터/캐시 삭제 후 첫 상품 추가 실패** 미확인 이슈 발견됨. 1.0.15에서 재현되면 추가 fix 발생 → 아이고 이식 전 지금이야 fix 확정 후 진행 권장
- 본 문서는 5/8 시점 스냅샷 — 지금이야 추가 변경 발생 시 갱신 필요
- 모든 이식 항목은 자체 빌드/테스트 후 진행 (지금이야 코드 그대로 복사 시 import 경로 / theme / 상수 차이 정합성 확인 필수)
