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

## 수익모델: 쿠팡 파트너스 단일 전략
- 지금이야와 동일 구조 (3~10% 수수료)
- 육아용품 특성: 반복 구매 빈도 높음 → 전환율 유리
- 기저귀/분유/물티슈 등 소모품 = 정기 구매 유도 가능
- 파트너스 계정: 지금이야와 동일 계정 사용 가능

## 현재 상태: v1.0.3 비공개 테스트 검토 중 (2026-04-09)

### Google Play
- 스토어: https://play.google.com/store/apps/details?id=com.aigo.app
- GitHub: https://github.com/Tegisee/aigo (Private)
- 현재 버전: 1.0.3 (버전 코드 9)
- 비공개 테스트: v1.0.3 검토 중 (04-09 제출)
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

**v1.0.4 수정 완료 (04-10)**
- ✅ BUG-29: 재설치 온보딩 → expo-secure-store 설치 마커 + allowBackup:false
- ✅ BUG-27,28: 접종/검진 플로우 → 날짜→병원명→확인 순서, 취소 시 미저장
- ✅ BUG-26: 기념일 탭 반응 없음 → keywords 추가
- ✅ ENV-2: 구글 로그인 데이터 복원 → Firestore에서 설정+상품 복원
- ✅ BUG-23: 푸시 토큰 → projectId fallback + 재시도
- ✅ ENV-1: 카테고리 추천 → 삭제 상품 필터링 + 안내 개선
- ✅ BUG-12: 쿠팡 앱 전환 → WebView 차단 강화
- ✅ BUG-24: 음력 생일 → korean-lunar-calendar 변환
- ✅ BUG-25: 기념일 서비스 준비 중 → BUG-26+ENV-1로 해결

### 남은 TODO
**확인 필요 (v1.0.4 테스트)**
1. **BUG-5**: 쿠팡 앱 딥링크 (intentFilters 추가 완료)
2. **ENV-1**: 쿠팡 파트너스 API 키 실제 동작 확인

**🟢 낮음**
- 육아정보 API 2단계 (L)

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

## 앱 기본 정보
- 앱 이름: 아이고 (AIGO)
- 번들 ID: com.aigo.app
- 프로젝트 경로: ~/aigo/aigo
- 카테고리: 쇼핑/육아/유틸리티
- 개인정보처리방침: https://dafamstore.tistory.com/11
