import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

const expo = new Expo();

export type AlertType =
  | 'target_reached'
  | 'price_drop'
  | 'lowest_ever'
  | 'lowest_no_target'
  | 'no_change'
  | 'repurchase';

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
  }
}

export async function sendSmartNotifications(
  targets: SmartPushTarget[],
): Promise<string[]> {
  if (targets.length === 0) return [];

  const invalidTokens: string[] = [];

  const messages: ExpoPushMessage[] = targets
    .filter((t) => Expo.isExpoPushToken(t.token))
    .map((t) => {
      const { title, body } = buildMessage(t);
      return {
        to: t.token,
        sound: 'default' as const,
        title,
        body,
        data: { itemId: t.itemId, screen: 'detail', alertType: t.alertType },
      };
    });

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

  tickets.forEach((ticket, i) => {
    if (ticket.status === 'error') {
      const token = messages[i]?.to as string;
      if (
        ticket.details?.error === 'DeviceNotRegistered' ||
        ticket.details?.error === 'InvalidCredentials'
      ) {
        console.log('[Push] 만료 토큰:', token?.slice(0, 30));
        if (token) invalidTokens.push(token);
      }
    }
  });

  return invalidTokens;
}
