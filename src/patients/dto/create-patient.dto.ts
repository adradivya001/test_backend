import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsInt, IsDateString, IsEmail, IsOptional } from 'class-validator';
import { Gender, Language } from '@prisma/client';

export class CreatePatientDto {
  @ApiProperty({ example: 'Alice' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Smith' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ enum: Gender, example: Gender.FEMALE })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({ example: 28 })
  @IsInt()
  age: number;

  @ApiProperty({ example: '1998-05-15' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ example: '919876543210' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'alice@example.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '123 Main St, New York', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 'Bob Smith (Husband) - 919876543211', required: false })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiProperty({ example: 'O+', required: false })
  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @ApiProperty({ enum: Language, example: Language.EN, required: false, default: Language.EN })
  @IsEnum(Language)
  @IsOptional()
  preferredLanguage?: Language;

  @ApiProperty({ example: 'ACTIVE', required: false })
  @IsOptional()
  @IsString()
  status?: string;
}
