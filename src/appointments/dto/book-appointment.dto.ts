import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString, Matches } from 'class-validator';

export class BookAppointmentDto {
  @ApiProperty({ example: 'patient-uuid' })
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ example: 'doctor-uuid' })
  @IsString()
  @IsNotEmpty()
  doctorId: string;

  @ApiProperty({ example: 'department-uuid' })
  @IsString()
  @IsNotEmpty()
  departmentId: string;

  @ApiProperty({ example: '2026-06-10', description: 'YYYY-MM-DD' })
  @IsDateString()
  appointmentDate: string;

  @ApiProperty({ example: '10:30', description: 'HH:MM format' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'slotTime must be in HH:MM format' })
  slotTime: string;
}
