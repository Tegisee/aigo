# 미해결 이슈 (Open Issues)

CLAUDE.md에서 분리된 미해결 이슈 상세본. CLAUDE.md에는 1줄 요약만 두고 본 문서로 링크한다.

우선순위:
- 🟠 **P1** — 스토어 검토 / 인프라 검증 (출시·운영 영향)
- 🟡 **P2** — UX 개선 / 기존 UX 버그 / Phase 3 UI 후속
- 🟢 **낮음** — 후순위 기능

---

## 🟠 P1 — 스토어 검토 + 인프라 검증

### STORE-APPLE: App Store 1.0.8(22) 심사 회신 대기
- 1.0.6(20)/1.0.7(21)/1.0.8(22) 누적 제출 상태. Apple 회신 대기.

### STORE-PLAY: Play Store 1.0.8 vc81 프로덕션 승급 결정
- 내부 테스트 업로드 완료 → 프로덕션 승급 의사결정 단계.

### CRON-BABY-GROUP: baby-category 그룹별 yml 4개 schedule 첫 자동 실행 검증
- group1(01:20 KST) / group2(01:35) / group3(03:00) / group4(03:20) 첫 자동 실행 결과 확인 필요.

### CRON-GREETER: aigo-daily-greeter schedule 활성화 후 첫 실 트래픽 모니터링
- workflow_dispatch에서 mode=morning/evening dry_run=1 → skip 사유 확인 → dry_run=0 본인 토큰 단독 발송 → schedule 활성화 순.
- 권장 cron: `30 22 * * *`(07:30 KST morning) + `0 11 * * *`(20:00 KST evening).

### MON-SEARCH-LIMIT: search API limit 10 적용 후 적재량 영향
- baby-category 슬러그당 의도 범위 15~25 / event 이벤트당 30~40 충족 여부. 부족 시 키워드 추가 또는 PRODUCTS_PER_EVENT 조정.

### MON-BABY-NOTIFIER: baby-category-notifier 상품별 발송(B) 첫 실 트래픽
- 사용자당 알림 수 분포 확인. 폭탄 우려 시 dropAmount 상위 N개 상한 적용.

### MON-EVENTS-MULTI-KEYWORD: events.ts 다중 키워드 cron 첫 실행 검증
- PER_KEYWORD 20→10 영향 / 124콜 5분 내 종료 확인.

### MON-FUNCTIONS-COST: Functions `minInstances: 1` 운영 비용 모니터링
- asia-northeast3 무료 티어 초과분 모니터링.

### MON-TOKEN-DEDUP: price-checker token-dedup + swap (5/8 이식) 첫 실 트래픽
- `[ActiveUsers]` 로그로 aigo / dup / swap / skip 분포 확인.
- swap이 자주 발생하면 anon 재로그인 흔적, jigumiya skip 다수면 통합 프로젝트 발송 격리 정상.

---

## 🟡 P2 — UX 개선

### IMPROVE-A: 설정에 로그인된 구글 계정 이메일/이름 표시

### AIGO-BUG-04: 와우회원 필드
- 사양 정리 필요.

### AIGO-BUG-05: 익명 로그인 사용자에게 구글 연동 가능 표기

### GRAPH-Y-AXIS: 그래프 Y축 가격 라벨 버그
- 1~2일 가격 변동 누적 후 재현 확인.

### ANNOUNCE-INFRA: 공지사항 팝업 + 전체 푸시 인프라
- Firestore announcements 컬렉션 + 마지막 본 ID 비교 패턴.

---

## 🟡 P2 — 기존 UX 버그

### BUG-36: 접종 리스트 등록 후 나중에 체크

### BUG-37: 월령별 추천 카테고리 복수선택 해제 안 됨

### BUG-39: 구글 로그인 데이터 복원 간헐적 미적용
- vc69 검증 후 미해결.

### AIGO-BUG-06: 관심상품 자녀 칩 높이 흔들림
- vc73~78 5회 미해결.
- 가설: fontWeight 500↔600 라인 메트릭 차이.
- 다음 시도: ScrollView → View / Pressable+onLayout / fontWeight 단일화.
- 상세 이력: `archive/04_v1.0.6_vc72_vc78_이력.md`

---

## 🟡 P2 — Phase 3 UI 후속

### NAV-BABY-CATEGORY: baby-category 탭 라우팅
- 푸시 `screen=baby-category` + slugs[] 도착 시 홈 탭에서 해당 월령별 섹션 자동 스크롤/하이라이트.

### NAV-PRICE-DROP: 가격 하락 알림 동선 개선
- 홈 → 카테고리 → 상품 카드 흐름 개선.

---

## 🟢 낮음

### BABY-INFO-API-2: 육아정보 API 2단계 (L)
