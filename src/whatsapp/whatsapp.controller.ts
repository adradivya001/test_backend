import { Controller, Get, Post, Query, Body, Req, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { RedisService } from '../common/redis/redis.service';
import { ReportsService } from '../reports/reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { PatientsService } from '../patients/patients.service';
import * as crypto from 'crypto';

@Controller('whatsapp')
export class WhatsAppController {
  private readonly verifyToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly whatsappService: WhatsAppService,
    private readonly workflowsService: WorkflowsService,
    private readonly redisService: RedisService,
    private readonly reportsService: ReportsService,
    private readonly prisma: PrismaService,
    private readonly patientsService: PatientsService,
  ) {
    this.verifyToken = this.configService.get<string>('WHATSAPP_VERIFY_TOKEN') || '';
  }

  // 1. Meta Webhook Verification Handshake (GET)
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') token: string,
  ) {
    if (mode === 'subscribe' && token === this.verifyToken) {
      return challenge;
    }
    throw new ForbiddenException('Verification token mismatch');
  }

  // 2. Incoming Messages Webhook Processor (POST)
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: any, @Req() req: any) {
    const signature = req.headers['x-hub-signature-256'] as string;
    if (signature) {
      const appSecret = this.configService.get<string>('WHATSAPP_APP_SECRET') || '';
      if (appSecret) {
        const rawBody = JSON.stringify(payload);
        const hmac = crypto.createHmac('sha256', appSecret);
        const digest = 'sha256=' + hmac.update(rawBody).digest('hex');
        const signatureBuffer = Buffer.from(signature);
        const digestBuffer = Buffer.from(digest);
        const isMatch = signatureBuffer.length === digestBuffer.length && 
                        crypto.timingSafeEqual(signatureBuffer, digestBuffer);
        if (!isMatch) {
          throw new ForbiddenException('Invalid webhook signature');
        }
      }
    }

    // A. Check for delivery status updates (sent, delivered, read, failed)
    const statusObj = payload.entry?.[0]?.changes?.[0]?.value?.statuses?.[0];
    if (statusObj) {
      const messageId = statusObj.id;
      const metaStatus = statusObj.status; // 'sent' | 'delivered' | 'read' | 'failed'
      
      const statusMapping: Record<string, string> = {
        sent: 'SENT',
        delivered: 'DELIVERED',
        read: 'READ',
        failed: 'FAILED',
      };
      
      const targetStatus = statusMapping[metaStatus];
      if (targetStatus) {
        const updateData: any = { deliveryStatus: targetStatus };
        if (metaStatus === 'delivered') {
          updateData.deliveredAt = new Date();
        } else if (metaStatus === 'read') {
          updateData.readAt = new Date();
        } else if (metaStatus === 'failed') {
          updateData.failureReason = statusObj.errors?.[0]?.message || 'Meta API delivery failed';
        }

        await this.prisma.notificationLog.updateMany({
          where: { whatsappMessageId: messageId },
          data: updateData,
        });
      }
      return { status: 'processed_status' };
    }

    // B. Check for standard user messages
    const messageObj = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!messageObj) {
      return { status: 'ignored' };
    }
    const phone = messageObj.from;
    
    // Accept text inputs or button clicks
    const userInput = messageObj.text?.body || messageObj.interactive?.button_reply?.id;
    if (!userInput) {
      return { status: 'unsupported_content_type' };
    }

    // Log incoming user message
    try {
      await this.prisma.chatMessage.create({
        data: {
        phone,
          sender: 'USER',
          message: userInput,
        },
      });
    } catch (err) {
      console.error('Failed to log incoming message to DB:', err.message);
    }

    // Load active conversation state with Redis-down database fallback
    const sessionKey = `whatsapp_session:${phone}`;
    let sessionData: any = {};
    let usingRedis = true;

    try {
      const cachedSession = await this.redisService.get(sessionKey);
      sessionData = cachedSession ? JSON.parse(cachedSession) : {};
    } catch (redisErr) {
      console.warn('Redis failed, falling back to database conversation state mapping:', redisErr.message);
      usingRedis = false;
      const dbMapping = await this.prisma.conversationMapping.findFirst({ where: { phone },
      });
      sessionData = dbMapping ? JSON.parse(dbMapping.sessionData) : {};
    }

    // Process state transitions and get reply
    const updatedSession = await this.processConversation(phone, userInput, sessionData);

    // Save state back with fallback
    if (usingRedis) {
      try {
        await this.redisService.set(sessionKey, JSON.stringify(updatedSession), 3600);
      } catch (redisErr) {
        console.error('Failed to save to Redis, saving to DB fallback:', redisErr.message);
        await this.prisma.conversationMapping.upsert({
          where: { phone },
          update: { sessionData: JSON.stringify(updatedSession) },
          create: {  phone, sessionData: JSON.stringify(updatedSession) },
        });
      }
    } else {
      await this.prisma.conversationMapping.upsert({
        where: { phone },
        update: { sessionData: JSON.stringify(updatedSession) },
        create: {  phone, sessionData: JSON.stringify(updatedSession) },
      });
    }

    return { status: 'processed' };
  }

  private async sendMessageAndLog(phone: string, text: string): Promise<string> {
    const messageId = await this.whatsappService.sendMessage(phone, text);
    try {
      await this.prisma.chatMessage.create({
        data: {
        phone,
          sender: 'BOT',
          message: text,
        },
      });
    } catch (dbErr) {
      console.error('Failed to log outgoing message to DB:', dbErr.message);
    }
    return messageId;
  }

  private async sendInteractiveButtonsAndLog(
    phone: string,
    text: string,
    buttons: { id: string; title: string }[]
  ): Promise<string> {
    const messageId = await this.whatsappService.sendInteractiveButtons(phone, text, buttons);
    try {
      const serializedMessage = `${text} [Options: ${buttons.map(b => `${b.title} (${b.id})`).join(', ')}]`;
      await this.prisma.chatMessage.create({
        data: {
        phone,
          sender: 'BOT',
          message: serializedMessage,
        },
      });
    } catch (dbErr) {
      console.error('Failed to log outgoing buttons to DB:', dbErr.message);
    }
    return messageId;
  }

  private async processConversation(phone: string, input: string, session: any): Promise<any> {
    const rawInput = input.trim();
    const lowerInput = rawInput.toLowerCase();

    // Support resetting workflow
    if (lowerInput === 'restart' || lowerInput === 'reset') {
      session = {};
    }

    // ==========================================
    // 1. INTENT ROUTING
    // ==========================================

    // A. Check if user wants report status
    if (lowerInput.includes('report') || lowerInput.includes('result') || lowerInput.includes('lab') || lowerInput.includes('blood test') || lowerInput.includes('xray')) {
      const result: any = await this.workflowsService.handleReportStatusWorkflow({ phone });
      if (result.status === 'READY' && result.reportId) {
        const secureDownloadPath = await this.reportsService.generateSecureUrl(result.reportId);
        const hostUrl = this.configService.get<string>('APP_HOST_URL', 'http://localhost:3000');
        const downloadUrl = `${hostUrl}${secureDownloadPath}`;
        
        await this.sendMessageAndLog(
          phone,
          `📄 Your latest ${result.reportType} report is ready!\n\nClick the link below to download it securely. Note: For security, this link expires in 15 minutes:\n${downloadUrl}`
        );
      } else if (result.status === 'PENDING' || result.status === 'PROCESSING') {
        await this.sendMessageAndLog(
          phone,
          `⏳ Your ${result.reportType} report is currently: ${result.status}.\nℹ️ ETA: ${result.eta}`
        );
      } else {
        await this.sendMessageAndLog(phone, `❌ ${result.message || 'Report not found or unavailable'}`);
      }
      return session; // keep active session state unchanged
    }

    // A2. Check if user wants medical history timeline
    if (
      lowerInput.includes('history') ||
      lowerInput.includes('previous visit') ||
      lowerInput.includes('past visit') ||
      lowerInput.includes('medical record') ||
      lowerInput.includes('my record')
    ) {
      const patient = await this.patientsService.findByPhone(phone);
      if (!patient) {
        await this.sendMessageAndLog(
          phone,
          `❌ You are not registered as a patient in our system. Please complete the registration or appointment booking flow to register.`
        );
        return session;
      }

      const timeline = await this.patientsService.getTimeline(patient.patientId);
      if (timeline.length === 0) {
        await this.sendMessageAndLog(
          phone,
          `📭 No appointments or reports were found in your medical history.`
        );
        return session;
      }

      // Limit to 5 most recent events to prevent hitting WhatsApp message size limits
      const recentEvents = timeline.slice(0, 5);
      let message = `📋 *Your Medical History (Recent Activities)* 📋\n\n`;

      recentEvents.forEach((event, index) => {
        const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });

        if (event.type === 'APPOINTMENT') {
          const details = event.details as any;
          message += `${index + 1}. 📅 *APPOINTMENT*\n`;
          message += `   • *Doctor:* ${event.title.replace('Appointment with ', '')}\n`;
          message += `   • *Department:* ${event.subtitle}\n`;
          message += `   • *Date:* ${formattedDate} (${details.slotTime})\n`;
          message += `   • *Status:* ${event.status}\n\n`;
        } else if (event.type === 'REPORT') {
          const details = event.details as any;
          message += `${index + 1}. 📄 *REPORT*\n`;
          message += `   • *Type:* ${event.title.replace(' Report', '')}\n`;
          message += `   • *Date:* ${formattedDate}\n`;
          message += `   • *Status:* ${event.status}\n`;
          if (details.reportUrl) {
            message += `   • *URL:* ${details.reportUrl}\n`;
          }
          message += `\n`;
        }
      });

      if (timeline.length > 5) {
        message += `ℹ️ *Note:* Showing the 5 most recent events.`;
      }

      await this.sendMessageAndLog(phone, message.trim());
      return session;
    }

    // B. Check if user is asking general questions (FAQ/Knowledge Base)
    if (lowerInput.includes('timing') || lowerInput.includes('location') || lowerInput.includes('address') || lowerInput.includes('policy') || lowerInput.includes('working hours') || lowerInput.includes('fee')) {
      const result: any = await this.workflowsService.handleKnowledgeWorkflow({ query: rawInput });
      await this.sendMessageAndLog(phone, result.answer || '');
      return session;
    }

    // C. Check if user wants human support escalation
    if (lowerInput.includes('agent') || lowerInput.includes('support') || lowerInput.includes('human') || lowerInput.includes('help') || lowerInput.includes('complain')) {
      const result = await this.workflowsService.handleEscalationWorkflow({
        phone,
        conversationId: session.conversationId || `whatsapp-${Date.now()}`,
        issue: rawInput
      });
      await this.sendMessageAndLog(
        phone,
        `📞 Human Support Requested.\n\nA ticket (${result.ticketId}) has been created.\n📌 Status: ${result.status}\n👤 Assigned Agent: ${result.assignedAgent}`
      );
      return session;
    }

    // ==========================================
    // 2. APPOINTMENT BOOKING WORKFLOW (DEFAULT)
    // ==========================================

    // Map input to the current expected step variables
    if (session.step === 'patient_registration_required') {
      const parts = rawInput.split(' ');
      if (parts.length >= 5) {
        session.firstName = parts[0];
        session.lastName = parts[1];
        session.gender = parts[2];
        session.age = parts[3];
        session.dateOfBirth = parts[4];
      }
    } else if (session.step === 'department_selection') {
      session.departmentId = rawInput;
    } else if (session.step === 'doctor_selection') {
      session.doctorId = rawInput;
    } else if (session.step === 'date_selection') {
      session.date = rawInput;
    } else if (session.step === 'slot_selection') {
      session.slot = rawInput;
    }

    // Invoke the core WorkflowsService
    const result: any = await this.workflowsService.handleAppointmentWorkflow({
      phone,
      sessionData: session,
    });

    // Advance current step
    session.step = result.step;

    // Send corresponding message formats depending on active step
    if (result.step === 'patient_registration_required') {
      await this.sendMessageAndLog(phone, result.message);
    } else if (result.step === 'department_selection' && result.departments) {
      const buttons = result.departments.map((d: any) => ({ id: d.id, title: d.name.substring(0, 20) }));
      await this.sendInteractiveButtonsAndLog(phone, 'Select a Department:', buttons);
    } else if (result.step === 'doctor_selection' && result.doctors) {
      const buttons = result.doctors.map((d: any) => ({ id: d.id, title: d.name.substring(0, 20) }));
      await this.sendInteractiveButtonsAndLog(phone, 'Select a Doctor:', buttons);
    } else if (result.step === 'date_selection' && result.dates) {
      const buttons = result.dates.map((d: any) => ({ id: d, title: d }));
      await this.sendInteractiveButtonsAndLog(phone, 'Select a Date:', buttons);
    } else if (result.step === 'slot_selection' && result.slots) {
      const buttons = result.slots.map((s: any) => ({ id: s, title: s }));
      await this.sendInteractiveButtonsAndLog(phone, 'Select an Available Slot:', buttons);
    } else if (result.step === 'booking_confirmed') {
      const app = result.appointment;
      if (app) {
        const text = `✅ Appointment Confirmed!\n\n📅 Date: ${app.date}\n⏰ Time: ${app.time}\n👨‍⚕️ Doctor: ${app.doctorName}\n🏥 Dept: ${app.departmentName}\n💵 Fee: $${app.consultationFee}`;
        await this.sendMessageAndLog(phone, text);
      }
      session = {}; // reset session
    } else if (result.step === 'booking_failed') {
      await this.sendMessageAndLog(phone, `❌ Booking failed: ${result.message}. Please send "restart" to try again.`);
      session = {};
    }

    return session;
  }
}
