import { Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { CreatePrescriptionTemplateDto } from './dto/create-template.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';


@ApiTags('Prescriptions')
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new patient digital prescription' })
  async create(@Body() dto: CreatePrescriptionDto) {
    return this.prescriptionsService.create(dto);
  }

  @Post('templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a reusable prescription template for a doctor' })
  async createTemplate(@Body() dto: CreatePrescriptionTemplateDto) {
    return this.prescriptionsService.createTemplate(dto);
  }

  @Get('templates/:doctorId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get prescription templates for a doctor' })
  async getTemplates(@Param('doctorId') doctorId: string) {
    return this.prescriptionsService.getTemplates(doctorId);
  }

  @Get('patient/:patientId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR, Role.RECEPTIONIST, Role.SUPPORT_AGENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all prescriptions for a patient' })
  async findByPatient(@Param('patientId') patientId: string) {
    return this.prescriptionsService.findByPatient(patientId);
  }

  @Get('download/:id')
  @ApiOperation({ summary: 'Secure download/redirect endpoint validating JWT token query' })
  @ApiQuery({ name: 'token', required: true })
  async download(
    @Param('id') id: string,
    @Query('token') token: string,
    @Req() req: any,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const prescription = await this.prescriptionsService.verifyDownloadToken(id, token, ip);
    
    // Returns formatted digital prescription schema (simulating PDF layout payload)
    return {
      title: 'DFO DIGITAL PRESCRIPTION RECEIPT',
      date: prescription.createdAt,
      expiryDate: prescription.expiresAt,
      version: prescription.version,
      doctor: {
        name: prescription.doctor.name,
        specialization: prescription.doctor.specialization,
      },
      patient: {
        name: `${prescription.patient.firstName} ${prescription.patient.lastName}`,
        phone: prescription.patient.phone,
      },
      notes: prescription.notes,
      medications: prescription.items.map((i) => ({
        medication: i.medication,
        dosage: i.dosage,
        instructions: i.instructions,
        duration: i.duration,
        frequency: i.frequency,
        refills: i.refills,
      })),
      verified: true,
      legalDisclaimer: 'This prescription is digitally signed and valid under healthcare platform guidelines.',
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR, Role.RECEPTIONIST)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get prescription details by ID' })
  async findOne(@Param('id') id: string) {
    return this.prescriptionsService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft delete a prescription' })
  async delete(@Param('id') id: string) {
    return this.prescriptionsService.delete(id);
  }
}
