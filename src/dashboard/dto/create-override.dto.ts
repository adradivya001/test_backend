import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString, IsBoolean, IsOptional, Matches } from 'class-validator';

export class CreateOverrideDto {
  @ApiProperty({ example: 'd3b07384-d113-4c9b-a590-1c390a786311', description: 'Doctor ID' })
  @IsString()
  @IsNotEmpty()
  doctorId: string;

  @ApiProperty({ example: '2026-06-15', description: 'Date of override in YYYY-MM-DD' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ example: '08:00', description: 'Override start time in HH:MM format' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'startTime must be in HH:MM format' })
  startTime?: string;

  @ApiPropertyOptional({ example: '14:00', description: 'Override end time in HH:MM format' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'endTime must be in HH:MM format' })
  endTime?: string;

  @ApiProperty({ example: true, description: 'Availability of doctor on this override date' })
  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}
