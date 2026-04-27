# 019. Phase 3 공유 컬렉션 설계 (지금이야 + 아이고)

## 상태: 설계 확정 (2026-04-27)

지금이야 ↔ 아이고가 동일한 Firebase 프로젝트(`jigumiya`)를 공유하면서 양 앱에 의미있는 데이터를 cron으로 적재하고, 클라이언트는 read 전용으로 사용하는 구조.

---

## §1. 컬렉션 공유 원칙

- 모든 Firebase 컬렉션은 **지금이야 + 아이고 양쪽 공유** (단일 진실의 원천)
- 적재(cron, write)는 한쪽 앱이 책임지되 결과는 양 앱이 read
- 클라이언트는 쿠팡 파트너스 API 직접 호출 0회를 목표로 함
- cron 호출량은 분당 50회 한도(검색 API) 대비 보수적으로 설정

---

## §2. 컬렉션 구조

| 컬렉션 | 적재 주체 | 사용 주체 | 비고 |
|--------|----------|----------|------|
| `category_best/{categoryId}` | 지금이야 cron | 지금이야 + 아이고 | 쿠팡 공식 19개 categoryId 베스트셀러 |
| `category_best_baby/{slug}` | 아이고 cron | 지금이야 + 아이고 | BabyCategory 월령별 세분화 베스트셀러 |
| `event_best/{eventSlug}` | 아이고 cron | 지금이야 + 아이고 | 기념일/시즌/부모 31개 키워드 (minPrice 30,000원) |
| `shared_products/{productId}` | 양쪽 cron | 양쪽 | trackerCount/purchaseCount + 가격 이력 |
| `price_drops/{dropId}` | 지금이야 cron | 양쪽 | 가격 하락 발생 시 기록 (dropRate, trackerCount, deepLink) |

### 데이터 모델 (요약)

```
category_best_baby/{slug}
{
  category, slug, keyword, displayOrder,
  updatedAt: number,
  products: [{ productId, productName, productPrice, productImage, productUrl, isRocket }]
}

event_best/{eventSlug}
{
  eventSlug, eventName, eventType: 'anniversary' | 'season' | 'parent',
  keyword, minPrice: 30000,
  updatedAt: number,
  products: [...]
}
```

---

## §3. cron 확정 스케줄 (KST)

| 시각 | 작업 | 앱 | 비고 |
|------|------|-----|------|
| 01:00 | event-best-updater | 아이고 | 기념일 31개 키워드, minPrice=30,000 |
| 01:15 | baby 1그룹 | 아이고 | 장난감 + 의류 (16구간) |
| 01:30 | baby 2그룹 | 아이고 | 신발 + 도서 + 학습교구 (14구간) |
| 02:00 | category_best | 지금이야 | 19개 categoryId, sleep 80s |
| 03:00 | baby 3그룹 | 아이고 | 소모품: 기저귀 5구간 + 분유 3구간 + 물티슈 + 수유용품 |
| 03:20 | baby 4그룹 | 아이고 | 나머지 BabyCategory |
| 04:30 ~ 01:00 (익일) | shared_products price-check | 통합 | 20.5h 장기 cron, 분당 최대 40회, 순번 기준 순차 (§10-1) |

**시간대 분리 이유**: 분당 50회 한도 대비 동시 호출 방지 + 02:00~04:00에 모든 적재 완료 → 04:30 가격 체크 시작 시점에 category_best 캐시 모두 신선.

**낮 보조 업데이트 없음**: rate-limited 감지 시 당일 즉시 중단이 원칙. 낮시간 재실행/추가 호출 없음 (§10-5).

---

## §4. baby-categories.ts 월령별 세분화 기준

### §4-1. 월령 구간 (8단계)

| 구간 | 월령 |
|------|------|
| 신생아 | 0–3개월 |
| 초기영아 | 4–6개월 |
| 후기영아 | 7–12개월 |
| 초기유아 | 13–24개월 |
| 중기유아 | 25–36개월 |
| 후기유아 | 37–48개월 |
| 아동 | 49–72개월 |
| 학령기 | 73–84개월 |

### §4-2. 세분화 적용 카테고리

