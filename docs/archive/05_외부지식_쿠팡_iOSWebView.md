# 외부 지식 — 쿠팡 Rate Limit + iOS WebView 노하우

## 쿠팡 파트너스 공식 Rate Limit
- 검색 API: **1분당 50회**
- 리포트 API: **1시간당 500회**
- 모든 API 합산: **1분당 100회**
- 링크 생성(/deeplink): **1분당 50회**

## Rate Limit 초과 이력 / 정책
- 분당 50회 초과 누적: 1회·2회 → 자동 해제 (24h), 3회 → 계정 이용 제한 (소명 필요)
- 2026-04-24: 재시도 루프 burst로 분당 110회 호출 → 파트너스 계정 정지 → 소명 후 해제
- **재시도 루프 제거**: 상품당 1회 검색, 실패 시 스킵 (burst 차단)

## Phase 3 확정 cron 스케줄 (2026-04-24 시점 계획, 실제는 단일 통합 cron으로 변경됨)
- **공유상품 업데이트 (구안)**: 02:00 / 03:00 / 04:00 KST + 낮시간 최소 2회
- **지금이야 알림 (구안)**: 11:30 / 20:30 KST
- **아이고 알림 (구안)**: 10:00 / 19:00 KST

→ 실제로는 04:30~01:00 KST 분당 40회 단일 통합 cron(jigumiya 레포)으로 변경. CLAUDE.md "가격 체크 cron 관리 정책" 참조.

---

## iOS WebView 쿠팡 튕김 현상 (형제앱 지금이야 해결 내용)

### 증상
iOS WebView에서 쿠팡 URL 로드 시 Universal Link로 인해 쿠팡 앱으로 튕기는 현상

### 원인
link.coupang.com 단축 URL → 리다이렉트 → coupang:// 딥링크 트리거

### 해결책
1. `onShouldStartLoadWithRequest`에서 `coupang://`, `coupangapp://` 차단
2. `allowsBackForwardNavigationGestures={false}` 설정
3. WebView에 `html` prop으로 HTML 직접 전달 (URL 탐색 없음)
4. `BLOCK_DEEPLINK_JS`에 `coupangapp://` 추가

### 결과
2~3회 튕김 → 1회로 감소 (1회는 iOS 시스템 레벨이라 완전 차단 불가)

### 추가 시도 가능
- `expo-web-browser` (SFSafariViewController) 사용 시 튕김 없으나 JS 인젝션 불가 → 스크래핑 구조 변경 필요

### 참고 파일
- 지금이야 CoupangScraper.tsx, add-item.tsx
