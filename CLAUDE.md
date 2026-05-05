# 아이고 (AIGO) - 메인 컨텍스트

## 중요: 새 대화창 시작 방법
~/aigo/aigo/docs/000_MD_사용법.md 와 이 파일을 먼저 읽을 것.
작업할 항목의 sub MD도 함께 읽고 시작할 것.
과거 작업 이력은 `~/aigo/aigo/docs/archive/`에 분리 보관 — 필요 시에만 참조.

## 프로젝트 개요
- 앱 이름: 아이고 (AIGO)
- 슬로건: "내 아이 것은 내가 고른다"
- 컨셉: 육아용품 전문 쿠팡 최저가 추적 알림 앱
- 번들 ID: com.aigo.app
- 자매 앱: 지금이야 (Jigumiya) — 범용 가격 추적 앱
- 프로젝트 경로: ~/aigo/aigo
- 카테고리: 쇼핑/육아/유틸리티
- 개인정보처리방침: https://tegisee.github.io/aigo/privacy-policy/ (구: https://dafamstore.tistory.com/11)

## 작업 리스트

### Phase 1 (MVP)
| 번호 | 작업 | 상태 | sub MD |
|------|------|------|--------|
| 001 | 프로젝트 개요 + 차별화 전략 | ✅ | 001_프로젝트개요.md |
| 002 | 기술스택 + 폴더구조 세팅 | ✅ | 002_기술스택.md |
| 003 | 디자인시스템 + UI 구현 | ✅ | 003_디자인시스템.md |
| 004 | 수익모델 확정 | ✅ | 004_수익모델.md |
| 005 | UX 플로우 확정 | ✅ | 005_UX플로우.md |
| 006 | 알림 전략 확정 | ✅ | 006_알림전략.md |
| 007 | 데이터 저장 구조 구현 | ✅ | 007_데이터저장구조.md |
| 008 | Share Intent 연동 | ✅ | 008_ShareIntent.md |
| 009 | Firebase 연동 | ✅ | 009_Firebase.md |
| 010 | 상품 정보 스크래핑 + 카테고리 분류 | ✅ | 010_상품스크래핑.md |
| 011 | EAS 빌드 + 실기기 테스트 | ⬜ | 011_EAS빌드_배포.md |

### Phase 2 (가격 추적 + 알림 + 육아 특화)
| 번호 | 작업 | 상태 | sub MD |
|------|------|------|--------|
| 012 | FCM 푸시 알림 + 가격 체크 봇 | ⬜ | 012_FCM푸시알림.md |
| 013 | 쿠팡 파트너스 API 연동 | ⬜ | 013_파트너스API.md |
| 014 | 육아용품 카테고리 + 아이 나이별 필터 | ✅ | 014_카테고리_필터.md |
| 015 | 소모품 재구매 알림 (기저귀/분유 주기) | ✅ | 015_재구매알림.md |
| - | 버그 및 개선 목록 (41개 항목) | ✅ 41/41 | 012_버그및개선목록.md |

### Phase 3 (성장 + 확장)
| 번호 | 작업 | 상태 | sub MD |
|------|------|------|--------|
| 013 | 육아정보 API 연동 | ⬜ | 013_육아정보_API연동.md |
| 014 | 구글 플레이 셋팅 | ✅ | 014_구글플레이셋팅.md |
| 016 | Phase 3 전체 계획 | ⬜ | 016_Phase3계획.md |
| 017 | iOS 빌드 & 배포 | ⬜ | 017_iOS빌드배포.md |
| 019 | Phase 3 공유 컬렉션 설계 | ✅ | 019_Phase3_SharedProducts.md |

## 수익모델: 쿠팡 파트너스 단일 전략
- 지금이야와 동일 구조 (3~10% 수수료)
- 육아용품 특성: 반복 구매 빈도 높음 → 전환율 유리
- 기저귀/분유/물티슈 등 소모품 = 정기 구매 유도 가능
- 파트너스 계정: 지금이야와 동일 계정 사용

---

## 현재 상태 (2026-05-05 시점)

