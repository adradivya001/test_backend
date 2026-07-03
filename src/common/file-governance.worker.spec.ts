import { Test, TestingModule } from '@nestjs/testing';
import { FileGovernanceWorker } from './file-governance.worker';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('FileGovernanceWorker', () => {
  let worker: FileGovernanceWorker;
  let prisma: PrismaService;
  let audit: AuditService;

  const mockPrismaService = {
    report: {
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    prescription: {
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileGovernanceWorker,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    worker = module.get<FileGovernanceWorker>(FileGovernanceWorker);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('runGovernanceScan', () => {
    it('should soft delete expired reports and prescriptions, and hard delete records after 30-day grace period', async () => {
      // Setup mock data
      const mockExpiredReport = { reportId: 'r1', reportUrl: '/url1', isDeleted: false, expiresAt: new Date() };
      const mockExpiredPrescription = { id: 'p1', appointmentId: 'a1', isDeleted: false, expiresAt: new Date() };

      const mockOldDeletedReport = { reportId: 'r2', reportUrl: '/url2', isDeleted: true, deletedAt: new Date() };
      const mockOldDeletedPrescription = { id: 'p2', appointmentId: 'a2', isDeleted: true, deletedAt: new Date() };

      // Prisma mocks returns
      mockPrismaService.report.findMany
        .mockResolvedValueOnce([mockExpiredReport]) // first call: expired reports
        .mockResolvedValueOnce([mockOldDeletedReport]); // third call: reports to hard delete

      mockPrismaService.prescription.findMany
        .mockResolvedValueOnce([mockExpiredPrescription]) // second call: expired prescriptions
        .mockResolvedValueOnce([mockOldDeletedPrescription]); // fourth call: prescriptions to hard delete

      await worker.runGovernanceScan();

      // Verify soft deletes
      expect(mockPrismaService.report.update).toHaveBeenCalledWith({
        where: { reportId: 'r1' },
        data: expect.objectContaining({ isDeleted: true, deletedAt: expect.any(Date) }),
      });
      expect(mockPrismaService.prescription.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: expect.objectContaining({ isDeleted: true, deletedAt: expect.any(Date) }),
      });

      // Verify hard deletes
      expect(mockPrismaService.report.delete).toHaveBeenCalledWith({
        where: { reportId: 'r2' },
      });
      expect(mockPrismaService.prescription.delete).toHaveBeenCalledWith({
        where: { id: 'p2' },
      });

      // Verify audit logging
      expect(mockAuditService.log).toHaveBeenCalledWith(
        'Report Soft Deleted',
        'Report',
        'r1',
        undefined,
        expect.any(Object),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        'Prescription Soft Deleted',
        'Prescription',
        'p1',
        undefined,
        expect.any(Object),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        'Report Hard Deleted',
        'Report',
        'r2',
        undefined,
        expect.any(Object),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        'Prescription Hard Deleted',
        'Prescription',
        'p2',
        undefined,
        expect.any(Object),
      );
    });
  });
});
