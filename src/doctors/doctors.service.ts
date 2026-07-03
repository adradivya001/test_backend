import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { CreateScheduleOverrideDto } from './dto/create-override.dto';

@Injectable()
export class DoctorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDoctorDto) {
    // Check if department exists
    const dept = await this.prisma.department.findFirst({
      where: { id: dto.departmentId },
    });
    if (!dept) {
      throw new NotFoundException('Department not found');
    }

    return this.prisma.doctor.create({
      data: dto,
    });
  }

  async update(doctorId: string, dto: UpdateDoctorDto) {
    await this.findOne(doctorId);

    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId },
      });
      if (!dept) {
        throw new NotFoundException('Department not found');
      }
    }

    return this.prisma.doctor.update({
      where: { doctorId },
      data: dto,
    });
  }

  async setStatus(doctorId: string, status: 'ACTIVE' | 'OFFLINE' | 'ON_LEAVE' | 'IN_CONSULTATION' | 'UNAVAILABLE' | 'INACTIVE') {
    const allowed = ['ACTIVE', 'OFFLINE', 'ON_LEAVE', 'IN_CONSULTATION', 'UNAVAILABLE', 'INACTIVE'];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Invalid doctor presence status: ${status}. Must be one of: ${allowed.join(', ')}`);
    }
    await this.findOne(doctorId);
    return this.prisma.doctor.update({
      where: { doctorId },
      data: {
        status },
    });
  }

  async findAll(query?: string, specialization?: string, departmentId?: string) {
    const where: any = {};
    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { specialization: { contains: query, mode: 'insensitive' } },
      ];
    }
    if (specialization) {
      where.specialization = { contains: specialization, mode: 'insensitive' };
    }
    if (departmentId) {
      where.departmentId = departmentId;
    }

    return this.prisma.doctor.findMany({
      where,
      include: {
        department: true,
        schedules: true,
        scheduleOverrides: true,
      },
    });
  }

  async findOne(doctorId: string) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { doctorId },
      include: {
        department: true,
        schedules: true,
        leaves: true,
        scheduleOverrides: true,
      },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }
    return doctor;
  }

  async findByDepartment(departmentId: string) {
    return this.prisma.doctor.findMany({
      where: { departmentId, status: 'ACTIVE' },
    });
  }

  async addScheduleOverride(doctorId: string, dto: CreateScheduleOverrideDto) {
    await this.findOne(doctorId);
    const overrideDate = new Date(dto.date);
    return this.prisma.doctorScheduleOverride.upsert({
      where: {
        doctorId_date: {
          doctorId,
          date: overrideDate,
        },
      },
      update: {
        startTime: dto.startTime || null,
        endTime: dto.endTime || null,
        isAvailable: dto.isAvailable !== undefined ? dto.isAvailable : true,
      },
      create: {
        doctorId,
        date: overrideDate,
        startTime: dto.startTime || null,
        endTime: dto.endTime || null,
        isAvailable: dto.isAvailable !== undefined ? dto.isAvailable : true,
      },
    });
  }

  async getMetrics(doctorId: string) {
    await this.findOne(doctorId);

    const completedCount = await this.prisma.appointment.count({
      where: { doctorId, status: 'COMPLETED' },
    });

    const cancelledCount = await this.prisma.appointment.count({
      where: { doctorId, status: 'CANCELLED' },
    });

    const noShowCount = await this.prisma.appointment.count({
      where: { doctorId, status: 'NO_SHOW' },
    });

    const totalCount = await this.prisma.appointment.count({
      where: { doctorId },
    });

    const completionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 100;

    return {
      completedCount,
      cancelledCount,
      noShowCount,
      totalCount,
      completionRate: parseFloat(completionRate.toFixed(2)),
    };
  }
}
