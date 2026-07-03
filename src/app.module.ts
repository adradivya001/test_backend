import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from './common/logger/logger.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { DoctorsModule } from './doctors/doctors.module';
import { DepartmentsModule } from './departments/departments.module';
import { SchedulesModule } from './schedules/schedules.module';
import { DoctorLeavesModule } from './doctor-leaves/doctor-leaves.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ReportsModule } from './reports/reports.module';
import { FaqModule } from './faq/faq.module';
import { KnowledgeBaseModule } from './knowledge-base/knowledge-base.module';
import { SupportModule } from './support/support.module';
import { AuditModule } from './audit/audit.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { MonitoringController } from './common/monitoring/monitoring.controller';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { FileGovernanceWorker } from './common/file-governance.worker';
import { AlertingModule } from './common/monitoring/alerting.module';
import { TenantMiddleware } from './common/tenant/tenant.middleware';
import { TenantModule } from './tenant/tenant.module';
import { TemplatesModule } from './templates/templates.module';
import { OnboardingModule } from './onboarding/onboarding.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    LoggerModule,
    RedisModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    DoctorsModule,
    DepartmentsModule,
    SchedulesModule,
    DoctorLeavesModule,
    AppointmentsModule,
    ReportsModule,
    FaqModule,
    KnowledgeBaseModule,
    SupportModule,
    AuditModule,
    WorkflowsModule,
    DashboardModule,
    WhatsAppModule,
    PrescriptionsModule,
    AlertingModule,
    TenantModule,
    TemplatesModule,
    OnboardingModule,
  ],
  controllers: [MonitoringController],
  providers: [FileGovernanceWorker],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
