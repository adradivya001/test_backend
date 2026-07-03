import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AppointmentReminderWorker implements OnModuleInit, OnModuleDestroy {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Run every 1 minute to check for reminders
    this.intervalId = setInterval(() => this.processReminders(), 60000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async processReminders() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const now = new Date();
      // Fetch all upcoming booked or confirmed appointments
      const upcomingAppointments = await this.prisma.appointment.findMany({
        where: {
          status: { in: ['BOOKED', 'CONFIRMED'] },
        },
        include: {
          patient: true,
          doctor: true,
        },
      });

      for (const app of upcomingAppointments) {
        const start = this.getAppointmentStartDateTime(app.appointmentDate, app.slotTime);
        const diffMs = start.getTime() - now.getTime();

        if (diffMs <= 0) continue; // Already started or in the past

        // Check 30 minutes
        if (diffMs <= 30 * 60 * 1000) {
          await this.sendReminder(app, 'REMINDER_30M', `🔔 Quick Reminder: Your appointment with ${app.doctor.name} starts in 30 minutes at ${app.slotTime}.`);
        }
        // Check 2 hours
        else if (diffMs <= 2 * 60 * 60 * 1000) {
          await this.sendReminder(app, 'REMINDER_2H', `⏰ Reminder: Your appointment with ${app.doctor.name} is scheduled in 2 hours at ${app.slotTime}.`);
        }
        // Check 24 hours
        else if (diffMs <= 24 * 60 * 60 * 1000) {
          await this.sendReminder(app, 'REMINDER_24H', `📅 Reminder: You have an appointment with ${app.doctor.name} tomorrow at ${app.slotTime}.`);
        }
      }
    } catch (error) {
      console.error('Error processing appointment reminders:', error.message);
    } finally {
      this.isProcessing = false;
    }
  }

  private getAppointmentStartDateTime(date: Date, slotTime: string): Date {
    const [hours, minutes] = slotTime.split(':').map(Number);
    const d = new Date(date);
    d.setHours(hours, minutes, 0, 0);
    return d;
  }

  private async sendReminder(appointment: any, reminderType: string, message: string) {
    try {
      // Attempt to insert reminder log to guarantee uniqueness
      await this.prisma.appointmentReminderLog.create({
        data: {
        appointmentId: appointment.appointmentId,
          reminderType,
        },
      });

      // If successful (no unique clash), create NotificationLog
      await this.prisma.notificationLog.create({
        data: {
                    patientId: appointment.patientId,
          type: 'APPOINTMENT_REMINDER',
          payload: JSON.stringify({
            phone: appointment.patient.phone,
            patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
            doctorName: appointment.doctor.name,
            date: appointment.appointmentDate.toISOString().split('T')[0],
            time: appointment.slotTime,
            message,
          }),
        },
      });
    } catch (err) {
      // Prisma unique constraint error code is P2002
      if (err.code === 'P2002') {
        // Reminder already sent, ignore
        return;
      }
      console.error(`Failed to send ${reminderType} for appointment ${appointment.appointmentId}:`, err.message);
    }
  }
}
