# Changelog

날짜별 작업 이력 / 빌드 / 심사 이력. CLAUDE.md에는 더 이상 날짜별 이력을 누적하지 않고 이 파일에 추가한다.

상세 phase별 과거 이력은 `archive/` 디렉터리 참고:
- `01_v1.0.1_v1.0.4_이력.md` — Phase 1 인프라 + v1.0.1~v1.0.4 버그
- `02_v1.0.5_이력.md` — Firebase jigumiya 통합 + 계정 삭제 + Phase 3 골격
- `03_v1.0.6_vc67_vc70_이력.md` — BUG-41/42/43 + AIGO-BUG-01 (Android+iOS 로그인) 완전 해결
- `04_v1.0.6_vc72_vc78_이력.md` — Apple Sign In + 로그아웃 + 칩 작업
- `05_외부지식_쿠팡_iOSWebView.md` — 쿠팡 Rate Limit + iOS WebView 노하우

---

## 2026-05-10 (Firestore 운영 설정, 코드 변경 없음)

- **Firestore `meta/config_aigo` 업데이트 팝업 설정 완료** — `minRequiredVersion: '1.0.8'` / `latestVersion: '1.0.8'` / `updateMessage` / `forceUpdate: false`. `services/updateCheck.ts` (지금이야와 동일 인터페이스, snooze 정책 포함)이 부팅 시 조회. 1.0.8 미만 사용자에게 안내 노출 + "나중에" 시 `aigo-update-snoozed-aigo` AsyncStorage 키에 minRequiredVersion 저장 → minRequiredVersion 상승 시 재노출
- 5/8 이식분(High 묶음 d25f4ad / token-dedup 6bd53bf / trend 뱃지 e0be0ee) push 완료 상태 재확인. v1.0.9 빌드 직전 단계

## 2026-05-08 (커밋 `e0be0ee` + `d25f4ad` + `6bd53bf`, 모두 push 완료)

지금이야 1.0.12~1.0.15 변경사항 이식 (가이드: `docs/021_Jigumiya_Migration.md`). 🔴 High 묶음 3건 + 🟡 Mid 2건(token-dedup + ProductCard trend) 적용.

### High 묶음 (d25f4ad)
- **priceHistory Fix B** (`store/useAppStore.ts:167`) — `syncFromFirestore` 머지 정책. id 단위 매칭, `local.priceHistory.length > remote` 시 local 보존. 백그라운드 복귀마다 priceHistory 1개로 리셋되는 사고 방어
- **CoupangScraper 1.0.14 fixes** (`components/CoupangScraper.tsx`, 5개) — (1) `coupangapp://` 차단 추가 (BLOCK_DEEPLINK_JS + handleShouldStartLoad 양쪽), (2) `retryDelays`/`retryIndexRef` 선언을 `sourceKey` if 블록 위로 이동(TDZ fix), (3) 가격 재시도 소진 시 `console.warn`만 찍던 분기에서 즉시 `onError()` 호출 — iOS 무한로딩 fix, (4) `coupang.com` 도메인 WebView 내 강제 처리(Universal Link 팝업 방지), (5) `allowsBackForwardNavigationGestures={false}` 추가
- **add-item.tsx HTML redirectWebUrl 파싱** (`app/modal/add-item.tsx`) — `extractRedirectUrlFromHtml` 헬퍼 신설(hex-escape `\\xNN` 디코드, functions/src/index.ts 미러). `link.coupang.com` fallback 흐름에 30x Location → HTML body `redirectWebUrl` 파싱 → `redirect:'follow'` 본문 파싱 순서 반영

