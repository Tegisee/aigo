# 아이고 (AIGO) - 메인 컨텍스트

## 중요: 새 대화창 시작 방법
~/aigo/aigo/docs/000_MD_사용법.md 와 이 파일을 먼저 읽을 것.
작업할 항목의 sub MD도 함께 읽고 시작할 것.

## 프로젝트 개요
- 앱 이름: 아이고 (AIGO)
- 슬로건: "내 아이 것은 내가 고른다"
- 컨셉: 육아용품 전문 쿠팡 최저가 추적 알림 앱
- 번들 ID: com.aigo.app (예정)
- 자매 앱: 지금이야 (Jigumiya) — 범용 가격 추적 앱

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
| - | 버그 및 개선 목록 (31+10개 항목) | ✅ 41/41 | 012_버그및개선목록.md |

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
- 파트너스 계정: 지금이야와 동일 계정 사용 가능

## 현재 상태: v1.0.6 vc71~vc78 반복 빌드 진행 중 (2026-05-02 ~ 05-03)
- 마지막 코드 상태: 커밋 `d83de23` (refactor: 관심상품 칩 ScrollView 단순화)
- vc72에서 핵심 기능(오늘의 육아템 + 로그아웃 + Apple Sign In) 통합 완료, 이후 vc73~vc78은 발견된 버그/UX 개선 반복 빌드

### vc72 핵심 기능 4종 (a9d44cb)
- **오늘의 육아템 섹션 신설** (홈 탭): shared_products 가격 하락순 + category_best_baby fallback, 1h AsyncStorage 캐시. `fetchSharedPriceDrops`/`fetchBabyCategoryBestPool` 신규
- **관심상품 탭 자녀 칩 버튼 높이 통일 1차 시도**: `height:36 + paddingVertical:0` (이후 vc74~vc78에서 반복 재시도, 최종 미해결 — AIGO-BUG-06)
- **로그아웃 기능 추가** (설정 화면): 외부 계정(구글/Apple) 사용자 한정. `signOutGoogle/Apple + signOutFirebase + 로컬 정리`. Firestore 데이터는 보존 → 다음 로그인 시 자동 복원
- **Apple Sign In 구현** (iOS only): `expo-apple-authentication` + `expo-crypto`(nonce SHA256) + Firebase `OAuthProvider('apple.com')`. 온보딩/로그인/설정/계정삭제 4곳 분기. `app.config.js` `usesAppleSignIn:true`

### vc73 — isLinked 3겹 방어 + updateCheck 보강
- **isLinked 미동기화 3겹 방어** (`e520e2e`): Android 구글 로그인 사용자 설정화면 로그아웃 버튼 미표시 버그 수정 — restore.ts restoreKeys에 isLinked/linkedProvider 추가 + _layout.tsx subscribeAuthState 콜백에 store↔Firebase auth 자동 동기화 + settings.tsx `effectiveLinked` 이중 안전망
- **updateCheck 보강** (`cef9f1e`): App Store ID `'6762362777'` 채움 + 스토어 web fallback (`market://` 실패 시 `https://play.google.com/store/apps/details?id=com.aigo.app` 재시도) + `updateMessage` 필드 우선 표시 (운영자 Firestore Console에서 커스텀 안내문구 노출 가능)

### vc74~vc78 — 관심상품 칩 높이 반복 수정 (AIGO-BUG-06, 미해결)
- 증상: 전체/아이1/아이2 칩 선택/미선택 시 세로 높이 미세 변동, '전체' 선택 시 위쪽 가장자리 잘림 등
- 시도 5회 (모두 부분 해결, 완전 해결 못함) — 상세는 아래 ⚠️ TODO 섹션 참조
- 칩 작업 일단 중단, 마지막 코드 상태 `d83de23` (단순화 버전)

### ⚠️ TODO — 관심상품 탭 자녀 칩 높이 흔들림 (미해결)
- 증상: 전체/아이1/아이2 칩 선택/미선택 시 세로 높이가 미세하게 변동, '전체' 버튼 선택 시 위쪽 가장자리 잘림 등
- 시도 이력 (5회 모두 부분적 해결, 완전 해결 못함):
  1. `9bf97f4` 칩 자체 height:36 + lineHeight:16 + includeFontPadding:false + textAlignVertical:'center'
  2. `81dc5d7` active 스타일에도 height/minHeight/maxHeight 36 강제 + active text에도 lineHeight:16 명시
  3. `3f9b440` ScrollView style.height:44 + flexGrow:0 + marginBottom:16 외부 height 고정
  4. `b88a9b8` ScrollView height 44→50 + contentContainer paddingVertical:4 (전체 칩 잘림 보고로 확장)
  5. `d83de23` height 고정 방식 모두 버리고 단순화 — flexGrow:0 + paddingVertical:8 + marginBottom:8, contentContainer는 paddingHorizontal/flexDirection/alignItems만, 칩 자체 height:36은 유지
- 가설: fontWeight '500'↔'600' 전환 시 폰트 라인 메트릭이 자식 → 부모로 전파되는 RN/Android 빌드 특이 케이스. 또는 ScrollView contentContainer cross-axis stretch 동작이 의도와 다름
- 다음 시도 후보: 칩을 ScrollView 대신 `<View style={flexDirection:'row'}>`로 교체 (가로 스크롤 포기 — 아이 2~3명 시 화면 폭 충분), Pressable + 자체 onLayout 측정으로 padding 강제 보정, 또는 fontWeight 차이 제거(둘 다 '600' 또는 '500' 통일)

### 스토어 진행 상황 (2026-05-02)
- **App Store**: vc70 빌드로 새 버전 제출 완료 — Apple Sign In 활성 + **시연영상 첨부**하여 심사 제출. Apple 회신 대기
- **Google Play**: 프로덕션 액세스 신청 완료 — Google 검토 대기 (Play Console 14일 베타 충족 별도 요건)

### 다음 작업
- 시뮬레이터에서 vc78 (`d83de23`) 검증 — 자연 흐름 레이아웃이 시각적으로 OK인지 확인 후 칩 작업 종료 가능
- Apple Sign In 외부 작업 (Firebase Console > Authentication > Apple 활성화 + Apple Developer Capabilities) — App Store 제출(vc70) 회신 전 점검
- Play Console 프로덕션 액세스 승인 후 vc72+ 프로덕션 승급
- 칩 높이 작업 재개 (AIGO-BUG-06) — View 교체 / fontWeight 단일화 등 후보 시도

## 이전 상태: v1.0.6 vc69(Android) + vc70(iOS) 로컬 빌드 완료 (2026-05-01)
- **AIGO-BUG-01 완전 해결** (Android DEVELOPER_ERROR + iOS `requests-from-this-ios-client-application-<empty>-are-blocked`)
- iOS root cause: GCP `AIzaSy...KQ5Ho` API Key "iOS 앱 제한" 활성 + firebase-js-sdk가 RN에서 `X-Ios-Bundle-Identifier` 헤더 미부여 → "Bundle ID `<empty>`" 차단. 제한 해제로 해결
- Android root cause: aigo-a 프로젝트에 `com.aigo.app + SHA-1` OAuth 클라이언트 잔존 → Google OAuth 글로벌 정책상 `(SHA-1, 패키지명)` 동일 조합은 단일 GCP 프로젝트만 점유 가능 → jigumiya 측 OAuth Android 클라이언트 자동 생성 차단
- 해결 절차: aigo-a > Android/iOS 앱 삭제 → jigumiya Firebase Console SHA-1 토글 트리거 → GCP에 `Android client for com.aigo.app` 2개 자동 생성 → 새 google-services.json 다운로드 (oauth_client에 client_type:1 항목 추가) → vc68 빌드 (Play Console versionCode 충돌로 폐기) → vc69 재빌드
- 커밋 `30d2245` (fix: AIGO-BUG-01 ...) + 본 커밋 (versionCode 68→69 + CLAUDE.md)
- Android AAB: ~/aigo/builds/android/aigo-v1.0.6-vc69.aab
- iOS IPA: ~/aigo/builds/ios/aigo-v1.0.6-vc70.ipa
- ⚠️ Play App Signing 키 SHA-1 미확인 — Play Console 내부테스트 배포 후 재서명 키로 SHA-1 매칭 안 되면 추가 등록 필요
- 다음 작업: Play Console 내부테스트 vc69 업로드 → 외부 테스터 검증 → cron 전체 활성화 → 프로덕션 승급 → App Store 심사 제출

## 이전 상태: v1.0.6 vc67 로컬 빌드 완료 (2026-04-30)
- BUG-41 (재설치 후 구글 로그인 데이터 복원 실패) 수정 — restore.ts children[] 마이그레이션 + hasMeaningfulSettings 분기
- BUG-42 (쿠팡 공유 → 상품추가 무한로딩) 수정 — 자동 handleNext + useFocusEffect 가드 + Functions 워밍업 + 타임아웃
- BUG-43 (Android 구글 로그인 DEVELOPER_ERROR) 1차 수정 — Firebase Console jigumiya 프로젝트 SHA-1 4개 등록 (실제 OAuth 클라이언트 자동 생성은 vc69에서 완전 해결)
- IMPROVE-B 완료 — 온보딩 "매일 6회 자동 가격 확인" → "가격 변동 시 즉시 알림"
- 월령별 가격 변동 알림 cron 신설 (scripts/baby-category-notifier, 04:00 KST 비활성)
- stroller 슬러그 강아지/반려견/애완견 필터 추가
- 앱 측 푸시 알림 라우팅 분기 추가 (screen=detail/baby-category/price-drops/home)
- 두 레포(아이고 + 지금이야) Public 전환 완료
- Google Cloud API Key 제한 설정 (vc69에서 iOS 제한은 해제 — firebase-js-sdk 충돌)

