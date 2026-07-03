import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateScheduleOverrideDto {
  @ApiProperty({ example: '2026-06-12', description: 'Date for override (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ example: '09:00', required: false, description: 'Override start time (HH:MM)' })
  @IsString()
  @IsOptional()
  startTime?: string;

  @ApiProperty({ example: '17:00', required: false, description: 'Override end time (HH:MM)' })
  @IsString()
  @IsOptional()
  endTime?: string;

  @ApiProperty({ example: true, required: false, default: true, description: 'Whether doctor is available or on leave/closure' })
  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}
