# 아이고 (AIGO) - 메인 컨텍스트

## 🚨 아이고 이식 전제조건 (절대 준수)
- 지금이야(`~/jigumiya/jigumiya`) 수정이 완전히 완료되고 commit/push된 이후에만 이식 작업 시작
- 이식 시 지금이야 코드와 아이고 코드를 **파일 단위로 정밀 비교**하여 진행
- 지금이야 변경사항을 그대로 복붙하지 말고, 아이고 전용 요소에 미치는 영향 반드시 검토 후 적용:
  - 월령별 카테고리 구조 (`ageGroup`, `gender` 필드)
  - Google 로그인 + Apple 로그인 (Anonymous Auth 병행)
  - Firebase 프로젝트 별도 (`aigo-a`)
  - `category_best_baby` 컬렉션
- 치명적 영향이 예상되는 항목은 **반드시 작업 중단 후 오너에게 재협의 요청**
- 확신이 없으면 진행하지 말고 먼저 보고할 것

## 중요: 새 대화창 시작 방법
`~/aigo/aigo/docs/000_MD_사용법.md` 와 이 파일을 먼저 읽을 것.
작업할 항목의 sub MD도 함께 읽고 시작할 것.
- 미해결 이슈 상세: `docs/022_Issues.md`
- 날짜별 작업/빌드/심사 이력: `docs/changelog.md`
- 과거 phase별 상세 이력: `docs/archive/`

## 세션 재시작 기준
다음 중 하나라도 해당되면 작업 완료 후 새 세션 시작 권장:
- 수정 파일 10개 이상
- 신규 파일 5개 이상
- 연속 작업 30분 이상

기준 초과 시 출력:
"⚠️ 세션이 길어졌어요. 다음 작업 전에 새 세션 시작을 권장합니다."

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

## 현재 상태

- **마지막 코드 커밋**: `e0be0ee` (ProductCard trend 뱃지 이식). 5/8 이식분 push 완료, v1.0.9 빌드 직전 단계
- **빌드**: v1.0.8 vc81/bn81 — Android AAB Play 내부 테스트 업로드 / iOS IPA App Store 심사 요청 완료
- **App Store**: 1.0.8(22) Apple 심사 대기 (1.0.6/1.0.7/1.0.8 누적 제출)
- **Google Play**: 1.0.8 vc81 내부 테스트 → 프로덕션 승급 결정 대기
- **Firestore `meta/config_aigo`**: minRequiredVersion/latestVersion = `1.0.8`, forceUpdate=false
- 전체 날짜별 작업 이력은 `docs/changelog.md`

---

## 미해결 이슈 (1줄 요약)

상세 내용은 모두 [`docs/022_Issues.md`](docs/022_Issues.md) 참고.

### 🟠 P1 — 스토어 검토 + 인프라 검증
- App Store 1.0.8(22) Apple 심사 회신 대기 → `022#STORE-APPLE`
- Play Store 1.0.8 vc81 프로덕션 승급 결정 → `022#STORE-PLAY`
- baby-category 그룹별 yml 4개 schedule 첫 자동 실행 검증 → `022#CRON-BABY-GROUP`
- aigo-daily-greeter schedule 활성화 후 첫 실 트래픽 모니터링 → `022#CRON-GREETER`
- search API limit 10 적용 후 적재량 영향 모니터링 → `022#MON-SEARCH-LIMIT`
- baby-category-notifier 상품별 발송(B) 첫 실 트래픽 → `022#MON-BABY-NOTIFIER`
- events.ts 다중 키워드 cron 첫 실행 검증 → `022#MON-EVENTS-MULTI-KEYWORD`
- Functions `minInstances: 1` 운영 비용 모니터링 → `022#MON-FUNCTIONS-COST`
- price-checker token-dedup + swap 첫 실 트래픽 → `022#MON-TOKEN-DEDUP`

### 🟡 P2 — UX 개선 / 기존 버그 / Phase 3 UI
- IMPROVE-A 구글 계정 표시 / AIGO-BUG-04 와우회원 / AIGO-BUG-05 익명→구글 연동 안내
- 그래프 Y축 라벨 / 공지사항 팝업 인프라
- BUG-36 접종 / BUG-37 월령 카테고리 / BUG-39 데이터 복원 / **AIGO-BUG-06 칩 높이 흔들림 (5회 미해결)**
- baby-category 탭 라우팅 / 가격 하락 알림 동선

### 🟢 낮음
- 육아정보 API 2단계 (L)

---

## 다음 할 일

