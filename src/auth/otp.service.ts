import { Injectable, BadRequestException } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async sendOtp(phone: string, action: string): Promise<{ message: string }> {
    // Generate a random 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const redisKey = `otp:${action}:${phone}`;

    // Cache the OTP in Redis for 5 minutes (300 seconds)
    await this.redis.set(redisKey, code, 300);

    // Queue OTP Notification
    await this.prisma.notificationLog.create({
      data: {
        type: 'OTP_VERIFICATION',
        payload: JSON.stringify({
          phone,
          code,
          action,
        }),
      },
    });

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(phone: string, action: string, code: string): Promise<{ verified: boolean; token: string }> {
    const redisKey = `otp:${action}:${phone}`;
    const cachedCode = await this.redis.get(redisKey);

    if (!cachedCode) {
      throw new BadRequestException('OTP expired or not requested');
    }

    if (cachedCode !== code) {
      throw new BadRequestException('Invalid OTP code');
    }

    // OTP verified successfully, invalidate it
    await this.redis.del(redisKey);

    // Generate a short-lived verification token (valid for 15 minutes)
    const token = this.jwt.sign(
      { phone, action, verified: true },
      { expiresIn: '15m' },
    );

    return {
      verified: true,
      token,
    };
  }
}
