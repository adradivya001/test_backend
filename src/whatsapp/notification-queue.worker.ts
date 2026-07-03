import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { AlertingService } from '../common/monitoring/alerting.service';
import { TemplatesService } from '../templates/templates.service';

@Injectable()
export class NotificationQueueWorker implements OnModuleInit, OnModuleDestroy {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsAppService,
    private readonly alerting: AlertingService,
    private readonly templatesService: TemplatesService,
  ) {}

  onModuleInit() {
    // Run every 10 seconds to check for new outgoing notifications
    this.intervalId = setInterval(() => this.processQueue(), 10000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const currentHour = new Date().getHours();
      const isQuietHours = currentHour >= 21 || currentHour < 8;

      // Fetch up to 10 logs that are PENDING or RETRYING
      const pendingLogs = await this.prisma.notificationLog.findMany({
        where: {
          deliveryStatus: { in: ['PENDING', 'RETRYING'] },
          retryCount: { lt: 3 },
          // During quiet hours, only send OTPs
          type: isQuietHours ? 'OTP_VERIFICATION' : undefined,
        },
        take: 10,
        orderBy: { createdAt: 'asc' },
      });

      for (const log of pendingLogs) {
        try {
          const payload = JSON.parse(log.payload);
          const phone = payload.phone;
          
          if (!phone) {
            await this.prisma.notificationLog.update({
              where: { id: log.id },
              data: {
        deliveryStatus: 'FAILED',
                failureReason: 'Missing phone number in payload',
              },
            });
            continue;
          }

          // Duplicate notification prevention: check if identical message was sent in last 5 minutes
          const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
          const duplicate = await this.prisma.notificationLog.findFirst({
            where: {
              patientId: log.patientId,
              type: log.type,
              payload: log.payload,
              deliveryStatus: 'SENT',
              createdAt: { gte: fiveMinsAgo },
            },
          });

          if (duplicate) {
            await this.prisma.notificationLog.update({
              where: { id: log.id },
              data: {
        deliveryStatus: 'FAILED',
                failureReason: 'Duplicate notification suppressed',
              },
            });
            continue;
          }

          let language = payload.language || 'en';
          if (log.patientId && !payload.language) {
            const patient = await this.prisma.patient.findUnique({
              where: { patientId: log.patientId },
            });
            if (patient?.preferredLanguage) {
              language = patient.preferredLanguage.toLowerCase();
            }
          }

          // 1. Try to resolve via templating engine first
          let messageText = await this.templatesService.resolveTemplate(
            log.hospitalId || '',
            log.type,
            language,
            payload,
          );

          // 2. If no template is matched in the DB or fallbacks, use the hardcoded payload.message (if present)
          if (!messageText) {
            messageText = payload.message;
          }

          // 3. Ultimate fallback
          if (!messageText) {
            messageText = `Notification: ${log.type} (Variables: ${JSON.stringify(payload)})`;
          }

          if (messageText) {
            const msgId = await this.whatsappService.sendMessage(phone, messageText, log.hospitalId || undefined);
            
            // Mark database log as SENT
            await this.prisma.notificationLog.update({
              where: { id: log.id },
              data: {
        deliveryStatus: 'SENT',
                whatsappMessageId: msgId || null,
              },
            });
          } else {
            await this.prisma.notificationLog.update({
              where: { id: log.id },
              data: {
        deliveryStatus: 'FAILED',
                failureReason: 'Empty message template text',
              },
            });
          }
        } catch (err) {
          console.error(`Error processing notification log ${log.id}:`, err.message);
          const nextRetry = log.retryCount + 1;
          const reachedLimit = nextRetry >= 3;
          
          await this.prisma.notificationLog.update({
            where: { id: log.id },
            data: {
        retryCount: nextRetry,
              deliveryStatus: reachedLimit ? 'RETRY_LIMIT_REACHED' : 'RETRYING',
              failureReason: err.message || 'API error',
              lastRetryAt: new Date(),
            },
          });

          if (reachedLimit) {
            this.alerting.triggerAlert(
              'Notification Queue Worker',
              `Notification delivery failed 3 times. Log ID: ${log.id}. Reason: ${err.message || 'Unknown error'}`,
              'HIGH'
            );

            await this.prisma.notificationLog.update({
              where: { id: log.id },
              data: {
        deliveryStatus: 'ESCALATED',
              },
            });

            try {
              if (log.patientId) {
                // Find first user with administrative/agent role to author note
                const adminUser = await this.prisma.user.findFirst({
                  where: { role: { in: ['SUPER_ADMIN', 'HOSPITAL_ADMIN'] } },
                });
                
                await this.prisma.supportTicket.create({
                  data: {
                                        patientId: log.patientId,
                    conversationId: `notification-failure-${log.id}`,
                    priority: 'HIGH',
                    status: 'OPEN',
                    notes: {
                      create: {
                        noteText: `Automated Escalation: Notification delivery failed 3 times. Log ID: ${log.id}. Reason: ${err.message || 'Unknown error'}. Type: ${log.type}`,
                        authorId: adminUser?.id || '',
                      },
                    },
                  },
                });
              }
            } catch (ticketErr) {
              console.error('Failed to create support ticket for notification failure:', ticketErr.message);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching notification queue:', error.message);
    } finally {
      this.isProcessing = false;
    }
  }
}