## 이전 상태: v1.0.5 vc66 로컬 빌드 완료 (2026-04-28)
- Phase 3 월령 세분화 cron 적재 완료 (baby 538 상품 + event 55 상품)
- Firestore Rules 통합 (jigumiya 단일 소스) + 배포 완료
- 알림 버그 가설 A/C/E 3건 모두 패치 (FCM SA 교체 + channelId/priority + savePushToken retry)
- 업데이트 알림 기능 추가 (services/updateCheck.ts + meta/config_aigo)
- 홈 이벤트 배너 → event_best 실데이터 연동
- iOS 실기기 테스트 완료 (2026-04-28): 카테고리/기념일 추천 + 계정 삭제 정상 / BUG-41,42,43 + IMPROVE-A,B 발견

## 이전 상태: v1.0.5 vc63 로컬 빌드 완료 (2026-04-26)
- Firebase 프로젝트 jigumiya 통합 완료 (자매 앱과 백엔드 일원화)
- Android AAB: ~/aigo/builds/android/aigo-v1.0.5-vc63.aab

## 이전 상태: v1.0.4 (vc41) 비공개 테스트 준비 (2026-04-13)

### Google Play
- 스토어: https://play.google.com/store/apps/details?id=com.aigo.app
- GitHub: https://github.com/Tegisee/aigo (Private)
- 현재 버전: 1.0.4 (버전 코드 41)
- 비공개 테스트: v1.0.4 빌드 제출 준비 중
- 테스터 그룹: aigo_app@googlegroups.com
- 상세: docs/014_구글플레이셋팅.md

### 완료된 작업
**인프라**
- ✅ Firebase 프로젝트 (aigo-a) + google-services.json / GoogleService-Info.plist
- ✅ EAS 프로젝트 ID (caf70306-f2c6-40d7-8e12-817fa67b6477)
- ✅ app.config.js 플랫폼별 appId + intentFilters + withAndroidQueries
- ✅ .env 쿠팡 파트너스 키 + 공공데이터 API 키 + EAS Secret 등록
- ✅ git init + .env gitignore + GitHub Private 레포
- ✅ 앱 아이콘 + splash + favicon + 배너 교체 완료
- ✅ 개인정보처리방침: https://dafamstore.tistory.com/11
- ✅ Google Play Console 등록 + 스토어 등록정보 완료
- ✅ EAS production 빌드 v1.0.0 ~ v1.0.3
- ✅ 로컬 빌드 환경 설정 (ANDROID_HOME + JAVA_HOME)

**핵심 기능 (012_버그및개선목록 전체 완료)**
- ✅ 온보딩 리뉴얼 (이름/성별/생년월일 캘린더 + children[] 동시 저장)
- ✅ 홈화면 개편 (닉네임+월령+D-Day+카테고리+이벤트배너+추천상품)
- ✅ 하단 탭 4개 (홈/육아정보/관심상품/설정)
- ✅ 월령별 동적 카테고리 (6개 연령 구간, add-item 포함 전면 통일)
- ✅ shared_products 공유 가격 구조 (trackerCount + purchaseCount + 인기상품 연동)
- ✅ 관심상품 삭제 UI (스와이프+롱프레스) + 복수 아이 귀속/필터
- ✅ 구매목록 + 재구매 자동 소진일 계산 (소모품 카테고리)
- ✅ 감성 공유 멘트 선택 + 직접 입력 바텀시트
- ✅ 구글 로그인 실제 연동 (@react-native-google-signin + Firebase Auth)
- ✅ 복수 아이 지원 (추가/수정/삭제/선택 + 아이 전환 시 전체 초기화)
- ✅ 기념일 D-Day / 시즌 컬렉션 / 부모 자축 배너 + 탭 시 추천 상품
- ✅ 육아정보 탭 (예방접종/건강검진 날짜 기록+항목 추가, 정부 지원금 아코디언)
- ✅ 부모 정보 (엄마/아빠 생일 양력·음력 DatePicker, 결혼기념일)
- ✅ KeyboardAvoidingView 전체 모달 적용
- ✅ Firebase sanitize + Hook 오류 + 데이터 초기화 강화
- ✅ DatePickerButton 캘린더 컴포넌트 (모든 날짜 입력)

**v1.0.1 버그 수정 (04-05)**
- ✅ BUG-1~4: 온보딩 아이콘 📉 → assets/icon.png 교체
- ✅ BUG-2: 온보딩 버튼 레이아웃 (ScrollView 밖 고정)
- ✅ BUG-3: 예시 이미지 placeholder 처리
- ✅ BUG-6: 직접입력 무한 떨림 (CoupangScraper 조건부 렌더링)
- ✅ BUG-7: 아이 정보 중복 (children.length === 0 체크)
- ✅ BUG-8: 삭제 버튼 오작동 (행 View + 독립 핸들러)
- ✅ BUG-9: 부모 날짜 DatePicker 교체
- ✅ BUG-10: 접종/검진 추가 항목 날짜 입력
- ✅ 개인정보처리방침 외부 URL 연동
- ✅ 쿠팡 딥링크 intentFilters + withAndroidQueries 추가

**v1.0.3 버그 수정 + 개선 (04-09)**
- ✅ BUG-11,12: 연결 프로그램 선택창 → 쿠팡 앱 딥링크 우선 + WebView link.coupang.com 차단
- ✅ BUG-13: 구글 로그인 재설치 → signInWithCredential fallback
- ✅ BUG-14,17: 추천 상품 미표시 → API 키 없을 때 안내 개선 + 이벤트 빈 결과 처리
- ✅ BUG-15: 삭제 상품 추천 노출 → trackerCount > 0 필터
- ✅ BUG-16: 홈↔관심상품 아이 선택 불일치 → selectChild 동기화
- ✅ BUG-18: 접종 날짜 출생일 이전 입력 → DatePicker minimumDate
- ✅ BUG-19: 접종 항목 추가 시 날짜 모달 자동 열기
- ✅ BUG-20: 육아정보 연도 하드코딩 → 동적 처리
- ✅ IMPROVE-1: 앱 공유 스토어 링크 추가
- ✅ IMPROVE-3: 구매이력 안내 문구 추가
- ✅ IMPROVE-4: 예방접종 미접종 푸시 알림 (가격 체크 봇 21시)
- ✅ IMPROVE-5: 접종/검진 병원명 입력 필드 추가

**v1.0.3 추가 수정 (04-09 오후)**
- ✅ BUG-21: notificationEnabled 덮어쓰기 → _layout.tsx updateUserSettings 제거, 단일 경로 저장
- ✅ BUG-22: lastVaccineAlertDate 조기 기록 → 실제 발송 후에만 기록
- ✅ BUG-23: expoPushToken projectId fallback + 저장 재시도 추가
- ✅ GitHub Actions force_night_run 옵션 추가
- ✅ 쿠팡 productId 매칭 실패 시 가격 근접 매칭 fallback 추가
- ✅ Firestore Rules purchaseCount 업데이트 허용 추가

**v1.0.4 코드 수정 완료 (04-10)**
- ✅ BUG-29: 재설치 온보딩 → expo-secure-store 설치 마커 + Zustand rehydration 대기 + allowBackup:false
- ✅ BUG-27,28: 접종/검진 플로우 → DatePicker dismissed 체크 + 날짜→병원명→확인 3단계, 취소 시 미저장
- ✅ BUG-26: 기념일 탭 반응 없음 → anniversary keywords 추가 + shared_products fallback
- ✅ BUG-24: 음력 생일 → korean-lunar-calendar 음력→양력 변환
- ✅ BUG-25: 기념일 서비스 준비 중 → BUG-26+ENV-1로 해결

### v1.0.4 vc13 테스트 결과 (04-11)
**✅ 정상 확인**: BUG-31(온보딩 레이아웃), BUG-32(필수 입력), BUG-24(음력 D-Day)

### v1.0.4 vc22 완료 (04-12)
- ✅ BUG-12, BUG-23, BUG-30, BUG-33, BUG-34, BUG-35, ENV-1 완료

### v1.0.4 vc41 완료 (04-13)
- ✅ ENV-2: 구글 로그인 데이터 복원 — clearLocalData Firebase Auth 키 보존 + 자동 복원 흐름 수정
- ✅ BUG-38: 다자녀 접종/검진 데이터 독립 관리 (childId::key prefix)
- ✅ BUG-40: 관심상품 탭 아이별 월령 카테고리 독립 (홈 selectedChildId와 분리)
- ✅ 공유상품 성별 필터링 (SharedProduct gender 필드 + fetchPopularByCategory 필터)
- ✅ 기념일 추천 상품 수정 (shared_products fallback 제거, 쿠팡 API 전용)
- ✅ 발렌타인데이/화이트데이/핼러윈 기념일 추가
- ✅ 기념일 키워드 선물 중심 재배치
- ✅ 디버그 Alert 전체 제거 (OnboardingScreen, login.tsx, settings.tsx)

### v1.0.4 vc42 완료 (04-14)
- ✅ 근접 매칭 fallback 제거 (coupang-api.ts) — 다른 상품 오매칭 거짓 알림 차단
- ✅ API 디버그 로그 추가 (coupang-api.ts) — productId 불일치 원인 추적 가능
- ✅ inspect-output submodule 참조 제거 + gitignore — Actions exit code 128 해결
- ✅ FCM 토큰 갱신 로직 보강 — uid 확보 후 등록 + 재시도 5회 확대 + Firestore 저장 실패 재시도
- ✅ 스크래핑 전환 검토 → 쿠팡 GitHub Actions IP 차단 확인 → 파트너스 API 유지 결정
- ✅ 파트너스 API 구조적 한계 확인: productId 기반 조회 불가, 매칭률 57% (7개 중 4개)