### Mid 묶음 (6bd53bf, e0be0ee)
- **price-checker token-dedup + swap** (`scripts/price-checker/index.ts`, 6bd53bf) — `fetchActiveUsers` 헬퍼 신설. `collectionGroup('items')`로 trackedUids 사전 수집(aigo는 `items` 컬렉션, jigumiya는 `tracked` 컬렉션). `app === 'aigo'` strict (jigumiya/unknown/other 분리 카운트). token-dedup 첫 등장 보존 + swap(신 uid만 tracked 보유 시 kept 교체) — orphan tracker regression 방어. main() 두 순회의 `expoPushToken` 직접 사용 → `activeUsers.get(uid)?.token` 교체. 가격 업데이트는 모든 user 그대로, 알림 발송 대상만 dedup 한정
- **ProductCard trend 뱃지 (Fix C)** (`components/ProductCard.tsx`, e0be0ee) — `priceHistory[0]` vs `[last]` 비교 trend 뱃지: 가격하락감지(#FF4444) / 가격상승감지(#3B82F6) / 가격변동없음(theme.subtext). 2개 미만 미표시. 기존 gap 텍스트(`목표까지 -X%` / `가격 알림 중`)를 `bottomRow`(flex row + space-between)로 감싸 좌우 split. aigo 고유 영역(badgeRow / progressBar / SparklineChart) 보존. 색상 충돌 가능성(theme.primary `#FF7E67` 코랄 + #FF4444 빨강) → 실 화면 검증 후 채도 낮춘 톤(`#E55E5E` / `#5BA0F2`) 검토

### 적용 보류 (021 가이드 6~10번)
- expo-image 마이그레이션 — 다수 파일, Mid 묶음 마지막 잔여 항목. v1.0.9 빌드 직전 진행
- SparklineChart MIN_POINTS 가드 — 아이고 priceHistory가 짧을 가능성, 임계 3개 검토 후
- 가격그래프 개선 / "사달라고 조르기" 모달 / ensureUserDoc 패턴

## 2026-05-06 (커밋 `ee24ede`)

- **baby-categories 54개 슬러그 키워드 2~3개로 확장** — `keyword: string` → `keywords: string[]` 타입 변경. `index.ts` 다중 키워드 호출 → productId dedupe 패턴 (event-best와 동일 구조). 슬러그당 후보 평균 15~25개. env: `PRODUCTS_PER_KEYWORD`(기본 10) + `SLEEP_BETWEEN_KEYWORDS_MS`(기본 2000). Firestore `category_best_baby/{slug}` 필드 `keyword` → `keywords`
- **baby-category-best-update 그룹별 yml 4개 신설** — group1(01:20 KST `20 16 * * *`) / group2(01:35 `35 16 * * *`) / group3(03:00 `0 18 * * *`) / group4(03:20 `20 18 * * *`). 각 yml에 `GROUP=N` 하드코딩. 기존 통합 yml은 schedule 주석 처리 상태 그대로 유지
- **event-best / baby-category search API limit 10으로 강제** — 양쪽 `coupang-api.ts`에 `safeLimit = max(1, min(floor(limit), 10))` 클램프. env 기본값 50 → 10 (쿠팡 search API 공식 한도). PER_KEYWORD 20 → 10
- **aigo-daily-greeter cron 신설** — `scripts/aigo-daily-greeter/`(messages.ts + index.ts + package.json + tsconfig.json) + `.github/workflows/aigo-daily-greeter.yml`. KST 요일별 단일 문구 14개(morning 7 + evening 7). `app === 'aigo'` strict 필터 + KST 날짜 가드(`lastAigoMorningKstDate` / `lastAigoEveningKstDate` flat 필드). schedule 비활성(주석), workflow_dispatch만 활성. 활성화 시 권장 cron: `30 22 * * *`(07:30 KST morning) + `0 11 * * *`(20:00 KST evening)

## 2026-05-05 (커밋 `057b049` + 묶음)

- **87daed2** — baby-category-notifier 상품별 발송 보강(B)
- **204c0c8** — Functions `minInstances: 1` (asia-northeast3)
- **e691173** — 지금이야 알림 이식 C/D/E/H
- **2db2737** — events.ts 다중 키워드
- **e3cd05b** — baby-categories 12개 슬러그 정제
- **057b049** — chore: bump 1.0.7 → 1.0.8 (vc81/bn81)
- **98398d1** — 개인정보처리방침 GitHub Pages 이전 (https://tegisee.github.io/aigo/privacy-policy/)

---

## 빌드 산출물

### v1.0.8 vc81/bn81 (2026-05-05)
- Android AAB: `~/aigo/builds/android/aigo-1.0.8-81.aab` (64.2 MB) — Play Store 내부 테스트 업로드 완료
- iOS IPA: `~/aigo/builds/ios/aigo-1.0.8-81.ipa` (19.7 MB) — App Store 심사 요청 완료

### 최근 빌드 요약
- **v1.0.6 vc69~vc78** (2026-05-01~02) — Android+iOS AIGO-BUG-01(OAuth) 해결, Apple Sign In + 칩 통일. vc74~78 칩 미해결 = AIGO-BUG-06
- **v1.0.7 vc80/bn80** (2026-05-04, `39f99bc`) — iOS 공유 무한로딩 + Functions 콜드 스타트 보강. 별도 `5ea7241` BabyNotifier batch 거절 fallback
- **v1.0.8 vc81/bn81** (2026-05-05, `057b049`) — baby-category 키워드 정제(`e3cd05b`) + events 다중 키워드(`2db2737`) + 지금이야 알림 이식 C/D/E/H(`e691173`) + Functions minInstances(`204c0c8`) + 상품별 발송 B 보강(`87daed2`)

---

## App Store 심사 이력

- v1.0.4(12) 거절 — Guideline 4.8 + 5.1.1(v) (구글/애플 로그인 + 계정 삭제 미구현)
- v1.0.6(20) / 1.0.7(21) / 1.0.8(22) 누적 제출 → Apple 심사 대기

## Google Play 진행

- 1.0.8 vc81 내부 테스트 → 프로덕션 승급 결정 대기 (1.0.7 vc80 흐름 통합)
