import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, AppointmentStatus } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';

class CancelAppointmentDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  cancelledBy?: string;
}

@ApiTags('Appointments')
@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // ─── Booking ──────────────────────────────────────────────────────────────

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Book a new appointment' })
  async book(@Body() dto: BookAppointmentDto) {
    return this.appointmentsService.book(dto);
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Get all appointments (optionally filter by status)' })
  @ApiQuery({ name: 'status', enum: AppointmentStatus, required: false })
  async findAll(@Query('status') status?: AppointmentStatus) {
    return this.appointmentsService.findAll(status);
  }

  @Get('availability')
  @ApiOperation({ summary: 'Get available time slots for a doctor on a specific date' })
  @ApiQuery({ name: 'doctorId', required: true })
  @ApiQuery({ name: 'date', required: true, description: 'YYYY-MM-DD' })
  async getAvailability(
    @Query('doctorId') doctorId: string,
    @Query('date') date: string,
  ) {
    return this.appointmentsService.getAvailableSlots(doctorId, date);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Get appointment details by ID' })
  async findOne(@Param('id') id: string) {
    return this.appointmentsService.findOne(id);
  }

  // ─── Lifecycle Transitions ────────────────────────────────────────────────

  @Put(':id/confirm')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Confirm a booked appointment (BOOKED → CONFIRMED)' })
  async confirm(@Param('id') id: string) {
    return this.appointmentsService.confirm(id);
  }

  @Put(':id/check-in')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Check in patient (CONFIRMED → CHECKED_IN)' })
  async checkIn(@Param('id') id: string) {
    return this.appointmentsService.checkIn(id);
  }

  @Put(':id/start-consultation')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
  @ApiOperation({ summary: 'Start consultation (CHECKED_IN → IN_CONSULTATION)' })
  async startConsultation(@Param('id') id: string) {
    return this.appointmentsService.startConsultation(id);
  }

  @Put(':id/complete')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
  @ApiOperation({ summary: 'Complete appointment (IN_CONSULTATION → COMPLETED)' })
  async complete(@Param('id') id: string) {
    return this.appointmentsService.complete(id);
  }

  @Put(':id/no-show')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Mark appointment as no-show (CONFIRMED → NO_SHOW)' })
  async markNoShow(@Param('id') id: string) {
    return this.appointmentsService.markNoShow(id);
  }

  @Put(':id/cancel')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
  @ApiOperation({ summary: 'Cancel an appointment with optional reason' })
  @ApiBody({ type: CancelAppointmentDto, required: false })
  async cancelWithReason(
    @Param('id') id: string,
    @Body() body: CancelAppointmentDto,
  ) {
    return this.appointmentsService.cancel(id, body?.cancelledBy || 'STAFF', body?.reason);
  }

  // ─── Reschedule ───────────────────────────────────────────────────────────

  @Put(':id/reschedule')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Reschedule: marks original as RESCHEDULED, creates new appointment' })
  async reschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.appointmentsService.reschedule(id, dto);
  }

  // ─── Generic Status (Admin) ───────────────────────────────────────────────

  @Put(':id/status')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Force-set appointment status (admin only)' })
  @ApiQuery({ name: 'status', enum: AppointmentStatus, required: true })
  async updateStatus(
    @Param('id') id: string,
    @Query('status') status: AppointmentStatus,
  ) {
    return this.appointmentsService.setStatus(id, status);
  }

  // ─── Delete/Cancel (legacy) ───────────────────────────────────────────────

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Cancel an appointment (legacy DELETE endpoint)' })
  async cancel(@Param('id') id: string) {
    return this.appointmentsService.cancel(id, 'STAFF', 'Legacy cancellation');
  }
}