### 마지막 코드: 커밋 `057b049` (v1.0.8 vc81/bn81 빌드 직전 version bump)
- **057b049** — chore: bump version 1.0.7 → 1.0.8 (vc81/bn81)
- **d857144** — docs: 2026-05-05 작업 정리
- **87daed2** — baby-category-notifier 상품별 발송 (B 보강): 사용자당 1알림 요약 → n개 하락 → n개 알림
- **204c0c8** — Functions `minInstances: 1` 배포 완료 (asia-northeast3, idle 1 인스턴스 상시 가동)
- **e691173** — 지금이야 이식 (C/D/E/H): app 필터링 + 메시지에 상품명/가격 + KST 날짜 가드 + 'price_change' 라우팅
- **2db2737** — events.ts 다중 키워드 (31 × 3~5) + index.ts 배열 처리 + sleep 2초
- **e3cd05b** — baby-categories 12개 슬러그 키워드/excludeKeywords 정제 (성인/강아지/노인/임산부 노이즈 차단)
- 직전 빌드 컨텍스트:
  - **5ea7241** (BabyNotifier fix) — Expo batch 거절 방어 + 잘못된 lastBabyDropAlertAt 가드 차단
  - **39f99bc** (v1.0.7) — iOS 공유 무한로딩 수정 + Functions 콜드 스타트 완화 (지금이야 9de8269 + 601b166 동일 적용)
- v1.0.6 라인 (vc78까지) → AIGO-BUG-06 칩 높이 미해결로 중단된 채 유지, v1.0.7로 라인 점프

### 빌드 산출물
- **Android AAB**: `~/aigo/builds/android/aigo-1.0.8-81.aab` (64.2 MB, 2026-05-05 05:06) — Play Store 내부 테스트 업로드 완료
- **iOS IPA**: `~/aigo/builds/ios/aigo-1.0.8-81.ipa` (19.7 MB, 2026-05-05 05:03) — App Store 심사 요청 완료
- 직전: aigo-v1.0.7-vc80.aab / aigo-v1.0.7-vc80.ipa (1.0.7 라인, 검토 진행 중)

### 스토어 진행
- **App Store**:
  - **1.0.4(12) 거절** — Guideline 4.8 + 5.1.1(v) 위반 (해당 빌드는 구글/애플 로그인 및 계정 삭제 미구현)
  - **1.0.6(20) 재제출 완료** (2026-05-02 22:38 KST) — Apple Sign In + 구글 로그인 + 계정 삭제 + 시연영상 첨부
  - **1.0.7(21) 제출 완료** (2026-05-04) — iOS 공유 무한로딩 + 콜드 스타트 보강
  - **1.0.8(22) 심사 요청 완료** (2026-05-05) — baby-category 키워드 정제 + 알림 개선 + Functions minInstances → **Apple 심사 대기**
- **Google Play**:
  - 1.0.6 vc69 비공개 테스트 검토 통과 후 1.0.7 vc80 프로덕션 검토 진행
  - **1.0.8 vc81 내부 테스트 업로드 완료** (2026-05-05) → 내부 테스트 검토 통과 후 프로덕션 승급 예정

---

## 미해결 TODO

### 🟠 P1 — v1.0.8 vc81/bn81 스토어 검토 중 + 2026-05-05 후속 검증
- **App Store 1.0.8(22) Apple 심사 회신 대기** (2026-05-05 제출 — 1.0.6(20)/1.0.7(21) 누적 중)
- **Play Store 1.0.8 vc81 내부 테스트 검토 통과 → 프로덕션 승급 결정** (1.0.7 vc80 프로덕션 검토 흐름과 통합 결정 필요)
- **baby-category-notifier 상품별 발송(B) 첫 실 트래픽 모니터링** — 사용자당 알림 수 분포 확인. 폭탄 우려 시 dropAmount 상위 N개 상한 추가 검토
- **events.ts 다중 키워드 cron 첫 실행 검증** — 31×3~5 ≈ 124콜이 5분 내 정상 종료하는지 + dedupe 후 결과 분포
- **baby-categories 12개 슬러그 정제 효과 검증** — 다음 cron run 후 category_best_baby 문서에서 노이즈(성인기저귀/노인보행기/임산부분유 등) 0건 확인
- baby-category-notifier Expo batch 거절 fallback 분기 실 트래픽 검증 (5ea7241)
- Functions `minInstances: 1` 운영 비용 모니터링 (asia-northeast3 idle 1 인스턴스, 무료 티어 초과분 추적)

