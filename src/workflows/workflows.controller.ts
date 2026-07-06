import { Controller, Post, Body, OnModuleInit, Get, Patch, Param } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { getTenantId } from '../common/tenant/tenant.context';
import { AppointmentWorkflowDto } from './dto/appointment-workflow.dto';
import { DoctorAvailabilityWorkflowDto } from './dto/doctor-availability-workflow.dto';
import { ReportStatusWorkflowDto } from './dto/report-status-workflow.dto';
import { KnowledgeWorkflowDto } from './dto/knowledge-workflow.dto';
import { EscalationWorkflowDto } from './dto/escalation-workflow.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Language } from '@prisma/client';

@ApiTags('WhatsApp Workflows')
@Controller('api/workflows')
export class WorkflowsController implements OnModuleInit {
  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    try {
      // 1. Ensure Sandbox Hospital exists
      let hospital = await this.prisma.hospital.findFirst({ where: { id: 'mock_hospital_id' } });
      if (!hospital) {
        hospital = await this.prisma.hospital.create({
          data: {
            id: 'sandbox-hospital-uuid',
            name: 'Sandbox Hospital',
          }
        });
      }

      // 2. Ensure WhatsAppChannel exists for the simulator
      const channel = await this.prisma.whatsAppChannel.findUnique({ where: { phoneNumberId: 'mock_phone_number_id' } });
      if (!channel) {
        await this.prisma.whatsAppChannel.create({
          data: {
            tenantId: hospital.id,
            phoneNumberId: 'mock_phone_number_id',
            phoneNumber: '1234567890',
            accessToken: 'mock_access_token',
            verifyToken: 'dfo_verify_token_123',
          }
        });
      }

      // 3. Ensure a default Hindi template exists for E2E testing
      const apptConfirmTemplate = await this.prisma.notificationTemplate.findUnique({
        where: {
          hospitalId_eventType_language: {
            hospitalId: hospital.id,
            eventType: 'APPOINTMENT_CONFIRMATION',
            language: 'hi',
          }
        }
      });
      if (!apptConfirmTemplate) {
        await this.prisma.notificationTemplate.create({
          data: {
            hospitalId: hospital.id,
            eventType: 'APPOINTMENT_CONFIRMATION',
            language: 'hi',
            content: '🏥 *अपॉइंटमेंट पक्का हो गया!*\n\nप्रिय {{patientName}}, आपका अपॉइंटमेंट {{doctorName}} के साथ {{date}} को {{time}} बजे पक्का हो गया है।',
          }
        });
      }

      const deptCount = await this.prisma.department.count();
      if (deptCount === 0) {
        console.log('Seeding default sandbox data for tests...');
        const cardiology = await this.prisma.department.create({
          data: {
            name: 'Cardiology',
            description: 'Heart care services',
            hospitalId: hospital.id,
          },
        });

        const doctorUser = await this.prisma.user.create({
          data: {
            email: 'dr.kumar@hospital.com',
            passwordHash: 'mock-hash-123',
            firstName: 'Kumar',
            lastName: 'Dr',
            role: 'DOCTOR',
            hospitalId: hospital.id,
          },
        });

        const doctor = await this.prisma.doctor.create({
          data: {
            name: 'Dr. Kumar',
            specialization: 'Cardiologist',
            departmentId: cardiology.id,
            experience: 10,
            consultationFee: 150,
            userId: doctorUser.id,
            status: 'ACTIVE',
            hospitalId: hospital.id,
          },
        });

        // Seed schedule for all 7 days of the week
        for (let day = 0; day < 7; day++) {
          await this.prisma.doctorSchedule.create({
            data: {
              doctorId: doctor.doctorId,
              dayOfWeek: day,
              startTime: '09:00',
              endTime: '17:00',
            },
          });
        }
        console.log('Sandbox data seeded successfully!');
      } else {
        // Backfill existing records if they don't have hospitalId assigned
        await this.prisma.department.updateMany({
          where: { hospitalId: null },
          data: { hospitalId: hospital.id }
        });
        await this.prisma.doctor.updateMany({
          where: { hospitalId: null },
          data: { hospitalId: hospital.id }
        });
        await this.prisma.user.updateMany({
          where: { hospitalId: null },
          data: { hospitalId: hospital.id }
        });
        await this.prisma.patient.updateMany({
          where: { hospitalId: null },
          data: { hospitalId: hospital.id }
        });
        await this.prisma.appointment.updateMany({
          where: { hospitalId: null },
          data: { hospitalId: hospital.id }
        });

        // Ensure Dr. Kumar has schedules for all 7 days of the week
        const kumar = await this.prisma.doctor.findFirst({ where: { name: 'Dr. Kumar' } });
        if (kumar) {
          for (let day = 0; day < 7; day++) {
            const exists = await this.prisma.doctorSchedule.findFirst({
              where: { doctorId: kumar.doctorId, dayOfWeek: day }
            });
            if (!exists) {
              await this.prisma.doctorSchedule.create({
                data: {
                  doctorId: kumar.doctorId,
                  dayOfWeek: day,
                  startTime: '09:00',
                  endTime: '17:00',
                }
              });
            }
          }
        }

        // Ensure new departments and doctors are seeded
        const targetDepts = [
          { name: 'Neurology', desc: 'Brain and nervous system care', docName: 'Dr. Rao', docEmail: 'dr.rao@hospital.com', spec: 'Neurologist' },
          { name: 'Orthology', desc: 'Bone and joint care', docName: 'Dr. Reddy', docEmail: 'dr.reddy@hospital.com', spec: 'Orthopedist' },
          { name: 'General Surgeon', desc: 'Surgical services', docName: 'Dr. Verma', docEmail: 'dr.verma@hospital.com', spec: 'Surgeon' },
          { name: 'Dermatology', desc: 'Skin and hair care', docName: 'Dr. Patel', docEmail: 'dr.patel@hospital.com', spec: 'Dermatologist' },
        ];

        for (const deptData of targetDepts) {
          let dept = await this.prisma.department.findFirst({
            where: { name: deptData.name, hospitalId: hospital.id },
          });
          if (!dept) {
            dept = await this.prisma.department.create({
              data: {
                name: deptData.name,
                description: deptData.desc,
                hospitalId: hospital.id,
              },
            });
          }

          let docUser = await this.prisma.user.findFirst({
            where: { email: deptData.docEmail },
          });
          if (!docUser) {
            docUser = await this.prisma.user.create({
              data: {
                email: deptData.docEmail,
                passwordHash: 'mock-hash-123',
                firstName: deptData.docName.split(' ')[1],
                lastName: deptData.docName.split(' ')[0],
                role: 'DOCTOR',
                hospitalId: hospital.id,
              },
            });
          }

          let doc = await this.prisma.doctor.findFirst({
            where: { name: deptData.docName, hospitalId: hospital.id },
          });
          if (!doc) {
            doc = await this.prisma.doctor.create({
              data: {
                name: deptData.docName,
                specialization: deptData.spec,
                departmentId: dept.id,
                experience: 8,
                consultationFee: 120,
                userId: docUser.id,
                status: 'ACTIVE',
                hospitalId: hospital.id,
              },
            });
          }

          // Ensure doctor has schedules for all 7 days
          for (let day = 0; day < 7; day++) {
            const schedExists = await this.prisma.doctorSchedule.findFirst({
              where: { doctorId: doc.doctorId, dayOfWeek: day },
            });
            if (!schedExists) {
              await this.prisma.doctorSchedule.create({
                data: {
                  doctorId: doc.doctorId,
                  dayOfWeek: day,
                  startTime: '09:00',
                  endTime: '17:00',
                },
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('Auto-seeding skipped or failed:', err.message);
    }
  }

  @Post('appointment')
  @ApiOperation({ summary: 'Appointments scheduling workflow step runner' })
  async runAppointmentWorkflow(@Body() dto: AppointmentWorkflowDto) {
    const inputStep = dto.step || 'START';
    const collectedData = dto.collectedData || {};
    const userInput = (dto.payloadText || dto.messageText || '').trim();

    // Initialize sessionData
    const sessionData: any = {};

    // 1. Check if patient is registered
    let patient = await this.prisma.patient.findFirst({ where: { phone: dto.phone } });
    if (!patient) {
      const parts = userInput.split(/\s+/);
      if (parts.length >= 5) {
        const [firstName, lastName, gender, age, dobStr] = parts;
        let finalGender = 'OTHER';
        const normalizedGender = gender.toLowerCase().trim();
        const maleTerms = ['male', 'm', 'पुरुष', 'पुరుషుడు', 'పురుష', 'purush', 'purushudu', 'పు', 'पु', 'p'];
        const femaleTerms = ['female', 'f', 'महिला', 'स्त्री', 'మహిళ', 'mahila', 'sthree', 'మ', 'म'];

        if (maleTerms.includes(normalizedGender)) {
          finalGender = 'MALE';
        } else if (femaleTerms.includes(normalizedGender)) {
          finalGender = 'FEMALE';
        }

        try {
          const preferredLanguage = (dto.language || 'en').toUpperCase();
          const finalLang = ['EN', 'HI', 'TE'].includes(preferredLanguage) ? preferredLanguage : 'EN';

          patient = await this.prisma.patient.create({
            data: {
              hospitalId: getTenantId(),
              firstName,
              lastName,
              gender: finalGender as any,
              age: parseInt(age),
              dateOfBirth: new Date(dobStr),
              phone: dto.phone,
              preferredLanguage: finalLang as any,
            }
          });
          // Patient successfully created! Let's proceed to department selection
          sessionData.step = 'department_selection';
        } catch (err) {
          console.error('Patient creation failed with error:', err);
          return {
            nextStep: 'START',
            collectedData: {},
            status: 'pending',
            data: {
        status: 'registration_required',
              message: '❌ Invalid format. Please enter details exactly as:\n*FirstName LastName Gender Age YYYY-MM-DD*\n\n(e.g., John Doe Male 30 1996-01-01)',
            }
          };
        }
      } else {
        // Return registration instructions to the simulator
        return {
          nextStep: 'START',
          collectedData: {},
          status: 'pending',
          data: {
        status: 'registration_required',
            message: '📋 *Patient Registration Required*\n\nYou are not registered in our system. Please reply with your details in this format to register:\n\n*FirstName LastName Gender Age YYYY-MM-DD*\n(e.g. John Doe Male 30 1996-01-01)',
          }
        };
      }
    }

    // 2. Map step and state from the simulator to the backend
    if (inputStep === 'START') {
      sessionData.step = 'department_selection';
      if (collectedData.patientId) {
        sessionData.patientId = collectedData.patientId;
      }
      if (collectedData.departmentId) {
        sessionData.departmentId = collectedData.departmentId;
        sessionData.step = 'doctor_selection';
      }
      if (collectedData.doctorId || collectedData.doctor) {
        sessionData.doctorId = collectedData.doctorId || collectedData.doctor;
        sessionData.step = 'date_selection';
      }
      if (collectedData.date) {
        sessionData.date = collectedData.date;
        sessionData.step = 'slot_selection';
      }
    } else if (inputStep === 'SELECT_PROFILE') {
      sessionData.patientId = userInput;
      sessionData.step = 'department_selection';
    } else if (inputStep === 'SELECT_DOCTOR') {
      // The simulator sends the selected department ID or doctor ID in userInput
      const isDepartment = await this.prisma.department.findFirst({
        where: { id: userInput },
      });

      if (isDepartment) {
        // User selected a department, now show doctors in that department
        sessionData.step = 'doctor_selection';
        sessionData.departmentId = userInput;
      } else {
        // User selected a doctor directly
        sessionData.step = 'date_selection';
        sessionData.doctorId = userInput;
        sessionData.departmentId = collectedData.departmentId || 'default-dept';
      }
    } else if (inputStep === 'SELECT_DATE') {
      const isValidDate = (dStr: string) => /^\d{4}-\d{2}-\d{2}$/.test(dStr) && !isNaN(Date.parse(dStr));
      
      sessionData.step = 'slot_selection';
      sessionData.doctorId = collectedData.doctorId || collectedData.doctor;
      sessionData.departmentId = collectedData.departmentId;
      
      if (isValidDate(userInput)) {
        sessionData.date = userInput; // Selected date
      } else {
        // If the date is invalid (like clicking the header), drop back to date selection step
        sessionData.step = 'date_selection';
      }
    } else if (inputStep === 'SELECT_SLOT') {
      sessionData.step = 'booking_confirmed';
      sessionData.doctorId = collectedData.doctorId || collectedData.doctor;
      sessionData.departmentId = collectedData.departmentId;
      sessionData.date = collectedData.date;
      sessionData.slot = userInput; // Selected slot
    }

    // Call real workflowsService
    const result = await this.workflowsService.handleAppointmentWorkflow({
      phone: dto.phone,
      sessionData,
    });

    // 3. Map the backend response back to the simulator's format
    let nextStep: string | null = null;
    let status: 'success' | 'pending' | 'failed' = 'pending';
    let data: any = {};

    if (result.step === 'profile_selection') {
      nextStep = 'SELECT_PROFILE';
      data = {
        status: 'select_doctor',
        doctors: result.profiles?.map(p => `${p.name} (${p.id})`) || [],
        message: 'Multiple profiles found under this number. Please select the patient profile:',
      };
    } else if (result.step === 'department_selection') {
      nextStep = 'SELECT_DOCTOR';
      // Map departments to doctors list format for the simulator
      data = {
        status: 'select_doctor',
        doctors: result.departments?.map(d => `${d.name} (${d.id})`) || [],
      };
    } else if (result.step === 'doctor_selection') {
      nextStep = 'SELECT_DOCTOR';
      data = {
        status: 'select_doctor',
        doctors: result.doctors?.map(d => `${d.name} (${d.id})`) || [],
      };
    } else if (result.step === 'date_selection') {
      nextStep = 'SELECT_DATE';
      data = {
        status: 'select_date',
        doctor: sessionData.doctorId,
        dates: result.dates || [],
      };
    } else if (result.step === 'slot_selection') {
      nextStep = 'SELECT_SLOT';
      data = {
        status: 'select_slot',
        doctor: sessionData.doctorId,
        date: sessionData.date,
        slots: result.slots || [],
      };
    } else if (result.step === 'booking_confirmed') {
      nextStep = null;
      status = 'success';
      data = {
        status: 'confirmed',
        appointmentId: result.appointment?.appointmentId,
        doctor: result.appointment?.doctorName,
        date: result.appointment?.date,
        time: result.appointment?.time,
      };
    } else if (result.step === 'slot_conflict') {
      // Slot was taken by another patient — show fresh available slots
      nextStep = 'SELECT_SLOT';
      status = 'pending';
      data = {
        status: 'slot_conflict',
        message: result.message || 'The selected slot is no longer available. Please choose another slot.',
        doctor: sessionData.doctorId,
        date: sessionData.date,
        slots: result.slots || [],
      };
    } else if (result.step === 'booking_failed') {
      nextStep = null;
      status = 'failed';
    }

    // Maintain collectedData session
    const updatedCollectedData = {
      ...collectedData,
      patientId: sessionData.patientId || collectedData.patientId,
      departmentId: sessionData.departmentId || collectedData.departmentId,
      doctorId: sessionData.doctorId || collectedData.doctorId || collectedData.doctor,
      doctor: sessionData.doctorId || collectedData.doctorId || collectedData.doctor,
      date: sessionData.date || collectedData.date,
      slot: sessionData.slot || collectedData.slot,
    };

    // If slot conflict occurred, clear the slot so user can re-select
    if (result.step === 'slot_conflict') {
      delete updatedCollectedData.slot;
    }

    return {
      nextStep,
      collectedData: updatedCollectedData,
      status,
      data,
    };
  }

  @Post('doctor-availability')
  @ApiOperation({ summary: 'Calculate doctor available slots workflow' })
  async runDoctorAvailabilityWorkflow(@Body() dto: DoctorAvailabilityWorkflowDto) {
    return this.workflowsService.handleDoctorAvailabilityWorkflow(dto);
  }

  @Post('report-status')
  @ApiOperation({ summary: 'Check latest report status workflow' })
  async runReportStatusWorkflow(@Body() dto: ReportStatusWorkflowDto) {
    const patient = await this.prisma.patient.findFirst({ where: { phone: dto.phone } });
    if (patient) {
      const reportCount = await this.prisma.report.count({ where: { patientId: patient.patientId } });
      if (reportCount === 0) {
        const uploader = await this.prisma.user.findFirst();
        if (uploader) {
          await this.prisma.report.create({
            data: {
              patientId: patient.patientId,
              reportType: 'BLOOD_TEST',
              reportStatus: 'READY',
              reportUrl: 'http://127.0.0.1:3000/mock_report.pdf',
              uploadedBy: uploader.id,
              hospitalId: patient.hospitalId,
            }
          });
        }
      }
    }
    return this.workflowsService.handleReportStatusWorkflow(dto);
  }

  @Post('knowledge')
  @ApiOperation({ summary: 'Search KB / FAQ answer match workflow' })
  async runKnowledgeWorkflow(@Body() dto: KnowledgeWorkflowDto) {
    return this.workflowsService.handleKnowledgeWorkflow(dto);
  }

  @Post('escalation')
  @ApiOperation({ summary: 'Create support ticket / human escalation workflow' })
  async runEscalationWorkflow(@Body() dto: EscalationWorkflowDto) {
    return this.workflowsService.handleEscalationWorkflow(dto);
  }

  @Get('preferences/:phone')
  @ApiOperation({ summary: 'Get patient language preferences' })
  async getPreferences(@Param('phone') phone: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { phone }
    });
    if (!patient) {
      return { preferredLanguage: null };
    }
    return { preferredLanguage: patient.preferredLanguage.toLowerCase() };
  }

  @Patch('preferences/:phone')
  @ApiOperation({ summary: 'Update patient language preferences' })
  async updatePreferences(@Param('phone') phone: string, @Body() body: { preferredLanguage: string }) {
    const patient = await this.prisma.patient.findFirst({
      where: { phone }
    });
    if (!patient) {
      return { success: false, error: 'Patient not found' };
    }
    const lang = (body.preferredLanguage || '').toUpperCase();
    if (lang === 'EN' || lang === 'HI' || lang === 'TE') {
      await this.prisma.patient.update({
        where: { patientId: patient.patientId },
        data: {
          preferredLanguage: lang as Language }
      });
      return { success: true };
    }
    return { success: false, error: 'Invalid language preference' };
  }

  @Get('tickets')
  @ApiOperation({ summary: 'Get all support tickets (Bypass Auth)' })
  async getEscalationTickets() {
    return this.prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        patient: true,
      },
    });
  }

  @Get('chat-log/:phone')
  @ApiOperation({ summary: 'Get chat logs (Bypass Auth)' })
  async getChatLogs(@Param('phone') phone: string) {
    return this.prisma.chatMessage.findMany({
      where: { phone },
      orderBy: { timestamp: 'asc' },
    });
  }

  @Post('chat-log')
  @ApiOperation({ summary: 'Create chat log (Bypass Auth)' })
  async createChatLog(@Body() body: { phone: string; sender: string; message: string }) {
    const log = await this.prisma.chatMessage.create({
      data: {
        phone: body.phone,
        sender: body.sender,
        message: body.message,
      },
    });
    return { success: true, log };
  }

  @Post('tickets/:ticketId/resolve')
  @ApiOperation({ summary: 'Resolve support ticket (Bypass Auth)' })
  async resolveTicket(@Param('ticketId') ticketId: string) {
    await this.prisma.supportTicket.update({
      where: { ticketId },
      data: { status: 'RESOLVED' },
    });
    return { success: true };
  }
}
