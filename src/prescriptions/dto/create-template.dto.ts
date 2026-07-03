import { IsString, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PrescriptionItemDto } from './create-prescription.dto';

export class CreatePrescriptionTemplateDto {
  @ApiProperty({ example: 'doctor-uuid' })
  @IsString()
  @IsNotEmpty()
  doctorId: string;

  @ApiProperty({ example: 'Standard Antibiotics Pack' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ type: [PrescriptionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items: PrescriptionItemDto[];
}
