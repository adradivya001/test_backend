import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class AppointmentWorkflowDto {
  @ApiProperty({ example: '919876543210' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: {} })
  @IsObject()
  @IsOptional()
  sessionData?: any;

  @IsOptional()
  @IsString()
  step?: string;

  @IsOptional()
  @IsObject()
  collectedData?: any;

  @IsOptional()
  @IsString()
  messageText?: string;

  @IsOptional()
  @IsString()
  payloadText?: string;

  @IsOptional()
  @IsString()
  language?: string;
}

