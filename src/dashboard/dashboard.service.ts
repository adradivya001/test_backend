import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { CreateClosureDto } from './dto/create-closure.dto';
import { CreateOverrideDto } from './dto/create-override.dto';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getStats() {
    const totalPatients = await this.prisma.patient.count({
      where: { status: 'ACTIVE' },
    });

    const activeTickets = await this.prisma.supportTicket.count({
      where: { status: { in: ['OPEN', 'PENDING'] } },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentsToday = await this.prisma.appointment.count({
      where: {
        appointmentDate: today,
        status: { in: ['BOOKED', 'CONFIRMED'] },
      },
    });

    const totalDoctors = await this.prisma.doctor.count({
      where: { status: 'ACTIVE' },
    });

    const ticketStats = await this.prisma.supportTicket.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    const appointmentStats = await this.prisma.appointment.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    return {
      overview: {
        totalPatients,
        activeTickets,
        appointmentsToday,
        totalDoctors,
      },
      ticketsByStatus: ticketStats.map((item) => ({
        status: item.status,
        count: item._count.status,
      })),
      appointmentsByStatus: appointmentStats.map((item) => ({
        status: item.status,
        count: item._count.status,
      })),
    };
  }

  // --- Holiday Calendar ---
  async createHoliday(dto: CreateHolidayDto, userId?: string) {
    const targetDate = new Date(dto.date);
    const existing = await this.prisma.holidayCalendar.findFirst({
      where: { date: targetDate },
    });
    if (existing) {
      throw new ConflictException(`Holiday already exists for date ${dto.date}`);
    }

    const holiday = await this.prisma.holidayCalendar.create({
      data: {
        date: targetDate,
        name: dto.name,
      },
    });

    await this.auditService.log(
      'Holiday Created',
      'HolidayCalendar',
      holiday.id,
      userId,
      { date: dto.date, name: dto.name }
    );

    return holiday;
  }

  async getHolidays() {
    return this.prisma.holidayCalendar.findMany({
      orderBy: { date: 'asc' },
    });
  }

  async deleteHoliday(id: string, userId?: string) {
    const existing = await this.prisma.holidayCalendar.findFirst({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Holiday calendar entry not found');
    }

    await this.prisma.holidayCalendar.delete({
      where: { id },
    });

    await this.auditService.log(
      'Holiday Deleted',
      'HolidayCalendar',
      id,
      userId,
      { date: existing.date, name: existing.name }
    );

    return { message: 'Holiday deleted successfully' };
  }

  // --- Hospital Closures ---
  async createClosure(dto: CreateClosureDto, userId?: string) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (start > end) {
      throw new BadRequestException('Start date cannot be after end date');
    }

    const closure = await this.prisma.hospitalClosure.create({
      data: {
        startDate: start,
        endDate: end,
        reason: dto.reason,
      },
    });

    await this.auditService.log(
      'Hospital Closure Created',
      'HospitalClosure',
      closure.id,
      userId,
      { startDate: dto.startDate, endDate: dto.endDate, reason: dto.reason }
    );

    return closure;
  }

  async getClosures() {
    return this.prisma.hospitalClosure.findMany({
      orderBy: { startDate: 'asc' },
    });
  }

  async deleteClosure(id: string, userId?: string) {
    const existing = await this.prisma.hospitalClosure.findFirst({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Hospital closure entry not found');
    }

    await this.prisma.hospitalClosure.delete({
      where: { id },
    });

    await this.auditService.log(
      'Hospital Closure Deleted',
      'HospitalClosure',
      id,
      userId,
      { startDate: existing.startDate, endDate: existing.endDate, reason: existing.reason }
    );

    return { message: 'Hospital closure deleted successfully' };
  }

  // --- Doctor Schedule Overrides ---
  async upsertOverride(dto: CreateOverrideDto, userId?: string) {
    const targetDate = new Date(dto.date);

    // Validate Doctor
    const doctor = await this.prisma.doctor.findFirst({
      where: { doctorId: dto.doctorId },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Upsert Doctor Schedule Override
    const override = await this.prisma.doctorScheduleOverride.upsert({
      where: {
        doctorId_date: {
          doctorId: dto.doctorId,
          date: targetDate,
        },
      },
      update: {
        startTime: dto.startTime ?? null,
        endTime: dto.endTime ?? null,
        isAvailable: dto.isAvailable ?? true,
      },
      create: {
        doctorId: dto.doctorId,
        date: targetDate,
        startTime: dto.startTime ?? null,
        endTime: dto.endTime ?? null,
        isAvailable: dto.isAvailable ?? true,
      },
    });

    await this.auditService.log(
      'Doctor Schedule Override Upserted',
      'DoctorScheduleOverride',
      override.id,
      userId,
      { doctorId: dto.doctorId, date: dto.date, isAvailable: dto.isAvailable }
    );

    return override;
  }

  async getOverrides(doctorId?: string) {
    return this.prisma.doctorScheduleOverride.findMany({
      where: doctorId ? { doctorId } : {},
      include: {
        doctor: {
          select: {
            name: true,
            specialization: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  async deleteOverride(id: string, userId?: string) {
    const existing = await this.prisma.doctorScheduleOverride.findFirst({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Doctor schedule override not found');
    }

    await this.prisma.doctorScheduleOverride.delete({
      where: { id },
    });

    await this.auditService.log(
      'Doctor Schedule Override Deleted',
      'DoctorScheduleOverride',
      id,
      userId,
      { doctorId: existing.doctorId, date: existing.date }
    );

    return { message: 'Doctor schedule override deleted successfully' };
  }
}

