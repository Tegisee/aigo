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

## 지금이야와의 관계
- **별도 Firebase 프로젝트** 사용 (데이터 격리)
- 쿠팡 파트너스 계정은 공유 가능
- 코드 구조 동일 (firebase.ts 그대로 재사용)
