import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { DoctorExperienceService } from './doctor-experience.service';
import { SaveConsultationDto } from './dto/save-consultation.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { IsBoolean, IsString } from 'class-validator';

class UpdatePreferencesDto {
  @IsBoolean()
  receiveNotifications: boolean;

  @IsString()
  preferredLanguage: string;
}

@ApiTags('Doctor Experience')
@Controller('doctor-experience')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DoctorExperienceController {
  constructor(private readonly experienceService: DoctorExperienceService) {}

  @Get(':doctorId/today')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: "Get doctor's schedule for today" })
  async getTodaySchedule(@Param('doctorId') doctorId: string) {
    return this.experienceService.getTodaySchedule(doctorId);
  }

  @Get(':doctorId/upcoming')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: "Get doctor's upcoming appointments" })
  async getUpcomingAppointments(@Param('doctorId') doctorId: string) {
    return this.experienceService.getUpcomingAppointments(doctorId);
  }

  @Get(':doctorId/queue/patient')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'Get doctor patient queue (checked-in patients waiting)' })
  async getPatientQueue(@Param('doctorId') doctorId: string) {
    return this.experienceService.getPatientQueue(doctorId);
  }

  @Get(':doctorId/queue/consultation')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'Get doctor consultation queue (active consultations in-progress)' })
  async getConsultationQueue(@Param('doctorId') doctorId: string) {
    return this.experienceService.getConsultationQueue(doctorId);
  }

  @Get('patients/search')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'Search patient database' })
  @ApiQuery({ name: 'query', required: true })
  async searchPatients(@Query('query') query: string) {
    return this.experienceService.searchPatients(query);
  }

  @Get('patients/:patientId/history')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'View patient medical timeline history' })
  async getPatientHistory(@Param('patientId') patientId: string) {
    return this.experienceService.getPatientHistory(patientId);
  }

  @Get('patients/:patientId/reports')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'View patient test reports before/during consultation' })
  async getPatientReports(@Param('patientId') patientId: string) {
    return this.experienceService.getPatientReports(patientId);
  }

  @Get(':doctorId/preferences')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: "Get doctor's notification preferences" })
  async getPreferences(@Param('doctorId') doctorId: string) {
    return this.experienceService.getPreferences(doctorId);
  }

  @Put(':doctorId/preferences')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: "Update doctor's notification preferences" })
  async updatePreferences(
    @Param('doctorId') doctorId: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.experienceService.updatePreferences(doctorId, dto.receiveNotifications, dto.preferredLanguage);
  }

  @Get(':doctorId/notifications')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: "Get doctor's notifications log" })
  async getNotifications(@Param('doctorId') doctorId: string) {
    return this.experienceService.getNotifications(doctorId);
  }

  @Put('notifications/:id/read')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'Mark doctor notification as read' })
  async markNotificationRead(@Param('id') id: string) {
    return this.experienceService.markNotificationRead(id);
  }

  @Put('appointments/:id/start-consultation')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'Mark consultation as started' })
  async startConsultation(@Param('id') id: string) {
    return this.experienceService.startConsultation(id);
  }

  @Put('appointments/:id/update-consultation')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'Save/update consultation details in-progress' })
  async updateConsultation(
    @Param('id') id: string,
    @Body() dto: SaveConsultationDto,
  ) {
    return this.experienceService.updateConsultation(id, dto);
  }

  @Post('appointments/:id/consultation')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'Save consultation details and finalize (complete) appointment' })
  async saveConsultation(
    @Param('id') id: string,
    @Body() dto: SaveConsultationDto,
  ) {
    return this.experienceService.saveConsultation(id, dto);
  }
}