### 남은 TODO

**✅ 완료 (2026-04-29 ~ 04-30, vc67 반영)**
- **BUG-41**: 재설치 후 구글 로그인 시 아이정보 복원 실패 — 커밋 `6c37165` (restore.ts children[] 마이그레이션 + hasMeaningfulSettings 분기)
- **BUG-42**: 쿠팡 공유 → 상품추가 무한로딩 — 커밋 `4f8b338` (자동 handleNext, useFocusEffect 가드, timeoutRef cleanup, Functions 워밍업, 타임아웃)
- **BUG-43**: Android 구글 로그인 DEVELOPER_ERROR 1차 시도 — Firebase SHA-1 4개 등록 (vc69에서 aigo-a OAuth 충돌 정리로 완전 해결)
- **IMPROVE-B**: 온보딩 "매일 6회 자동 가격 확인" → "가격 변동 시 즉시 알림" — 커밋 `1eeab82`

**✅ 완료 (2026-05-01, vc69+vc70 반영)**
- **AIGO-BUG-01**: Android DEVELOPER_ERROR + iOS Bundle ID `<empty>` 차단 — 커밋 `30d2245` + `34e7412`
  · iOS: GCP `AIzaSy...KQ5Ho` API Key "iOS 앱 제한" 해제 (firebase-js-sdk가 RN에서 `X-Ios-Bundle-Identifier` 미부여)
  · Android: aigo-a 프로젝트 com.aigo.app Android/iOS 앱 삭제 → jigumiya SHA-1 토글로 GCP OAuth 자동 생성 트리거 → 새 google-services.json 갱신 (Android OAuth 2개 추가)
- **AIGO-BUG-02**: 추천상품 미표시 — AIGO-BUG-01 부수 해결 (구글 로그인 정상화로 인증 토큰 발급 → category_best_baby/event_best 정상 read)
- **AIGO-BUG-03**: 추천상품 후속 이슈 — AIGO-BUG-01 부수 해결

**🟠 P1 — vc69(Android)+vc70(iOS) 비공개 테스트 검토 중**
- AIGO-BUG-01/02/03 모두 vc69+vc70 반영
- Play Console 비공개 테스트 vc69 업로드 완료, **검토 단계 (대기)**
- iOS vc70 Transporter 업로드 + App Store 심사 정보 회신 대기

**🟡 P2 — UX 개선**
- **IMPROVE-A**: 설정화면에 로그인된 구글 계정 이메일/이름 표시 (iOS/Android 공통)
- **AIGO-BUG-04**: 와우회원 필드 (사양 정리 필요)
- **AIGO-BUG-05**: 익명 로그인 사용자에게 구글 연동 가능 표기 (UX 명확화)

**🟡 P2 — 기존 UX 버그**
- **BUG-36**: 접종 리스트 등록 후 나중에 체크 기능
- **BUG-37**: 월령별 추천 카테고리 복수선택 해제 안 됨
- **BUG-39**: 구글 로그인 데이터 복원 간헐적 미적용 (AIGO-BUG-01 해결로 자동 잔존 여부 vc69 검증 결과로 판단)
- **AIGO-BUG-06**: 관심상품 탭 자녀 칩 높이 흔들림 (vc73~vc78 시도 5회 미해결) — fontWeight '500'↔'600' 전환 시 폰트 라인 메트릭 변동 추정. 다음 시도 후보: ScrollView → 일반 View(가로 스크롤 포기) / Pressable + onLayout 측정 / fontWeight 단일화. 상세는 위 "현재 상태" TODO 섹션 참조

**🟡 P2 — Phase 3 UI 후속**
- 앱 측 baby-category 탭 라우팅 구현 — 푸시 알림 `screen=baby-category` + slugs 도착 시 홈 탭에서 해당 월령별 카테고리 섹션으로 자동 스크롤/하이라이트
- 가격 하락 알림 도착 시 사용자 동선(홈 → 카테고리 → 상품 카드) UX 개선

**🟡 P2 — 출시**
- 비공개 테스트 검토 완료 → Play Console 프로덕션 승급
- iOS vc70 Transporter 업로드 + App Store 심사 정보 회신
- AIGO-BUG-04 / AIGO-BUG-05 수정 후속 빌드
- cron 전체 활성화 (검증 통과 후)

**🟢 낮음**
- 육아정보 API 2단계 (L)

### iOS 실기기 정상 확인 (2026-04-28)
- ✅ 월령별 카테고리 추천상품 Firebase에서 정상 로드
- ✅ 기념일 추천상품 Firebase에서 정상 로드 (event_best)
- ✅ 계정 삭제 흐름 정상 (구글 재인증 → Firestore/Auth 정리 → 온보딩 복귀)

**다음 단계**:
1. BUG-41 / BUG-42 / BUG-43 수정 → vc67 재빌드
2. 가격 체크 + 알림 설계 최종 확정 (시간대 협의 후)
3. cron 전체 활성화
4. Android Play Console 내부테스트 → 프로덕션 승급
5. iOS App Store 심사 제출 (Apple 회신 반영)

---

## 가격 체크 cron 관리 정책 (2026-05-02 확정)
- **단일 관리 위치**: 가격체크 cron은 지금이야 레포(`~/jigumiya`)에서 단일 관리 중. 아이고 레포에 별도 cron 없음.
- **설계 문서**: `~/jigumiya/jigumiya/docs/020_PriceChecker_CronDesign.md` (지금이야 레포)
- **공유 컬렉션**: shared_products / category_best_baby / event_best 모두 jigumiya 프로젝트에 적재 → 양 앱이 read만 수행
- **아이고 cron 활성화 시점**: 지금이야 cron 안정화 후 진행 예정 (현재 비활성 유지)

---

## 가격 체크 + 알림 설계 (2026-04-28 초안, 내일 재논의)

### shared-price-checker (단일 통합 cron)
- **공유 범위**: 지금이야 + 아이고 shared_products 동일 컬렉션 사용 → 단일 cron으로 양 앱 커버
- **사이클 자동 계산**: `meta/stats.sharedProductCount` 읽어서 동적 sleep 간격 결정
  - 계산식: `전체상품수 ÷ 40회/분 = 1사이클 소요분`, 가용시간(20.5h) 내 자동 반복
- **호출 속도**: 분당 최대 40회 (한도 50/분 대비 안전 마진)
- **운영 시간**: 04:30 ~ 01:00 KST (익일) — 카테고리 업데이트 시간대(01:00~04:30) 제외
- **rate-limited 감지**: 즉시 중단, 당일 재실행 없음 (다음날 04:30 정상 재개)

### 알림 발송 (하루 3회 고정)
- **시간대 미확정** (내일 협의) — 후보: 08:00 / 13:00 / 20:00 KST
- 각 발송 시점까지 누적된 가격 하락 상품 모아서 한 번에 발송
- 가격 변동 없을 때 처리 방식 미확정 ("오늘은 가격 변동이 없었어요" 알림 여부)

### 내일 재논의 항목
- 알림 발송 시간대 3회 확정
- 가격 변동 없을 때 알림 정책
- 온보딩 "매일 N회 가격 알림" 문구 최종 확정 (IMPROVE-B 연동)
- 전체 cron 스케줄 최종 검토 후 활성화 여부

### EAS 빌드 크레딧
- 현재: 100% 소진 (리셋: 2026-04-21)
- 로컬 빌드: `cd ~/aigo/aigo && eas build --local --profile production --platform android`

## 지금이야 대비 차별화 포인트
1. 육아용품 전문 (범용 X)
2. 아이 나이별 카테고리 자동 분류
3. 소모품 재구매 주기 알림
4. 육아맘/육아대디 감성 UI (따뜻한 톤)
5. 안전 인증 마크 표시 (KC 인증 등)

## 주요 기술 현황 (지금이야에서 검증 완료, 그대로 재사용)
- React Native + Expo SDK 55 + TypeScript
- Zustand + AsyncStorage persist
- Firebase Firestore + Anonymous Auth
- CoupangScraper (WebView DOM 스크래핑)
- 쿠팡 파트너스 API (HMAC 서명 + 딥링크)
- GitHub Actions 가격 체크 봇 (3회/일)
- Expo Push Notifications (FCM V1)
- EAS Build (iOS + Android)

## 빌드 아티팩트
- 네이밍: `aigo-v{version}-vc{versionCode}.{aab|apk|ipa}`
- 버전 관리 규칙: docs/016_버전관리규칙.md
- 저장 위치:
  - Android: `~/aigo/builds/android/`
  - iOS: `~/aigo/builds/ios/`

## 빌드 파일 관리 규칙
- **Android AAB**: `~/aigo/builds/android/aigo-v{버전}-vc{버전코드}.aab`
  - 예: `aigo-v1.0.4-vc49.aab`
- **iOS IPA**: `~/aigo/builds/ios/aigo-v{버전}-vc{버전코드}.ipa`
  - 예: `aigo-v1.0.4-vc49.ipa`
- 빌드 완료 후 **반드시** 위 규칙으로 파일명 변경 후 해당 폴더로 이동
  - Android: `mv ~/aigo/aigo/build-[타임스탬프].aab ~/aigo/builds/android/aigo-v1.0.4-vc{N}.aab`
  - iOS: `mv ~/aigo/aigo/build-[타임스탬프].ipa ~/aigo/builds/ios/aigo-v1.0.4-vc{N}.ipa`