### 🟡 P2 — UX 개선
- **IMPROVE-A**: 설정화면에 로그인된 구글 계정 이메일/이름 표시 (iOS/Android 공통)
- **AIGO-BUG-04**: 와우회원 필드 (사양 정리 필요)
- **AIGO-BUG-05**: 익명 로그인 사용자에게 구글 연동 가능 표기 (UX 명확화)
- **그래프 Y축 가격 표시 버그**: 가격 히스토리 그래프 Y축 라벨 이상 — 1~2일 가격 변동 누적 관찰 후 재현 여부 확인
- **공지사항 팝업 + 전체 푸시 기능**: 운영자 공지(긴급 알림/이벤트)를 모든 사용자에게 일괄 발송하는 인프라 신설

### 🟡 P2 — 기존 UX 버그
- **BUG-36**: 접종 리스트 등록 후 나중에 체크 기능
- **BUG-37**: 월령별 추천 카테고리 복수선택 해제 안 됨
- **BUG-39**: 구글 로그인 데이터 복원 간헐적 미적용 (AIGO-BUG-01 해결로 잔존 여부 vc69 검증 결과로 판단)
- **AIGO-BUG-06**: 관심상품 탭 자녀 칩 높이 흔들림 (vc73~vc78 시도 5회 미해결)
  - 가설: fontWeight '500'↔'600' 전환 시 폰트 라인 메트릭 변동 (RN/Android 특이 케이스)
  - 다음 시도 후보: ScrollView → 일반 View 교체(가로 스크롤 포기) / Pressable + onLayout 측정 / fontWeight 단일화
  - 상세: `docs/archive/04_v1.0.6_vc72_vc78_이력.md`

### 🟡 P2 — Phase 3 UI 후속
- 앱 측 baby-category 탭 라우팅 구현 — 푸시 알림 `screen=baby-category` + slugs 도착 시 홈 탭에서 해당 월령별 카테고리 섹션으로 자동 스크롤/하이라이트
- 가격 하락 알림 도착 시 사용자 동선(홈 → 카테고리 → 상품 카드) UX 개선

### 🟡 P2 — 출시
- App Store 1.0.8(22) 심사 회신 대기 (1.0.7(21) 누적)
- Google Play 1.0.8 vc81 내부 테스트 검토 통과 후 프로덕션 단계적 승급
- AIGO-BUG-04 / AIGO-BUG-05 수정 후속 빌드
- cron 전체 활성화 (검증 통과 후)

### 🟢 낮음
- 육아정보 API 2단계 (L)

---

## 다음 작업 (우선순위 순)
1. **App Store 1.0.8(22) 심사 회신 모니터링** — 통과 시 1.0.7(21) 흐름 정리, 거절 시 사유 분석
2. **Play Store 1.0.8 vc81 내부 테스트 검토 통과 후** 프로덕션 단계적 승급 비율 조정
3. **baby-category 그룹 1~4 cron 첫 실행** — 12개 슬러그 정제 효과 + excludeKeywords 필터 동작 검증
4. **event-best cron 첫 실행** — 다중 키워드 (124콜) 5분 내 종료 + dedupe 후 카테고리별 결과 분포 확인
5. **baby-category-notifier 다음 cron run 로그** — 상품별 발송(B) 사용자별 알림 수 + chunk fallback 분기 검증
6. Functions `minInstances: 1` 비용 추적 1~2주 후 효율성 평가 (idle cost vs 콜드 스타트 사용자 경험)
7. 그래프 Y축 버그 재현 시도 — 1~2일 가격 변동 누적 후 확인
8. 공지사항 팝업 + 전체 푸시 인프라 설계 (Firestore announcements 컬렉션 + 앱 첫 진입 시 마지막 본 ID와 비교)
9. 칩 높이 작업 재개 (AIGO-BUG-06) — View 교체 / fontWeight 단일화 등 후보 시도

