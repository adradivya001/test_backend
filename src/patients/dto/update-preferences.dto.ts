import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { Language } from '@prisma/client';

export class UpdatePreferencesDto {
  @ApiProperty({ enum: Language, example: Language.HI, description: 'Preferred language of the patient' })
  @IsEnum(Language)
  @IsNotEmpty()
  preferredLanguage: Language;
}
