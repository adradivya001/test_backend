import { Module } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { DoctorsController } from './doctors.controller';
import { DoctorExperienceService } from './doctor-experience.service';
import { DoctorExperienceController } from './doctor-experience.controller';
import { AppointmentsModule } from '../appointments/appointments.module';
import { PatientsModule } from '../patients/patients.module';

@Module({
  imports: [AppointmentsModule, PatientsModule],
  controllers: [DoctorsController, DoctorExperienceController],
  providers: [DoctorsService, DoctorExperienceService],
  exports: [DoctorsService, DoctorExperienceService],
})
export class DoctorsModule {}
