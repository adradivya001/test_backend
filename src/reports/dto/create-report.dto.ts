import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ReportStatus } from '@prisma/client';

export class CreateReportDto {
  @ApiProperty({ example: 'patient-uuid' })
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ example: 'BLOOD_TEST' })
  @IsString()
  @IsNotEmpty()
  reportType: string;

  @ApiProperty({ example: 'http://bucket.url/bloodtest.pdf' })
  @IsString()
  @IsNotEmpty()
  reportUrl: string;

  @ApiProperty({ enum: ReportStatus, example: ReportStatus.PENDING })
  @IsEnum(ReportStatus)
  reportStatus: ReportStatus;
}
