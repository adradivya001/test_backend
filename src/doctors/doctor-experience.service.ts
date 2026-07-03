import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { PatientsService } from '../patients/patients.service';
import { SaveConsultationDto } from './dto/save-consultation.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class DoctorExperienceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appointmentsService: AppointmentsService,
    private readonly patientsService: PatientsService,
    private readonly auditService: AuditService,
  ) {}

  async getTodaySchedule(doctorId: string) {
    const doctor = await this.prisma.doctor.findFirst({ where: { doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    return this.prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        patient: true,
        department: true,
      },
      orderBy: { slotTime: 'asc' },
    });
  }

  async getUpcomingAppointments(doctorId: string) {
    const doctor = await this.prisma.doctor.findFirst({ where: { doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: {
          gt: today,
        },
      },
      include: {
        patient: true,
        department: true,
      },
      orderBy: [
        { appointmentDate: 'asc' },
        { slotTime: 'asc' },
      ],
    });
  }

  async getPatientQueue(doctorId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    return this.prisma.appointment.findMany({
      where: {
        doctorId,
        status: 'CHECKED_IN',
        appointmentDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        patient: true,
        department: true,
      },
      orderBy: { slotTime: 'asc' },
    });
  }

  async getConsultationQueue(doctorId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    return this.prisma.appointment.findMany({
      where: {
        doctorId,
        status: 'IN_CONSULTATION',
        appointmentDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        patient: true,
        department: true,
      },
      orderBy: { slotTime: 'asc' },
    });
  }

  async getPatientHistory(patientId: string) {
    return this.patientsService.getTimeline(patientId);
  }

  async getPatientReports(patientId: string) {
    return this.prisma.report.findMany({
      where: { patientId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async searchPatients(query: string) {
    return this.patientsService.search(query);
  }

  async getPreferences(doctorId: string) {
    const prefs = await this.prisma.doctorPreferences.findFirst({
      where: { doctorId },
    });
    if (!prefs) {
      return this.prisma.doctorPreferences.create({
        data: {
        doctorId,
          receiveNotifications: true,
          preferredLanguage: 'en',
        },
      });
    }
    return prefs;
  }

  async updatePreferences(doctorId: string, receiveNotifications: boolean, preferredLanguage: string) {
    return this.prisma.doctorPreferences.upsert({
      where: { doctorId },
      update: { receiveNotifications, preferredLanguage },
      create: { doctorId, receiveNotifications, preferredLanguage },
    });
  }

  async getNotifications(doctorId: string) {
    return this.prisma.doctorNotification.findMany({
      where: { doctorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markNotificationRead(notificationId: string) {
    return this.prisma.doctorNotification.update({
      where: { id: notificationId },
      data: {
        isRead: true },
    });
  }

  async startConsultation(appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { appointmentId },
      include: { patient: true, doctor: true },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    const updated = await this.appointmentsService.startConsultation(appointmentId);

    // Update local consultation status details
    await this.prisma.appointment.update({
      where: { appointmentId },
      data: {
        consultationStatus: 'STARTED',
      },
    });

    // Save Audit event
    await this.auditService.log(
      'CONSULTATION_STARTED',
      'Appointment',
      appointmentId,
      undefined,
      { doctorId: appointment.doctorId, patientId: appointment.patientId }
    );

    // Create doctor notifications if preferences allow
    const prefs = await this.getPreferences(appointment.doctorId);
    if (prefs.receiveNotifications) {
      await this.prisma.doctorNotification.create({
        data: {
        doctorId: appointment.doctorId,
          message: `Consultation started for patient ${appointment.patient.firstName} ${appointment.patient.lastName}.`,
        },
      });
    }

    return updated;
  }

  async updateConsultation(appointmentId: string, dto: SaveConsultationDto) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { appointmentId },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    const updated = await this.prisma.appointment.update({
      where: { appointmentId },
      data: {
        consultationNotes: dto.consultationNotes,
        diagnosis: dto.diagnosis,
        prescriptionUrl: dto.prescriptionUrl || null,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
        consultationSummary: dto.consultationSummary || null,
        clinicalObservations: dto.clinicalObservations || null,
        treatmentPlan: dto.treatmentPlan || null,
        consultationDuration: dto.consultationDuration || null,
        consultationStatus: 'UPDATED',
      },
    });

    // Save Audit event
    await this.auditService.log(
      'CONSULTATION_UPDATED',
      'Appointment',
      appointmentId,
      undefined,
      { doctorId: appointment.doctorId, patientId: appointment.patientId }
    );

    return updated;
  }

  async saveConsultation(appointmentId: string, dto: SaveConsultationDto) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { appointmentId },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    // First update the details
    await this.prisma.appointment.update({
      where: { appointmentId },
      data: {
        consultationNotes: dto.consultationNotes,
        diagnosis: dto.diagnosis,
        prescriptionUrl: dto.prescriptionUrl || null,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
        consultationSummary: dto.consultationSummary || null,
        clinicalObservations: dto.clinicalObservations || null,
        treatmentPlan: dto.treatmentPlan || null,
        consultationDuration: dto.consultationDuration || null,
        consultationStatus: 'COMPLETED',
      },
    });

    // Complete appointment state machine transition
    const updated = await this.appointmentsService.complete(appointmentId);

    // Save Audit event
    await this.auditService.log(
      'CONSULTATION_COMPLETED',
      'Appointment',
      appointmentId,
      undefined,
      { doctorId: appointment.doctorId, patientId: appointment.patientId }
    );

    // If follow-up date is set, create a follow-up tracker record
    if (dto.followUpDate) {
      await this.prisma.patientFollowUp.upsert({
        where: { appointmentId },
        update: {
          followUpDate: new Date(dto.followUpDate),
          status: 'PENDING',
        },
        create: {
          appointmentId,
          patientId: appointment.patientId,
          followUpDate: new Date(dto.followUpDate),
          status: 'PENDING',
        },
      });
    }

    // Create doctor notifications if preferences allow
    const prefs = await this.getPreferences(appointment.doctorId);
    if (prefs.receiveNotifications) {
      await this.prisma.doctorNotification.create({
        data: {
        doctorId: appointment.doctorId,
          message: `Consultation completed for appointment ID: ${appointmentId}.`,
        },
      });
    }

    return updated;
  }
}
