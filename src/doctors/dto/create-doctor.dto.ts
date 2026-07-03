import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, IsNumber, IsOptional } from 'class-validator';

export class CreateDoctorDto {
  @ApiProperty({ example: 'Dr. John Kumar' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Cardiology' })
  @IsString()
  @IsNotEmpty()
  specialization: string;

  @ApiProperty({ example: 'dept-uuid' })
  @IsString()
  @IsNotEmpty()
  departmentId: string;

  @ApiProperty({ example: 12 })
  @IsInt()
  experience: number;

  @ApiProperty({ example: 500 })
  @IsNumber()
  consultationFee: number;

  @ApiProperty({ example: 'userId-uuid', required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ example: 'ACTIVE', required: false })
  @IsOptional()
  @IsString()
  status?: string;
}
