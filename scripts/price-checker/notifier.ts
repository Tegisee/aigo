import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

const expo = new Expo();

export type AlertType =
  | 'target_reached'
  | 'price_drop'
  | 'lowest_ever'
  | 'lowest_no_target'
  | 'no_change'
  | 'repurchase'
  | 'vaccine_overdue';

export interface SmartPushTarget {
  token: string;
  itemId: string;
  productName: string;
  alertType: AlertType;
  currentPrice: number;
  previousPrice: number;
  targetPrice: number;
  lowestPrice: number;
  noChangeDays: number;
  repurchaseDaysLeft?: number;
  childName?: string;
  vaccineName?: string;
}

function buildMessage(t: SmartPushTarget): { title: string; body: string } {
  const name = t.productName.length > 20
    ? t.productName.slice(0, 20) + '...'
    : t.productName;
  const cur = t.currentPrice.toLocaleString();
  const prev = t.previousPrice.toLocaleString();

  switch (t.alertType) {
    case 'target_reached':
      return {
        title: '아이고, 지금이 기회!',
        body: `${name} ${cur}원 — 목표가 도달!`,
      };

    case 'price_drop': {
      const hasTarget = t.targetPrice != null && t.targetPrice > 0;
      const gap = hasTarget ? t.targetPrice - t.currentPrice : 0;
      if (hasTarget && gap > 0) {
        return {
          title: '아이고~ 가격 떨어졌다!',
          body: `${name} ${prev}원 → ${cur}원! 목표가까지 ${gap.toLocaleString()}원`,
        };
      }
      return {
        title: '아이고~ 가격 떨어졌다!',
        body: `${name} ${prev}원 → ${cur}원!`,
      };
    }

    case 'lowest_ever':
      return {
        title: '역대 최저가!',
        body: `${name} ${cur}원 — 지금까지 가장 낮은 가격이에요!`,
      };

    case 'lowest_no_target':
      return {
        title: '최저가 갱신!',
        body: `${name} ${cur}원 — 알림 시작 후 가장 낮은 가격이에요`,
      };

    case 'no_change':
      return {
        title: '가격 변동 없음',
        body: `${name} ${t.noChangeDays}일째 가격 변동이 없어요. 슬슬 구매하실 때가 됐을까요?`,
      };

    case 'repurchase':
      return {
        title: '재구매 시기예요!',
        body: t.repurchaseDaysLeft != null && t.repurchaseDaysLeft <= 0
          ? `${name}, 슬슬 다 떨어질 때가 됐어요! 지금 가격 확인해보세요`
          : `${name}, 약 ${t.repurchaseDaysLeft}일 후 소진 예정이에요`,
      };

    case 'vaccine_overdue':
      return {
        title: '예방접종 확인해주세요 💉',
        body: `${t.childName || '아이'}의 ${t.vaccineName || '접종'} 접종 시기가 지났어요! 확인해보세요`,
      };
  }
}

