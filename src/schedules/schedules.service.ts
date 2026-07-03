import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(doctorId: string, dto: CreateScheduleDto) {
    // Validate doctor
    const doctor = await this.prisma.doctor.findFirst({ where: { doctorId } });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    try {
      const schedule = await this.prisma.doctorSchedule.create({
        data: {
        doctorId,
          dayOfWeek: dto.dayOfWeek,
          startTime: dto.startTime,
          endTime: dto.endTime,
        },
      });

      await this.auditService.log(
        'Doctor Schedule Updated',
        'DoctorSchedule',
        schedule.id,
        undefined,
        { doctorId, action: 'CREATE', dayOfWeek: dto.dayOfWeek },
      );

      return schedule;
    } catch (error) {
      throw new ConflictException('Schedule time range already exists for this day');
    }
  }

  async findByDoctor(doctorId: string) {
    const doctor = await this.prisma.doctor.findFirst({ where: { doctorId } });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    return this.prisma.doctorSchedule.findMany({
      where: { doctorId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async delete(scheduleId: string) {
    const existing = await this.prisma.doctorSchedule.findFirst({
      where: { id: scheduleId },
    });
    if (!existing) {
      throw new NotFoundException('Schedule not found');
    }

    const deleted = await this.prisma.doctorSchedule.delete({ where: { id: scheduleId } });

    await this.auditService.log(
      'Doctor Schedule Updated',
      'DoctorSchedule',
      scheduleId,
      undefined,
      { doctorId: existing.doctorId, action: 'DELETE' },
    );

    await this.handleImpactedAppointments(existing.doctorId, existing.dayOfWeek);

    return deleted;
  }

  async handleImpactedAppointments(doctorId: string, dayOfWeek: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        status: { in: ['BOOKED', 'CONFIRMED'] },
        appointmentDate: { gte: today },
      },
      include: { patient: true, doctor: true },
    });

    const schedules = await this.prisma.doctorSchedule.findMany({
      where: { doctorId, dayOfWeek },
    });

    const doctor = await this.prisma.doctor.findFirst({ where: { doctorId } });
    const duration = doctor?.slotDuration || 30;

    for (const app of appointments) {
      if (app.appointmentDate.getDay() !== dayOfWeek) continue;

      let isValid = false;
      for (const schedule of schedules) {
        const slots = this.generateSlots(schedule.startTime, schedule.endTime, duration);
        if (slots.includes(app.slotTime)) {
          isValid = true;
          break;
        }
      }

      if (!isValid) {
        await this.prisma.appointment.update({
          where: { appointmentId: app.appointmentId },
          data: {
        status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledBy: 'SYSTEM',
            cancellationReason: 'Doctor Schedule Changed',
          },
        });

        await this.auditService.log(
          'Appointment Cancelled',
          'Appointment',
          app.appointmentId,
          undefined,
          { reason: 'Doctor Schedule Changed', originalDate: app.appointmentDate, slotTime: app.slotTime },
        );

        await this.prisma.notificationLog.create({
          data: {
        patientId: app.patientId,
            type: 'DOCTOR_LEAVE_CANCELLATION',
            payload: JSON.stringify({
              phone: app.patient.phone,
              message: `⚠️ *Appointment Cancellation Alert* ⚠️\n\nDear ${app.patient.firstName},\n\nWe regret to inform you that your appointment with Dr. ${app.doctor.name} on ${app.appointmentDate.toISOString().split('T')[0]} at ${app.slotTime} has been cancelled due to a change in the doctor's consultation hours. Please select another slot.`,
              appointmentId: app.appointmentId,
            }),
          },
        });
      }
    }
  }

  // Generate slots for a specific schedule
  generateSlots(startTime: string, endTime: string, intervalMinutes = 30): string[] {
    const slots: string[] = [];
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    let currentMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    while (currentMinutes + intervalMinutes <= endMinutes) {
      const hour = Math.floor(currentMinutes / 60);
      const minute = currentMinutes % 60;
      
      const formattedHour = hour.toString().padStart(2, '0');
      const formattedMinute = minute.toString().padStart(2, '0');
      
      slots.push(`${formattedHour}:${formattedMinute}`);
      currentMinutes += intervalMinutes;
    }

    return slots;
  }
}
