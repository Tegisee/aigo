/**
 * 아이고 morning / evening 인사 알림 cron.
 *
 * 동작:
 *   1. MODE 환경변수 (morning / evening) 검증
 *   2. users 컬렉션 순회 — app === 'aigo' + token + notificationEnabled + 토큰 형식 + KST 날짜 가드
 *   3. KST 요일별 단일 문구 1개 픽 → 사용자별 1알림 발송
 *   4. 발송 성공 사용자에 lastAigoMorningKstDate 또는 lastAigoEveningKstDate = 오늘 KST 날짜 갱신
 *   5. 만료 토큰(DeviceNotRegistered/InvalidCredentials) 정리
 *
 * 환경변수:
 *   FIREBASE_SERVICE_ACCOUNT_KEY    Admin SDK 인증 (jigumiya 통합 프로젝트)
 *   MODE                            'morning' | 'evening' (필수)
 *   DRY_RUN                         '1' 지정 시 실제 push 미발송 (디버그용)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import {
  pickGreetingMessage,
  todayKstDateStr,
  type GreetingMode,
} from './messages.js';

const DRY_RUN = process.env.DRY_RUN === '1';

const expo = new Expo();

function parseMode(raw: string | undefined): GreetingMode {
  if (raw === 'morning' || raw === 'evening') return raw;
  throw new Error(`MODE 환경변수가 'morning' 또는 'evening' 이어야 합니다 (현재: "${raw ?? ''}")`);
}

async function cleanupInvalidUsers(
  db: FirebaseFirestore.Firestore,
  invalidTokens: string[],
) {
  if (invalidTokens.length === 0) return;
  const tokenSet = new Set(invalidTokens);
  const usersSnap = await db.collection('users').get();
  let cleaned = 0;
  for (const userDoc of usersSnap.docs) {
    const token = userDoc.data().expoPushToken;
    if (!token || !tokenSet.has(token)) continue;
    await userDoc.ref.update({ expoPushToken: null });
    cleaned += 1;
  }
  console.log(`[AigoGreeter] 만료 토큰 정리: ${cleaned}건`);
}

/**
 * 푸시 발송. chunk 단위 try/catch + batch 거절 시 1건씩 fallback (다른 EAS projectId 토큰 혼재 방어).
 *
 * 반환:
 *   - successfulTokens: ticket.status === 'ok'로 응답된 토큰 (KST 가드 갱신 대상)
 *   - invalidTokens: DeviceNotRegistered / InvalidCredentials 토큰 (cleanup 대상)
 */
async function sendChunked(
  messages: ExpoPushMessage[],
): Promise<{ successfulTokens: Set<string>; invalidTokens: string[] }> {
  const successfulTokens = new Set<string>();
  const invalidTokens: string[] = [];

  if (messages.length === 0) return { successfulTokens, invalidTokens };

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    let tickets: ExpoPushTicket[] = [];
    try {
      tickets = await expo.sendPushNotificationsAsync(chunk);
      console.log('[AigoGreeter] 발송:', tickets.length, '건');
    } catch (e) {
      console.warn(
        '[AigoGreeter] batch 거절 → 1건씩 재시도:',
        e instanceof Error ? e.message.slice(0, 200) : String(e),
      );
      tickets = [];
      for (const m of chunk) {
        try {
          const single = await expo.sendPushNotificationsAsync([m]);
          tickets.push(...single);
        } catch (innerE) {
          const tokenStr =
            typeof m.to === 'string' ? m.to : Array.isArray(m.to) ? m.to[0] : '';
          console.warn(
            '[AigoGreeter] 단건 실패:',
            tokenStr?.slice(0, 30),
            innerE instanceof Error ? innerE.message.slice(0, 120) : String(innerE),
          );
          tickets.push({
            status: 'error',
            message: innerE instanceof Error ? innerE.message : String(innerE),
            details: { error: 'ProviderError' },
          } as unknown as ExpoPushTicket);
        }
      }
    }

    tickets.forEach((ticket, i) => {
      const m = chunk[i];
      const token =
        typeof m?.to === 'string' ? m.to : Array.isArray(m?.to) ? m.to[0] : '';
      if (ticket.status === 'ok') {
        if (token) successfulTokens.add(token);
      } else if (ticket.status === 'error') {
        const code = ticket.details?.error;
        if (code === 'DeviceNotRegistered' || code === 'InvalidCredentials') {
          console.log('[AigoGreeter] 만료 토큰:', token?.slice(0, 30), `(code=${code})`);
          if (token) invalidTokens.push(token);
        } else {
          console.log(
            '[AigoGreeter][DEBUG] 판정 제외 에러:',
            token?.slice(0, 30),
            `(code=${code ?? 'unknown'}, message="${ticket.message}")`,
          );
        }
      }
    });
  }

  return { successfulTokens, invalidTokens };
}