- **빌드 로그**:
  - Android: `~/aigo/builds/android/build-log-android.txt`
  - iOS: `~/aigo/builds/ios/build-log-ios.txt`
  - `tee` 옵션으로 실시간 기록 (예: `eas build ... 2>&1 | tee ~/aigo/builds/android/build-log-android.txt`)

## 앱 기본 정보
- 앱 이름: 아이고 (AIGO)
- 번들 ID: com.aigo.app
- 프로젝트 경로: ~/aigo/aigo
- 카테고리: 쇼핑/육아/유틸리티
- 개인정보처리방침: https://dafamstore.tistory.com/11

## 형제 앱
- 아이고와 지금이야(~/jigumiya/jigumiya)는 형제 앱 관계
- 동일 개발자, 동일 기술 스택 (React Native, Expo, Firebase)
- 한 앱에서 해결한 문제/노하우는 다른 앱에 이식 가능
- iOS 로컬 빌드 세팅은 지금이야 참고 (fastlane, .easignore 설정 등)
- Android 로컬 빌드 세팅 동일하게 적용 가능

## 빌드 완료 시 응답 형식 (Claude AI 참고)

빌드 성공 시 항상 아래 형식으로 응답:

1. 🎉 빌드 성공! (이모지 포함)
2. AAB 이동 명령어 코드블록:
   mv ~/aigo/aigo/build-[타임스탬프].aab ~/aigo/builds/android/aigo-v[버전]-vc[버전코드].aab
3. "Play Console 올리고 테스트해요! 출시노트:" 문구
4. 출시노트 코드블록 (수정 내용 요약, 3~5줄)
5. 출시명 확인 후 MD 업데이트 제안

## 현재 빌드 이력
- v1.0.4 vc26 (2026-04-13) - 재설치 시 구글 로그인 데이터 복원 개선
- v1.0.4 vc41 (2026-04-13) - ENV-2/BUG-38/BUG-40 수정, 성별 필터, 기념일 개선, 디버그 제거
- v1.0.4 vc42 (2026-04-14) - 근접 매칭 제거, API 디버그 로그, 토큰 갱신 보강, submodule 정리
- v1.0.5 vc62 (2026-04-20) - 로컬 빌드 완료, AQ-3/AQ-4 수정 후 vc63 재빌드 예정 (vc62 폐기)
- v1.0.5 vc63 (2026-04-26) - Firebase jigumiya 통합 + 계정 삭제 + price-checker 캐시 + BabyCategory cron + 쿠팡 직접 호출 제거
- v1.0.5 vc66 (2026-04-28) - Phase 3 월령 세분화 + event-best-updater + 알림 버그 3건 + 업데이트 알림 + 홈 event_best 연동
- v1.0.6 vc67 (2026-04-30) - BUG-41/42/43 + IMPROVE-B 완료, baby-category-notifier 신설, stroller 강아지 필터, 푸시 라우팅 분기, 두 레포 Public 전환
- v1.0.6 vc68 (2026-04-30) - 폐기 (Play Console versionCode 충돌, AIGO-BUG-01 1차 수정 빌드)
- v1.0.6 vc69 (2026-05-01) - Android, AIGO-BUG-01 완전 해결 (aigo-a OAuth 충돌 정리 + google-services.json 갱신)
- v1.0.6 vc70 (2026-05-01) - iOS, AIGO-BUG-01 완전 해결 (Android와 동일 변경)
- v1.0.6 vc72 (2026-05-02) - 오늘의 육아템 섹션 + 칩 통일 1차 + 로그아웃 + Apple Sign In
- v1.0.6 vc73 (2026-05-02) - isLinked 3겹 방어 (Android 로그아웃 버튼 수정) + updateCheck 보강 (App Store ID 6762362777 + web fallback + updateMessage)
- v1.0.6 vc74~vc78 (2026-05-02) - 관심상품 칩 높이 반복 수정 (5회 시도, 미해결 — AIGO-BUG-06)

## 2026-05-02 후속 작업 이력 (v1.0.6 vc73~vc78 + 스토어 제출)

### vc73 — isLinked 미동기화 3겹 방어 (커밋 `e520e2e`)
**증상**: Android 구글 로그인 사용자가 설정 화면에서 로그아웃 버튼을 볼 수 없음.

**원인**: `store.isLinked`가 false로 남는 두 구멍 — (1) `services/restore.ts` `restoreKeys` 화이트리스트에 `isLinked`/`linkedProvider` 누락 → Firestore에 저장돼 있어도 클라가 안 읽어옴, (2) `app/_layout.tsx` `subscribeAuthState` 콜백이 `providerData`를 보고 store를 자동 갱신하지 않음. 재설치/AsyncStorage 클린업 후 발현.

**수정**:
1. `services/restore.ts:134` `restoreKeys`에 `'isLinked','linkedProvider'` 추가 — 다음 복원부터 자동 해결
2. `app/_layout.tsx:339-356` `subscribeAuthState` 콜백에 `info.providers` 검사 후 `useAppStore.setState({ isLinked, linkedProvider })` 자동 동기화 (Firestore read 0회, providerData만 검사)
3. `app/(tabs)/settings.tsx` `effectiveLinked = isLinked || (getAuthState().provider !== null && !isAnonymous)` 이중 안전망 + 계정 카드/로그아웃 분기 모두 effective 값으로 교체

### vc73 — updateCheck 보강 (커밋 `cef9f1e`)
지금이야 `services/updateChecker.ts` 패턴 참고하여 3종 보강:
1. **iOS App Store ID** `'6762362777'` 채움 (`app/_layout.tsx:300`) — 기존 `undefined` TODO 제거. iOS에서 `itms-apps://apps.apple.com/app/id6762362777` 딥링크 활성화
2. **스토어 web fallback** — `UpdateCheckResult.storeUrlFallback` 필드 추가, `getStoreUrls()`가 `{primary, fallback}` 반환. `_layout.tsx` 신규 `openStoreUrl(primary, fallback)` 헬퍼 — `canOpenURL(primary)` 실패 시 `https://play.google.com/store/apps/details?id=com.aigo.app` (또는 `https://apps.apple.com/app/id6762362777`)로 자동 재시도. Play Store 미설치/iOS 시뮬레이터 케이스 대비
3. **`updateMessage` 필드 우선 표시** — `AppConfigDoc.updateMessage?: string` + `UpdateCheckResult.updateMessage?` 추가. 본문 우선순위: `updateMessage > releaseNotes > 기본문구`. Firestore `meta/config_aigo`에서 운영자가 케이스별 커스텀 안내 가능 (예: "긴급 보안 업데이트", "성능 개선 패치")

### vc74~vc78 — 관심상품 칩 높이 흔들림 반복 수정 (AIGO-BUG-06, 미해결)
**증상**: 관심상품 탭의 전체/아이1/아이2 칩이 선택/미선택 상태에서 세로 높이가 미세하게 변동, '전체' 선택 시 위쪽 잘림 등.

**시도 이력 5회** (모두 부분 해결, 완전 해결 못함):
1. `9bf97f4` 칩 자체 `height:36` + `lineHeight:16` + `includeFontPadding:false` + `textAlignVertical:'center'` 등 텍스트 박스 모델 강제
2. `81dc5d7` `childFilterChipActive`에도 `height/minHeight/maxHeight 36` 강제 + Active 텍스트도 `lineHeight:16` 명시 (3겹 강제)
3. `3f9b440` ScrollView `style.height:44` + `flexGrow:0` + `marginBottom:16` 외부 height 고정 + contentContainer `alignItems:'center'`
4. `b88a9b8` ScrollView `height` 44→50 + contentContainer `paddingVertical:4` (전체 칩 잘림 보고로 확장)
5. `d83de23` height 고정 방식 모두 버리고 자연 흐름 단순화 — `flexGrow:0 + paddingVertical:8 + marginBottom:8`만, 칩 자체 `height:36`은 유지

**가설**: fontWeight `'500'`↔`'600'` 전환 시 폰트 라인 메트릭(ascender/descender) 변동이 자식 → 부모로 전파되는 RN/Android 빌드 특이 케이스. 또는 ScrollView contentContainer cross-axis 동작 차이.

**다음 시도 후보** (작업 재개 시):
- ScrollView → 일반 `<View style={{flexDirection:'row'}}>`로 교체 (가로 스크롤 포기, 아이 2~3명 시 화면 폭 충분)
- `Pressable` + `onLayout` 측정으로 padding 강제 보정
- fontWeight 단일화(둘 다 `'600'` 또는 `'500'`) — 시각적 active 강조는 색상으로만

**현재 상태**: 작업 일단 중단, 마지막 코드 `d83de23`. AIGO-BUG-06으로 P2 등록.

### 스토어 제출 (외부 작업)
- **App Store**: vc70 빌드로 새 버전 제출 완료. Apple Sign In 활성화 후 **시연영상 첨부**하여 심사 제출 (Apple Sign In 동작 확인용). Apple 회신 대기
- **Google Play**: **프로덕션 액세스 신청 완료**. Google 검토 대기 (14일 베타 충족 등 별도 요건 충족 검증)

---

## 2026-05-02 작업 이력 (v1.0.6 vc72)

### 1. 오늘의 육아템 섹션 신설 (홈 탭)
- **services/firebase.ts**:
  - `BabyPriceDrop` 인터페이스 + `fetchSharedPriceDrops(maxItems, scanLimit, gender)` — shared_products `lastCheckedAt desc` 100건 1회 read → 클라에서 `currentPrice < previousPrice` 필터 + `dropRate` 오름차순 정렬 (Firestore 필드 비교 쿼리 불가)
  - `fetchBabyCategoryBestPool(categories, perCategory, gender, months)` — 월령 카테고리 슬러그 병렬 read, productId 중복 제거
