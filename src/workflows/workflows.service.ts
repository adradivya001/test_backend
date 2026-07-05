import { Injectable, NotFoundException } from '@nestjs/common';
import { PatientsService } from '../patients/patients.service';
import { DepartmentsService } from '../departments/departments.service';
import { DoctorsService } from '../doctors/doctors.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { FaqService } from '../faq/faq.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { SupportService } from '../support/support.service';
import { ReportsService } from '../reports/reports.service';
import { AppointmentWorkflowDto } from './dto/appointment-workflow.dto';
import { DoctorAvailabilityWorkflowDto } from './dto/doctor-availability-workflow.dto';
import { ReportStatusWorkflowDto } from './dto/report-status-workflow.dto';
import { KnowledgeWorkflowDto } from './dto/knowledge-workflow.dto';
import { EscalationWorkflowDto } from './dto/escalation-workflow.dto';
import { Gender, Language } from '@prisma/client';

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly departmentsService: DepartmentsService,
    private readonly doctorsService: DoctorsService,
    private readonly appointmentsService: AppointmentsService,
    private readonly faqService: FaqService,
    private readonly kbService: KnowledgeBaseService,
    private readonly supportService: SupportService,
    private readonly reportsService: ReportsService,
  ) {}

  async handleAppointmentWorkflow(dto: AppointmentWorkflowDto) {
    const { phone, sessionData } = dto;

    // 1. Validate Patient Profile (Priority 9: Family sharing check)
    let patient: any = null;

    if (sessionData.patientId) {
      patient = await this.patientsService.findOne(sessionData.patientId);
    } else {
      const familyProfiles = await this.patientsService.findAllByPhone(phone);
      if (familyProfiles.length > 1) {
        return {
          workflow: 'appointment',
          step: 'profile_selection',
          profiles: familyProfiles.map((p) => ({ id: p.patientId, name: `${p.firstName} ${p.lastName}` })),
        };
      } else if (familyProfiles.length === 1) {
        patient = familyProfiles[0];
      }
    }
    
    // Check if registration details are provided in session
    if (!patient && sessionData.firstName && sessionData.lastName && sessionData.gender && sessionData.age && sessionData.dateOfBirth) {
      const preferredLanguage = (dto.language || 'en').toUpperCase();
      const finalLang = ['EN', 'HI', 'TE'].includes(preferredLanguage) ? preferredLanguage : 'EN';

      patient = await this.patientsService.create({
        firstName: sessionData.firstName,
        lastName: sessionData.lastName,
        gender: sessionData.gender as Gender,
        age: parseInt(sessionData.age),
        dateOfBirth: sessionData.dateOfBirth,
        phone,
        preferredLanguage: finalLang as any,
      });
    }

    if (!patient) {
      return {
        workflow: 'appointment',
        step: 'patient_registration_required',
      };
    }

    // 2. Department Selection
    if (!sessionData.departmentId) {
      const depts = await this.departmentsService.findAll();
      return {
        workflow: 'appointment',
        step: 'department_selection',
        departments: depts.map((d) => ({ id: d.id, name: d.name, description: d.description })),
      };
    }

    // 3. Doctor Selection
    if (!sessionData.doctorId) {
      const docs = await this.doctorsService.findByDepartment(sessionData.departmentId);
      return {
        workflow: 'appointment',
        step: 'doctor_selection',
        doctors: docs.map((d) => ({ id: d.doctorId, name: d.name, specialization: d.specialization, fee: d.consultationFee })),
      };
    }

    // 4. Date Selection
    if (!sessionData.date) {
      const dates: string[] = [];
      const today = new Date();
      for (let i = 1; i <= 7; i++) {
        const nextDate = new Date();
        nextDate.setDate(today.getDate() + i);
        const yyyy = nextDate.getFullYear();
        const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
        const dd = String(nextDate.getDate()).padStart(2, '0');
        dates.push(`${yyyy}-${mm}-${dd}`);
      }

      return {
        workflow: 'appointment',
        step: 'date_selection',
        dates,
      };
    }

    // 5. Slot Selection
    if (!sessionData.slot) {
      const slots = await this.appointmentsService.getAvailableSlots(
        sessionData.doctorId,
        sessionData.date,
        patient.patientId,
      );
      return {
        workflow: 'appointment',
        step: 'slot_selection',
        slots,
      };
    }

    // 6. Book Appointment
    try {
      const appointment = await this.appointmentsService.book({
        patientId: patient.patientId,
        doctorId: sessionData.doctorId,
        departmentId: sessionData.departmentId,
        appointmentDate: sessionData.date,
        slotTime: sessionData.slot,
      });

      return {
        workflow: 'appointment',
        step: 'booking_confirmed',
        appointment: {
          appointmentId: appointment.appointmentId,
          patientName: `${patient.firstName} ${patient.lastName}`,
          doctorName: appointment.doctor.name,
          departmentName: appointment.department.name,
          date: sessionData.date,
          time: sessionData.slot,
          consultationFee: appointment.doctor.consultationFee,
        },
      };
    } catch (err) {
      // Handle slot conflict — return fresh available slots so user can pick another
      if (err.status === 409) {
        const conflictData = err.response || {};
        const freshSlots = conflictData.availableSlots
          || await this.appointmentsService.getAvailableSlots(sessionData.doctorId, sessionData.date);
        return {
          workflow: 'appointment',
          step: 'slot_conflict',
          message: conflictData.message || 'The selected slot is no longer available.',
          slots: freshSlots,
          date: sessionData.date,
          doctorId: sessionData.doctorId,
        };
      }
      return {
        workflow: 'appointment',
        step: 'booking_failed',
      };
    }
  }

  async handleDoctorAvailabilityWorkflow(dto: DoctorAvailabilityWorkflowDto) {
    const doctor = await this.doctorsService.findOne(dto.doctorId);
    const slots = await this.appointmentsService.getAvailableSlots(dto.doctorId, dto.date);

    return {
      doctor: doctor.name,
      available: slots.length > 0,
      slots,
    };
  }

  async handleReportStatusWorkflow(dto: ReportStatusWorkflowDto) {
    const patient = await this.patientsService.findByPhone(dto.phone);
    if (!patient) {
      return {
        status: 'PATIENT_NOT_FOUND',
      };
    }

    const reports = await this.reportsService.findByPatient(patient.patientId);
    if (reports.length === 0) {
      return {
        status: 'NO_REPORTS_FOUND',
      };
    }

    const latest = reports[0];
    const isPending = latest.reportStatus === 'PENDING' || latest.reportStatus === 'PROCESSING';

    if (latest.reportStatus === 'READY') {
      if (!dto.dob) {
        return {
          status: 'VERIFICATION_REQUIRED',
          message: 'For security and privacy, please verify your identity by replying with your First Name:',
        };
      }

      const cleanInputName = dto.dob.trim().toLowerCase();
      const patientFirstName = patient.firstName.trim().toLowerCase();
      
      if (cleanInputName !== patientFirstName) {
        return {
          status: 'VERIFICATION_FAILED',
          message: 'Verification failed. The name provided does not match our records.',
        };
      }
    }

    let secureUrl: string | null = null;
    if (latest.reportStatus === 'READY') {
      secureUrl = await this.reportsService.generateSecureUrl(latest.reportId);
    }

    return {
      status: latest.reportStatus,
      reportId: latest.reportId,
      reportType: latest.reportType,
      createdAt: latest.createdAt,
      isPending,
      downloadUrl: secureUrl,
    };
  }

  async handleKnowledgeWorkflow(dto: KnowledgeWorkflowDto) {
    // Search FAQs first
    const faqs = await this.faqService.search(dto.query, dto.language);
    if (faqs.length > 0) {
      return {
        answer: faqs[0].answer,
        source: 'FAQ',
        title: faqs[0].question,
      };
    }

    // Fallback search KnowledgeBase
    const kb = await this.kbService.search(dto.query, dto.language);
    if (kb.length > 0) {
      return {
        answer: kb[0].content,
        source: 'KB',
        title: kb[0].title,
      };
    }

    return {
      answer: null,
      status: 'NOT_FOUND',
      source: 'FALLBACK',
    };
  }

  async handleEscalationWorkflow(dto: EscalationWorkflowDto) {
    let patient = await this.patientsService.findByPhone(dto.phone);
    if (!patient) {
      // Auto-create basic patient profile to store the support ticket
      patient = await this.patientsService.create({
        firstName: 'WhatsApp',
        lastName: 'User',
        gender: 'OTHER',
        age: 30,
        dateOfBirth: new Date('1996-01-01').toISOString(),
        phone: dto.phone,
      });
    }

    const ticket = await this.supportService.createTicket({
      patientId: patient.patientId,
      conversationId: dto.conversationId,
      initialNote: dto.issue || 'Escalated from WhatsApp automation bot',
    });

    return {
      ticketId: ticket.ticketId,
      status: ticket.status,
      priority: ticket.priority,
      assignedAgent: ((ticket as any).assignedAgent) ? `${(ticket as any).assignedAgent.firstName} ${(ticket as any).assignedAgent.lastName}` : 'Queue Allocation',
    };
  }
}
