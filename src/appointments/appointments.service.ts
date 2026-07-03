import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulesService } from '../schedules/schedules.service';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { AppointmentStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

// ─── State Machine ────────────────────────────────────────────────────────────
const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  REQUESTED: ['BOOKED', 'CANCELLED'],
  BOOKED: ['CONFIRMED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW'],
  CHECKED_IN: ['IN_CONSULTATION', 'CANCELLED'],
  IN_CONSULTATION: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  RESCHEDULED: [],
};

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulesService: SchedulesService,
    private readonly auditService: AuditService,
  ) {}

  // ─── Slot Availability ────────────────────────────────────────────────────

  async getAvailableSlots(doctorId: string, dateStr: string, patientId?: string): Promise<string[]> {
    const targetDate = new Date(dateStr);

    // 1. Enforce Holiday Calendar
    const holiday = await this.prisma.holidayCalendar.findFirst({
      where: { date: targetDate },
    });
    if (holiday) return [];

    // 2. Enforce Hospital Closures
    const closure = await this.prisma.hospitalClosure.findFirst({
      where: {
        startDate: { lte: targetDate },
        endDate: { gte: targetDate },
      },
    });
    if (closure) return [];

    // 3. Enforce Doctor Leaves
    const leave = await this.prisma.doctorLeave.findFirst({
      where: { doctorId, leaveDate: targetDate },
    });
    if (leave) return [];

    // 4. Resolve Doctor and Department Slot Duration (Default to 30 mins)
    const doctor = await this.prisma.doctor.findFirst({
      where: { doctorId },
      include: { department: true },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    
    // Priority 5: Enforce doctor presence checks (block booking if doctor is INACTIVE, ON_LEAVE, or UNAVAILABLE)
    if (['INACTIVE', 'ON_LEAVE', 'UNAVAILABLE'].includes(doctor.status)) {
      return [];
    }

    // Priority 6: Dynamic slot duration lookup based on patient history (First consult vs Follow-up)
    let slotDuration = doctor.slotDuration || doctor.department?.slotDuration || 30;
    if (patientId) {
      const pastAppointmentsCount = await this.prisma.appointment.count({
        where: { patientId, doctorId, status: 'COMPLETED' },
      });
      slotDuration = pastAppointmentsCount === 0 ? 30 : 15;
    }

    // 5. Check for schedule overrides
    const override = await this.prisma.doctorScheduleOverride.findFirst({
      where: {
        doctorId, date: targetDate
      },
    });

    let schedules: { startTime: string; endTime: string }[] = [];

    if (override) {
      if (!override.isAvailable || !override.startTime || !override.endTime) {
        return []; // Doctor override specifies unavailable
      }
      schedules = [{ startTime: override.startTime, endTime: override.endTime }];
    } else {
      const dayOfWeek = targetDate.getDay();
      schedules = await this.prisma.doctorSchedule.findMany({
        where: { doctorId, dayOfWeek },
      });
    }

    if (schedules.length === 0) return [];

    // 6. Generate Slots using resolved duration
    let allSlots: string[] = [];
    for (const schedule of schedules) {
      const slots = this.schedulesService.generateSlots(schedule.startTime, schedule.endTime, slotDuration);
      allSlots = [...allSlots, ...slots];
    }

    const bookedAppointments = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: targetDate,
        status: { in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION'] },
      },
      select: { slotTime: true, patientId: true },
    });

    const timeToMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    // Calculate booked time range intervals dynamically
    const bookedIntervals = await Promise.all(
      bookedAppointments.map(async (appt) => {
        const apptPastCount = await this.prisma.appointment.count({
          where: { patientId: appt.patientId, doctorId, status: 'COMPLETED' },
        });
        const apptDuration = apptPastCount === 0 ? 30 : 15;
        const start = timeToMinutes(appt.slotTime);
        return { start, end: start + apptDuration };
      })
    );

    // Filter slots by performing interval intersection checks
    return allSlots.filter((slot) => {
      const start = timeToMinutes(slot);
      const end = start + slotDuration;
      const overlaps = bookedIntervals.some(
        (interval) => start < interval.end && end > interval.start
      );
      return !overlaps;
    });
  }

  // ─── Book ─────────────────────────────────────────────────────────────────

  async book(dto: BookAppointmentDto) {
    const patient = await this.prisma.patient.findFirst({
      where: { patientId: dto.patientId },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const doctor = await this.prisma.doctor.findFirst({
      where: { doctorId: dto.doctorId },
      include: { user: true },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const department = await this.prisma.department.findFirst({
      where: { id: dto.departmentId },
    });
    if (!department) throw new NotFoundException('Department not found');

    const availableSlots = await this.getAvailableSlots(dto.doctorId, dto.appointmentDate, dto.patientId);
    if (!availableSlots.includes(dto.slotTime)) {
      throw new BadRequestException('Selected slot is not available');
    }

    try {
      const appointment = await this.prisma.$transaction(async (tx) => {
        // Enforce transaction-level row locking on the specific slot
        const booked = await tx.$queryRaw<any[]>`
          SELECT "appointmentId" FROM "Appointment"
          WHERE "doctorId" = ${dto.doctorId}
            AND "appointmentDate" = ${new Date(dto.appointmentDate)}
            AND "slotTime" = ${dto.slotTime}
            AND "status" IN ('BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION')
          LIMIT 1
          FOR UPDATE
        `;

        if (booked && booked.length > 0) {
          throw new ConflictException('This slot was just booked by another patient. Please choose a different slot.');
        }

        // Double check slot availability via business rules
        const targetDate = new Date(dto.appointmentDate);
        const holiday = await tx.holidayCalendar.findFirst({ where: { date: targetDate } });
        if (holiday) throw new ConflictException('Selected date is a holiday.');

        const closure = await tx.hospitalClosure.findFirst({
          where: { startDate: { lte: targetDate }, endDate: { gte: targetDate } },
        });
        if (closure) throw new ConflictException('Hospital is closed on this date.');

        const leave = await tx.doctorLeave.findFirst({
          where: { doctorId: dto.doctorId, leaveDate: targetDate },
        });
        if (leave) throw new ConflictException('Doctor is on leave.');

        return tx.appointment.create({
          data: {
        patientId: dto.patientId,
            doctorId: dto.doctorId,
            departmentId: dto.departmentId,
            appointmentDate: targetDate,
            slotTime: dto.slotTime,
            status: 'BOOKED',
          },
          include: { doctor: { include: { user: true } }, patient: true, department: true },
        });
      });

      await this.prisma.notificationLog.create({
        data: {
        patientId: dto.patientId,
          type: 'APPOINTMENT_CONFIRMATION',
          payload: JSON.stringify({
            patientName: `${patient.firstName} ${patient.lastName}`,
            phone: patient.phone,
            doctorName: doctor.name,
            date: dto.appointmentDate,
            time: dto.slotTime,
            appointmentId: appointment.appointmentId,
          }),
        },
      });

      // Notify Doctor of New Booking
      await this.notifyDoctor(appointment, 'BOOKED');

      await this.auditService.log(
        'Appointment Created',
        'Appointment',
        appointment.appointmentId,
        undefined,
        { patientId: dto.patientId, doctorId: dto.doctorId, date: dto.appointmentDate },
      );

      return appointment;
    } catch (error) {
      if (error.code === 'P2002' || error.status === 409) {
        const freshSlots = await this.getAvailableSlots(dto.doctorId, dto.appointmentDate);
        throw new ConflictException({
          message: error.message || 'This slot was just booked by another patient. Please choose a different slot.',
          availableSlots: freshSlots,
          doctorId: dto.doctorId,
          date: dto.appointmentDate,
        });
      }
      throw error;
    }
  }

  // ─── State Machine Transition Helper ─────────────────────────────────────

  private statusToTimestampField(status: AppointmentStatus): string | null {
    switch (status) {
      case 'CONFIRMED': return 'confirmationSentAt';
      case 'CHECKED_IN': return 'checkInAt';
      case 'IN_CONSULTATION': return 'consultationStartedAt';
      case 'COMPLETED': return 'completedAt';
      case 'CANCELLED': return 'cancelledAt';
      case 'RESCHEDULED': return 'rescheduledAt';
      case 'NO_SHOW': return 'noShowAt';
      default: return null;
    }
  }

  private async notifyDoctor(appointment: any, eventType: string) {
    const doctorUser = appointment.doctor?.user || null;
    await this.prisma.notificationLog.create({
      data: {
        patientId: appointment.patientId,
        type: 'DOCTOR_ALERT',
        payload: JSON.stringify({
          doctorId: appointment.doctorId,
          appointmentId: appointment.appointmentId,
          patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
          date: appointment.appointmentDate.toISOString().split('T')[0],
          slot: appointment.slotTime,
          eventType,
          doctorEmail: doctorUser?.email || 'N/A',
          doctorPhone: doctorUser?.phone || 'N/A',
          message: `Appointment ${eventType.toLowerCase()} for patient ${appointment.patient.firstName} ${appointment.patient.lastName}`,
        }),
      },
    });
  }

  private async transition(
    id: string,
    targetStatus: AppointmentStatus,
    actionLabel: string,
    notificationPayloadExtra?: Record<string, any>,
  ) {
    const existing = await this.prisma.appointment.findFirst({
      where: { appointmentId: id },
      include: { patient: true, doctor: { include: { user: true } }, department: true },
    });
    if (!existing) throw new NotFoundException('Appointment not found');

    const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${existing.status} to ${targetStatus}`,
      );
    }

    const updateData: any = { status: targetStatus };
    const timestampField = this.statusToTimestampField(targetStatus);
    if (timestampField) {
      updateData[timestampField] = new Date();
    }

    if (targetStatus === 'CANCELLED' && notificationPayloadExtra) {
      updateData.cancelledBy = notificationPayloadExtra.cancelledBy || 'SYSTEM';
      updateData.cancellationReason = notificationPayloadExtra.cancellationReason || 'Not specified';
    }

    const updated = await this.prisma.appointment.update({
      where: { appointmentId: id },
      data: updateData,
      include: { patient: true, doctor: { include: { user: true } }, department: true },
    });

    // Patient Notification
    const basePayload = {
      patientName: `${existing.patient.firstName} ${existing.patient.lastName}`,
      phone: existing.patient.phone,
      doctorName: existing.doctor.name,
      appointmentId: id,
      date: existing.appointmentDate,
      time: existing.slotTime,
      status: targetStatus,
      ...notificationPayloadExtra,
    };

    if (['CONFIRMED', 'CANCELLED'].includes(targetStatus)) {
      await this.prisma.notificationLog.create({
        data: {
        patientId: existing.patientId,
          type: 'APPOINTMENT_CONFIRMATION',
          payload: JSON.stringify(basePayload),
        },
      });
    }

    // Doctor Notification
    if (['CANCELLED', 'CHECKED_IN'].includes(targetStatus)) {
      await this.notifyDoctor(updated, targetStatus);
    }

    await this.auditService.log(
      actionLabel,
      'Appointment',
      id,
      undefined,
      { from: existing.status, to: targetStatus, ...notificationPayloadExtra },
    );

    return updated;
  }

  // ─── Lifecycle Methods ────────────────────────────────────────────────────

  async confirm(id: string) {
    return this.transition(id, 'CONFIRMED', 'Appointment Confirmed');
  }

  async checkIn(id: string) {
    return this.transition(id, 'CHECKED_IN', 'Patient Checked In');
  }

  async startConsultation(id: string) {
    return this.transition(id, 'IN_CONSULTATION', 'Consultation Started');
  }

  async complete(id: string) {
    return this.transition(id, 'COMPLETED', 'Appointment Completed');
  }

  async markNoShow(id: string) {
    return this.transition(id, 'NO_SHOW', 'Marked No Show');
  }

  async cancel(id: string, cancelledBy?: string, reason?: string) {
    return this.transition(id, 'CANCELLED', 'Appointment Cancelled', {
      cancelledBy: cancelledBy || 'SYSTEM',
      cancellationReason: reason || 'Not specified',
    });
  }

  // ─── Reschedule ───────────────────────────────────────────────────────────

  async reschedule(id: string, dto: RescheduleAppointmentDto) {
    const existing = await this.prisma.appointment.findFirst({
      where: { appointmentId: id },
      include: { patient: true, doctor: { include: { user: true } }, department: true },
    });
    if (!existing) throw new NotFoundException('Appointment not found');

    if (!['BOOKED', 'CONFIRMED'].includes(existing.status)) {
      throw new BadRequestException(
        `Cannot reschedule an appointment with status ${existing.status}`,
      );
    }

    const availableSlots = await this.getAvailableSlots(existing.doctorId, dto.newDate);
    if (!availableSlots.includes(dto.newSlotTime)) {
      throw new BadRequestException('New slot is not available');
    }

    const now = new Date();
    await this.prisma.appointment.update({
      where: { appointmentId: id },
      data: {
        status: 'RESCHEDULED',
        rescheduledAt: now,
        rescheduleReason: dto.rescheduleReason || 'Not specified',
      },
    });

    const newAppointment = await this.prisma.appointment.create({
      data: {
        patientId: existing.patientId,
        doctorId: existing.doctorId,
        departmentId: existing.departmentId,
        appointmentDate: new Date(dto.newDate),
        slotTime: dto.newSlotTime,
        status: 'BOOKED',
        previousAppointmentId: id,
      },
      include: { doctor: { include: { user: true } }, patient: true, department: true },
    });

    // Patient Reschedule Notification
    await this.prisma.notificationLog.create({
      data: {
        patientId: existing.patientId,
        type: 'APPOINTMENT_CONFIRMATION',
        payload: JSON.stringify({
          patientName: `${existing.patient.firstName} ${existing.patient.lastName}`,
          phone: existing.patient.phone,
          doctorName: existing.doctor.name,
          date: dto.newDate,
          time: dto.newSlotTime,
          newAppointmentId: newAppointment.appointmentId,
          originalAppointmentId: id,
          rescheduled: true,
          rescheduleReason: dto.rescheduleReason,
        }),
      },
    });

    // Notify Doctor
    await this.notifyDoctor(newAppointment, 'RESCHEDULED');
    await this.notifyDoctor(existing, 'CANCELLED');

    await this.auditService.log(
      'Appointment Rescheduled',
      'Appointment',
      id,
      undefined,
      {
        originalId: id,
        newId: newAppointment.appointmentId,
        newDate: dto.newDate,
        newSlotTime: dto.newSlotTime,
      },
    );

    return {
      original: { appointmentId: id, status: 'RESCHEDULED' },
      new: newAppointment,
    };
  }

  // ─── Generic Status Setter (admin use) ───────────────────────────────────

  async setStatus(id: string, status: AppointmentStatus) {
    const existing = await this.prisma.appointment.findFirst({
      where: { appointmentId: id },
    });
    if (!existing) throw new NotFoundException('Appointment not found');

    const updateData: any = { status };
    const timestampField = this.statusToTimestampField(status);
    if (timestampField) {
      updateData[timestampField] = new Date();
    }

    const updated = await this.prisma.appointment.update({
      where: { appointmentId: id },
      data: updateData,
    });

    await this.auditService.log('Appointment Status Updated', 'Appointment', id, undefined, {
      status,
    });

    return updated;
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  async findAll(status?: AppointmentStatus) {
    return this.prisma.appointment.findMany({
      where: status ? { status } : undefined,
      include: { doctor: true, patient: true, department: true },
      orderBy: { appointmentDate: 'desc' },
    });
  }

  async findOne(id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { appointmentId: id },
      include: { doctor: true, patient: true, department: true },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }

  async findUpcoming(hoursAhead: number) {
    const now = new Date();
    const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
    return this.prisma.appointment.findMany({
      where: {
        status: { in: ['BOOKED', 'CONFIRMED'] },
        appointmentDate: { lte: future, gte: now },
      },
      include: { patient: true, doctor: true },
    });
  }
}
