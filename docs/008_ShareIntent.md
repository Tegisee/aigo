# 008. Share Intent 연동

## 개요
쿠팡 앱에서 "공유하기" → 아이고 선택 → 상품 자동 등록

## 기술 스택
- `expo-share-intent` 라이브러리
- iOS: Share Extension (`AigoShareExtension`, App Group `group.com.aigo.app`)
- Android: intent-filter (expo-share-intent 플러그인 자동 구성)

## 플로우
1. 쿠팡 앱 → 공유하기 → 아이고 선택
2. `+native-intent.tsx` → `/shareintent` 라우팅
3. `_layout.tsx` ShareIntentHandler가 감지
4. `extractCoupangUrl()` — webUrl / text / url 순서로 쿠팡 URL 추출
5. 쿠팡 URL → `/modal/add-item?sharedUrl=...&sharedText=...`
6. 비쿠팡 URL → Alert 안내

## 공유 텍스트 예시 (쿠팡)
```
하기스 네이처메이드 팬티형 5단계
32,900원
https://link.coupang.com/re/SHAREAPP?...
쿠팡을 추천합니다!
```

## URL 추출 우선순위
1. `shareIntent.webUrl` — coupang.com 포함 시
2. `shareIntent.text` — 정규식으로 쿠팡 URL 추출
3. `shareIntent.url` — coupang.com 포함 시

## 지원 URL 패턴
- `https://link.coupang.com/re/...` (단축)
- `https://www.coupang.com/vp/products/...` (상품 직접)
- `https://m.coupang.com/vm/products/...` (모바일)

## 플랫폼별 참고
- **iOS**: Share Extension은 앱 본체와 별도 프로세스 → App Group으로 데이터 공유
- **Android**: `delay 600ms` 적용 (라우팅 안정성)
- **iOS 쿠팡 앱 인터셉트**: 쿠팡 앱이 share intent를 가로채는 경우 있음 → 스크래핑 시 재시도 로직 구현 완료

## app.config.js 설정
```js
["expo-share-intent", {
  iosShareExtensionName: "AigoShareExtension",
  iosActivationRules: {
    NSExtensionActivationSupportsText: true,
    NSExtensionActivationSupportsWebURLWithMaxCount: 1,
  },
}]
```

## 구현 파일
| 파일 | 역할 |
|------|------|
| `app/_layout.tsx` | ShareIntentProvider + ShareIntentHandler |
| `app/shareintent.tsx` | 라우팅 대상 화면 (로딩 표시) |
| `app/+native-intent.tsx` | 네이티브 intent → expo-router 경로 변환 |
| `app/modal/add-item.tsx` | sharedUrl params 수신 → 스크래핑 → 저장 |
