import { IsString, IsNotEmpty, IsOptional, IsDateString, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SaveConsultationDto {
  @ApiProperty({ description: 'Consultation notes' })
  @IsString()
  @IsNotEmpty()
  consultationNotes: string;

  @ApiProperty({ description: 'Consultation diagnosis' })
  @IsString()
  @IsNotEmpty()
  diagnosis: string;

  @ApiProperty({ description: 'Prescription file download URL', required: false })
  @IsString()
  @IsOptional()
  prescriptionUrl?: string;

  @ApiProperty({ description: 'Follow-up date (YYYY-MM-DD)', required: false })
  @IsDateString()
  @IsOptional()
  followUpDate?: string;

  @ApiProperty({ description: 'Consultation summary', required: false })
  @IsString()
  @IsOptional()
  consultationSummary?: string;

  @ApiProperty({ description: 'Clinical observations during consultation', required: false })
  @IsString()
  @IsOptional()
  clinicalObservations?: string;

  @ApiProperty({ description: 'Treatment plan details', required: false })
  @IsString()
  @IsOptional()
  treatmentPlan?: string;

  @ApiProperty({ description: 'Consultation duration in minutes', required: false })
  @IsInt()
  @IsOptional()
  consultationDuration?: number;

  @ApiProperty({ description: 'Lifecycle status of consultation (e.g. STARTED, UPDATED, COMPLETED)', required: false })
  @IsString()
  @IsOptional()
  consultationStatus?: string;
}