- **장난감 / 의류 / 신발 / 도서 / 학습교구**: 8단계 월령별 별도 키워드 (지속 노출 + 선물 카테고리)
- **소모품 월령별**:
  - 기저귀: 0–3 / 4–6 / 7–12 / 13–24 / 25–36 (5구간)
  - 분유: 0–3 / 4–6 / 7–12 (3구간)
  - 물티슈: 공통 (1구간)
  - 수유용품: 0–12 공통 (1구간)

### §4-3. cron 그룹 분배 근거

- 1그룹(01:15): 장난감 8 + 의류 8 = 16콜
- 2그룹(01:30): 신발 + 도서 + 학습교구 = 14콜
- 3그룹(03:00): 소모품 = 5+3+1+1 = 10콜
- 4그룹(03:20): 나머지 BabyCategory

---

## §5. event_best 카테고리 (31개)

### §5-1. 분류

**아이 기념일 (anniversary)** — 출생일 기준 D-Day
- 100일, 200일, 300일, 500일, 1000일, 돌
- 만 1세 ~ 만 13세 생일 (13개)

**시즌 (season)** — 매년 고정/음력
- 어린이날 (5/5)
- 크리스마스 (12/25)
- 핼러윈 (10/31)
- 설날 (음력 1/1)
- 추석 (음력 8/15)

**부모 자축 (parent)** — 매년 고정/사용자 설정
- 어버이날 (5/8)
- 발렌타인데이 (2/14)
- 화이트데이 (3/14)
- 부부의 날 (5/21)
- 엄마 생일 (사용자 설정)
- 아빠 생일 (사용자 설정)
- 결혼기념일 (사용자 설정)

### §5-2. 적재 조건

- 검색 시 `minPrice=30000` 적용 — 선물 가치 있는 상품만 적재
- 활성 기간(D-leadDays) 외에는 stale 데이터 그대로 둠 (cron이 매일 갱신)
- 클라이언트는 `services/events.ts`의 `getActiveEvents()`로 활성 이벤트만 표시

---

## §6. 호출 방식 (상세)

### §6-1. 호출 단위
- 월령별 키워드 1개 = 쿠팡 검색 API 1회 호출
- 호출당 상품 10개 반환 (`limit=10`)

### §6-2. 정렬
- 리뷰수 + 구매수 기반 인기순 (쿠팡 기본 정렬 활용)

### §6-3. 호출 간격
- 카테고리 사이 **2초 sleep** (분당 최대 30회 — 한도 50회 대비 안전)
- 보수 가정: 1호출 = 10회 카운팅 가능성 고려 → 분당 5카테고리 이하 유지

### §6-4. 안전장치
- HTTP 429 / `rMessage`에 "사용 횟수 초과" 또는 "rate" 포함 시 → `rateLimited=true`
- rate-limited 감지 시 cron **즉시 중단** (다음 회차로 이월)

### §6-5. event_best 전용
- `minPrice=30000` 파라미터 적용 (search API 자체 미지원 시 fetchLimit×3 후 클라이언트 필터)

---

## §7. 어제 완료한 작업 (2026-04-26)

### 지금이야
- v1.0.6 (bn40) 빌드 + iOS 심사 제출 + Android 프로덕션 승급
- `category_best` 19개 카테고리 Firebase 저장 (950개 상품)
- 카테고리 베스트 + 가격변동 탭 UI (4탭 구조)
- `price_drops` 컬렉션 설계 + `recordPriceDrop` 로직
- price-checker §4-2 중복 처리 로직 (`category-best-cache.ts`)

### 아이고
- Firebase `aigo-a` → `jigumiya` 통합 완료 (커밋 `0fdc5e3`)
- `scripts/baby-category-best-updater/` 신설 (23개 카테고리, 단순 매핑)
- 클라이언트 쿠팡 API 직접 호출 제거 → Firebase read로 교체 (커밋 `df32df7`)
- v1.0.5 (vc62) Android + iOS 빌드 완료

---

## §8. 다음 작업 순서

1. **`baby-categories.ts` 월령별 세분화 구현** — 장난감/의류/신발/도서/학습교구 8구간 + 소모품 월령별
2. **`scripts/event-best-updater/` 신설** — 31개 기념일, `minPrice=30000`
3. **GitHub Actions workflow 4개 yml 작성** — 01:00 / 01:15 / 01:30 / 03:00 / 03:20 KST
4. **Firestore Rules** — `category_best_baby` + `event_best` 규칙 추가 + 배포
5. **아이고 Play Console** — 내부 테스트 업로드 + 프로덕션 승급
6. **아이고 iOS** — TestFlight 업로드 + App Store 심사 제출
7. **수동 첫 적재** — `baby-category-best` + `event-best` workflow_dispatch
8. **가족 구매 테스트** — 파트너스 실적 검증
9. **cron 전체 재활성화** — 위 1~8 선결조건 모두 완료 후

