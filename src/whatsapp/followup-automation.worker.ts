import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FollowupAutomationWorker implements OnModuleInit, OnModuleDestroy {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Check follow-ups every 30 seconds
    this.intervalId = setInterval(() => this.processFollowups(), 30000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async processFollowups() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 1. Process pending follow-ups that are due
      const pendingFollowUps = await this.prisma.patientFollowUp.findMany({
        where: {
          status: 'PENDING',
          followUpDate: {
            lte: today,
          },
        },
        include: {
          appointment: {
            include: {
              doctor: true,
              patient: true,
            },
          },
        },
      });

      for (const followUp of pendingFollowUps) {
        try {
          // Check if patient has already booked/completed a subsequent appointment with the doctor since the original appointment
          const subsequentAppointment = await this.prisma.appointment.findFirst({
            where: {
              patientId: followUp.patientId,
              doctorId: followUp.appointment.doctorId,
              appointmentDate: {
                gt: followUp.appointment.appointmentDate,
              },
              status: { in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION', 'COMPLETED'] },
            },
          });

          if (subsequentAppointment) {
            // Auto-transition to COMPLETED and skip reminder
            await this.prisma.patientFollowUp.update({
              where: { id: followUp.id },
              data: {
        status: 'COMPLETED',
              },
            });
            continue;
          }

          const patientName = `${followUp.appointment.patient.firstName} ${followUp.appointment.patient.lastName}`;
          const doctorName = followUp.appointment.doctor.name;
          const formattedDate = followUp.followUpDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });

          const message = `🔔 *Medical Follow-Up Reminder* 🔔\n\nDear ${followUp.appointment.patient.firstName},\n\nThis is a friendly reminder that you have a follow-up consultation recommended by Dr. ${doctorName} on ${formattedDate}.\n\nTo schedule this appointment, please send us a message saying "book appointment" or call the reception.`;

          // Queue follow-up reminder notification
          await this.prisma.notificationLog.create({
            data: {
                        patientId: followUp.patientId,
              type: 'FOLLOWUP_REMINDER',
              payload: JSON.stringify({
                phone: followUp.appointment.patient.phone,
                message,
                patientName,
                doctorName,
                followUpDate: followUp.followUpDate,
              }),
              deliveryStatus: 'PENDING',
            },
          });

          // Update follow-up record status to NOTIFIED
          await this.prisma.patientFollowUp.update({
            where: { id: followUp.id },
            data: {
        status: 'NOTIFIED',
              notifiedAt: new Date(),
            },
          });
        } catch (err) {
          console.error(`Error processing follow-up ID ${followUp.id}:`, err.message);
        }
      }

      // 2. Mark older notified follow-ups as MISSED if more than 3 days have passed without booking
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - 3);

      const missedFollowUps = await this.prisma.patientFollowUp.findMany({
        where: {
          status: 'NOTIFIED',
          followUpDate: {
            lt: thresholdDate,
          },
        },
        include: {
          appointment: {
            include: {
              patient: true,
            },
          },
        },
      });

      for (const followUp of missedFollowUps) {
        try {
          // Transition status to MISSED
          await this.prisma.patientFollowUp.update({
            where: { id: followUp.id },
            data: {
        status: 'MISSED',
            },
          });

          // Queue follow-up missed notice (for support agents or logs)
          await this.prisma.notificationLog.create({
            data: {
                        patientId: followUp.patientId,
              type: 'FOLLOWUP_MISSED',
              payload: JSON.stringify({
                phone: followUp.appointment.patient.phone,
                message: `Alert: Patient ${followUp.appointment.patient.firstName} ${followUp.appointment.patient.lastName} missed their scheduled follow-up on ${followUp.followUpDate.toLocaleDateString()}.`,
              }),
              deliveryStatus: 'PENDING',
            },
          });
        } catch (err) {
          console.error(`Error flagging missed follow-up ID ${followUp.id}:`, err.message);
        }
      }

      // 3. Auto-detect No-Shows (Priority 16 check-in window)
      const nowTime = new Date();
      const currentMinutes = nowTime.getHours() * 60 + nowTime.getMinutes();
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      const bookedApptsToday = await this.prisma.appointment.findMany({
        where: {
          status: { in: ['BOOKED', 'CONFIRMED'] },
          appointmentDate: todayDate,
        },
        include: { patient: true, doctor: true },
      });

      for (const app of bookedApptsToday) {
        const [h, m] = app.slotTime.split(':').map(Number);
        const apptMinutes = h * 60 + m;
        // If appointment slot start was more than 30 minutes ago and patient hasn't checked in
        if (currentMinutes > apptMinutes + 30) {
          await this.prisma.appointment.update({
            where: { appointmentId: app.appointmentId },
            data: {
        status: 'NO_SHOW',
              noShowAt: new Date(),
            },
          });

          await this.prisma.auditLog.create({
            data: {
        action: 'Marked No Show',
              entityType: 'Appointment',
              entityId: app.appointmentId,
              details: JSON.stringify({ reason: 'Auto-detected by No-Show Worker' }),
            },
          });

          await this.prisma.notificationLog.create({
            data: {
                        patientId: app.patientId,
              type: 'FOLLOWUP_MISSED',
              payload: JSON.stringify({
                phone: app.patient.phone,
                message: `⚠️ *Missed Appointment Alert* ⚠️\n\nDear ${app.patient.firstName},\n\nYou missed your scheduled appointment with Dr. ${app.doctor.name} today at ${app.slotTime}. Since you did not check-in within the 30-minute window, the slot was released. To book another slot, reply with "book appointment".`,
              }),
            },
          });
        }
      }

    } catch (error) {
      console.error('Error running follow-up automation worker:', error.message);
    } finally {
      this.isProcessing = false;
    }
  }
}
