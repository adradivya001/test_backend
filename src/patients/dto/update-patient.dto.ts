import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreatePatientDto } from './create-patient.dto';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { Language } from '@prisma/client';

export class UpdatePatientDto extends PartialType(CreatePatientDto) {
  @ApiProperty({ description: 'Insurance Information details', required: false })
  @IsString()
  @IsOptional()
  insuranceInformation?: string;

  @ApiProperty({ enum: Language, description: 'Preferred Language (EN, HI, TE)', required: false, default: Language.EN })
  @IsEnum(Language)
  @IsOptional()
  preferredLanguage?: Language;

  @ApiProperty({ description: 'Preferred Communication channel (e.g. WHATSAPP, EMAIL)', required: false, default: 'WHATSAPP' })
  @IsString()
  @IsOptional()
  communicationPreferences?: string;
}
