import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  async getTenantByPhoneNumberId(phoneNumberId: string) {
    // 1. Fetch channel config
    const channel = await this.prisma.whatsAppChannel.findUnique({
      where: { phoneNumberId },
      include: { hospital: true },
    });

    if (!channel) {
      throw new NotFoundException('No tenant found for this WhatsApp number ID');
    }

    return {
      tenantId: channel.tenantId,
      accessToken: channel.accessToken,
      verifyToken: channel.verifyToken,
      webhookSecret: channel.webhookSecret,
      tenantName: channel.hospital.name,
      tenantCode: channel.hospital.name.toLowerCase().replace(/\s+/g, '-'),
      timezone: 'UTC',
      defaultLanguage: 'en',
    };
  }
}
