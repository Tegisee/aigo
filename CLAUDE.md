# 아이고 (AIGO) - 메인 컨텍스트

## 중요: 새 대화창 시작 방법
`~/aigo/aigo/docs/000_MD_사용법.md` 와 이 파일을 먼저 읽을 것.
작업할 항목의 sub MD도 함께 읽고 시작할 것.
과거 작업 이력은 `~/aigo/aigo/docs/archive/`에 분리 보관.

## 프로젝트 개요
- 앱 이름: 아이고 (AIGO) — "내 아이 것은 내가 고른다"
- 컨셉: 육아용품 전문 쿠팡 최저가 추적 알림 앱
- 번들 ID: `com.aigo.app` / 카테고리: 쇼핑·육아·유틸리티
- 자매 앱: 지금이야 (Jigumiya, `~/jigumiya/jigumiya`) — 범용 가격 추적 (동일 Firebase 프로젝트, 동일 스택)
- 프로젝트 경로: `~/aigo/aigo`
- 개인정보처리방침: https://tegisee.github.io/aigo/privacy-policy/

## 작업 리스트 (sub MD: `docs/0XX_*.md`)
- **Phase 1 (MVP)** — 001~010 ✅ / 011 (EAS 빌드 + 실기기 테스트) ⬜
- **Phase 2 (가격 추적·알림·육아 특화)** — 014·015 ✅ / 012(FCM)·013(파트너스 API) ⬜ / 버그 41건 ✅ 41/41
- **Phase 3 (성장·확장)** — 014(Play Console)·019(공유 컬렉션) ✅ / 013(육아정보 API)·016(전체 계획)·017(iOS) ⬜

## 수익모델: 쿠팡 파트너스 단일 전략
- 지금이야와 동일 구조 (3~10% 수수료, 동일 계정)
- 육아용품 = 반복 구매 빈도 높음 → 전환율 유리. 기저귀/분유/물티슈 정기 구매 유도

## 지금이야 대비 차별화
1. 육아용품 전문 (범용 X)
2. 아이 나이별 카테고리 자동 분류
3. 소모품 재구매 주기 알림
4. 육아맘/육아대디 감성 UI (따뜻한 톤)
5. 안전 인증 마크 표시 (KC 등)

## 기술 스택 (지금이야에서 검증 완료)
- React Native + Expo SDK 55 + TypeScript / Zustand + AsyncStorage persist
- Firebase Firestore + Anonymous Auth (jigumiya 통합 프로젝트)
- CoupangScraper (WebView DOM) + 쿠팡 파트너스 API (HMAC + 딥링크)
- Firebase Cloud Functions (`resolveAndGenerateAffiliateUrl`, asia-northeast3, `minInstances: 1`)
- GitHub Actions cron + Expo Push (FCM V1) + EAS Build (iOS+Android)

---

## 현재 상태 (2026-05-06)

### 마지막 코드: 커밋 `ee24ede`
- **ee24ede** (2026-05-06) — 알림/cron 인프라 정비 (오늘 작업, 아래 별도 섹션)
- **98398d1** (2026-05-05) — 개인정보처리방침 GitHub Pages 이전
- **057b049** (2026-05-05) — chore: bump 1.0.7 → 1.0.8 (vc81/bn81)
- **87daed2 / 204c0c8 / e691173 / 2db2737 / e3cd05b** (2026-05-05) — baby-category-notifier 상품별 발송 / Functions minInstances / 지금이야 알림 이식(C/D/E/H) / events.ts 다중 키워드 / baby-categories 12개 슬러그 정제

### 빌드 산출물 (v1.0.8 vc81/bn81)
- Android AAB: `~/aigo/builds/android/aigo-1.0.8-81.aab` (64.2 MB) — Play Store 내부 테스트 업로드 완료
- iOS IPA: `~/aigo/builds/ios/aigo-1.0.8-81.ipa` (19.7 MB) — App Store 심사 요청 완료

### 스토어 진행
- **App Store**: 1.0.8(22) Apple 심사 대기 (1.0.4(12) Guideline 4.8/5.1.1(v) 거절 후 → 1.0.6(20)/1.0.7(21)/1.0.8(22) 누적 제출)
- **Google Play**: 1.0.8 vc81 내부 테스트 → 프로덕션 승급 결정 대기 (1.0.7 vc80 흐름 통합)

---

## 2026-05-06 오늘 작업 (커밋 `ee24ede`)

