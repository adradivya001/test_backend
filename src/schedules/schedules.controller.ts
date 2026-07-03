import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Doctor Schedules')
@Controller('doctors')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post(':id/schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add working schedule for a doctor (Admin only)' })
  async create(@Param('id') doctorId: string, @Body() dto: CreateScheduleDto) {
    return this.schedulesService.create(doctorId, dto);
  }

  @Get(':id/schedule')
  @ApiOperation({ summary: 'Get working schedules of a doctor' })
  async findByDoctor(@Param('id') doctorId: string) {
    return this.schedulesService.findByDoctor(doctorId);
  }

  @Delete('schedule/:scheduleId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a doctor schedule (Admin only)' })
  async delete(@Param('scheduleId') scheduleId: string) {
    return this.schedulesService.delete(scheduleId);
  }
}
