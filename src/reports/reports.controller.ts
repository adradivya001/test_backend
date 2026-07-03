import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Res } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Response } from 'express';

@ApiTags('Medical Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.LAB_STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create and upload a patient report (Admins & Lab Staff only)' })
  async create(@Body() dto: CreateReportDto, @GetUser('id') userId: string) {
    return this.reportsService.create(dto, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.LAB_STAFF, Role.DOCTOR, Role.RECEPTIONIST, Role.SUPPORT_AGENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all reports' })
  async findAll() {
    return this.reportsService.findAll();
  }

  @Get('patient/:patientId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.LAB_STAFF, Role.DOCTOR, Role.RECEPTIONIST, Role.SUPPORT_AGENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Look up all reports for a specific patient' })
  async findByPatient(@Param('patientId') patientId: string) {
    return this.reportsService.findByPatient(patientId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.LAB_STAFF, Role.DOCTOR, Role.RECEPTIONIST, Role.SUPPORT_AGENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get report details by ID' })
  async findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.LAB_STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update report status (Admins & Lab Staff only)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.reportsService.updateStatus(id, dto.reportStatus);
  }

  @Get(':id/secure-url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.LAB_STAFF, Role.DOCTOR, Role.RECEPTIONIST, Role.SUPPORT_AGENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a secure expirable link for report download' })
  async getSecureUrl(@Param('id') id: string) {
    const url = await this.reportsService.generateSecureUrl(id);
    return { secureUrl: url };
  }

  @Get('download/:id')
  @ApiOperation({ summary: 'Proxy download page: validates transient token and redirects to actual file' })
  @ApiQuery({ name: 'token', required: true, description: 'Transient JWT verification token' })
  async download(
    @Param('id') id: string,
    @Query('token') token: string,
    @Res() res: any,
  ) {
    const fileUrl = await this.reportsService.verifyDownloadToken(id, token);
    return res.redirect(fileUrl);
  }
}