export async function sendSmartNotifications(
  targets: SmartPushTarget[],
): Promise<string[]> {
  if (targets.length === 0) return [];

  const invalidTokens: string[] = [];

  const validTargets = targets.filter((t) => Expo.isExpoPushToken(t.token));
  const messages: ExpoPushMessage[] = validTargets.map((t) => {
    const { title, body } = buildMessage(t);
    // Android 채널: 가격 + 백신 = 'price' (HIGH), 재구매 = 'repurchase' (DEFAULT)
    // services/notifications.ts setNotificationChannelAsync 와 sync 유지
    const channelId = t.alertType === 'repurchase' ? 'repurchase' : 'price';
    return {
      to: t.token,
      sound: 'default' as const,
      title,
      body,
      priority: 'high' as const,
      channelId,
      data: {
        itemId: t.itemId,
        screen: t.alertType === 'vaccine_overdue' ? 'babyinfo' : 'detail',
        alertType: t.alertType,
      },
    };
  });

  // [DEBUG] 입력 통계
  const invalidFormatCount = targets.length - messages.length;
  console.log(
    `[Push][DEBUG] 입력: 전체 ${targets.length}건, 유효 ${messages.length}건, 형식오류 ${invalidFormatCount}건`,
  );
  if (invalidFormatCount > 0) {
    const invalidFormatTokens = targets
      .filter((t) => !Expo.isExpoPushToken(t.token))
      .slice(0, 5)
      .map((t) => t.token?.slice(0, 30) || '(null)');
    console.log('[Push][DEBUG] 형식오류 토큰 샘플:', invalidFormatTokens);
  }

  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];

  for (const chunk of chunks) {
    try {
      const result = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...result);
      console.log('[Push] 발송:', result.length, '건');
    } catch (e) {
      console.error('[Push] 발송 실패:', e);
    }
  }

  // [DEBUG] ticket status/error 집계
  const statusCount: Record<string, number> = {};
  const errorCount: Record<string, number> = {};
  const receiptIds: string[] = [];
  tickets.forEach((ticket) => {
    statusCount[ticket.status] = (statusCount[ticket.status] || 0) + 1;
    if (ticket.status === 'ok') {
      receiptIds.push(ticket.id);
    } else if (ticket.status === 'error') {
      const code = ticket.details?.error ?? '(no error code)';
      errorCount[code] = (errorCount[code] || 0) + 1;
    }
  });
  console.log('[Push][DEBUG] ticket status 집계:', JSON.stringify(statusCount));
  if (Object.keys(errorCount).length > 0) {
    console.log('[Push][DEBUG] ticket error 집계:', JSON.stringify(errorCount));
  }

  // [DEBUG] error ticket raw 전체 출력 (최대 10건)
  const errorTickets = tickets
    .map((ticket, i) => ({ ticket, i }))
    .filter(({ ticket }) => ticket.status === 'error');
  errorTickets.slice(0, 10).forEach(({ ticket, i }) => {
    const token = messages[i]?.to as string;
    if (ticket.status === 'error') {
      console.log(
        `[Push][DEBUG] error ticket #${i}:`,
        JSON.stringify({
          token: token ? token.slice(0, 30) + '...' : '(none)',
          message: ticket.message,
          details: ticket.details,
        }),
      );
    }
  });
  if (errorTickets.length > 10) {
    console.log(`[Push][DEBUG] ... error ticket 추가 ${errorTickets.length - 10}건 생략`);
  }

  // [DEBUG] 성공 ticket 1건 샘플 (receipt id 확인용)
  const firstOk = tickets.find((t) => t.status === 'ok');
  if (firstOk && firstOk.status === 'ok') {
    console.log('[Push][DEBUG] 성공 ticket 샘플 — receiptId:', firstOk.id);
  }

  // ── 만료 토큰 판정 ──
  tickets.forEach((ticket, i) => {
    if (ticket.status !== 'error') return;
    const token = messages[i]?.to as string;
    const code = ticket.details?.error;

    if (code === 'DeviceNotRegistered' || code === 'InvalidCredentials') {
      console.log('[Push] 만료 토큰:', token?.slice(0, 30), `(code=${code})`);
      if (token) invalidTokens.push(token);
    } else {
      // 만료 판정 제외된 기타 에러 — 추후 정책 재검토 필요
      console.log(
        '[Push][DEBUG] 판정 제외 에러:',
        token?.slice(0, 30),
        `(code=${code ?? 'unknown'}, message="${ticket.message}")`,
      );
    }
  });

  // ── Receipt 조회 (FCM/APNs 실제 전달 결과) ──
  // ticket은 Expo 서버 큐 진입 성공만 확인. 실제 기기 전달은 receipt로 확인해야 함.
  // Expo 권장: 15분 후 조회이지만 GitHub Actions 단발 실행이라 즉시 조회 시도 (일부만 잡힘)
  if (receiptIds.length > 0) {
    try {
      const receiptChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
      const receiptStatusCount: Record<string, number> = {};
      const receiptErrorCount: Record<string, number> = {};

      // ticket id → token 매핑 (id로 역추적)
      const idToToken = new Map<string, string>();
      tickets.forEach((ticket, i) => {
        if (ticket.status === 'ok') {
          idToToken.set(ticket.id, messages[i]?.to as string);
        }
      });

      for (const chunk of receiptChunks) {
        const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
        for (const [receiptId, receipt] of Object.entries(receipts)) {
          receiptStatusCount[receipt.status] =
            (receiptStatusCount[receipt.status] || 0) + 1;
          if (receipt.status === 'error') {
            // expo-server-sdk 타입에 MismatchSenderId가 포함 안 된 버전 대응
            const code: string = (receipt.details?.error as string | undefined) ?? '(no error code)';
            receiptErrorCount[code] = (receiptErrorCount[code] || 0) + 1;
            const token = idToToken.get(receiptId);
            console.log(
              `[Push][DEBUG] receipt error:`,
              JSON.stringify({
                token: token ? token.slice(0, 30) + '...' : '(unknown)',
                message: receipt.message,
                details: receipt.details,
              }),
            );
            if (
              token &&
              (code === 'DeviceNotRegistered' ||
                code === 'InvalidCredentials' ||
                code === 'MismatchSenderId')
            ) {
              console.log('[Push] 만료 토큰 (receipt):', token.slice(0, 30), `(code=${code})`);
              invalidTokens.push(token);
            }
          }
        }
      }
      console.log(
        '[Push][DEBUG] receipt status 집계:',
        JSON.stringify(receiptStatusCount),
        '조회된 receipt:',
        Object.values(receiptStatusCount).reduce((a, b) => a + b, 0),
        '/',
        receiptIds.length,
      );
      if (Object.keys(receiptErrorCount).length > 0) {
        console.log('[Push][DEBUG] receipt error 집계:', JSON.stringify(receiptErrorCount));
      }
    } catch (e) {
      console.error('[Push][DEBUG] receipt 조회 실패:', e);
    }
  }

  return invalidTokens;
}
