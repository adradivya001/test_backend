import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class FileGovernanceWorker implements OnModuleInit, OnModuleDestroy {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  onModuleInit() {
    // Run every 10 minutes to scan for file retention policies
    this.intervalId = setInterval(() => this.runGovernanceScan(), 600000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async runGovernanceScan() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const now = new Date();

      // --- 1. Soft-Delete Expired Reports ---
      const expiredReports = await this.prisma.report.findMany({
        where: {
          isDeleted: false,
          expiresAt: {
            lte: now,
          },
        },
      });

      for (const report of expiredReports) {
        await this.prisma.report.update({
          where: { reportId: report.reportId },
          data: {
        isDeleted: true,
            deletedAt: now,
          },
        });

        await this.auditService.log(
          'Report Soft Deleted',
          'Report',
          report.reportId,
          undefined,
          { reason: 'Retention period expired', url: report.reportUrl }
        );
      }

      // --- 2. Soft-Delete Expired Prescriptions ---
      const expiredPrescriptions = await this.prisma.prescription.findMany({
        where: {
          isDeleted: false,
          expiresAt: {
            lte: now,
          },
        },
      });

      for (const rx of expiredPrescriptions) {
        await this.prisma.prescription.update({
          where: { id: rx.id },
          data: {
        isDeleted: true,
            deletedAt: now,
          },
        });

        await this.auditService.log(
          'Prescription Soft Deleted',
          'Prescription',
          rx.id,
          undefined,
          { reason: 'Retention period expired', appointmentId: rx.appointmentId }
        );
      }

      // --- 3. Hard-Delete Reports after 30-day recovery window ---
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const reportsToHardDelete = await this.prisma.report.findMany({
        where: {
          isDeleted: true,
          deletedAt: {
            lte: thirtyDaysAgo,
          },
        },
      });

      for (const report of reportsToHardDelete) {
        await this.prisma.report.delete({
          where: { reportId: report.reportId },
        });

        await this.auditService.log(
          'Report Hard Deleted',
          'Report',
          report.reportId,
          undefined,
          { reason: '30-day recovery window elapsed', url: report.reportUrl }
        );
      }

      // --- 4. Hard-Delete Prescriptions after 30-day recovery window ---
      const prescriptionsToHardDelete = await this.prisma.prescription.findMany({
        where: {
          isDeleted: true,
          deletedAt: {
            lte: thirtyDaysAgo,
          },
        },
      });

      for (const rx of prescriptionsToHardDelete) {
        await this.prisma.prescription.delete({
          where: { id: rx.id },
        });

        await this.auditService.log(
          'Prescription Hard Deleted',
          'Prescription',
          rx.id,
          undefined,
          { reason: '30-day recovery window elapsed', appointmentId: rx.appointmentId }
        );
      }

    } catch (error) {
      console.error('Error running File Governance Worker:', error.message);
    } finally {
      this.isProcessing = false;
    }
  }
}
