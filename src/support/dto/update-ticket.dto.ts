import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional } from 'class-validator';
import { SupportTicketStatus, SupportTicketPriority } from '@prisma/client';

export class UpdateTicketDto {
  @ApiProperty({ enum: SupportTicketStatus, example: SupportTicketStatus.PENDING, required: false })
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @ApiProperty({ enum: SupportTicketPriority, example: SupportTicketPriority.HIGH, required: false })
  @IsOptional()
  @IsEnum(SupportTicketPriority)
  priority?: SupportTicketPriority;

  @ApiProperty({ example: 'agent-uuid', required: false })
  @IsOptional()
  @IsString()
  assignedAgentId?: string;
}
