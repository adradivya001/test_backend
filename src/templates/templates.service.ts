import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getOptionalTenantId } from '../common/tenant/tenant.context';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  // Standard fallback templates when none exist in the database
  private fallbacks: Record<string, Record<string, string>> = {
    APPOINTMENT_CONFIRMATION: {
      en: '📋 *Appointment Confirmed*\n\nHi {{patientName}}, your appointment with {{doctorName}} on {{date}} at {{time}} is successfully booked.',
      hi: '📋 *अपॉइंटमेंट की पुष्टि*\n\nनमस्ते {{patientName}}, आपका {{doctorName}} के साथ {{date}} को {{time}} बजे का अपॉइंटमेंट बुक हो गया है।',
      te: '📋 *అపాయింట్‌మెంట్ ఖరారైంది*\n\nనమస్తే {{patientName}}, {{date}} న {{time}} గంటలకు {{doctorName}} గారితో మీ అపాయింట్‌మెంట్ విజయవంతంగా బుక్ చేయబడింది.',
    },
    APPOINTMENT_REMINDER: {
      en: '⏰ *Appointment Reminder*\n\nHi {{patientName}}, this is a reminder that you have an appointment with {{doctorName}} today at {{time}}.',
      hi: '⏰ *अपॉइंटमेंट रिमाइंडर*\n\nनमस्ते {{patientName}}, आपको याद दिलाना है कि आज {{time}} बजे {{doctorName}} के साथ आपका अपॉइंटमेंट है।',
      te: '⏰ *అపాయింట్‌మెంట్ రిమైండర్*\n\nనమస్తే {{patientName}}, ఈరోజు {{time}} గంటలకు {{doctorName}} గారితో మీ అపాయింట్‌మెంట్ ఉందని గుర్తు చేస్తున్నాము.',
    },
    REPORT_READY: {
      en: '📄 *Report Ready*\n\nHi {{patientName}}, your medical report is now ready. You can download it here: {{downloadUrl}}',
      hi: '📄 *रिपोर्ट तैयार है*\n\nनमस्ते {{patientName}}, आपकी मेडिकल रिपोर्ट तैयार है। आप इसे इस लिंक से डाउनलोड कर सकते हैं: {{downloadUrl}}',
      te: '📄 *రిపోర్ట్ సిద్ధంగా ఉంది*\n\nనమస్తే {{patientName}}, మీ వైద్య నివేదిక సిద్ధంగా ఉంది. మీరు ఇక్కడ డౌన్‌లోడ్ చేసుకోవచ్చు: {{downloadUrl}}',
    },
    OTP_VERIFICATION: {
      en: '🔑 Your OTP code is {{otp}}. Valid for 5 minutes.',
      hi: '🔑 आपका ओटीपी कोड {{otp}} है। यह 5 मिनट के लिए वैध है।',
      te: '🔑 మీ OTP కోడ్ {{otp}}. ఇది 5 నిమిషాల వరకు చెల్లుతుంది.',
    },
    FOLLOWUP_REMINDER: {
      en: '🩺 *Follow-up Due*\n\nHi {{patientName}}, you are due for a follow-up appointment for {{specialization}}. Please reply "book" to schedule.',
      hi: '🩺 *फॉलो-अप देय*\n\nनमस्ते {{patientName}}, आपका {{specialization}} के लिए फॉलो-अप अपॉइंटमेंट होने वाला है। बुक करने के लिए कृपया "book" रिप्लाई करें।',
      te: '🩺 *ఫాలో-అప్ సమయం*\n\nనమస్తే {{patientName}}, మీకు {{specialization}} కొరకు ఫాలో-అప్ అపాయింట్‌మెంట్ సమయం అయింది. బుక్ చేయడానికి దయచేసి "book" అని రిప్లై ఇవ్వండి.',
    },
    APPOINTMENT_RESCHEDULED: {
      en: '🔄 *Appointment Rescheduled*\n\nHi {{patientName}}, your appointment with {{doctorName}} has been rescheduled to {{date}} at {{time}}.',
      hi: '🔄 *अपॉइंटमेंट का समय बदल गया है*\n\nनमस्ते {{patientName}}, {{doctorName}} के साथ आपका अपॉइंटमेंट बदलकर {{date}} को {{time}} बजे हो गया है।',
      te: '🔄 *అపాయింట్‌మెంట్ రీషెడ్యూల్ చేయబడింది*\n\nనమస్తే {{patientName}}, {{doctorName}} గారితో మీ అపాయింట్‌మెంట్ {{date}} న {{time}} గంటలకు రీషెడ్యూల్ చేయబడింది.',
    },
    APPOINTMENT_CANCELLED: {
      en: '❌ *Appointment Cancelled*\n\nHi {{patientName}}, your appointment with {{doctorName}} on {{date}} at {{time}} has been cancelled.',
      hi: '❌ *अपॉइंटमेंट रद्द हो गया*\n\nनमस्ते {{patientName}}, {{doctorName}} के साथ {{date}} को {{time}} बजे का आपका अपॉइंटमेंट रद्द कर दिया गया है।',
      te: '❌ *అపాయింట్‌మెంట్ రద్దు చేయబడింది*\n\nనమస్తే {{patientName}}, {{date}} న {{time}} గంటలకు {{doctorName}} గారితో మీ అపాయింట్‌మెంట్ రద్దు చేయబడింది.',
    }
  };

  /**
   * Resolves notification template text by rendering placeholders with dynamic variables.
   * Leverages Database query (scoped to Tenant) with smart fallback to language and hardcoded configurations.
   */
  async resolveTemplate(
    hospitalId: string,
    eventType: string,
    language: string,
    variables: Record<string, string>,
  ): Promise<string | null> {
    const lang = (language || 'en').toLowerCase();

    // Dynamically route APPOINTMENT_CONFIRMATION to cancelled or rescheduled event types if appropriate
    let targetEventType = eventType;
    if (eventType === 'APPOINTMENT_CONFIRMATION') {
      const vars = variables || {};
      if (String(vars.rescheduled) === 'true') {
        targetEventType = 'APPOINTMENT_RESCHEDULED';
      } else if (vars.status === 'CANCELLED') {
        targetEventType = 'APPOINTMENT_CANCELLED';
      }
    }

    // 1. Attempt to fetch template from DB (Note: since this might be called outside API context, we pass hospitalId explicitly or query directly)
    let template = await this.prisma.notificationTemplate.findFirst({
      where: {
        hospitalId,
        eventType: targetEventType,
        language: lang,
        isActive: true,
      },
    });

    // 2. Fallback to English template if localized version is missing
    if (!template && lang !== 'en') {
      template = await this.prisma.notificationTemplate.findFirst({
        where: {
          hospitalId,
          eventType: targetEventType,
          language: 'en',
          isActive: true,
        },
      });
    }

    let rawContent = template?.content;

    // 3. Fallback to code defaults if database contains no template definitions
    if (!rawContent) {
      const typeFallbacks = this.fallbacks[targetEventType];
      if (typeFallbacks) {
        rawContent = typeFallbacks[lang] || typeFallbacks['en'];
      }
    }

    if (!rawContent) {
      return null;
    }

    // 4. Interpolate variables (e.g. {{patientName}} -> variables.patientName)
    const normalizedVars = { ...variables };
    if (normalizedVars.code && !normalizedVars.otp) {
      normalizedVars.otp = normalizedVars.code;
    }

    return rawContent.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
      return normalizedVars[key] !== undefined ? normalizedVars[key] : match;
    });
  }

  // --- CRUD Operations Scoped to Tenant via Prisma Client Extensions ---

  async create(dto: CreateTemplateDto) {
    const hospitalId = getOptionalTenantId();
    if (!hospitalId) {
      throw new Error('Tenant context required to create template');
    }

    return this.prisma.notificationTemplate.upsert({
      where: {
        hospitalId_eventType_language: {
          hospitalId,
          eventType: dto.eventType,
          language: (dto.language || 'en').toLowerCase(),
        },
      },
      update: {
        content: dto.content,
        isActive: dto.isActive ?? true,
      },
      create: {
        hospitalId,
        eventType: dto.eventType,
        language: (dto.language || 'en').toLowerCase(),
        content: dto.content,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll() {
    return this.prisma.notificationTemplate.findMany();
  }

  async findOne(id: string) {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  async remove(id: string) {
    const template = await this.findOne(id);
    return this.prisma.notificationTemplate.delete({
      where: { id: template.id },
    });
  }
}
