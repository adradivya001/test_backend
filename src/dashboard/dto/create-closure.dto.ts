import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class CreateClosureDto {
  @ApiProperty({ example: '2026-07-04', description: 'Start date of hospital closure in YYYY-MM-DD' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-07-06', description: 'End date of hospital closure in YYYY-MM-DD' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 'Renovation work', description: 'Reason for closure' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