- **app/(tabs)/index.tsx**:
  - `DEALS_TARGET=20`, `DEALS_CACHE_KEY='home-baby-deals-cache'`, `DEALS_CACHE_TTL_MS=1h`, `BEST_POOL_PER_CATEGORY=5`
  - useEffect: AsyncStorage 1h 캐시 → 미스 시 두 함수 `Promise.all` 병렬 fetch (`childId` / `babyMonths` / `babyGender` 의존)
  - `deals` useMemo: drop 우선 + best pool fallback, `productId` 중복 제거
  - `handleBuyDrop`/`handleBuyBest`: `generateDeepLink(vp/products/{productId})` 우선 → 실패 시 productUrl 또는 vp URL 직접 (지금이야 fallback 체인 그대로)
  - UI 위치: 자녀 선택 칩 아래 + 이벤트 배너 위 (지금이야 '오늘의 특가' 패턴 미러링)
  - 빈 상태 안내: "아직 가격 변동 데이터가 부족해요. 가격이 내려가면 바로 알려드릴게요!"
- **price_drops 컬렉션 미이식** 대안: shared_products 직접 쿼리. Phase 3 정식 구조 도입 시 교체 가능

### 2. 관심상품 탭 자녀 칩 높이 통일
- **app/(tabs)/wishlist.tsx**: `childFilterChip` `minHeight:36` → **`height:36`**, `paddingVertical:8` → **`0`**
- 원인: 선택 시 `fontWeight:'600'`, 미선택 `'500'` → Android 일부 폰트 렌더러에서 line-height 차이로 칩 높이 변동
- 가로는 텍스트 길이에 따라 유동 (paddingHorizontal:16 그대로)

### 3. 로그아웃 기능 추가 (설정 화면)
- **services/firebase.ts**: `signOutFirebase()` 신규 export — `firebaseSignOut(auth)` 래퍼, Firestore 데이터 보존
- **app/(tabs)/settings.tsx**:
  - `performLogout()`: `signOutGoogle` + `signOutApple` + `signOutFirebase` → 로컬 상태/AsyncStorage 정리 → `hasSeenOnboarding:false` (root layout이 자동으로 OnboardingScreen 전환)
  - 계정 카드에 `isLinked` 조건부 로그아웃 row 추가 (익명 사용자는 미표시)
  - 로딩 모달 추가 (`signingOut` state)
- **deleteAccount와 차이점**: `removeItemFromFirestore` 호출 X (다른 사용자 trackerCount 보존, 본인 추적 항목 Firestore 유지) → 다음 로그인 시 `restoreFromFirestore`로 자동 복원

### 4. Apple Sign In 구현 (iOS only)
**신규 파일**:
- **services/appleAuth.ts**: `signInWithApple()` — `expo-crypto.getRandomBytesAsync(32)` rawNonce → `digestStringAsync(SHA256)` hashedNonce → `AppleAuthentication.signInAsync({nonce: hashedNonce})` → `{identityToken, rawNonce, email, fullName}` 반환. `isAppleSignInAvailable()` (iOS + 디바이스 가용성). `signOutApple()` no-op (Apple 명시적 로그아웃 API 없음)

**수정 파일**:
- **app.config.js**: iOS `usesAppleSignIn:true` 추가 (Capabilities 자동 처리)
- **services/firebase.ts**:
  - `OAuthProvider` import 추가
  - `linkAppleAccount(identityToken, rawNonce)` — `linkGoogleAccount`와 동일 분기 (익명 → Apple link / currentUser=null이면 직접 signIn / `auth/credential-already-in-use` fallback)
  - `getAuthState()` provider 타입 `'google' | 'apple' | null` 확장
  - `deleteAccount(googleIdToken?, appleCredential?)` 시그니처 확장 + Apple 재인증 분기 (`OAuthProvider('apple.com').credential({idToken, rawNonce})`)
- **components/OnboardingScreen.tsx**: `handleAppleStart` 핸들러 (handleGoogleStart 미러링) + Apple 버튼 (구글 버튼 아래, `Platform.OS==='ios' && appleAvailable` 가드, 검정 배경 흰 텍스트)
- **app/modal/login.tsx**: `handleAppleLogin` 핸들러 + Apple 버튼 + `linkedInfo` provider 분기 (apple 시 `logo-apple` 아이콘)
- **app/(tabs)/settings.tsx**: `performLogout`에 `signOutApple()` 추가, `performDeleteAccount`에 Apple 재인증 분기 (`signInWithApple()`로 토큰 재발급), 계정 카드 라벨 provider별 분기 ('Apple 계정 연동됨' / '구글 계정 연동됨')

**의존성 추가**: `expo-apple-authentication` + `expo-crypto`

**외부 작업 필요**:
- Firebase Console (jigumiya) > Authentication > Sign-in method > **Apple 활성화** (모바일 앱은 Service ID 불필요, Bundle ID 충분)
- Apple Developer Console > 앱 ID `com.aigo.app` > Capabilities > **"Sign In with Apple" 체크** + 프로비저닝 프로파일 갱신 (EAS 자동 처리)

### 5. v1.0.6 vc72 로컬 빌드 완료
- Android AAB / iOS IPA: `~/aigo/builds/{android|ios}/aigo-v1.0.6-vc72.{aab|ipa}`
- 커밋 `a9d44cb` (feat: v1.0.6 vc72 — 오늘의 육아템 + 칩 통일 + 로그아웃 + Apple Sign In)

### 미해결 / 다음 작업
- 시뮬레이터 검증 (홈 '오늘의 육아템' / 칩 일관성 / 로그아웃 흐름 / Apple Sign In E2E)
- Firebase Console + Apple Developer Console 외부 작업 적용 후 Apple 로그인 실기기 테스트
- Play Console vc72 업로드 → 외부 테스터 검증
- App Store 심사 제출 (Apple Sign In 정상 작동 확인 후)

---

## 2026-05-01 작업 이력 (v1.0.6 vc69+vc70)

### AIGO-BUG-01 완전 해결 — Android DEVELOPER_ERROR + iOS Bundle ID `<empty>` 차단

**iOS root cause** (선해결): GCP `AIzaSy...KQ5Ho` API Key의 "iOS 앱" 애플리케이션 제한 활성 + `services/firebase.ts` firebase-js-sdk가 React Native에서 `X-Ios-Bundle-Identifier` 헤더를 자동 부여하지 않음 → GCP가 빈 헤더를 "Bundle ID `<empty>`"로 인식하여 차단. **해결**: GCP Console에서 해당 API Key 애플리케이션 제한을 "없음"으로 변경 (Firebase Web API key는 클라이언트 식별자, 공식적으로 비밀 아님)

**Android root cause**: Google OAuth 2.0 글로벌 정책상 `(SHA-1, 패키지명)` 동일 조합은 GCP 전체에서 단 하나의 프로젝트만 OAuth 2.0 Android 클라이언트로 점유 가능. **aigo-a 프로젝트가 com.aigo.app + 업로드 키 SHA-1을 잔존 점유** → jigumiya 측에 Firebase Console로 SHA-1 4개 등록해도 GCP 측 OAuth Android 클라이언트가 자동 생성되지 못함 → @react-native-google-signin이 jigumiya OAuth 매칭 실패 → DEVELOPER_ERROR. (BUG-43에서 SHA-1 등록만 했지 OAuth 자동 생성 미완 — vc67 빌드도 깨진 상태였음)

**Android 해결 절차** (커밋 `30d2245`):
1. **aigo-a Firebase Console > Android/iOS 앱(com.aigo.app) 삭제** (soft-delete 30일 유예이지만 OAuth 클라이언트 정리 트리거)
2. **jigumiya Firebase Console > Android 앱(com.aigo.app) > SHA-1 1개 제거 → 즉시 재추가** (자동 생성 트리거)
3. 5분 대기 → jigumiya GCP > APIs & Credentials > OAuth 2.0 클라이언트 ID 목록에 `Android client for com.aigo.app` 자동 생성 확인 (SHA-1당 1개씩, 총 **2개** 생성)
4. **새 google-services.json 다운로드 → 클라이언트 교체** — `oauth_client[]` 배열에 `client_type:1` Android 항목 2개 추가됨 확인

**자동 생성된 Android OAuth 클라이언트 SHA-1**:
- `a8e3563b85be782876a28096bfe57bdb2c9da75f` — vc69 업로드 키 ✅ (vc67 AAB SHA-1 대조 완료)
- `a1eb1cce71bc4c4555463da0f7e43754d3836b19` — 별도 키 (Play 서명 또는 디버그 추정)

⚠️ **Firebase Console에 SHA-1 4개 등록인데 OAuth 클라이언트는 2개만 자동 생성** — Play App Signing 키 SHA-1이 이 2개에 포함됐는지 미확인. 비공개 테스트 검토 완료 후 실기기 검증 결과에 따라 추가 등록 필요 여부 판단.

### AIGO-BUG-02, 03 부수 해결
- AIGO-BUG-01 (구글 로그인) 정상화 → Firestore 인증 토큰 정상 발급 → `category_best_baby` / `event_best` 추천상품 정상 표시 확인

