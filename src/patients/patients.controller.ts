import { Controller, Get, Post, Put, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, Language } from '@prisma/client';

@ApiTags('Patients')
@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Create a new patient' })
  async create(@Body() dto: CreatePatientDto) {
    return this.patientsService.create(dto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Search patients or get all' })
  @ApiQuery({ name: 'query', required: false, description: 'Search term for name or phone' })
  async find(@Query('query') query?: string) {
    if (query) {
      return this.patientsService.search(query);
    }
    return this.patientsService.search('');
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Get patient by ID' })
  async findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  @Get('phone/:phone')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Get patient by Phone number' })
  async findByPhone(@Param('phone') phone: string) {
    return this.patientsService.findByPhone(phone);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Update patient details' })
  async update(@Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(id, dto);
  }

  @Get(':id/history')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Get patient appointment and report history' })
  async getHistory(@Param('id') id: string) {
    return this.patientsService.getHistory(id);
  }

  @Get(':id/timeline')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Get patient medical history timeline' })
  async getTimeline(@Param('id') id: string) {
    return this.patientsService.getTimeline(id);
  }

  @Get(':id/consultations/timeline')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Get patient clinical consultation timeline history' })
  async getClinicalTimeline(@Param('id') id: string) {
    return this.patientsService.getClinicalConsultationTimeline(id);
  }

  @Get(':id/audit')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Get audit logs for a patient (Admin only)' })
  async getAuditTrail(@Param('id') id: string) {
    return this.patientsService.getAuditTrail(id);
  }

  @Get(':phone/preferences')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Get patient language preferences by phone' })
  async getPreferences(@Param('phone') phone: string) {
    return this.patientsService.getPreferences(phone);
  }

  @Patch(':phone/preferences')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Update patient language preferences by phone' })
  async updatePreferences(
    @Param('phone') phone: string,
    @Body() dto: UpdatePreferencesDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.patientsService.updatePreferences(phone, dto.preferredLanguage, userId);
  }
}
