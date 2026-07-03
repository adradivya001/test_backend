import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class EscalationWorkflowDto {
  @ApiProperty({ example: '919876543210' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'whatsapp-conv-123' })
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @ApiProperty({ example: 'My report is still processing after 24h', required: false })
  @IsOptional()
  @IsString()
  issue?: string;
}