---

## 가격 체크 cron 관리 정책 (2026-05-02 확정)
- **단일 관리 위치**: 가격체크 cron은 지금이야 레포(`~/jigumiya`)에서 단일 관리. 아이고 레포에 별도 cron 없음
- **설계 문서**: `~/jigumiya/jigumiya/docs/020_PriceChecker_CronDesign.md` (지금이야 레포)
- **공유 컬렉션**: shared_products / category_best_baby / event_best 모두 jigumiya 프로젝트에 적재 → 양 앱이 read만 수행
- **운영 시간**: 04:30 ~ 01:00 KST, 분당 40회 순차 (공식 한도 50/분 대비 안전 마진)
- **알림 발송**: 하루 3회 고정 (시간대 미확정, 후보 08:00 / 13:00 / 20:00 KST)
- **아이고 cron 활성화 시점**: 지금이야 cron 안정화 후 진행

---

## 지금이야 대비 차별화 포인트
1. 육아용품 전문 (범용 X)
2. 아이 나이별 카테고리 자동 분류
3. 소모품 재구매 주기 알림
4. 육아맘/육아대디 감성 UI (따뜻한 톤)
5. 안전 인증 마크 표시 (KC 인증 등)

## 주요 기술 스택 (지금이야에서 검증 완료)
- React Native + Expo SDK 55 + TypeScript
- Zustand + AsyncStorage persist
- Firebase Firestore + Anonymous Auth (jigumiya 통합 프로젝트)
- CoupangScraper (WebView DOM 스크래핑)
- 쿠팡 파트너스 API (HMAC 서명 + 딥링크)
- Firebase Cloud Functions (resolveAndGenerateAffiliateUrl)
- GitHub Actions 가격 체크 봇
- Expo Push Notifications (FCM V1)
- EAS Build (iOS + Android)

---

## 빌드 규칙

### 빌드 아티팩트 네이밍
- 패턴: `aigo-v{version}-vc{versionCode}.{aab|apk|ipa}`
- 버전 관리 규칙: docs/016_버전관리규칙.md

### 빌드 파일 관리
- **Android AAB**: `~/aigo/builds/android/aigo-v{버전}-vc{버전코드}.aab`
- **iOS IPA**: `~/aigo/builds/ios/aigo-v{버전}-vc{버전코드}.ipa`
- 빌드 완료 후 **반드시** 위 규칙으로 파일명 변경 후 해당 폴더로 이동
- **빌드 로그**: `~/aigo/builds/{android|ios}/build-log-{android|ios}.txt` (`tee`로 실시간 기록)

### 로컬 빌드 명령어
```bash
cd ~/aigo/aigo && eas build --local --profile production --platform android
cd ~/aigo/aigo && eas build --local --profile production --platform ios
```
EAS 크레딧 100% 소진 (리셋: 매월 21일)

### 빌드 완료 시 응답 형식
1. 🎉 빌드 성공! (이모지 포함)
2. AAB 이동 명령어 코드블록:
   `mv ~/aigo/aigo/build-[타임스탬프].aab ~/aigo/builds/android/aigo-v[버전]-vc[버전코드].aab`
3. "Play Console 올리고 테스트해요! 출시노트:" 문구
4. 출시노트 코드블록 (수정 내용 요약, 3~5줄)
5. 출시명 확인 후 MD 업데이트 제안

---

## 형제 앱
- 아이고와 지금이야(`~/jigumiya/jigumiya`)는 형제 앱 관계
- 동일 개발자, 동일 기술 스택 (React Native, Expo, Firebase)
- 한 앱에서 해결한 문제/노하우는 다른 앱에 이식 가능
- iOS 로컬 빌드 세팅은 지금이야 참고 (fastlane, .easignore 설정 등)
- iOS WebView 쿠팡 튕김 노하우: `docs/archive/05_외부지식_쿠팡_iOSWebView.md`

---