- **baby-categories 54개 슬러그 키워드 2~3개로 확장** — `keyword: string` → `keywords: string[]` 타입 변경. `index.ts` 다중 키워드 호출 → productId dedupe 패턴 (event-best와 동일 구조). 슬러그당 후보 평균 15~25개. env: `PRODUCTS_PER_KEYWORD`(기본 10) + `SLEEP_BETWEEN_KEYWORDS_MS`(기본 2000). Firestore `category_best_baby/{slug}` 필드 `keyword` → `keywords`
- **baby-category-best-update 그룹별 yml 4개 신설** — group1(01:20 KST `20 16 * * *`) / group2(01:35 `35 16 * * *`) / group3(03:00 `0 18 * * *`) / group4(03:20 `20 18 * * *`). 각 yml에 `GROUP=N` 하드코딩. 기존 통합 yml은 schedule 주석 처리 상태 그대로 유지
- **event-best / baby-category search API limit 10으로 강제** — 양쪽 `coupang-api.ts`에 `safeLimit = max(1, min(floor(limit), 10))` 클램프. env 기본값 50 → 10 (쿠팡 search API 공식 한도). PER_KEYWORD 20 → 10
- **aigo-daily-greeter cron 신설** — `scripts/aigo-daily-greeter/`(messages.ts + index.ts + package.json + tsconfig.json) + `.github/workflows/aigo-daily-greeter.yml`. KST 요일별 단일 문구 14개(morning 7 + evening 7). `app === 'aigo'` strict 필터 + KST 날짜 가드(`lastAigoMorningKstDate` / `lastAigoEveningKstDate` flat 필드). schedule 비활성(주석), workflow_dispatch만 활성. 활성화 시 권장 cron: `30 22 * * *`(07:30 KST morning) + `0 11 * * *`(20:00 KST evening)

## 내일 할 일

1. **각 그룹별 yml workflow_dispatch 검증** — group3(10슬러그 = 가장 가벼움)부터 dry-run → group1/2/4 순. 로그에 `dedupe N/raw M` 분포 확인 + group3 노이즈(성인/반려/임산부) 0건 재확인
2. **aigo-daily-greeter schedule 주석 해제 (검증 후)** — workflow_dispatch에서 mode=morning/evening 각각 dry_run=1 → skip 사유 + 본문 로그 확인 → dry_run=0 본인 토큰 단독 발송 → schedule 활성화
3. **빌드 (월령별 카테고리 현재가만, 기저귀 카테고리 정확도 등)** — 새 데이터 구조(`keywords[]`) + 키워드 정제 효과 반영한 v1.0.9 빌드. 출시노트: 월령별 카테고리 현재가 표시 + 기저귀 카테고리 정확도 향상

---

## 미해결 TODO

### 🟠 P1 — 스토어 검토 + 인프라 검증
- App Store 1.0.8(22) Apple 심사 회신 대기 (1.0.6/1.0.7/1.0.8 누적)
- Play Store 1.0.8 vc81 내부 테스트 → 프로덕션 승급 결정
- baby-category 그룹별 yml 4개 schedule 첫 자동 실행 검증 (위 "내일 할 일 1" 후속)
- aigo-daily-greeter schedule 활성화 후 첫 실 트래픽 모니터링
- search API limit 10 적용 후 적재량 영향 모니터링 (baby-category 슬러그당 / event 이벤트당 의도 범위 15~25 / 30~40 충족 여부, 부족 시 키워드 추가 또는 PRODUCTS_PER_EVENT 조정)
- baby-category-notifier 상품별 발송(B) 첫 실 트래픽 — 사용자당 알림 수 분포 (폭탄 우려 시 dropAmount 상위 N개 상한)
- events.ts 다중 키워드 cron 첫 실행 검증 (PER_KEYWORD 20→10 영향, 124콜 5분 내 종료)
- Functions `minInstances: 1` 운영 비용 모니터링 (asia-northeast3, 무료 티어 초과분)

### 🟡 P2 — UX 개선
- **IMPROVE-A**: 설정에 로그인된 구글 계정 이메일/이름 표시
- **AIGO-BUG-04**: 와우회원 필드 (사양 정리 필요)
- **AIGO-BUG-05**: 익명 로그인 사용자에게 구글 연동 가능 표기
- 그래프 Y축 가격 라벨 버그 — 1~2일 가격 변동 누적 후 재현 확인
- 공지사항 팝업 + 전체 푸시 인프라 (Firestore announcements 컬렉션 + 마지막 본 ID 비교)

