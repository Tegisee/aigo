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
- 개인정보처리방침: https://dafamstore.tistory.com/11

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

## 현재 상태 (2026-05-02 시점)

### 마지막 코드: 커밋 `d83de23`, 빌드 v1.0.6 vc78
- vc72에서 핵심 기능(오늘의 육아템 + 로그아웃 + Apple Sign In) 통합
- vc73에서 isLinked 3겹 방어 + updateCheck 보강
- vc74~vc78 관심상품 칩 높이 반복 수정 5회 → 미해결 상태로 일단 중단

### 빌드 산출물
- Android AAB: `~/aigo/builds/android/aigo-v1.0.6-vc69.aab` (Play Console 검토 중)
- iOS IPA: `~/aigo/builds/ios/aigo-v1.0.6-vc70.ipa` (App Store 심사 중)

### 스토어 진행
- **App Store**: vc70 빌드 + Apple Sign In + 시연영상 첨부하여 심사 제출 → **Apple 회신 대기**
- **Google Play**: 프로덕션 액세스 신청 완료 → **Google 검토 대기** (14일 베타 충족 등 별도 요건)

---

## 미해결 TODO

### 🟠 P1 — vc69/vc70 비공개 테스트 검토 중
- AIGO-BUG-01/02/03 모두 vc69+vc70 반영 (Android DEVELOPER_ERROR + iOS Bundle ID `<empty>` 차단 완전 해결)
- Play App Signing 키 SHA-1 미확인 — 비공개 테스트 검토 후 실기기 검증 결과로 추가 등록 필요 여부 판단

### 🟡 P2 — UX 개선
- **IMPROVE-A**: 설정화면에 로그인된 구글 계정 이메일/이름 표시 (iOS/Android 공통)
- **AIGO-BUG-04**: 와우회원 필드 (사양 정리 필요)
- **AIGO-BUG-05**: 익명 로그인 사용자에게 구글 연동 가능 표기 (UX 명확화)

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
- 비공개 테스트 검토 완료 → Play Console 프로덕션 승급
- iOS vc70 App Store 심사 정보 회신
- AIGO-BUG-04 / AIGO-BUG-05 수정 후속 빌드
- cron 전체 활성화 (검증 통과 후)

### 🟢 낮음
- 육아정보 API 2단계 (L)

---

## 다음 작업 (우선순위 순)
1. 시뮬레이터에서 vc78 (`d83de23`) 검증 — 자연 흐름 레이아웃이 시각적으로 OK인지 확인 후 칩 작업 종료 여부 판단
2. Apple Sign In 외부 작업 점검 — Firebase Console > Authentication > Apple 활성화 + Apple Developer Capabilities (App Store 회신 전)
3. Play Console 프로덕션 액세스 승인 → vc72+ 프로덕션 승급
4. 칩 높이 작업 재개 (AIGO-BUG-06) — View 교체 / fontWeight 단일화 등 후보 시도
5. cron 전체 활성화 (검증 통과 후)

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

전체 이력은 `docs/archive/`:
- `01_v1.0.1_v1.0.4_이력.md` — Phase 1 인프라 + 핵심 기능 + v1.0.1~v1.0.4 버그 수정
- `02_v1.0.5_이력.md` — Firebase jigumiya 통합 + 계정 삭제 + Phase 3 골격 + 알림 패치
- `03_v1.0.6_vc67_vc70_이력.md` — BUG-41/42/43 + AIGO-BUG-01 (Android+iOS 로그인) 완전 해결
- `04_v1.0.6_vc72_vc78_이력.md` — Apple Sign In + 로그아웃 + 칩 작업
- `05_외부지식_쿠팡_iOSWebView.md` — 쿠팡 Rate Limit + iOS WebView 노하우