## 최근 빌드 이력
- v1.0.6 vc69 (2026-05-01) — Android, AIGO-BUG-01 완전 해결 (aigo-a OAuth 충돌 정리 + google-services.json 갱신)
- v1.0.6 vc70 (2026-05-01) — iOS, AIGO-BUG-01 완전 해결
- v1.0.6 vc72 (2026-05-02) — 오늘의 육아템 + 칩 통일 1차 + 로그아웃 + Apple Sign In
- v1.0.6 vc73 (2026-05-02) — isLinked 3겹 방어 + updateCheck 보강 (App Store ID 6762362777 + web fallback + updateMessage)
- v1.0.6 vc74~vc78 (2026-05-02) — 관심상품 칩 높이 반복 수정 (5회 시도, 미해결 — AIGO-BUG-06)
- **v1.0.7 vc80/bn80 (2026-05-04)** — iOS 공유 무한로딩 수정 + Functions 콜드 스타트 완화. 지금이야 9de8269 + 601b166 동일 적용 (commit `39f99bc`)
  - iOS: handleNext Alert 가이드 + useFocusEffect step 보존 + startScrape iOS HTML fetch 8s timeout
  - 공통: services/firebase.ts `warmupResolveAffiliate` 신설 (sentinel URL → backend early-return) + 모달 mount + AppState active 시 워밍업 + Functions 응답시간 로그
  - **별도 커밋 5ea7241 (BabyNotifier)** — Expo batch 거절 시 chunk 단위 try/catch + 1건씩 fallback, lastBabyDropAlertAt 발송 성공 토큰만 갱신, 1회성 cleanup 스크립트 (DRY_RUN 결과 candidates=0 — 잔존 데이터 없음 확인)
- **v1.0.8 vc81/bn81 (2026-05-05)** — 5월 5일 누적 5개 commit 반영 빌드. iOS App Store 심사 요청 + Android Play Store 내부 테스트 업로드 완료 (version bump commit `057b049`)
  - baby-categories 12개 슬러그 키워드/excludeKeywords 정제 (성인/강아지/노인/임산부 노이즈 차단 — 커밋 `e3cd05b`)
  - events.ts `keyword: string` → `keywords: string[]` 스키마 + 31개 이벤트 × 3~5 키워드 + index.ts dedupe + sleep 2초 (`2db2737`)
  - 지금이야 이식 (C/D/E/H): savePushToken `app: 'aigo'` + 알림 본문 상품명/가격 + KST 날짜 가드 + `'price_change'` 라우팅 (`e691173`)
  - Functions `minInstances: 1` 적용 + asia-northeast3 배포 완료 (`204c0c8`)
  - baby-category-notifier 사용자당 1알림 요약 → 상품별 각각 발송 (n개 하락 → n개 알림, screen='detail' + itemId, `87daed2`)
  - 산출물: `~/aigo/builds/ios/aigo-1.0.8-81.ipa` (19.7 MB) / `~/aigo/builds/android/aigo-1.0.8-81.aab` (64.2 MB)
  - EAS remote buildNumber 카운터: 21 → 22 (App Store 노출 빌드 번호)

## 2026-05-05 코드 변경 (v1.0.7 vc80 이후, 빌드 전 — origin/main push 완료)

5개 커밋 누적 (`0ce8c5a` → `87daed2`). 다음 EAS 빌드 시 함께 반영 예정.

- **e3cd05b** — `fix: baby-categories 키워드/필터 패치 (12개 슬러그)`
  - 쿠팡 search API 전수 검증으로 노이즈 슬러그 식별
  - diaper-25-36 `"팬티 기저귀"` → `"걸음마 기저귀"` (10/10 무관: 콜라/프라이팬/건전지)
  - walker `"보행기"` → `"아기 보행기"` + excludeKeywords (10/10 노인 보행보조기)
  - diaper-13-24 → `"유아 대형 기저귀"` (성인기저귀 6/10), diaper-7-12/4-6 동일 패턴
  - books-7-12 `"돌전 책"` → `"아기 그림책"`, learning-7-12 `"돌전 교구"` → `"아기 원목교구"`
  - sports/daily/electronics 키워드 정제, formula-0-3 excludeKeywords 추가 (임산부 분유 차단)

