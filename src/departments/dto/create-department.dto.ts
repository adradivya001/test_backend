import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Cardiology' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Heart and vascular care clinic', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
