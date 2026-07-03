import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { DoctorLeavesService } from './doctor-leaves.service';
import { MarkLeaveDto } from './dto/mark-leave.dto';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Doctor Leaves')
@Controller('doctor-leaves')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DoctorLeavesController {
  constructor(private readonly doctorLeavesService: DoctorLeavesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Mark doctor on leave (Admin only)' })
  async markLeave(@Body() dto: MarkLeaveDto) {
    return this.doctorLeavesService.markLeave(dto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
  @ApiOperation({ summary: 'Get all leaves or filter by doctor ID' })
  @ApiQuery({ name: 'doctorId', required: false })
  async getLeaves(@Query('doctorId') doctorId?: string) {
    return this.doctorLeavesService.getLeaves(doctorId);
  }

  @Delete(':doctorId/:leaveDate')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Cancel doctor leave (Admin only)' })
  async cancelLeave(
    @Param('doctorId') doctorId: string,
    @Param('leaveDate') leaveDate: string,
  ) {
    return this.doctorLeavesService.cancelLeave(doctorId, leaveDate);
  }
}
