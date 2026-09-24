import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma.service';

const APPROVED_OUTBOUND_NUMBERS = new Set(['+18605001016', '+19593333361']);
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

type LaunchSessionInput = {
  destinationNumber?: unknown;
  contactName?: unknown;
  selectedOutboundNumber?: unknown;
};

type WebRtcSessionResponse = {
  webRtcToken?: unknown;
  expiresAt?: unknown;
  clientState?: unknown;
  callLogId?: unknown;
};

type SmsInput = {
  orderId?: unknown;
  selectedOutboundNumber?: unknown;
  message?: unknown;
  recipients?: unknown;
};

@Injectable()
export class VoxiqService {
  private readonly logger = new Logger(VoxiqService.name);
  constructor(private readonly prisma: PrismaService) {}

  async createLaunchSession(authenticatedUser: { sub?: unknown }, input: unknown) {
    const request = this.validateRequest(input);
    this.requireAuthenticatedUser(authenticatedUser);

    const { baseUrl, apiKey } = this.getConfiguration();
    let response: { status: number; data?: { launchUrl?: unknown } };
    try {
      response = await axios.post(
        new URL('/api/integrations/click-to-call/launch-session', baseUrl).toString(),
        {
          destinationNumber: request.destinationNumber,
          contactName: request.contactName,
          selectedOutboundNumber: request.selectedOutboundNumber,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10_000,
          validateStatus: () => true,
        },
      );
    } catch {
      throw new BadGatewayException('Unable to create a Voxiq call session.');
    }

    if (response.status === 404) {
      throw new ServiceUnavailableException('Voxiq launch service is unavailable. Please contact your Voxiq administrator.');
    }
    if (response.status === 400) {
      this.logger.warn('Voxiq rejected a click-to-call request (HTTP 400).');
      throw new BadRequestException('Voxiq rejected this call request. Confirm the customer number and selected outgoing number.');
    }
    if (response.status === 401 || response.status === 403) {
      this.logger.warn(`Voxiq integration authorization failed (HTTP ${response.status}).`);
      throw new ServiceUnavailableException('Voxiq integration authorization failed. Please contact your Voxiq administrator.');
    }
    if (response.status === 429) {
      this.logger.warn('Voxiq rate limit reached for click-to-call sessions.');
      throw new HttpException('Too many Voxiq call requests. Please try again shortly.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (response.status < 200 || response.status >= 300 || !this.isSafeLaunchUrl(response.data?.launchUrl, baseUrl)) {
      this.logger.warn(`Voxiq launch session failed (HTTP ${response.status}).`);
      throw new BadGatewayException('Unable to create a Voxiq call session.');
    }

    return { launchUrl: response.data!.launchUrl as string };
  }

  async createWebRtcSession(authenticatedUser: { sub?: unknown }, input: unknown) {
    const request = this.validateRequest(input);
    this.requireAuthenticatedUser(authenticatedUser);

    const { baseUrl, apiKey } = this.getConfiguration();
    let response: { status: number; data?: WebRtcSessionResponse };
    try {
      response = await axios.post(
        new URL('/api/integrations/click-to-call/webrtc-session', baseUrl).toString(),
        request,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10_000,
          validateStatus: () => true,
        },
      );
    } catch {
      throw new BadGatewayException('Unable to create a Voxiq WebRTC session.');
    }

    this.throwForVoxiqStatus(response.status, 'WebRTC session');
    if (typeof response.data?.webRtcToken !== 'string' || !response.data.webRtcToken.trim()) {
      this.logger.warn('Voxiq WebRTC session returned an invalid response.');
      throw new BadGatewayException('Unable to create a Voxiq WebRTC session.');
    }
    if (typeof response.data?.clientState !== 'string' || !response.data.clientState.trim()) {
      this.logger.warn('Voxiq WebRTC session did not include client state.');
      throw new BadGatewayException('Unable to create a Voxiq WebRTC session.');
    }

    return {
      webRtcToken: response.data.webRtcToken,
      expiresAt: typeof response.data.expiresAt === 'string' ? response.data.expiresAt : undefined,
      destinationNumber: request.destinationNumber,
      contactName: request.contactName,
      selectedOutboundNumber: request.selectedOutboundNumber,
      clientState: response.data.clientState,
      callLogId: typeof response.data.callLogId === 'string' ? response.data.callLogId : undefined,
    };
  }

