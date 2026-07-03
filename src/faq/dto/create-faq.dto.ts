import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { Language } from '@prisma/client';

export class CreateFaqDto {
  @ApiProperty({ example: 'Hospital Timings' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'General' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 'What are the visiting hours?' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ example: 'Visiting hours are from 4:00 PM to 7:00 PM daily.' })
  @IsString()
  @IsNotEmpty()
  answer: string;

  @ApiProperty({ enum: Language, example: Language.EN, required: false, default: Language.EN })
  @IsEnum(Language)
  @IsOptional()
  language?: Language;
}