async function main() {
  const mode = parseMode(process.env.MODE);
  console.log(
    `[AigoGreeter] 시작: mode=${mode}`,
    new Date().toISOString(),
    DRY_RUN ? '(DRY_RUN)' : '',
  );

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const dateStr = todayKstDateStr();
  const guardField = mode === 'morning' ? 'lastAigoMorningKstDate' : 'lastAigoEveningKstDate';
  const { title, body } = pickGreetingMessage(mode);
  console.log(`[AigoGreeter] 본문 KST=${dateStr} title="${title}" body="${body}"`);

  const usersSnap = await db.collection('users').get();
  console.log(`[AigoGreeter] 전체 유저: ${usersSnap.size}명`);

  const messages: ExpoPushMessage[] = [];
  const targetUids: string[] = []; // messages와 동일 인덱스 — 발송 후 KST 가드 갱신
  const skipReasons: Record<string, number> = {};
  const inc = (k: string) => {
    skipReasons[k] = (skipReasons[k] || 0) + 1;
  };
  // 동일 expoPushToken을 공유하는 uid 중복 제거 — 재설치/익명 재로그인으로 같은 device token이
  // 여러 user doc에 등록된 경우 한 사이클에 같은 token으로 N번 push 되는 사고 차단.
  // 첫 등장 uid만 보존 (Firestore default ordering = doc id asc → 안정적).
  const seenTokens = new Map<string, string>();

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    const uid = userDoc.id;
    const token = userData.expoPushToken as string | undefined;
    const notifEnabled = userData.notificationEnabled !== false;

    if (!token) {
      inc('no-token');
      continue;
    }
    if (!notifEnabled) {
      inc('notif-off');
      continue;
    }
    if (!Expo.isExpoPushToken(token)) {
      inc('invalid-format');
      continue;
    }

    // 앱 필터 — app === 'aigo' strict (legacy null 사용자는 발송 대상에서 제외해 jigumiya 토큰 오발송 방지).
    const userApp = userData.app as string | undefined;
    if (userApp !== 'aigo') {
      inc(`app-skip-${userApp ?? 'null'}`);
      continue;
    }

    // 동일 token 중복 uid 제거 (KST 가드 이전 적용 — 첫 uid만 발송/가드 갱신 대상).
    const firstUid = seenTokens.get(token);
    if (firstUid) {
      inc('dup-token');
      console.log(
        `[AigoGreeter] dup-token uid=${uid} kept-first=${firstUid} token=${token.slice(0, 30)}…`,
      );
      continue;
    }
    seenTokens.set(token, uid);

    // KST 날짜 가드 — 같은 KST 날짜에 같은 mode 알림 이미 발송했으면 스킵.
    const lastKstDate = userData[guardField] as string | undefined;
    if (lastKstDate === dateStr) {
      inc('same-kst-date');
      continue;
    }

    messages.push({
      to: token,
      sound: 'default' as const,
      title,
      body,
      priority: 'high' as const,
      data: {
        type: 'daily_greeting',
        mode,
        screen: 'home',
      },
    });
    targetUids.push(uid);
  }

  console.log(
    `[AigoGreeter] 발송 대상: ${messages.length}건, skip 사유: ${JSON.stringify(skipReasons)}`,
  );

  if (DRY_RUN) {
    console.log('[AigoGreeter] DRY_RUN — 실제 발송 스킵, 종료');
    return;
  }
  if (messages.length === 0) {
    console.log('[AigoGreeter] 발송 대상 0건 — 종료');
    return;
  }

  const { successfulTokens, invalidTokens } = await sendChunked(messages);

  console.log(
    `[AigoGreeter] 발송 성공 토큰: ${successfulTokens.size}/${messages.length} (만료 토큰 ${invalidTokens.length}건)`,
  );

  // 발송 성공한 토큰의 uid만 추려 KST 가드 갱신 (미발송 사용자는 가드 박히지 않음).
  const successUidSet = new Set<string>();
  messages.forEach((m, i) => {
    const token =
      typeof m.to === 'string' ? m.to : Array.isArray(m.to) ? m.to[0] : '';
    if (token && successfulTokens.has(token)) {
      const uid = targetUids[i];
      if (uid) successUidSet.add(uid);
    }
  });
  for (const uid of successUidSet) {
    try {
      await db.collection('users').doc(uid).update({ [guardField]: dateStr });
    } catch (e) {
      console.warn(`[AigoGreeter] ${guardField} 갱신 실패 uid=${uid}:`, e);
    }
  }
  console.log(
    `[AigoGreeter] ${guardField}=${dateStr} 갱신 ${successUidSet.size}명 / 만료 토큰 ${invalidTokens.length}건`,
  );

  await cleanupInvalidUsers(db, invalidTokens);

  console.log('[AigoGreeter] 종료');
}

main().catch((e) => {
  console.error('[AigoGreeter] 치명적 오류:', e);
  process.exit(1);
});