  async sendTransactionalSms(authenticatedUser: { sub?: unknown }, input: unknown) {
    this.requireAuthenticatedUser(authenticatedUser);
    const request = this.validateSmsRequest(input);
    const existing = await this.prisma.orderSmsNotification.findMany({ where: { orderId: request.orderId, driverId: { in: request.recipients.map(r => r.driverId) }, notificationType: 'order_created' } });
    const recipients = request.recipients.filter(recipient => !existing.some(record => record.driverId === recipient.driverId && record.status !== 'failed'));
    if (!recipients.length) return { totalRecipients: request.recipients.length, sent: 0, failed: 0, skipped: request.recipients.length, results: [] };
    const order = await this.prisma.specialOrder.findUnique({ where: { id: request.orderId } });
    if (!order) throw new BadRequestException('Order not found.');
    const targetIds = order.targetType === 'all' ? recipients.map(r => r.driverId) : ((order.targetDriverIds as number[]) || []);
    if (recipients.some(r => !targetIds.includes(r.driverId))) throw new BadRequestException('SMS recipients must be selected for this order.');
    const drivers = await this.prisma.user.findMany({ where: { driverId: { in: recipients.map(r => r.driverId) }, smsOptedOut: false }, select: { driverId: true, phoneNumber: true, fullName: true } });
    const normalizeE164 = (raw: string | null): string | null => { if (!raw) return null; const d = raw.replace(/\D/g, ''); if (d.length === 10) return `+1${d}`; if (d.length === 11 && d.startsWith('1')) return `+${d}`; return null; };
    if (drivers.length !== recipients.length || recipients.some(r => !drivers.some(d => d.driverId === r.driverId && normalizeE164(d.phoneNumber) === r.phoneNumber))) throw new BadRequestException('A selected driver is opted out or has no matching phone number.');
    const { baseUrl, apiKey } = this.getConfiguration();
    let response: { status: number; data?: unknown };
    try {
      response = await axios.post(
        new URL('/api/integrations/click-to-call/sms/send', baseUrl).toString(),
        { selectedOutboundNumber: request.selectedOutboundNumber, messagePurpose: 'transactional', message: request.message, recipients: recipients.map(({ phoneNumber, name }) => ({ phoneNumber, name })) },
        { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 10_000, validateStatus: () => true },
      );
    } catch (err: any) {
      this.logger.error('Voxiq SMS axios error:', err?.message ?? err);
      throw new BadGatewayException('Unable to send Voxiq driver notifications.');
    }
    this.throwForVoxiqStatus(response.status, 'SMS notification');
    const data = response.data as { results?: { phoneNumber?: string; status?: string; messageId?: string }[]; sent?: number; failed?: number };
    await Promise.all(recipients.map(async recipient => {
      const result = data.results?.find(item => item.phoneNumber === recipient.phoneNumber);
      await this.prisma.orderSmsNotification.upsert({
        where: { orderId_driverId_notificationType: { orderId: request.orderId, driverId: recipient.driverId, notificationType: 'order_created' } },
        create: { orderId: request.orderId, driverId: recipient.driverId, notificationType: 'order_created', status: result?.status === 'queued' ? 'queued' : 'failed', selectedOutboundNumber: request.selectedOutboundNumber, messageId: result?.messageId },
        update: { status: result?.status === 'queued' ? 'queued' : 'failed', selectedOutboundNumber: request.selectedOutboundNumber, messageId: result?.messageId },
      });
    }));
    return data;
  }

  private validateRequest(input: unknown) {
    const body = (input && typeof input === 'object' ? input : {}) as LaunchSessionInput;
    const destinationNumber = typeof body.destinationNumber === 'string' ? body.destinationNumber.trim() : '';
    const contactName = typeof body.contactName === 'string' ? body.contactName.trim() : '';
    const selectedOutboundNumber = typeof body.selectedOutboundNumber === 'string' ? body.selectedOutboundNumber.trim() : '';

    if (!E164_PATTERN.test(destinationNumber)) {
      throw new BadRequestException('A valid customer phone number is required.');
    }
    if (!APPROVED_OUTBOUND_NUMBERS.has(selectedOutboundNumber)) {
      throw new BadRequestException('Select an approved outgoing number.');
    }
    if (!contactName || contactName.length > 200) {
      throw new BadRequestException('A valid contact name is required.');
    }
    return { destinationNumber, contactName, selectedOutboundNumber };
  }

