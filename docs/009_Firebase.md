# 009. Firebase 연동

## Firebase 프로젝트 설정 체크리스트

### 1. 프로젝트 생성
- [ ] Firebase Console에서 신규 프로젝트 생성 (이름: `aigo` 또는 `aigo-app`)
- [ ] Blaze 요금제 활성화 (FCM V1 필수)

### 2. 앱 등록
- [ ] Android 앱 등록: `com.aigo.app`
  - `google-services.json` 다운로드 → `aigo/google-services.json` 교체
- [ ] iOS 앱 등록: `com.aigo.app`
  - `GoogleService-Info.plist` 다운로드 → `aigo/GoogleService-Info.plist` 교체

### 3. 코드 설정값 교체
- [ ] `services/firebase.ts` — firebaseConfig 객체의 TODO 값 교체
  - `apiKey`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` (Android/iOS)

### 4. Authentication 설정
- [ ] Firebase Console → Authentication → 로그인 방법 → **익명 로그인** 활성화

### 5. Firestore 설정
- [ ] Firestore 데이터베이스 생성 (asia-northeast3 — 서울 리전)
- [ ] 보안 규칙 배포: `firestore.rules` 파일 참고

### 6. FCM 설정
- [ ] iOS: APNs 키 업로드 (Apple Developer → Keys → APNs)
- [ ] Android: 자동 구성 (google-services.json에 포함)

## Firestore 구조
```
users/
  {uid}/
    expoPushToken: string
    notificationEnabled: boolean
    repurchaseNotificationEnabled: boolean
    isWowMember: boolean
    babyBirthDate: string | null
    lastActiveAt: string
    items/
      {itemId}/
        (TrackedItem 전체 필드)
```

## 보안 규칙
`firestore.rules` 파일 참고. 핵심:
- 본인 문서만 읽기/쓰기 (`request.auth.uid == userId`)
- items 서브컬렉션도 본인만 접근
- 가격 체크 봇은 Admin SDK 사용 (규칙 우회)

## 사용 기능
| 기능 | 용도 |
|------|------|
| Anonymous Auth | 기기 식별, Firestore 접근 권한 |
| Firestore | 상품 데이터 원격 백업, 가격 체크 봇 연동 |
| FCM (V1) | 가격 알림 / 재구매 알림 푸시 |
| Cloud Functions | 쿠팡 제휴 딥링크 생성 (asia-northeast3) |

## Cloud Functions

### resolveAndGenerateAffiliateUrl (onCall, asia-northeast3)
- **역할**: link.coupang.com 단축 URL → redirect chain resolve → www.coupang.com/vp/products/... 확보 → HMAC 인증 + /deeplink API 호출 → shortenUrl 반환
- **추가 이유**: 클라이언트가 link.coupang.com 단축 URL을 그대로 /deeplink API에 넘기면 파트너스 실적이 집계되지 않음 → 서버에서 vp URL로 resolve한 후 제휴 링크 생성
- **호출 경로**: `services/firebase.ts` → `callResolveAffiliate(sharedUrl)` wrapper (예외 내부 흡수, 실패 시 client fetch + generateDeepLink fallback)
- **배포 완료**: 2026-04-21 커밋 0b27a4f

### Secrets (Firebase Secret Manager)
| 이름 | 용도 | 현재 버전 |
|------|------|----------|
| `COUPANG_ACCESS_KEY` | 쿠팡 파트너스 Access Key | versions/1 |
| `COUPANG_SECRET_KEY` | 쿠팡 파트너스 Secret Key | versions/1 |

### 등록/배포 명령
```bash
cd ~/aigo/aigo
firebase use aigo-a
firebase functions:secrets:set COUPANG_ACCESS_KEY
firebase functions:secrets:set COUPANG_SECRET_KEY
firebase deploy --only functions --project aigo-a
```

### 관련 파일
- `functions/src/index.ts` — Functions 본체 (HMAC 서명 + redirect chain + deeplink)
- `functions/package.json` — Node 22, firebase-functions ^6.1.1
- `firebase.json` / `.firebaserc` — default=aigo-a

## 지금이야와의 관계
- **별도 Firebase 프로젝트** 사용 (데이터 격리)
- 쿠팡 파트너스 계정은 공유 가능
- 코드 구조 동일 (firebase.ts, functions/src/index.ts 그대로 재사용)
- Functions 코드는 지금이야(72e5792) 이식, HMAC 인증부 무수정
