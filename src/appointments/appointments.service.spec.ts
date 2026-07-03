import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulesService } from '../schedules/schedules.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: PrismaService;
  let schedulesService: SchedulesService;

  const mockPrismaService = {
    $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
    $queryRaw: jest.fn().mockResolvedValue([]),
    doctorLeave: {
      findFirst: jest.fn(),
    },
    doctorSchedule: {
      findMany: jest.fn(),
    },
    appointment: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    patient: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    doctor: {
      findUnique: jest.fn().mockResolvedValue({ doctorId: 'doctor-1', name: 'Dr. House', slotDuration: 30, departmentId: 'dept-1' }),
      findFirst: jest.fn().mockResolvedValue({ doctorId: 'doctor-1', name: 'Dr. House', slotDuration: 30, departmentId: 'dept-1' }),
    },
    department: {
      findUnique: jest.fn().mockResolvedValue({ id: 'dept-1', name: 'Cardiology', slotDuration: 30 }),
      findFirst: jest.fn().mockResolvedValue({ id: 'dept-1', name: 'Cardiology', slotDuration: 30 }),
    },
    notificationLog: {
      create: jest.fn(),
    },
    holidayCalendar: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    hospitalClosure: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    doctorScheduleOverride: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };

  const mockSchedulesService = {
    generateSlots: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SchedulesService, useValue: mockSchedulesService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    prisma = module.get<PrismaService>(PrismaService);
    schedulesService = module.get<SchedulesService>(SchedulesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAvailableSlots', () => {
    it('should return empty array if doctor is on leave', async () => {
      mockPrismaService.doctorLeave.findFirst.mockResolvedValue({ id: 'leave-1' });

      const slots = await service.getAvailableSlots('doctor-1', '2026-06-10');
      expect(slots).toEqual([]);
      expect(mockPrismaService.doctorLeave.findFirst).toHaveBeenCalledWith({
        where: { doctorId: 'doctor-1', leaveDate: new Date('2026-06-10') },
      });
    });

    it('should return empty array if doctor has no schedule on that day', async () => {
      mockPrismaService.doctorLeave.findFirst.mockResolvedValue(null);
      mockPrismaService.doctorSchedule.findMany.mockResolvedValue([]);

      const slots = await service.getAvailableSlots('doctor-1', '2026-06-10'); // June 10, 2026 is Wednesday
      expect(slots).toEqual([]);
    });

    it('should filter out booked slots from generated slots', async () => {
      mockPrismaService.doctorLeave.findFirst.mockResolvedValue(null);
      mockPrismaService.doctorSchedule.findMany.mockResolvedValue([{ id: 'sched-1', startTime: '09:00', endTime: '10:00' }]);
      mockSchedulesService.generateSlots.mockReturnValue(['09:00', '09:30']);
      mockPrismaService.appointment.findMany.mockResolvedValue([{ slotTime: '09:00' }]);

      const slots = await service.getAvailableSlots('doctor-1', '2026-06-10');
      expect(slots).toEqual(['09:30']);
    });
  });

  describe('book', () => {
    it('should throw NotFoundException if patient does not exist', async () => {
      mockPrismaService.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.book({
          patientId: 'patient-invalid',
          doctorId: 'doctor-1',
          departmentId: 'dept-1',
          appointmentDate: '2026-06-10',
          slotTime: '09:00',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if slot is not available', async () => {
      mockPrismaService.patient.findFirst.mockResolvedValue({ patientId: 'patient-1', firstName: 'John', lastName: 'Doe', phone: '123' });
      mockPrismaService.doctor.findFirst.mockResolvedValue({ doctorId: 'doctor-1', name: 'Dr. House' });
      mockPrismaService.department.findFirst.mockResolvedValue({ id: 'dept-1' });
      
      mockPrismaService.doctorLeave.findFirst.mockResolvedValue(null);
      mockPrismaService.doctorSchedule.findMany.mockResolvedValue([]); // will result in empty available slots

      await expect(
        service.book({
          patientId: 'patient-1',
          doctorId: 'doctor-1',
          departmentId: 'dept-1',
          appointmentDate: '2026-06-10',
          slotTime: '09:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
