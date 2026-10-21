import { logger } from './logger';

/**
 * 메일 발송. 지금은 Resend(https://resend.com) HTTP API만 지원한다.
 * RESEND_API_KEY·MAIL_FROM(인증한 도메인의 주소, 예: "맘브릿지 <no-reply@mombridge.kr>")이 없으면 발송하지 않는다.
 */
export interface Mail { to: string; subject: string; text: string; html?: string }

export const mailConfigured = () => !!process.env.RESEND_API_KEY && !!process.env.MAIL_FROM;

/** 테스트에서 발송 대신 내용을 확인할 수 있게 바꿔 끼우는 지점 */
export const mailer = {
  async send(mail: Mail): Promise<void> {
    if (!mailConfigured()) throw new Error('mail is not configured');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // 응답 본문에 수신자 주소가 들어 있을 수 있어 상태 코드만 남긴다
      logger.error('mail send failed', { status: res.status });
      throw new Error(`mail send failed: ${res.status}`);
    }
  },
};
