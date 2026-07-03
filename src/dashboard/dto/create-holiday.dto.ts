import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class CreateHolidayDto {
  @ApiProperty({ example: '2026-12-25', description: 'Date of the holiday in YYYY-MM-DD format' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'Christmas Day', description: 'Name of the holiday' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
