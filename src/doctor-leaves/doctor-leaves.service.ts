import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarkLeaveDto } from './dto/mark-leave.dto';
import { AppointmentsService } from '../appointments/appointments.service';

@Injectable()
export class DoctorLeavesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appointmentsService: AppointmentsService,
  ) {}

  async markLeave(dto: MarkLeaveDto) {
    // Check doctor exists
    const doctor = await this.prisma.doctor.findFirst({
      where: { doctorId: dto.doctorId },
      include: { department: true },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const leaveDate = new Date(dto.leaveDate);

    // Double check if leave already exists
    const existing = await this.prisma.doctorLeave.findFirst({
      where: {
        doctorId: dto.doctorId,
        leaveDate: leaveDate,
      },
    });
    if (existing) {
      throw new ConflictException('Doctor is already marked on leave for this date');
    }

    // Query all BOOKED or CONFIRMED appointments on that day
    const appointments = await this.prisma.appointment.findMany({
      where: {
        doctorId: dto.doctorId,
        appointmentDate: leaveDate,
        status: { in: ['BOOKED', 'CONFIRMED'] },
      },
      include: {
        patient: true,
      },
    });

    // Create the doctor leave record first
    const leaveRecord = await this.prisma.doctorLeave.create({
      data: {
        doctorId: dto.doctorId,
        leaveDate: leaveDate,
        reason: dto.reason,
      },
    });

    const dayOfWeek = leaveDate.getDay();

    // Query alternative active doctors in the same department who have schedule on this dayOfWeek, and who do not have a leave on this leaveDate.
    const alternativeDoctors = await this.prisma.doctor.findMany({
      where: {
        departmentId: doctor.departmentId,
        doctorId: { not: dto.doctorId },
        status: 'ACTIVE',
        schedules: {
          some: {
            dayOfWeek: dayOfWeek,
          },
        },
        leaves: {
          none: {
            leaveDate: leaveDate,
          },
        },
      },
      include: {
        schedules: {
          where: {
            dayOfWeek: dayOfWeek,
          },
        },
      },
    });

    // Format alternative doctors suggestion text
    let alternativesText = '';
    if (alternativeDoctors.length > 0) {
      alternativesText = `\n\nWe suggest the following alternative doctor(s) in the same department:\n`;
      for (const altDoc of alternativeDoctors) {
        const slots = await this.appointmentsService.getAvailableSlots(altDoc.doctorId, dto.leaveDate);
        const slotsText = slots.slice(0, 3).join(', ');
        alternativesText += `• Dr. ${altDoc.name} (Slots: ${slotsText || 'No slots available'})\n`;
      }
      alternativesText += `\nTo reschedule, please reply with "reschedule" or contact us.`;
    } else {
      alternativesText = `\n\nPlease reply with "reschedule" or contact the hospital to book another slot.`;
    }

    const formattedLeaveDate = leaveDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    // Process each cancelled appointment individually
    for (const app of appointments) {
      // 1. Update appointment status to CANCELLED
      await this.prisma.appointment.update({
        where: { appointmentId: app.appointmentId },
        data: {
        status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: 'DOCTOR',
          cancellationReason: dto.reason || 'Doctor Leave',
        },
      });

      // 2. Log audit event
      await this.prisma.auditLog.create({
        data: {
        action: 'Appointment Cancelled',
          userId: null,
          entityType: 'Appointment',
          entityId: app.appointmentId,
          details: JSON.stringify({
            reason: dto.reason || 'Doctor Leave',
            cancelledBy: 'DOCTOR',
            originalDate: app.appointmentDate,
            slotTime: app.slotTime,
          }),
        },
      });

      // 3. Format message for patient
      const patientMessage = `⚠️ *Appointment Cancellation Alert* ⚠️\n\nDear ${app.patient.firstName},\n\nWe regret to inform you that your appointment with Dr. ${doctor.name} on ${formattedLeaveDate} at ${app.slotTime} has been cancelled due to doctor leave.${alternativesText}`;

      // 4. Create NotificationLog entry for patient
      await this.prisma.notificationLog.create({
        data: {
        patientId: app.patientId,
          type: 'DOCTOR_LEAVE_CANCELLATION',
          payload: JSON.stringify({
            phone: app.patient.phone,
            message: patientMessage,
            appointmentId: app.appointmentId,
          }),
          deliveryStatus: 'PENDING',
        },
      });
    }

    return leaveRecord;
  }

  async cancelLeave(doctorId: string, leaveDateStr: string) {
    const leaveDate = new Date(leaveDateStr);
    const existing = await this.prisma.doctorLeave.findFirst({
      where: { doctorId, leaveDate },
    });
    if (!existing) {
      throw new NotFoundException('Leave record not found');
    }

    return this.prisma.doctorLeave.delete({
      where: { id: existing.id },
    });
  }

  async getLeaves(doctorId?: string) {
    return this.prisma.doctorLeave.findMany({
      where: doctorId ? { doctorId } : {},
      include: { doctor: true },
      orderBy: { leaveDate: 'asc' },
    });
  }
}
