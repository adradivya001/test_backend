import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { Language } from '@prisma/client';

export class CreateKbDto {
  @ApiProperty({ example: 'Insurance Partners' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Policies' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 'We partner with Allianz, Bupa, and MetLife to provide cashless treatments.' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ enum: Language, example: Language.EN, required: false, default: Language.EN })
  @IsEnum(Language)
  @IsOptional()
  language?: Language;
}
