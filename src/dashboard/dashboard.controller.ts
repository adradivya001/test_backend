import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Role } from '@prisma/client';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { CreateClosureDto } from './dto/create-closure.dto';
import { CreateOverrideDto } from './dto/create-override.dto';

@ApiTags('Dashboard Operations')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Get overview metrics and status summaries (Admin only)' })
  async getStats() {
    return this.dashboardService.getStats();
  }

  // --- Holiday Calendar ---
  @Post('holidays')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @Permissions('manage:hospital')
  @ApiOperation({ summary: 'Create a holiday in the calendar' })
  async createHoliday(@Body() dto: CreateHolidayDto, @Req() req: any) {
    return this.dashboardService.createHoliday(dto, req.user?.id);
  }

  @Get('holidays')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Get all configured holidays' })
  async getHolidays() {
    return this.dashboardService.getHolidays();
  }

  @Delete('holidays/:id')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @Permissions('manage:hospital')
  @ApiOperation({ summary: 'Delete a holiday from the calendar' })
  async deleteHoliday(@Param('id') id: string, @Req() req: any) {
    return this.dashboardService.deleteHoliday(id, req.user?.id);
  }

  // --- Hospital Closures ---
  @Post('closures')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @Permissions('manage:hospital')
  @ApiOperation({ summary: 'Create a hospital closure period' })
  async createClosure(@Body() dto: CreateClosureDto, @Req() req: any) {
    return this.dashboardService.createClosure(dto, req.user?.id);
  }

  @Get('closures')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Get all configured hospital closures' })
  async getClosures() {
    return this.dashboardService.getClosures();
  }

  @Delete('closures/:id')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @Permissions('manage:hospital')
  @ApiOperation({ summary: 'Delete a hospital closure period' })
  async deleteClosure(@Param('id') id: string, @Req() req: any) {
    return this.dashboardService.deleteClosure(id, req.user?.id);
  }

  // --- Doctor Schedule Overrides ---
  @Post('overrides')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @Permissions('manage:hospital')
  @ApiOperation({ summary: 'Create or update doctor schedule override' })
  async upsertOverride(@Body() dto: CreateOverrideDto, @Req() req: any) {
    return this.dashboardService.upsertOverride(dto, req.user?.id);
  }

  @Get('overrides')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Get all doctor schedule overrides' })
  @ApiQuery({ name: 'doctorId', required: false })
  async getOverrides(@Query('doctorId') doctorId?: string) {
    return this.dashboardService.getOverrides(doctorId);
  }

  @Delete('overrides/:id')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @Permissions('manage:hospital')
  @ApiOperation({ summary: 'Delete a doctor schedule override' })
  async deleteOverride(@Param('id') id: string, @Req() req: any) {
    return this.dashboardService.deleteOverride(id, req.user?.id);
  }
}