### vc69 Android + vc70 iOS 빌드 (커밋 `34e7412`)
- versionCode bump 67 → 68 → (Play Console 충돌, 폐기) → **69**
- EAS `appVersionSource:remote` 단일 카운터 공유 → iOS 빌드 시 자동 +1로 vc70 부여
- Android AAB: `~/aigo/builds/android/aigo-v1.0.6-vc69.aab` (2026-05-01 00:21)
- iOS IPA: `~/aigo/builds/ios/aigo-v1.0.6-vc70.ipa` (2026-05-01 02:05)
- Play Console 비공개 테스트 vc69 업로드 완료 → **검토 단계 (대기)**

### 진행 중 / 다음 작업
- 비공개 테스트 검토 완료 → Play Console 프로덕션 승급
- iOS vc70 Transporter 업로드 → App Store 심사 정보 회신 (Apple)
- AIGO-BUG-04 (와우회원 필드) / AIGO-BUG-05 (익명 로그인 시 구글 연동 표기) 수정
- cron 전체 활성화 (검증 통과 후)

---

## 2026-04-30 작업 이력 (v1.0.6 vc67)

### 1. BUG-41 수정 — 재설치 후 구글 로그인 시 아이정보 복원 실패 (커밋 6c37165)
- **원인**: 옛 단일 아이 사용자(babyName/babyGender/babyBirthDate 필드만 있고 children[] 비어있음)는 `restore.ts`가 `childrenCount=0` 반환 → `OnboardingScreen.handleGoogleStart`가 `onNext()`로 빠져 온보딩 재입력 강제
- **services/restore.ts**:
  - `RestoreResult`에 `hasMeaningfulSettings: boolean` 필드 추가
  - 단일 아이 → children[] 자동 마이그레이션: settings.children 비어있고 babyName/babyBirthDate 있으면 `child-{Date.now()}` id로 children[] 생성 + Firestore 백필 (`updateUserSettings`)
  - 의미 필드(parentInfo / vaccinationRecords / checkupRecords / babyName) 존재 시 `hasMeaningfulSettings=true`
- **components/OnboardingScreen.tsx**: 분기 조건 `childrenCount > 0 || itemsCount > 0` → `... || hasMeaningfulSettings`
- **app/modal/login.tsx**: 디버그 라인에 hasMeaningfulSettings 추가 (분기 영향 없음 — 익명→구글 업그레이드 흐름)

### 2. BUG-42 수정 — 쿠팡 공유 → 상품추가 무한로딩 (커밋 4f8b338)
- **가설 정리**:
  - ① useFocusEffect 재진입으로 step 리셋: 외부 앱 튕김 → 복귀 시 `step='url'`로 리셋되어 진행 중 스크래핑 죽음
  - ② Functions/네트워크 콜드 스타트 무한 대기
  - ③ 공유 진입 시 사용자가 "다음" 버튼 누르는 UX 부담
- **app/modal/add-item.tsx**:
  - 자동 handleNext useEffect: `sharedUrl + step==='url'` 시 `autoTriggeredRef`로 1회 자동 트리거
  - useFocusEffect 가드: `step !== 'url'`이면 리셋 스킵 (진행 중 보호)
  - timeoutRef cleanup useEffect: 모달 언마운트 시 좀비 timeout 정리
  - `callResolveAffiliate` 8초 race timeout (handleNext + handleSave 양쪽)
  - fallback fetch 5초 AbortController × 2 (redirect:manual / redirect:follow)
  - `generateDeepLink` 5초 race timeout (handleNext + handleSave 양쪽)
- **app/_layout.tsx**: Functions 콜드 스타트 워밍업 — 앱 시작 3초 후 `callResolveAffiliate('https://www.coupang.com/vp/products/warmup')` 백그라운드 더미 호출 (실패 무시)
- **CoupangScraper 본문 side effect는 별도 검증용으로 이번 커밋에서 제외**

### 3. BUG-43 수정 — Android 구글 로그인 DEVELOPER_ERROR
- **원인**: Firebase aigo-a → jigumiya 통합 후 jigumiya 프로젝트 OAuth 클라이언트에 com.aigo.app 키스토어 SHA-1이 등록 안 됨
- **SHA-1 추출**: vc66 AAB의 META-INF/F3256989.RSA → keytool printcert
  - 업로드 키 SHA-1: `A8:E3:56:3B:85:BE:78:28:76:A2:80:96:BF:E5:7B:DB:2C:9D:A7:5F`
  - SHA-256: `A4:52:74:5B:CD:99:CC:BF:78:2F:82:60:1D:38:38:40:02:E7:4B:31:EF:39:84:62:78:B8:2B:50:23:34:40:7C`
- **Firebase Console(jigumiya) > Android 앱(com.aigo.app)에 SHA-1 4개 등록 완료** (업로드 키 + Play App Signing 키 + 디버그/추가 키)
- **google-services.json 교체** (Firebase 측 OAuth 설정은 클라이언트 파일과 별개라 mtime 변화 없을 수도)

### 4. IMPROVE-B — 온보딩 알림 횟수 문구 (커밋 1eeab82)
- **components/OnboardingScreen.tsx:154**: "매일 6회 자동 가격 확인" → "가격 변동 시 즉시 알림"
- 이유: 가격 체크 cron이 04:30~01:00 KST 분당 40회 순차로 변경되며 하루 N회 고정 표현 부정확

### 5. 월령별 가격 변동 알림 — baby-category-notifier 신설 (커밋 db139f7)
- **scripts/baby-category-best-updater/baby-categories.ts**:
  - `excludeKeywords?: string[]` 필드 신규 (선언적 제외 키워드)
- **scripts/baby-category-best-updater/index.ts**:
  - 적재 직전 기존 `category_best_baby/{slug}` read → 신/구 가격 비교
  - 임계: **5% 이상 OR 1,000원 이상 하락**
  - 변동분 → `price_drops_baby/{YYYY-MM-DD KST}` 그룹별 merge (`bySlug` 맵 + `groupsCompleted`)
  - 7일 이전 price_drops_baby 자동 정리 (그룹마다 멱등 호출)
- **scripts/baby-category-notifier/ 신설**:
  - `index.ts`: `price_drops_baby/{오늘}` read → users 순회 → 슬러그 끝 `-N-M` 범위로 월령 매칭 (없으면 공통 슬러그)
  - `messages.ts`: 랜덤 메시지 3종 (월령 토큰 치환 1종 + 일반 2종)
  - 24h 가드: `users/{uid}.lastBabyDropAlertAt`
  - 가드 로직: notificationEnabled / expoPushToken / Expo 토큰 형식 / babyBirthDate / 월령 매칭 슬러그 1개 이상
  - DRY_RUN=1 모드 지원
  - 만료 토큰 cleanupInvalidUsers
- **.github/workflows/baby-category-notifier.yml 신설**: 04:00 KST = 19:00 UTC schedule (비활성, workflow_dispatch 가능)
- **firestore.rules**: jigumiya 단일 소스에 `price_drops_baby/{date}` read O / write X 추가 (지금이야 레포에서 처리)

### 6. stroller 슬러그 강아지 필터 (커밋 db139f7)
- **scripts/baby-category-best-updater/baby-categories.ts**:
  - `stroller` 슬러그에 `excludeKeywords: ['애완견', '반려견', '강아지']` 적용
- **index.ts `applyExcludeFilter`**: 상품명 substring 매칭, 필터 후 0개면 미갱신, 10개 미만 허용 (재검색 X — 분당 50회 한도 보호)

### 7. 앱 업데이트 알림 — meta/config_aigo (사용자 직접 업데이트)
- **Firebase Console**: `meta/config_aigo.minRequiredVersion` `"1.0.5"` → `"1.0.6"` 갱신
- v1.0.6 vc67 빌드부터 강제 업데이트 임계값 상향
- forceUpdate=false 유지 (선택 업데이트 알림)

### 8. 푸시 알림 클릭 라우팅 분기 (커밋 61b405a)
- **services/notifications.ts**:
  - `routeFromNotification(response)` 신규 — `data.screen` 분기:
    - `screen='detail' + itemId` → `/detail/{itemId}`
    - `screen='baby-category'` → `/` (홈, slugs[] 파라미터 동봉)
    - `screen='price-drops'` → `/` (아이고는 가격변동 탭 없으므로 홈)
    - `screen='home'` → `/`
    - 하위 호환: screen 미지정 + itemId → `/detail/{itemId}`
  - 사용처 없는 `getItemIdFromNotification` 제거 (dead code)
- **app/_layout.tsx**: `addNotificationResponseReceivedListener` + `getLastNotificationResponseAsync` 양쪽 모두 routeFromNotification 사용
- **scripts/baby-category-notifier/index.ts**: `data.screen` `'home'` → `'baby-category'` (slugs 동봉)

### 9. 두 레포 Public 전환 + 보안 점검
- **GitHub Actions**: Public 레포 무제한 무료 (Private 한도 부담 해소)
- **보안 점검 결과 (Public 전환 안전)**:
  - `firebase-service-account.json` (private key 평문) — `.gitignore` 보호 + `git rev-list` 결과 비어있음 (한 번도 커밋된 적 없음)
  - 쿠팡 파트너스 키 — 모두 `process.env.COUPANG_*` 환경변수, 코드 하드코딩 없음, GitHub Actions Secret 사용
  - `.env`/`.env.example` — `.env`는 ignore, `.env.example`는 placeholder (`your_xxx_here`)
  - Firebase Web API key (`services/firebase.ts:47` `AIzaSyAMGMGrOJw1TqdytZqB_Y0-roiYRyKQ5Ho`) — 클라이언트 식별자, Firebase 공식 입장상 비밀 아님
  - google-services.json / GoogleService-Info.plist — 클라이언트 식별 정보 (apiKey/client_id/project_id), Public 노출 일반적
