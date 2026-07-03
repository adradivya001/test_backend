import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ReportStatus } from '@prisma/client';

export class UpdateReportStatusDto {
  @ApiProperty({ enum: ReportStatus, example: ReportStatus.READY })
  @IsEnum(ReportStatus)
  reportStatus: ReportStatus;
}
