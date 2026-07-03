import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: PrismaService;
  let audit: AuditService;

  const mockPrismaService = {
    patient: { count: jest.fn() },
    supportTicket: { count: jest.fn(), groupBy: jest.fn() },
    appointment: { count: jest.fn(), groupBy: jest.fn() },
    doctor: { count: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
    holidayCalendar: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
    hospitalClosure: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
    doctorScheduleOverride: { upsert: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('should return overview metrics and statuses grouped', async () => {
      mockPrismaService.patient.count.mockResolvedValue(10);
      mockPrismaService.supportTicket.count.mockResolvedValue(2);
      mockPrismaService.appointment.count.mockResolvedValue(5);
      mockPrismaService.doctor.count.mockResolvedValue(3);
      mockPrismaService.supportTicket.groupBy.mockResolvedValue([{ status: 'OPEN', _count: { status: 2 } }]);
      mockPrismaService.appointment.groupBy.mockResolvedValue([{ status: 'CONFIRMED', _count: { status: 5 } }]);

      const stats = await service.getStats();

      expect(stats.overview.totalPatients).toBe(10);
      expect(stats.overview.activeTickets).toBe(2);
      expect(stats.ticketsByStatus).toEqual([{ status: 'OPEN', count: 2 }]);
      expect(stats.appointmentsByStatus).toEqual([{ status: 'CONFIRMED', count: 5 }]);
    });
  });

  describe('Holiday Calendar', () => {
    it('should create holiday successfully if it does not exist', async () => {
      const dto = { date: '2026-12-25', name: 'Christmas Day' };
      mockPrismaService.holidayCalendar.findUnique.mockResolvedValue(null);
      mockPrismaService.holidayCalendar.create.mockResolvedValue({ id: 'h1', ...dto });

      const holiday = await service.createHoliday(dto, 'admin-id');

      expect(holiday.id).toBe('h1');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        'Holiday Created',
        'HolidayCalendar',
        'h1',
        'admin-id',
        expect.any(Object),
      );
    });

    it('should throw ConflictException if holiday date already exists', async () => {
      const dto = { date: '2026-12-25', name: 'Christmas Day' };
      mockPrismaService.holidayCalendar.findFirst.mockResolvedValue({ id: 'h1', ...dto });

      await expect(service.createHoliday(dto, 'admin-id')).rejects.toThrow(ConflictException);
    });

    it('should delete holiday successfully', async () => {
      mockPrismaService.holidayCalendar.findFirst.mockResolvedValue({ id: 'h1', date: new Date(), name: 'Christmas' });
      mockPrismaService.holidayCalendar.delete.mockResolvedValue({});

      const result = await service.deleteHoliday('h1', 'admin-id');

      expect(result.message).toBe('Holiday deleted successfully');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        'Holiday Deleted',
        'HolidayCalendar',
        'h1',
        'admin-id',
        expect.any(Object),
      );
    });

    it('should throw NotFoundException on deleting non-existent holiday', async () => {
      mockPrismaService.holidayCalendar.findFirst.mockResolvedValue(null);

      await expect(service.deleteHoliday('h1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Hospital Closures', () => {
    it('should create hospital closure successfully', async () => {
      const dto = { startDate: '2026-07-01', endDate: '2026-07-03', reason: 'Maintenance' };
      mockPrismaService.hospitalClosure.create.mockResolvedValue({ id: 'c1', ...dto });

      const closure = await service.createClosure(dto, 'admin-id');

      expect(closure.id).toBe('c1');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        'Hospital Closure Created',
        'HospitalClosure',
        'c1',
        'admin-id',
        expect.any(Object),
      );
    });

    it('should throw BadRequestException if startDate is after endDate', async () => {
      const dto = { startDate: '2026-07-05', endDate: '2026-07-03', reason: 'Invalid' };

      await expect(service.createClosure(dto)).rejects.toThrow(BadRequestException);
    });

    it('should delete closure successfully', async () => {
      mockPrismaService.hospitalClosure.findFirst.mockResolvedValue({ id: 'c1', reason: 'Maintenance' });
      mockPrismaService.hospitalClosure.delete.mockResolvedValue({});

      const result = await service.deleteClosure('c1', 'admin-id');

      expect(result.message).toBe('Hospital closure deleted successfully');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        'Hospital Closure Deleted',
        'HospitalClosure',
        'c1',
        'admin-id',
        expect.any(Object),
      );
    });

    it('should throw NotFoundException on deleting non-existent closure', async () => {
      mockPrismaService.hospitalClosure.findFirst.mockResolvedValue(null);

      await expect(service.deleteClosure('c1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Doctor Schedule Overrides', () => {
    it('should upsert schedule override successfully', async () => {
      const dto = { doctorId: 'd1', date: '2026-06-15', startTime: '09:00', endTime: '12:00', isAvailable: true };
      mockPrismaService.doctor.findFirst.mockResolvedValue({ doctorId: 'd1', name: 'Dr. Smith' });
      mockPrismaService.doctorScheduleOverride.upsert.mockResolvedValue({ id: 'o1', ...dto });

      const override = await service.upsertOverride(dto, 'admin-id');

      expect(override.id).toBe('o1');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        'Doctor Schedule Override Upserted',
        'DoctorScheduleOverride',
        'o1',
        'admin-id',
        expect.any(Object),
      );
    });

    it('should throw NotFoundException if doctor does not exist', async () => {
      const dto = { doctorId: 'd1', date: '2026-06-15' };
      mockPrismaService.doctor.findFirst.mockResolvedValue(null);

      await expect(service.upsertOverride(dto)).rejects.toThrow(NotFoundException);
    });

    it('should delete override successfully', async () => {
      mockPrismaService.doctorScheduleOverride.findFirst.mockResolvedValue({ id: 'o1', doctorId: 'd1' });
      mockPrismaService.doctorScheduleOverride.delete.mockResolvedValue({});

      const result = await service.deleteOverride('o1', 'admin-id');

      expect(result.message).toBe('Doctor schedule override deleted successfully');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        'Doctor Schedule Override Deleted',
        'DoctorScheduleOverride',
        'o1',
        'admin-id',
        expect.any(Object),
      );
    });

    it('should throw NotFoundException on deleting non-existent override', async () => {
      mockPrismaService.doctorScheduleOverride.findFirst.mockResolvedValue(null);

      await expect(service.deleteOverride('o1')).rejects.toThrow(NotFoundException);
    });
  });
});
