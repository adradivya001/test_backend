import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { Language } from '@prisma/client';

export class KnowledgeWorkflowDto {
  @ApiProperty({ example: 'What are the visiting hours?' })
  @IsString()
  @IsNotEmpty()
  query: string;

  @ApiProperty({ enum: Language, example: Language.EN, required: false, default: Language.EN })
  @IsEnum(Language)
  @IsOptional()
  language?: Language;
}