- **2db2737** — `feat: events.ts 다중 키워드 + index.ts 배열 처리`
  - `EventDef.keyword: string` → `keywords: string[]` (이벤트당 3~5개)
  - 31개 이벤트 키워드 정제 (네이버쇼핑/쿠팡 연관검색어 리서치 기반)
  - anniversary 19개 "아기" 접두어 강제, season 5개 "어린이" 한정, parent 7개 카테고리+대상 조합
  - cron: 키워드별 호출 → productId dedupe → 가격 내림차순 → LIMIT 슬라이스, sleep 60s → 2s
  - 31 × 평균 4 키워드 ≈ 124콜, 약 4~5분 소요 (분당 30콜 한도 안전 마진)

- **e691173** — `feat: 지금이야 이식 — 알림 메시지 + KST 가드 + 앱 필터링 (C/D/E/H)`
  - jigumiya `de856a6` 커밋의 아이고 해당분 이식
  - C: `services/firebase.ts savePushToken`에 `app: 'aigo' as const` 추가 (jigumiya cron이 app !== 'aigo' 스킵)
  - D: `baby-category-notifier`에 대표 상품 picking + 본문에 `상품명 prev원 → curr원`
  - E: 24h ms 가드 → KST 날짜 가드 (`lastBabyDropAlertKstDate`) — cron jitter 시 미발송 문제 수정
  - H: `services/notifications.ts routeFromNotification`에 `'price_change'` screen 라우팅 추가
  - jigumiya 단독 항목 (G round-robin / 카테고리 broadcast)은 jigumiya cron에서 처리, 아이고 변경 없음

- **204c0c8** — `perf: Functions minInstances: 1 — 콜드 스타트 제거`
  - `resolveAndGenerateAffiliateUrl` onCall에 `minInstances: 1` 추가
  - `firebase deploy --only functions:resolveAndGenerateAffiliateUrl --force` 배포 완료 (asia-northeast3, 2026-05-05)
  - idle 1 인스턴스 상시 가동 → Android/iOS 첫 호출도 즉시 응답 (warmup 보강과 이중 안전)
  - 비용: idle 1 인스턴스 × asia-northeast3 (모니터링 필요)

- **87daed2** — `feat: baby-category-notifier 상품별 발송 (B 보강) — n개 하락 → n개 알림`
  - 사용자당 1알림 요약 (대표 상품 1개) → 매칭 슬러그의 모든 drops × 1알림씩
  - dedupe by productId + dropAmount desc 정렬, `data.itemId` + `screen='detail'` → 클릭 시 상세 직행
  - KST 가드 + DB write는 사용자별 1회 (`successUidSet` dedupe)

## App Store 심사 이력
- **v1.0.4(12) 거절** — Guideline 4.8 + 5.1.1(v) 위반. 거절 사유: 구글/애플 로그인 미구현 + 계정 삭제 미구현. (해당 빌드 자체 한계)
- **v1.0.6(20) 재제출** (2026-05-02 22:38 KST) — Apple Sign In + 구글 로그인 + 계정 삭제 + 시연영상 첨부 → Apple 회신 대기
- **v1.0.7(21) 제출** (2026-05-04) — iOS 공유 무한로딩 수정 + 콜드 스타트 보강 → Apple 심사 대기
- **v1.0.8(22) 제출** (2026-05-05) — baby-category 키워드 정제 + 알림 메시지/가드 개선 + 상품별 알림 + Functions minInstances → Apple 심사 대기

전체 이력은 `docs/archive/`:
- `01_v1.0.1_v1.0.4_이력.md` — Phase 1 인프라 + 핵심 기능 + v1.0.1~v1.0.4 버그 수정
- `02_v1.0.5_이력.md` — Firebase jigumiya 통합 + 계정 삭제 + Phase 3 골격 + 알림 패치
- `03_v1.0.6_vc67_vc70_이력.md` — BUG-41/42/43 + AIGO-BUG-01 (Android+iOS 로그인) 완전 해결
- `04_v1.0.6_vc72_vc78_이력.md` — Apple Sign In + 로그아웃 + 칩 작업
- `05_외부지식_쿠팡_iOSWebView.md` — 쿠팡 Rate Limit + iOS WebView 노하우
