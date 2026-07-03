import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class DoctorAvailabilityWorkflowDto {
  @ApiProperty({ example: 'doctor-uuid' })
  @IsString()
  @IsNotEmpty()
  doctorId: string;

  @ApiProperty({ example: '2026-06-10', description: 'YYYY-MM-DD' })
  @IsDateString()
  date: string;
}
