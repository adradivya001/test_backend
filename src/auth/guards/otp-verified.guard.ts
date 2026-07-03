import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { SetMetadata } from '@nestjs/common';

export const OTP_ACTION_KEY = 'otp_action';
export const OtpAction = (action: string) => SetMetadata(OTP_ACTION_KEY, action);

@Injectable()
export class OtpVerifiedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAction = this.reflector.getAllAndOverride<string>(OTP_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no OTP action is declared, bypass the check
    if (!requiredAction) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const otpToken = request.headers['x-otp-token'] as string;
    const patientPhone = request.headers['x-otp-phone'] as string;

    if (!otpToken) {
      throw new UnauthorizedException('OTP verification required: missing x-otp-token header');
    }

    try {
      const payload = this.jwtService.verify(otpToken);

      if (!payload.verified || payload.action !== requiredAction) {
        throw new ForbiddenException('OTP verification invalid for this action');
      }

      if (patientPhone && payload.phone !== patientPhone) {
        throw new ForbiddenException('OTP verification phone mismatch');
      }

      // Append verified payload to request for downstream usage
      request.otpPayload = payload;
      return true;
    } catch (err) {
      throw new UnauthorizedException('OTP verification token invalid or expired');
    }
  }
}
