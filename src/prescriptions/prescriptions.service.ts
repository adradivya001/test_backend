import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { CreatePrescriptionTemplateDto } from './dto/create-template.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreatePrescriptionDto) {
    // Check appointment, patient, and doctor exist
    const appointment = await this.prisma.appointment.findFirst({
      where: { appointmentId: dto.appointmentId },
      include: { patient: true, doctor: true },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    const prescription = await this.prisma.prescription.create({
      data: {
        appointmentId: dto.appointmentId,
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        notes: dto.notes,
        // Calculate standard expiry date for prescriptions (e.g. 180 days default)
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        items: {
          create: dto.items,
        },
      },
      include: {
        items: true,
      },
    });

    // Create Audit log
    await this.auditService.log(
      'PRESCRIPTION_CREATED',
      'Prescription',
      prescription.id,
      undefined,
      { patientId: dto.patientId, doctorId: dto.doctorId }
    );

    // Dynamic WhatsApp Notification Link
    const hostUrl = this.configService.get<string>('APP_HOST_URL', 'http://localhost:3000');
    const secureDownloadPath = await this.generateSecureUrl(prescription.id);
    const downloadUrl = `${hostUrl}${secureDownloadPath}`;

    const message = `💊 *New Prescription Available* 💊\n\nDear ${appointment.patient.firstName},\n\nDr. ${appointment.doctor.name} has prescribed medication following your consultation on ${appointment.appointmentDate.toLocaleDateString()}.\n\nYou can securely view and download your digital prescription details here (link expires in 15 minutes):\n${downloadUrl}`;

    await this.prisma.notificationLog.create({
      data: {
        patientId: dto.patientId,
        type: 'APPOINTMENT_CONFIRMATION', // standard channel outbox
        payload: JSON.stringify({
          phone: appointment.patient.phone,
          message,
        }),
        deliveryStatus: 'PENDING',
      },
    });

    // Link prescription URL back to appointment for record consistency
    await this.prisma.appointment.update({
      where: { appointmentId: dto.appointmentId },
      data: {
        prescriptionUrl: downloadUrl,
      },
    });

    return prescription;
  }

  async createTemplate(dto: CreatePrescriptionTemplateDto) {
    const doctor = await this.prisma.doctor.findFirst({ where: { doctorId: dto.doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    return this.prisma.prescriptionTemplate.create({
      data: {
        doctorId: dto.doctorId,
        name: dto.name,
        medications: JSON.stringify(dto.items),
      },
    });
  }

  async getTemplates(doctorId: string) {
    return this.prisma.prescriptionTemplate.findMany({
      where: { doctorId },
    });
  }

  async findOne(id: string) {
    const p = await this.prisma.prescription.findFirst({
      where: { id },
      include: {
        items: true,
        patient: true,
        doctor: true,
      },
    });
    if (!p || p.isDeleted) throw new NotFoundException('Prescription not found');
    return p;
  }

  async findByPatient(patientId: string) {
    return this.prisma.prescription.findMany({
      where: { patientId, isDeleted: false },
      include: { items: true, doctor: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async generateSecureUrl(prescriptionId: string): Promise<string> {
    const token = this.jwtService.sign(
      { prescriptionId },
      { expiresIn: '15m' },
    );
    return `/prescriptions/download/${prescriptionId}?token=${token}`;
  }

  async verifyDownloadToken(prescriptionId: string, token: string, ipAddress?: string) {
    try {
      const payload = this.jwtService.verify(token);
      if (payload.prescriptionId !== prescriptionId) {
        throw new UnauthorizedException('Token credentials mismatch');
      }

      const prescription = await this.findOne(prescriptionId);

      // Track download audit entry
      await this.prisma.prescriptionDownload.create({
        data: {
        prescriptionId,
          ipAddress: ipAddress || 'unknown',
        },
      });

      await this.auditService.log(
        'PRESCRIPTION_DOWNLOADED',
        'Prescription',
        prescriptionId,
        undefined,
        { ipAddress }
      );

      return prescription;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired prescription download token');
    }
  }

  async delete(id: string) {
    const p = await this.prisma.prescription.findFirst({ where: { id } });
    if (!p) throw new NotFoundException('Prescription not found');

    // Perform soft delete
    const deleted = await this.prisma.prescription.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    await this.auditService.log(
      'PRESCRIPTION_DELETED',
      'Prescription',
      id,
      undefined,
      { softDelete: true }
    );

    return deleted;
  }
}
