import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { AuditService } from '../audit/audit.service';
import { Language } from '@prisma/client';

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreatePatientDto) {
    const duplicate = await this.prisma.patient.findFirst({
      where: {
        phone: dto.phone,
        firstName: { equals: dto.firstName, mode: 'insensitive' },
        lastName: { equals: dto.lastName, mode: 'insensitive' },
        dateOfBirth: new Date(dto.dateOfBirth),
      },
    });
    if (duplicate) {
      throw new ConflictException('A duplicate patient profile with this name and date of birth already exists under this phone number.');
    }

    return this.prisma.patient.create({
      data: {
        ...dto,
        dateOfBirth: new Date(dto.dateOfBirth),
      },
    });
  }

  async update(patientId: string, dto: UpdatePatientDto) {
    const original = await this.findOne(patientId);
    
    const updated = await this.prisma.patient.update({
      where: { patientId },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });

    await this.auditService.log(
      'PATIENT_PROFILE_UPDATED',
      'Patient',
      patientId,
      undefined,
      {
        original: {
          email: original.email,
          address: original.address,
          emergencyContact: original.emergencyContact,
          insuranceInformation: original.insuranceInformation,
          preferredLanguage: original.preferredLanguage,
          communicationPreferences: original.communicationPreferences,
        },
        updated: {
          email: updated.email,
          address: updated.address,
          emergencyContact: updated.emergencyContact,
          insuranceInformation: updated.insuranceInformation,
          preferredLanguage: updated.preferredLanguage,
          communicationPreferences: updated.communicationPreferences,
        },
      }
    );

    return updated;
  }

  async findOne(patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { patientId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return patient;
  }

  async findByPhone(phone: string) {
    return this.prisma.patient.findFirst({
      where: { phone, status: 'ACTIVE' },
    });
  }

  async findAllByPhone(phone: string) {
    return this.prisma.patient.findMany({
      where: { phone, status: 'ACTIVE' },
    });
  }

  async search(query: string) {
    return this.prisma.patient.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
        ],
      },
    });
  }

  async getHistory(patientId: string) {
    await this.findOne(patientId);

    const appointments = await this.prisma.appointment.findMany({
      where: { patientId },
      include: { doctor: true, department: true },
      orderBy: { appointmentDate: 'desc' },
    });

    const reports = await this.prisma.report.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      appointments,
      reports,
    };
  }

  async getTimeline(patientId: string) {
    const { appointments, reports } = await this.getHistory(patientId);

    const timeline = [
      ...appointments.map((a) => ({
        id: a.appointmentId,
        type: 'APPOINTMENT',
        date: a.appointmentDate,
        title: `Appointment with Dr. ${a.doctor.name}`,
        subtitle: a.department.name,
        status: a.status,
        timestamp: a.createdAt,
        details: {
          slotTime: a.slotTime,
          cancellationReason: a.cancellationReason,
          cancelledBy: a.cancelledBy,
          rescheduleReason: a.rescheduleReason,
        },
      })),
      ...reports.map((r) => ({
        id: r.reportId,
        type: 'REPORT',
        date: r.createdAt,
        title: `${r.reportType.replace(/_/g, ' ')} Report`,
        subtitle: `Status: ${r.reportStatus}`,
        status: r.reportStatus,
        timestamp: r.createdAt,
        details: {
          reportUrl: r.reportUrl,
        },
      })),
    ];

    // Sort descending by date (most recent first), fall back to timestamp
    return timeline.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }

  async getClinicalConsultationTimeline(patientId: string) {
    await this.findOne(patientId);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        patientId,
        status: { in: ['COMPLETED', 'IN_CONSULTATION'] },
      },
      include: {
        doctor: true,
        department: true,
        prescription: {
          include: {
            items: true,
          },
        },
      },
      orderBy: { appointmentDate: 'desc' },
    });

    const reports = await this.prisma.report.findMany({
      where: {
        patientId,
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    const timeline = [
      ...appointments.map((a) => ({
        id: a.appointmentId,
        type: 'CONSULTATION',
        date: a.appointmentDate,
        timestamp: a.completedAt || a.consultationStartedAt || a.createdAt,
        title: `Consultation with Dr. ${a.doctor.name}`,
        subtitle: a.department.name,
        status: a.status,
        clinical: {
          diagnosis: a.diagnosis,
          observations: a.clinicalObservations,
          treatmentPlan: a.treatmentPlan,
          notes: a.consultationNotes,
          durationMinutes: a.consultationDuration,
        },
        prescription: a.prescription ? {
          notes: a.prescription.notes,
          items: a.prescription.items.map((item) => ({
            medication: item.medication,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            instructions: item.instructions,
          })),
        } : null,
      })),
      ...reports.map((r) => ({
        id: r.reportId,
        type: 'DIAGNOSTIC_REPORT',
        date: r.createdAt,
        timestamp: r.createdAt,
        title: `${r.reportType.replace(/_/g, ' ')} Report`,
        subtitle: `Uploaded by Lab Staff`,
        status: r.reportStatus,
        details: {
          reportUrl: r.reportUrl,
          reportStatus: r.reportStatus,
        },
      })),
    ];

    return timeline.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }

  async getAuditTrail(patientId: string) {
    await this.findOne(patientId);

    // Fetch audit logs that match this patient's ID as entityId
    return this.prisma.auditLog.findMany({
      where: {
        entityId: patientId,
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  async getPreferences(phone: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { phone },
      select: { preferredLanguage: true },
    });
    if (!patient) {
      throw new NotFoundException(`Patient with phone ${phone} not found`);
    }
    return { preferredLanguage: patient.preferredLanguage };
  }

  async updatePreferences(phone: string, preferredLanguage: Language, userId?: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { phone },
    });
    if (!patient) {
      throw new NotFoundException(`Patient with phone ${phone} not found`);
    }

    const originalLanguage = patient.preferredLanguage;

    await this.prisma.patient.update({
      where: { patientId: patient.patientId },
      data: {
        preferredLanguage },
    });

    await this.auditService.log(
      'PATIENT_LANGUAGE_UPDATED',
      'Patient',
      patient.patientId,
      userId,
      {
        original: { preferredLanguage: originalLanguage },
        updated: { preferredLanguage },
      },
    );

    return { success: true };
  }
}