### 🟡 P2 — 기존 UX 버그
- **BUG-36**: 접종 리스트 등록 후 나중에 체크
- **BUG-37**: 월령별 추천 카테고리 복수선택 해제 안 됨
- **BUG-39**: 구글 로그인 데이터 복원 간헐적 미적용 (vc69 검증)
- **AIGO-BUG-06**: 관심상품 자녀 칩 높이 흔들림 (vc73~78 5회 미해결). 가설: fontWeight 500↔600 라인 메트릭. 다음 시도: ScrollView → View / Pressable+onLayout / fontWeight 단일화. 상세 `docs/archive/04_v1.0.6_vc72_vc78_이력.md`

### 🟡 P2 — Phase 3 UI 후속
- baby-category 탭 라우팅 — 푸시 `screen=baby-category` + slugs[] 도착 시 홈 탭에서 해당 월령별 섹션 자동 스크롤/하이라이트
- 가격 하락 알림 동선 개선 (홈 → 카테고리 → 상품 카드)

### 🟢 낮음
- 육아정보 API 2단계 (L)

---

## 가격 체크 cron 관리 정책 (2026-05-02 확정)
- **단일 관리 위치**: 가격체크 cron은 지금이야 레포(`~/jigumiya`)에서 단일 관리. 아이고 레포에 별도 가격체크 cron 없음
- **설계 문서**: `~/jigumiya/jigumiya/docs/020_PriceChecker_CronDesign.md`
- **공유 컬렉션**: shared_products / category_best_baby / event_best 모두 jigumiya 프로젝트에 적재 → 양 앱 read 전용
- **운영 시간**: 04:30 ~ 01:00 KST, 분당 40회 순차 (한도 50/분 안전 마진)
- **알림 발송**: 하루 3회 고정 (시간대 미확정, 후보 08:00 / 13:00 / 20:00 KST)

## 빌드 규칙
- **네이밍**: `aigo-v{version}-vc{versionCode}.{aab|apk|ipa}` (상세 `docs/016_버전관리규칙.md`)
- **저장 위치**: Android `~/aigo/builds/android/`, iOS `~/aigo/builds/ios/`. 빌드 로그 `tee`로 실시간 기록
- **로컬 빌드**: `cd ~/aigo/aigo && eas build --local --profile production --platform {android|ios}` (EAS 크레딧 100% 소진, 매월 21일 리셋)
- **빌드 완료 응답 형식**: 🎉 빌드 성공 + 이동 명령어 코드블록(`mv ...`) + "Play Console 올리고 테스트해요! 출시노트:" + 출시노트 코드블록(3~5줄) + 출시명 확인 후 MD 업데이트 제안

## 형제 앱
- 한 앱 노하우 → 다른 앱 이식 가능. iOS 로컬 빌드 세팅은 지금이야 참고 (fastlane, .easignore)
- iOS WebView 쿠팡 튕김 노하우: `docs/archive/05_외부지식_쿠팡_iOSWebView.md`

---

## 빌드/심사 이력

### 최근 빌드
- **v1.0.6 vc69~vc78** (2026-05-01~02) — Android+iOS AIGO-BUG-01(OAuth) 해결, Apple Sign In + 칩 통일. vc74~78 칩 미해결 = AIGO-BUG-06
- **v1.0.7 vc80/bn80** (2026-05-04, `39f99bc`) — iOS 공유 무한로딩 + Functions 콜드 스타트 보강. 별도 `5ea7241` BabyNotifier batch 거절 fallback
- **v1.0.8 vc81/bn81** (2026-05-05, `057b049`) — baby-category 키워드 정제(`e3cd05b`) + events 다중 키워드(`2db2737`) + 지금이야 알림 이식 C/D/E/H(`e691173`) + Functions minInstances(`204c0c8`) + 상품별 발송 B 보강(`87daed2`)

### App Store 심사 이력
- v1.0.4(12) 거절 — Guideline 4.8 + 5.1.1(v) (구글/애플 로그인 + 계정 삭제 미구현)
- v1.0.6(20) / 1.0.7(21) / 1.0.8(22) 누적 제출 → Apple 심사 대기

### archive 참고
- `01_v1.0.1_v1.0.4_이력.md` — Phase 1 인프라 + v1.0.1~v1.0.4 버그
- `02_v1.0.5_이력.md` — Firebase jigumiya 통합 + 계정 삭제 + Phase 3 골격
- `03_v1.0.6_vc67_vc70_이력.md` — BUG-41/42/43 + AIGO-BUG-01 (Android+iOS 로그인) 완전 해결
- `04_v1.0.6_vc72_vc78_이력.md` — Apple Sign In + 로그아웃 + 칩 작업
- `05_외부지식_쿠팡_iOSWebView.md` — 쿠팡 Rate Limit + iOS WebView 노하우
