import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsNotEmpty, Min, Max, Matches } from 'class-validator';

export class CreateScheduleDto {
  @ApiProperty({ example: 1, description: 'Day of week: 0 for Sunday, 1 for Monday, etc.' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ example: '09:00', description: 'Start time in HH:MM format' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'startTime must be in HH:MM format' })
  startTime: string;

  @ApiProperty({ example: '17:00', description: 'End time in HH:MM format' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'endTime must be in HH:MM format' })
  endTime: string;
}
