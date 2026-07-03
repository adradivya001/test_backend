import { Module } from '@nestjs/common';
import { DoctorLeavesService } from './doctor-leaves.service';
import { DoctorLeavesController } from './doctor-leaves.controller';
import { AppointmentsModule } from '../appointments/appointments.module';

@Module({
  imports: [AppointmentsModule],
  controllers: [DoctorLeavesController],
  providers: [DoctorLeavesService],
  exports: [DoctorLeavesService],
})
export class DoctorLeavesModule {}
