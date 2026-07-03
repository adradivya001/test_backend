import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PrescriptionItemDto {
  @ApiProperty({ example: 'Amoxicillin 500mg' })
  @IsString()
  @IsNotEmpty()
  medication: string;

  @ApiProperty({ example: '1 capsule' })
  @IsString()
  @IsNotEmpty()
  dosage: string;

  @ApiProperty({ example: 'Take after meals', required: false })
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiProperty({ example: '5 days' })
  @IsString()
  @IsNotEmpty()
  duration: string;

  @ApiProperty({ example: 'three times daily' })
  @IsString()
  @IsNotEmpty()
  frequency: string;

  @ApiProperty({ example: 0, required: false })
  @IsInt()
  @IsOptional()
  refills?: number;
}

export class CreatePrescriptionDto {
  @ApiProperty({ example: 'appointment-uuid' })
  @IsString()
  @IsNotEmpty()
  appointmentId: string;

  @ApiProperty({ example: 'patient-uuid' })
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ example: 'doctor-uuid' })
  @IsString()
  @IsNotEmpty()
  doctorId: string;

  @ApiProperty({ example: 'Drink plenty of water and rest.', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [PrescriptionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items: PrescriptionItemDto[];
}
