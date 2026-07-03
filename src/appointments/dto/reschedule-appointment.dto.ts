import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';

export class RescheduleAppointmentDto {
  @ApiProperty({ example: '2026-06-12', description: 'YYYY-MM-DD' })
  @IsDateString()
  newDate: string;

  @ApiProperty({ example: '14:30', description: 'HH:MM format' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'slotTime must be in HH:MM format' })
  newSlotTime: string;

  @ApiProperty({ example: 'Change of plan', required: false })
  @IsString()
  @IsOptional()
  rescheduleReason?: string;
}