1. **expo-image 마이그레이션 (Mid 묶음 마지막) → v1.0.9 빌드** — `package.json` + `app.config.js plugins`에 `expo-image` 등록. `import { Image } from 'react-native'` → `'expo-image'` 일괄 변경 (ProductCard / detail / 카테고리 베스트 등 사용처). `<Image>`에 `cachePolicy="memory-disk" recyclingKey={...} contentFit="cover" transition={0}` 추가. Android 스크롤 성능 ↑ 효과. 이식 완료 후 바로 v1.0.9 빌드
2. **v1.0.9 빌드 (5/8 이식분 + expo-image 통합)** — High 묶음(d25f4ad) + Mid 묶음(6bd53bf token-dedup, e0be0ee trend 뱃지, expo-image) + 5/6 인프라 변경(`keywords[]` 구조, baby-category yml 4개, search limit 10) 통합. 출시노트: iOS 상품 추가 무한로딩 차단 + 백그라운드 복귀 가격 이력 보존 + 단축링크 파싱 안정화 + 가격 트렌드 뱃지 + 이미지 로딩 성능 + 월령별 카테고리 현재가 + 기저귀 카테고리 정확도. 빌드 후 `meta/config_aigo` `minRequiredVersion`/`latestVersion`을 1.0.9로 갱신
3. **price-checker token-dedup 첫 실 트래픽 모니터링** — 다음 cron run 시 `[ActiveUsers]` 로그 확인: aigo 발송 대상 / dup-token 건수 / swap 건수 / skip{jigumiya,unknown,other} 분포
4. **aigo-daily-greeter schedule 주석 해제 (검증 후)** — workflow_dispatch에서 mode=morning/evening 각각 dry_run=1 → dry_run=0 본인 토큰 단독 발송 → schedule 활성화

---

## 핵심 원칙

### CLAUDE.md 운영 원칙
- **이 파일에 날짜별 이력을 추가하지 않는다.** 날짜별 작업/빌드/심사 이력은 모두 `docs/changelog.md`에 기록한다.
- 미해결 이슈 상세는 `docs/022_Issues.md`에 두고 본 파일에는 1줄 요약 + 링크만 둔다.
- "현재 상태" / "다음 할 일" / "미해결 이슈 1줄 요약"만 본 파일에서 수시 갱신한다. 기존 항목이 해결되면 줄을 통째로 삭제하고, changelog.md에 결과를 옮긴다.
- 해결된 과거 이슈/결정사항은 본 파일에 남기지 않는다 (코드/커밋 메시지가 권위 있는 기록).

### 가격 체크 cron 관리 정책 (2026-05-02 확정)
- **단일 관리 위치**: 가격체크 cron은 지금이야 레포(`~/jigumiya`)에서 단일 관리. 아이고 레포에 별도 가격체크 cron 없음
- **설계 문서**: `~/jigumiya/jigumiya/docs/020_PriceChecker_CronDesign.md`
- **공유 컬렉션**: shared_products / category_best_baby / event_best 모두 jigumiya 프로젝트에 적재 → 양 앱 read 전용
- **운영 시간**: 04:30 ~ 01:00 KST, 분당 40회 순차 (한도 50/분 안전 마진)
- **알림 발송**: 하루 3회 고정 (시간대 미확정, 후보 08:00 / 13:00 / 20:00 KST)

### 빌드 규칙
- **네이밍**: `aigo-v{version}-vc{versionCode}.{aab|apk|ipa}` (상세 `docs/016_버전관리규칙.md`)
- **저장 위치**: Android `~/aigo/builds/android/`, iOS `~/aigo/builds/ios/`. 빌드 로그 `tee`로 실시간 기록
- **로컬 빌드**: `cd ~/aigo/aigo && eas build --local --profile production --platform {android|ios}` (EAS 크레딧 100% 소진, 매월 21일 리셋)
- **빌드 완료 응답 형식**: 🎉 빌드 성공 + 이동 명령어 코드블록(`mv ...`) + "Play Console 올리고 테스트해요! 출시노트:" + 출시노트 코드블록(3~5줄) + 출시명 확인 후 MD 업데이트 제안

### 형제 앱
- 한 앱 노하우 → 다른 앱 이식 가능. iOS 로컬 빌드 세팅은 지금이야 참고 (fastlane, .easignore)
- iOS WebView 쿠팡 튕김 노하우: `docs/archive/05_외부지식_쿠팡_iOSWebView.md`

---

## 주요 참조 파일

- `docs/000_MD_사용법.md` — MD 운영 규칙
- `docs/001_프로젝트개요.md` ~ `docs/019_Phase3_SharedProducts.md` — phase별 sub 문서
- `docs/021_Jigumiya_Migration.md` — 지금이야 1.0.12~1.0.15 이식 가이드
- `docs/022_Issues.md` — 미해결 이슈 상세
- `docs/changelog.md` — 날짜별 작업·빌드·심사 이력
- `docs/archive/` — phase별 과거 상세 이력
