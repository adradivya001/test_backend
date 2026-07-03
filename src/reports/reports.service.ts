import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async create(dto: CreateReportDto, uploadedBy: string) {
    // Validate Patient
    const patient = await this.prisma.patient.findFirst({
      where: { patientId: dto.patientId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const report = await this.prisma.report.create({
      data: {
        patientId: dto.patientId,
        reportType: dto.reportType,
        reportUrl: dto.reportUrl,
        reportStatus: dto.reportStatus,
        uploadedBy,
      },
    });

    if (dto.reportStatus === 'READY') {
      await this.triggerNotification(report.reportId);
    }

    return report;
  }

  async updateStatus(reportId: string, status: any) {
    const existing = await this.prisma.report.findFirst({
      where: { reportId },
    });
    if (!existing) {
      throw new NotFoundException('Report not found');
    }

    const updated = await this.prisma.report.update({
      where: { reportId },
      data: {
        reportStatus: status },
    });

    if (status === 'READY') {
      await this.triggerNotification(reportId);
    }

    return updated;
  }

  async findByPatient(patientId: string) {
    return this.prisma.report.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll() {
    return this.prisma.report.findMany({
      include: { patient: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(reportId: string) {
    const report = await this.prisma.report.findFirst({
      where: { reportId },
      include: { patient: true },
    });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    return report;
  }

  // Generate secure temporary download link
  async generateSecureUrl(reportId: string): Promise<string> {
    const report = await this.findOne(reportId);
    
    // Generate a temporary JWT token valid for 15 minutes
    const token = this.jwtService.sign(
      { reportId: report.reportId },
      { expiresIn: '15m' },
    );

    // Return the proxy endpoint with token
    return `/reports/download/${report.reportId}?token=${token}`;
  }

  // Validate the proxy token and return the true URL
  async verifyDownloadToken(reportId: string, token: string): Promise<string> {
    try {
      const payload = this.jwtService.verify(token);
      if (payload.reportId !== reportId) {
        throw new BadRequestException('Invalid report token');
      }

      const report = await this.prisma.report.findFirst({ where: { reportId } });
      if (!report) {
        throw new NotFoundException('Report not found');
      }

      // Track report view
      await this.prisma.auditLog.create({
        data: {
        action: 'Report Viewed',
          entityType: 'Report',
          entityId: reportId,
        },
      });

      return report.reportUrl;
    } catch (err) {
      throw new BadRequestException('Expirable link is invalid or expired');
    }
  }

  private async triggerNotification(reportId: string) {
    const report = await this.prisma.report.findFirst({
      where: { reportId },
      include: { patient: true },
    });

    if (report && report.patient) {
      await this.prisma.notificationLog.create({
        data: {
        patientId: report.patientId,
          type: 'REPORT_READY',
          payload: JSON.stringify({
            patientName: `${report.patient.firstName} ${report.patient.lastName}`,
            phone: report.patient.phone,
            reportType: report.reportType,
            reportId: report.reportId,
            downloadUrl: `/reports/download/${report.reportId}`,
          }),
        },
      });
    }
  }
}
