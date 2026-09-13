import crypto from 'crypto';

export async function sendSMS(to: string, text: string): Promise<void> {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const sender = process.env.SOLAPI_SENDER_PHONE;

  // Gracefully skip if SMS is not configured
  if (!apiKey || !apiSecret || !sender) {
    console.log('[SMS SKIP] Not configured. Would send to:', to);
    return;
  }

  const phone = to.replace(/[^0-9]/g, '');
  if (!phone) return;

  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');

  const res = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
    },
    body: JSON.stringify({
      message: {
        to: phone,
        from: sender.replace(/[^0-9]/g, ''),
        text,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('[SMS ERROR]', err);
  }
}

// KakaoTalk 알림톡 - requires Solapi channel setup and template approval
// Set SOLAPI_KAKAO_CHANNEL_ID and SOLAPI_KAKAO_TEMPLATE_ID env vars to enable
export async function sendAlimTalk(to: string, templateId: string, variables: Record<string, string>, fallbackText: string): Promise<void> {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const channelId = process.env.SOLAPI_KAKAO_CHANNEL_ID;

  if (!apiKey || !apiSecret || !channelId) {
    // Fall back to SMS
    await sendSMS(to, fallbackText);
    return;
  }

  const phone = to.replace(/[^0-9]/g, '');
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');

  const res = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
    },
    body: JSON.stringify({
      message: {
        to: phone,
        from: process.env.SOLAPI_SENDER_PHONE?.replace(/[^0-9]/g, '') ?? '',
        type: 'ATA',
        kakaoOptions: {
          pfId: channelId,
          templateId,
          variables,
        },
      },
    }),
  });

  if (!res.ok) {
    console.error('[ALIMTALK ERROR]', await res.json().catch(() => ({})));
    // Fall back to SMS
    await sendSMS(to, fallbackText);
  }
}