- **Push protection / Secret scanning** GitHub 자동 활성화

### 10. Google Cloud API Key 제한 설정
- Google Cloud Console(jigumiya) > APIs & Credentials:
  - **Android API Key** (`AIzaSy...GAV5U`): 애플리케이션 제한 → "Android 앱" → 패키지 `com.aigo.app` + 자매앱 `com.jigumiya.app` + SHA-1 지문
  - **iOS API Key** (`AIzaSy...KQ5Ho`): "iOS 앱" → Bundle ID `com.aigo.app` + 자매앱 Bundle ID
  - API 제한: Firebase 관련 API만 허용 (Maps/Geocoding 등 차단)

### 11. v1.0.6 vc67 로컬 빌드 완료
- **app.config.js**: `version: "1.0.5"` → `"1.0.6"`, `versionCode: 66` → `67` (커밋 26578b4 + 9030ba0)
- **Android AAB**: `~/aigo/builds/android/aigo-v1.0.6-vc67.aab`
- **iOS IPA**: `~/aigo/builds/ios/aigo-v1.0.6-vc67.ipa`
- EAS `appVersionSource:remote + autoIncrement:true` 라 실제 versionCode/buildNumber는 EAS 서버 카운터 기준 자동 증가

### 미해결 / 다음 작업
- 실기기 통합 검증 (BUG-41/42/43 + 알림 + UX 개선) — 외부 테스터 라운드
- cron 전체 활성화 (검증 통과 후)
- Play Console 내부테스트 업로드 → 프로덕션 승급
- iOS App Store 심사 제출 (Apple 회신 반영)
- 앱 측 baby-category 탭 라우팅 UI 구현 (홈 탭에서 slugs 받아 해당 월령별 카테고리 섹션으로 스크롤/하이라이트)

---

## 2026-04-28 작업 이력 (v1.0.5 vc66)

### Phase 3 월령 세분화 + cron 골격 완성 (커밋 28b565c, a3180a7, c8d5d64)
- **types/index.ts**: `AgeBucket` (8단계: 0-3 / 4-6 / 7-12 / 13-24 / 25-36 / 37-48 / 49-72 / 73-84) + `getAgeBucket()` + `getCategorySlug(category, months)` 함수형으로 교체 (`CATEGORY_TO_SLUG` 상수 제거)
- **scripts/baby-category-best-updater/baby-categories.ts**: 23개 → **54개 슬러그** (그룹 1~4)
  - 그룹 1 (01:15 KST, 16콜): toys×8 + clothing×8
  - 그룹 2 (01:30 KST, 14콜): shoes×4 + books×5 + learning×5
  - 그룹 3 (03:00 KST, 10콜): diaper×5 + formula×3 + wipes + feeding-0-12
  - 그룹 4 (03:20 KST, 14콜): 단일 슬러그 (속싸개/스킨케어/이유식 등)
- **GROUP 환경변수**: cron index.ts에 `GROUP=1|2|3|4` 추가 → 그룹별 분리 실행
- **services/firebase.ts fetchBabyCategoryBest**: months 인자 추가 → 슬러그 동적 결정
- **app/(tabs)/index.tsx**: babyMonths 전달

### scripts/event-best-updater 신설 (커밋 28b565c)
- **31개 이벤트 슬러그**: anniversary 19 + season 5 + parent 7
  - anniversary: anniv-100/200/300/365/500/1000 + birthday-1~13
  - season: children-day / christmas / halloween / newyear / chuseok
  - parent: parents-day / valentine / whiteday / couple-day / mom-birthday / dad-birthday / wedding
- **minPrice=30,000 KRW** (50,000에서 하향, 적재 풀 확대)
- **coupang-api.ts**: minPrice 옵션 추가 (search API 자체 미지원 → 클라 필터)
- **GitHub Actions yml**: 01:00 KST schedule 주석 + workflow_dispatch 가능
- **events.ts MIN_PRICE_KRW**: 50,000 → 30,000 (커밋 a3180a7), docs sync (c8d5d64)

### Firestore Rules 통합 — jigumiya 단일 소스
- **단일 소스 위치**: `~/jigumiya/jigumiya/firestore.rules`
- **추가 규칙**:
  - `category_best_baby/{slug}` read O / write X
  - `event_best/{eventSlug}` read O / write X
  - `meta/{docId}` read public (인증 전 체크) / write false
- **아이고 레포 firestore.rules**: 미사용 표시 헤더 추가 (커밋 81706a1)
- **배포 방식**: `cd ~/jigumiya/jigumiya && firebase deploy --only firestore:rules --project jigumiya`

### 알림 버그 3건 동시 수정

**가설 A — EAS FCM V1 service account 교체 (외부 작업)**
- 기존: aigo-a 프로젝트 SA → 마이그레이션 후 jigumiya 클라이언트와 sender ID 불일치 (MismatchSenderId 의심)
- **조치**: EAS Android credentials 에서 FCM v1 SA를 jigumiya 프로젝트 것으로 갱신
- 마이그레이션 후 푸시 미수신 근본 원인으로 추정

**가설 C — Push 메시지 channelId + priority 추가 (커밋 d0d7535)**
- `scripts/price-checker/notifier.ts` ExpoPushMessage 빌드 시:
  - `priority: 'high'` (iOS APNs 즉시 전달, Android sleeping wake)
  - `channelId`: repurchase → 'repurchase', 그 외(가격/백신) → 'price'
- `services/notifications.ts setNotificationChannelAsync` 와 sync

**가설 E — savePushToken retry 활성화 (커밋 4c9d83b)**
- 진단: 가격 체크 봇 04-18 로그에서 `토큰없음=72/145` 발견 (절반 사용자 미저장)
- 원인: `savePushToken: Promise<void>` 가 setDoc 실패를 catch만 하고 throw 안 함 → 호출자 try/catch 데드코드 → retry 절대 발동 안 함
- **수정**:
  - `savePushToken: Promise<void> → Promise<boolean>` (성공 true / 실패 false)
  - `getLastSavePushTokenError()` export (디버그용)
  - `notifications.ts retryTokenSave`: uid 없음 + setDoc 실패 모두 다음 attempt로 재귀 (5회, 누적 30초)

### 업데이트 알림 기능 추가 (커밋 5e40eb7)
- **services/updateCheck.ts** 신규 (재사용 가능 — 지금이야 이식 가능)
  - `UpdateCheckConfig`: appKey + currentVersion + 패키지명 + iOS App Store ID
  - Firestore `meta/config_{appKey}` 1회 read
  - semver 비교 (외부 라이브러리 없이)
  - AsyncStorage 버전별 snooze (`aigo-update-snoozed-{appKey}`)
- **services/firebase.ts**: `fetchAppConfig(appKey)` read 함수 export
- **app/_layout.tsx**: 첫 마운트 1회 체크 + Alert.alert 노출
  - "업데이트" → Linking.openURL(스토어)
  - "나중에" → snoozeUpdate (forceUpdate=true 시 버튼 없음 + cancelable=false)
  - AppState 재체크 없음 (1회만)
- **iOS App Store ID**: TODO (등록 후 갱신)

### 홈 이벤트 배너 → event_best 연동 (커밋 48d2412)
- **services/firebase.ts**: `fetchEventBest(slug, count)` + `EventBestProduct` 타입
- **services/events.ts**: `EventBanner.eventSlug` 필드 + 31개 슬러그 매핑
  - `ANNIVERSARY_DAY_SLUG`: 100/200/300/365/500/1000일 매핑
  - 매년 생일: birthday-1 ~ birthday-13 (만 14세 이상 미적재 → undefined)
  - season/parent: 각 객체에 slug 필드
  - 부모 사용자 설정 (엄마/아빠/결혼): parent-mom-birthday / dad-birthday / wedding
- **app/(tabs)/index.tsx handleEventPress**: fetchEventBest 호출, 슬러그 없는 이벤트는 빈 결과

### 수동 첫 적재 완료
- **baby GROUP 1~4**: 54 슬러그 모두 적재 → 538 상품
- **event-best**: 31개 중 23개 성공 → 55 상품 (minPrice=30,000 통과)
- **rate-limit 미발생** (분당 1콜 보수 운영)

### Firebase Console
- **meta/config_aigo** 초기 문서 생성:
  - `minRequiredVersion: "1.0.5"`
  - `forceUpdate: false`
  - 향후 강제 업데이트 시 minRequiredVersion 상향

### v1.0.5 vc64/vc66 로컬 빌드
- **versionCode bump**: 62 → 64 → 66 (EAS remote autoIncrement sync)
- **Android AAB**: `~/aigo/builds/android/aigo-v1.0.5-vc66.aab`
- **iOS IPA**: `~/aigo/builds/ios/aigo-v1.0.5-vc66.ipa`

### docs 갱신
- **019_Phase3_SharedProducts.md §10 Phase 3-B 운영 정책 추가** (커밋 3e596c8)
  - §10-1: shared_products 가격 체크 cron (04:30~01:00 KST, 분당 40회 순차)
  - §10-2: trackerCount 합산(지금이야+아이고) 기반 정리
  - §10-3: meta/stats.sharedProductCount 카운터
  - §10-4: 앱 내 검색 — Firebase 내부 데이터만
  - §10-5: 낮 보조 업데이트 제거
- **firestore.rules / event-best minPrice docs sync** (커밋 c8d5d64)

### 미해결 / 다음 작업
- **BUG-41**: 구글 로그인 후 재설치 시 아이정보 복원 실패 → vc67 수정 예정
- 알림 가설 A/C/E vc66 반영, 실기기 테스트 미완료
- cron 전체 활성화는 실기기 테스트 통과 후

