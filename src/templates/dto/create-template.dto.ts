import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
