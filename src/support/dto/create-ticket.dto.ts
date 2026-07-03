import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { SupportTicketPriority } from '@prisma/client';

export class CreateTicketDto {
  @ApiProperty({ example: 'patient-uuid' })
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ example: 'whatsapp-conv-123' })
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @ApiProperty({ enum: SupportTicketPriority, example: SupportTicketPriority.MEDIUM, required: false })
  @IsOptional()
  @IsEnum(SupportTicketPriority)
  priority?: SupportTicketPriority;

  @ApiProperty({ example: 'Patient complains about report delay', required: false })
  @IsOptional()
  @IsString()
  initialNote?: string;
}