  private validateSmsRequest(input: unknown) {
    const body = (input && typeof input === 'object' ? input : {}) as SmsInput;
    const orderId = Number(body.orderId);
    const selectedOutboundNumber = typeof body.selectedOutboundNumber === 'string' ? body.selectedOutboundNumber.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const recipients = Array.isArray(body.recipients) ? body.recipients : [];
    if (!Number.isInteger(orderId) || orderId <= 0) throw new BadRequestException('A saved order is required.');
    if (!APPROVED_OUTBOUND_NUMBERS.has(selectedOutboundNumber)) throw new BadRequestException('Select an approved outgoing number.');
    if (!message || /[^\x20-\x7E]/.test(message)) throw new BadRequestException('SMS message must use standard English characters only.');
    if (!recipients.length || recipients.length > 50) throw new BadRequestException('Select between 1 and 50 drivers.');
    const normalizedRecipients = recipients.map((recipient) => {
      const value = recipient && typeof recipient === 'object' ? recipient as { driverId?: unknown; phoneNumber?: unknown; name?: unknown } : {};
      const driverId = Number(value.driverId);
      const phoneNumber = typeof value.phoneNumber === 'string' ? value.phoneNumber.trim() : '';
      const name = typeof value.name === 'string' ? value.name.trim() : '';
      if (!Number.isInteger(driverId) || driverId <= 0 || !E164_PATTERN.test(phoneNumber) || !name || name.length > 200) throw new BadRequestException('Each selected driver needs a valid name and E.164 phone number.');
      return { driverId, phoneNumber, name };
    });
    return { orderId, selectedOutboundNumber, message, recipients: normalizedRecipients };
  }

  private requireAuthenticatedUser(authenticatedUser: { sub?: unknown }) {
    const userId = Number(authenticatedUser?.sub);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new UnauthorizedException('Authentication is required.');
    }
  }

  private throwForVoxiqStatus(status: number, operation: string) {
    if (status === 404) {
      throw new ServiceUnavailableException('Voxiq service is unavailable. Please contact your Voxiq administrator.');
    }
    if (status === 400) {
      this.logger.warn(`Voxiq rejected a ${operation} request (HTTP 400).`);
      throw new BadRequestException('Voxiq rejected this call request. Confirm the customer number and selected outgoing number.');
    }
    if (status === 401 || status === 403) {
      this.logger.warn(`Voxiq integration authorization failed (HTTP ${status}).`);
      throw new ServiceUnavailableException('Voxiq integration authorization failed. Please contact your Voxiq administrator.');
    }
    if (status === 429) {
      this.logger.warn(`Voxiq rate limit reached for ${operation}.`);
      throw new HttpException('Too many Voxiq call requests. Please try again shortly.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (status < 200 || status >= 300) {
      this.logger.warn(`Voxiq ${operation} failed (HTTP ${status}).`);
      throw new BadGatewayException('Unable to create a Voxiq call session.');
    }
  }

  private getConfiguration() {
    const configuredBaseUrl = process.env.VOXIQ_BASE_URL;
    const apiKey = process.env.VOXIQ_INTEGRATION_API_KEY;
    if (!configuredBaseUrl || !apiKey) {
      throw new ServiceUnavailableException('Voxiq integration is unavailable.');
    }

    let baseUrl: URL;
    try {
      baseUrl = new URL(configuredBaseUrl);
    } catch {
      throw new ServiceUnavailableException('Voxiq integration is unavailable.');
    }
    if (baseUrl.protocol !== 'https:') {
      throw new ServiceUnavailableException('Voxiq integration is unavailable.');
    }
    return { baseUrl, apiKey };
  }

  private isSafeLaunchUrl(value: unknown, baseUrl: URL): value is string {
    if (typeof value !== 'string') return false;
    try {
      const launchUrl = new URL(value);
      return launchUrl.protocol === 'https:' && launchUrl.origin === baseUrl.origin && launchUrl.pathname === '/agent';
    } catch {
      return false;
    }
  }
}