---

## 2026-04-26 작업 이력

### Firebase 프로젝트 통합 aigo-a → jigumiya (커밋 0fdc5e3)
- **목적**: 자매 앱과 백엔드 일원화 → Functions/Secrets/category_best 캐시 공유
- **교체**: google-services.json + GoogleService-Info.plist (jigumiya, com.aigo.app)
- **클라이언트**: services/firebase.ts firebaseConfig + .firebaserc + firebase.json (firestore rules) + services/googleAuth.ts WEB_CLIENT_ID
- **iOS OAuth**: plist의 CLIENT_ID 자동 인식 (별도 코드 불필요)
- **잔여 외부 작업**:
  - Functions 재배포: `firebase deploy --only functions --project jigumiya`
  - Firestore Rules 배포: `firebase deploy --only firestore:rules --project jigumiya`
  - GitHub Actions Secret 갱신: FIREBASE_SERVICE_ACCOUNT_KEY → jigumiya 서비스 계정
  - EAS Secret GOOGLE_SERVICES_JSON 점검 (확인 결과 없음)

### 계정 삭제 기능 (v1.0.5 vc62, 커밋 10617f8)
- 설정 화면 계정 삭제 메뉴: 구글 재인증 → Firestore/Auth 정리 → 로컬 초기화 → 온보딩 복귀

### price-checker category_best 캐시 도입 (커밋 e8dcc72)
- **신규**: scripts/price-checker/category-best-cache.ts (지금이야 모듈 이식, MAX_AGE_MS 6h)
- **index.ts**: cron 시작 시 캐시 선로드 → productId 매칭 시 fetchCurrentPrice 스킵
- **신뢰성 가드**: isCacheStablePrice (30% 변동 초과 시 폴백)
- **Sleep 절약**: 캐시 hit 시 1s 생략
- **통계 로그**: cache hit / API call / 절감률 (%)
- **효과**: jigumiya 통합으로 지금이야 02:00 KST 적재분 공유 → 분당 50회 rate-limit 여유 ↑

### BabyCategory 베스트셀러 cron + 쿠팡 직접 호출 제거 (커밋 df32df7)
- **신규 cron**: scripts/baby-category-best-updater/ (BabyCategory 23개 키워드 매핑)
  - search API 1콜/분 보수 운영, ~23분 소요, 429/rMessage rate-limit 즉시 중단
  - category_best_baby/{slug} 단일 문서 덮어쓰기
- **클라이언트**:
  - types: CATEGORY_TO_SLUG + CategoryBestBaby 인터페이스 추가
  - services/firebase.ts: fetchBabyCategoryBest(category, count, gender) — 의류/신발/장난감 성별 휴리스틱 필터
  - app/(tabs)/index.tsx: searchProducts/fetchGoldbox 직접 호출 전면 제거
    - 카테고리 보충 → fetchBabyCategoryBest
    - 이벤트 배너 → 빈 결과 (Phase 3 분리)
    - 골드박스 섹션 제거
- **인프라**:
  - .github/workflows/baby-category-best-update.yml (schedule 주석, workflow_dispatch 가능)
  - firestore.rules: category_best_baby read 허용
- **목적**: 쿠팡 API 분당 50회 한도 압박 해소 (클라이언트 read 0콜)
- **첫 적재 미실행**: cron 비활성 상태 유지, 수동 workflow_dispatch로 첫 적재 후 자동화 검토

### v1.0.5 vc63 Android 로컬 빌드 성공 (BUILD SUCCESSFUL 1m 47s)
- 산출물: ~/aigo/builds/android/aigo-v1.0.5-vc63.aab
- versionCode 자동 증가 (eas.json: appVersionSource:remote + autoIncrement)
- iOS 로컬 빌드: 사용자 보류

### Phase 3로 분리한 항목
- **이벤트 배너 추천 상품**: 14개 이벤트(기념일/시즌/부모) 키워드 적재 방식 미정 (옵션 B 범용 키워드 / C 별도 cron 후보). 현재 클릭 시 빈 결과
- **price_drops 컬렉션 기록**: 지금이야 패턴 미이식 (필요 시 도입)

## 2026-04-21 작업 이력

### Firebase Cloud Functions 배포 (AQ-4 해결, 커밋 0b27a4f)
- **추가**: `functions/src/index.ts` — `resolveAndGenerateAffiliateUrl` (onCall, asia-northeast3)
  - link.coupang.com 단축 URL → redirect chain → www.coupang.com/vp/products/... resolve
  - HMAC 인증으로 /deeplink API 호출 → shortenUrl 반환
- **Secret 등록 (aigo-a)**: COUPANG_ACCESS_KEY versions/1, COUPANG_SECRET_KEY versions/1
- **배포 완료**: Successful update operation
- **클라이언트 연동**:
  - `services/firebase.ts`: `getFunctions`/`httpsCallable` + `callResolveAffiliate(sharedUrl)` wrapper
  - `app/modal/add-item.tsx`: handleNext/handleSave 재시도 모두 Functions 우선 → client fallback
- **출처**: 지금이야 Resolver 작업 이식 (72e5792/5970bcd/d64d750)

### 쿠팡 Rate Limit 긴급 대응 (커밋 23033de)
- 분당 50회 초과 2회 누적 (3회 시 계정 이용 제한)
  - 1회차: 2026-04-20 21:53:48 자동 해제 완료
  - 2회차: 2026-04-22 07:21 KST 자동 해제 예정
- 아이고·지금이야 두 앱 모두 cron 비활성화 완료
- 아이고는 추적 상품 0개라 API 호출 기여 없음 확인 (지금이야 단독 원인 추정)
- **cron 재활성화 보류**: 04-22 07:21 해제 + 두 앱 합산 호출량 재검토 후 결정

### 미완료 항목
- app.config.js + settings.tsx + firebase.ts (v1.0.5 계정 삭제 기능) 별도 커밋 대기
- iOS 심사용 빌드 미진행 (계정 삭제 커밋 완료 후 진행)

## 2026-04-24 작업 이력

### Firebase Functions resolveAndGenerateAffiliateUrl 추가 및 배포
- **프로젝트**: jigumiya + aigo-a 두 앱 모두 배포 완료
- **Secrets 등록 완료**: COUPANG_ACCESS_KEY, COUPANG_SECRET_KEY
- **기능**: link.coupang.com 단축 URL → vp URL resolve → HMAC 서명 /deeplink API 호출

### 쿠팡 Cron 재활성화
- 스케줄: 07/09/11/13/16/19 KST (총 6회/일)
- 지금이야와 시간대 분리하여 분당 50회 Rate Limit 여유 확보

### 쿠팡 Cron 긴급 비활성화 (파트너스 계정 정지 대응)
- **원인**: 재시도 루프 burst로 분당 110회 호출 → 공식 Rate Limit 초과
- **조치**: 아이고·지금이야 두 앱 cron 전면 비활성화
- **재시도 루프 제거 완료**: 상품당 1회 검색, 실패 시 스킵 (burst 차단)
- **파트너스 계정 정지 → 소명 후 해제** (2026-04-24 당일)

### 쿠팡 파트너스 공식 Rate Limit
- 검색 API: **1분당 50회**
- 리포트 API: **1시간당 500회**
- 모든 API 합산: **1분당 100회**
- 링크 생성(/deeplink): **1분당 50회**

### Phase 3 확정 스케줄 (cron 재활성화 계획)
- **공유상품 업데이트**: 02:00 / 03:00 / 04:00 KST (새벽) + 낮시간 최소 2회
- **지금이야 알림**: 11:30 / 20:30 KST
- **아이고 알림**: 10:00 / 19:00 KST
- **cron 재활성화 조건**: Phase 3 shared_products 구조 완료 후

### 남은 작업 (우선순위 순)

**🔴 P0 — Functions 버그 수정 이식 (지금이야에서 발견)**
- 지금이야 커밋 참고: e69d05e (functions/src/index.ts)
- **버그 1**: link.coupang.com/a/... 단축 URL이 200 HTML 반환
  - HTML 내 `redirectWebUrl` hex-escape 파싱으로 vp URL 추출 필요
- **버그 2**: COUPANG_ACCESS_KEY/SECRET_KEY Secret 값 말미 개행문자(\n) 포함
  - `.trim()` 방어 처리 필요

**🟠 P1 — 알림 버그 수정**
- Android/iOS 수동 실행 테스트에서 알림 미수신 확인됨

**🟡 P2 — 프로덕션 출시**
- Google Play 14일 베타 충족 확인 후 진행

## iOS WebView 쿠팡 튕김 현상 (형제앱 지금이야 해결 내용)
- 증상: iOS WebView에서 쿠팡 URL 로드 시 Universal Link로 인해 쿠팡 앱으로 튕기는 현상
- 원인: link.coupang.com 단축 URL → 리다이렉트 → coupang:// 딥링크 트리거
- 해결책:
  1. onShouldStartLoadWithRequest에서 coupang://, coupangapp:// 차단
  2. allowsBackForwardNavigationGestures={false} 설정
  3. WebView에 html prop으로 HTML 직접 전달 (URL 탐색 없음)
  4. BLOCK_DEEPLINK_JS에 coupangapp:// 추가
- 결과: 2~3회 튕김 → 1회로 감소 (1회는 iOS 시스템 레벨이라 완전 차단 불가)
- 추가 시도 가능: expo-web-browser(SFSafariViewController) 사용 시 튕김 없으나 JS 인젝션 불가 → 스크래핑 구조 변경 필요
- 참고 파일: 지금이야 CoupangScraper.tsx, add-item.tsx
