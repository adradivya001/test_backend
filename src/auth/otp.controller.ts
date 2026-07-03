import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { OtpService } from './otp.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SendOtpDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  action: string;
}

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  action: string;

  @IsString()
  @IsNotEmpty()
  code: string;
}

@ApiTags('Authentication')
@Controller('auth/otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a one-time password (OTP) to a patient' })
  @ApiResponse({ status: 200, description: 'OTP successfully sent' })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.otpService.sendOtp(dto.phone, dto.action);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify the OTP and obtain an action authorization token' })
  @ApiResponse({ status: 200, description: 'OTP verified, returns signature token' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.otpService.verifyOtp(dto.phone, dto.action, dto.code);
  }
}