---

## §10. Phase 3-B 운영 정책 (2026-04-27 확정)

### §10-1. shared_products 가격 체크 cron

| 항목 | 값 |
|------|-----|
| 실행 시간 | 매일 **04:30 ~ 01:00 KST (익일)** — 20.5시간 장기 cron |
| 호출 속도 | **분당 최대 40회** (한도 50/분 대비 안전 마진) |
| 처리 방식 | `shared_products` **순번 기준 순차 호출** |
| 당일 추가 상품 | 시작 시점 snapshot 기준 → 그 이후 등록 상품은 **다음날부터** 체크 대상 |
| rate-limited 감지 | **즉시 중단, 당일 재실행 없음** (다음날 04:30 정상 재개) |

**처리량 추정**: 1230분 × 40회 = 최대 49,200건/일. 분당 호출 간 1.5초 sleep + category_best 캐시(§7)로 실제 호출량 절감.

**기존 04:00 price-check 대체**: 지금이야 단독 04:00 cron → 04:30 통합 운영으로 일원화.

### §10-2. trackerCount 기반 정리

- `shared_products.trackerCount`는 **지금이야 + 아이고 합산** (양 앱 동일 컬렉션 공유)
- 정리 대상: `trackerCount === 0` (양 앱 모두에서 추적 해제됨)
- 정리 주기: §10-1 가격 체크 cron 종료 후 별도 단계 또는 주간 별도 cron
- 정리 시 `meta/stats.sharedProductCount` 동기 감산 (§10-3)

### §10-3. meta/stats 카운터 문서

```
meta/stats {
  sharedProductCount: number,
  ...
}
```

- `shared_products` **추가 시**: `meta/stats.sharedProductCount` ← `increment(+1)`
- `shared_products` **삭제 시**: `meta/stats.sharedProductCount` ← `increment(-1)`
- 클라이언트 트랜잭션으로 add/delete + counter 동시 갱신
- 양 앱 동일 카운터 공유 → 검색/통계용 전체 적재량 단일 진실 소스

**Firestore Rules 추가 필요** (jigumiya 단일 소스 갱신 후 배포):
```
match /meta/{docId} {
  allow read: if request.auth != null;
  allow update: if request.auth != null;  // counter increment 허용
}
```

### §10-4. 앱 내 검색 기능

- **검색 대상**: Firebase 내부 데이터만 (쿠팡 API 호출 0)
  - `category_best/{categoryId}` (지금이야 적재)
  - `category_best_baby/{slug}` (아이고 적재)
  - `event_best/{eventSlug}` (아이고 적재)
  - `shared_products/{productId}` (양 앱 적재)
- **이유**: 쿠팡 분당 50회 한도 보호 + 사용자가 추적 중이거나 cron이 적재한 상품만 노출 → 검증된 데이터
- **없는 상품 처리**: 검색 결과 0건 시 "추적 요청" 버튼 → 사용자가 URL/키워드 제출 → 다음 cron에서 적재 후보 (Phase 3-C 기능)

### §10-5. 낮 보조 업데이트 제거

- 기존 안: rate-limited 시 낮시간 보조 cron으로 재시도
- **확정**: rate-limited 감지 시 **당일 완전 중단**, 낮 재실행 없음
- 이유:
  1. burst 누적 시 파트너스 계정 정지 위험 (2026-04-24 사례 학습)
  2. 다음날 04:30 정상 재개 시 신선도 충분
  3. 단순한 운영 = 디버깅 비용 감소

---

## §11. 참고

- 지금이야 측 동일 설계 문서: `~/jigumiya/docs/019_Phase3_SharedProducts.md`
- 아이고 BabyCategory 정의: `types/index.ts` `BabyCategory` 타입 + `CATEGORY_TO_SLUG`
- 아이고 이벤트 정의: `services/events.ts` `getActiveEvents()`
- 아이고 cron 코드: `scripts/baby-category-best-updater/`
- 가격 체크 캐시: `scripts/price-checker/category-best-cache.ts` (지금이야 모듈 이식)
