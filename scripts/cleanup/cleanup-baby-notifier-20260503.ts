/**
 * 1회성 정리 스크립트 — 2026-05-03 07:30~08:30 KST 사이 baby-category-notifier cron이
 * Expo batch 거절(다른 EAS projectId 토큰 혼재)로 발송 0건/부분 실패임에도 불구하고,
 * 코드 버그(chunk 실패 시 ticket index 정합성 깨짐)로 잘못된 uid에 lastBabyDropAlertAt이
 * 박혔을 가능성에 대비해 해당 timestamp 범위를 unset.
 *
 * 환경 변수:
 *   FIREBASE_SERVICE_ACCOUNT_KEY  — 서비스 계정 JSON 문자열 (필수)
 *   DRY_RUN                       — "false" 면 실제 적용, 그 외 dry-run (기본 true)
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const keyEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!keyEnv) {
  console.error('FIREBASE_SERVICE_ACCOUNT_KEY env required');
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(keyEnv)) });
const db = getFirestore();

const DRY_RUN = (process.env.DRY_RUN ?? 'true') !== 'false';

// 2026-05-03 07:30~08:30 KST = 2026-05-02 22:30~23:30 UTC
const TARGET_TS_START = Date.UTC(2026, 4, 2, 22, 30, 0);
const TARGET_TS_END = Date.UTC(2026, 4, 2, 23, 30, 0);

async function main() {
  console.log(`[cleanup] DRY_RUN=${DRY_RUN}`);
  console.log(
    `[cleanup] lastBabyDropAlertAt 범위: ${new Date(
      TARGET_TS_START,
    ).toISOString()} ~ ${new Date(TARGET_TS_END).toISOString()}`,
  );

  const snap = await db.collection('users').get();
  let scanned = 0;
  let candidates = 0;
  let updated = 0;
  let outOfRange = 0;
  let noField = 0;

  for (const u of snap.docs) {
    scanned++;
    const data = u.data();
    const ts = data?.lastBabyDropAlertAt as number | undefined;
    if (typeof ts !== 'number') {
      noField++;
      continue;
    }
    if (ts < TARGET_TS_START || ts > TARGET_TS_END) {
      outOfRange++;
      continue;
    }

    candidates++;
    const tokenSlice =
      (data?.expoPushToken as string | undefined)?.slice(0, 30) ?? 'no-token';
    console.log(
      `  [후보 ${candidates}] uid=${u.id} lastBabyDropAlertAt=${new Date(ts).toISOString()} token=${tokenSlice}`,
    );

    if (DRY_RUN) continue;

    try {
      await u.ref.update({
        lastBabyDropAlertAt: FieldValue.delete(),
      });
      updated++;
    } catch (e) {
      console.warn(`  [실패] uid=${u.id}:`, e);
    }
  }

  console.log(
    `\n[cleanup] 완료 scanned=${scanned} noField=${noField} outOfRange=${outOfRange} candidates=${candidates} updated=${updated} dry=${DRY_RUN}`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
