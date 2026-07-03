import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString, IsOptional } from 'class-validator';

export class MarkLeaveDto {
  @ApiProperty({ example: 'doctor-uuid' })
  @IsString()
  @IsNotEmpty()
  doctorId: string;

  @ApiProperty({ example: '2026-06-15', description: 'YYYY-MM-DD format of leave' })
  @IsDateString()
  leaveDate: string;

  @ApiProperty({ example: 'Medical checkup or Annual vacation', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
