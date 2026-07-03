import { Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { NotificationsController } from './notifications.controller';
import { WorkflowsModule } from '../workflows/workflows.module';
import { ReportsModule } from '../reports/reports.module';
import { NotificationQueueWorker } from './notification-queue.worker';
import { AppointmentReminderWorker } from './appointment-reminder.worker';
import { FollowupAutomationWorker } from './followup-automation.worker';
import { PatientsModule } from '../patients/patients.module';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [WorkflowsModule, ReportsModule, PatientsModule, TemplatesModule],
  controllers: [WhatsAppController, NotificationsController],
  providers: [WhatsAppService, NotificationQueueWorker, AppointmentReminderWorker, FollowupAutomationWorker],
})
export class WhatsAppModule {}
