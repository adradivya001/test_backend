import { Module } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { WorkflowsController } from './workflows.controller';
import { PatientsModule } from '../patients/patients.module';
import { DepartmentsModule } from '../departments/departments.module';
import { DoctorsModule } from '../doctors/doctors.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { FaqModule } from '../faq/faq.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { SupportModule } from '../support/support.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [
    PatientsModule,
    DepartmentsModule,
    DoctorsModule,
    AppointmentsModule,
    FaqModule,
    KnowledgeBaseModule,
    SupportModule,
    ReportsModule,
  ],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
