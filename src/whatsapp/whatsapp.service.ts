import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class WhatsAppService {
  private readonly token: string;
  private readonly phoneNumberId: string;
  private readonly baseUrl: string;
  private readonly isDev: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.token = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN') || '';
    this.phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '';
    this.baseUrl = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;
    this.isDev = this.configService.get<string>('NODE_ENV') === 'development' || !this.token || this.token.includes('your_');
  }

  /**
   * Helper to dynamically resolve Meta Credentials (accessToken, phoneNumberId) scoped to tenant.
   */
  private async getCredentials(hospitalId?: string): Promise<{ token: string; phoneId: string; isMock: boolean }> {
    let token = this.token;
    let phoneId = this.phoneNumberId;
    let isMock = this.isDev;

    if (hospitalId) {
      const channel = await this.prisma.whatsAppChannel.findFirst({
        where: { tenantId: hospitalId, status: 'ACTIVE' },
      });
      if (channel) {
        token = channel.accessToken;
        phoneId = channel.phoneNumberId;
        isMock = this.configService.get<string>('NODE_ENV') === 'development' || !token || token.includes('your_');
      }
    }

    return { token, phoneId, isMock };
  }

  // Send simple text message
  async sendMessage(to: string, text: string, hospitalId?: string): Promise<string> {
    const { token, phoneId, isMock } = await this.getCredentials(hospitalId);

    if (isMock) {
      console.log(`\n--- [MOCK WHATSAPP OUTBOX] ---`);
      console.log(`To: ${to}`);
      console.log(`Hospital ID Context: ${hospitalId || 'Global'}`);
      console.log(`Phone ID used: ${phoneId}`);
      console.log(`Message:\n${text}`);
      console.log(`------------------------------\n`);
      return `mock_msg_${Date.now()}`;
    }

    try {
      const baseUrl = `https://graph.facebook.com/v18.0/${phoneId}/messages`;
      const response = await axios.post(
        baseUrl,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return response.data?.messages?.[0]?.id || '';
    } catch (error: any) {
      console.error('Error sending WhatsApp message:', error.response?.data || error.message);
      throw new HttpException('Failed to send WhatsApp message', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Send interactive buttons (Meta allows max 3 buttons per message)
  async sendInteractiveButtons(
    to: string, 
    text: string, 
    buttons: { id: string; title: string }[],
    hospitalId?: string,
  ): Promise<string> {
    const { token, phoneId, isMock } = await this.getCredentials(hospitalId);

    if (isMock) {
      console.log(`\n--- [MOCK WHATSAPP OUTBOX (BUTTONS)] ---`);
      console.log(`To: ${to}`);
      console.log(`Hospital ID Context: ${hospitalId || 'Global'}`);
      console.log(`Phone ID used: ${phoneId}`);
      console.log(`Prompt: ${text}`);
      console.log(`Options:`, buttons.map(b => `[${b.title} (${b.id})]`).join(', '));
      console.log(`----------------------------------------\n`);
      return `mock_btn_${Date.now()}`;
    }

    try {
      const baseUrl = `https://graph.facebook.com/v18.0/${phoneId}/messages`;
      const response = await axios.post(
        baseUrl,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text },
            action: {
              buttons: buttons.slice(0, 3).map((b) => ({
                type: 'reply',
                reply: { id: b.id, title: b.title },
              })),
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return response.data?.messages?.[0]?.id || '';
    } catch (error: any) {
      console.error('Error sending WhatsApp buttons:', error.response?.data || error.message);
      throw new HttpException('Failed to send buttons', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
