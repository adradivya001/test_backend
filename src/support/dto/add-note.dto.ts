import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class AddNoteDto {
  @ApiProperty({ example: 'Emailed the lab to speed up the process' })
  @IsString()
  @IsNotEmpty()
  noteText: string;
}
