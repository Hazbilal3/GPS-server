import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  async sendToMany(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    const valid = tokens.filter((t) => t && t.startsWith('ExponentPushToken'));
    if (valid.length === 0) return;

    const messages = valid.map((to) => ({
      to,
      title,
      body,
      sound: 'default',
      data: data ?? {},
    }));

    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(messages),
      });
      const result = await res.json() as any;
      this.logger.log(`Expo push sent to ${valid.length} device(s): ${JSON.stringify(result?.data ?? result)}`);
    } catch (err) {
      this.logger.error('Expo push notification failed', err);
    }
  }
}