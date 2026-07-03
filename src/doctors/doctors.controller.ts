import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { CreateScheduleOverrideDto } from './dto/create-override.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Doctors')
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new doctor profile' })
  async create(@Body() dto: CreateDoctorDto) {
    return this.doctorsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get and search doctors' })
  @ApiQuery({ name: 'query', required: false, description: 'Search term for name or specialization' })
  @ApiQuery({ name: 'specialization', required: false })
  @ApiQuery({ name: 'departmentId', required: false })
  async findAll(
    @Query('query') query?: string,
    @Query('specialization') specialization?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.doctorsService.findAll(query, specialization, departmentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get doctor by ID' })
  async findOne(@Param('id') id: string) {
    return this.doctorsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update doctor profile' })
  async update(@Param('id') id: string, @Body() dto: UpdateDoctorDto) {
    return this.doctorsService.update(id, dto);
  }

  @Put(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activate a doctor profile' })
  async activate(@Param('id') id: string) {
    return this.doctorsService.setStatus(id, 'ACTIVE');
  }

  @Put(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate a doctor profile' })
  async deactivate(@Param('id') id: string) {
    return this.doctorsService.setStatus(id, 'INACTIVE');
  }

  @Put(':id/presence')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update doctor presence status' })
  async updatePresence(
    @Param('id') id: string,
    @Body('status') status: 'ACTIVE' | 'OFFLINE' | 'ON_LEAVE' | 'IN_CONSULTATION' | 'UNAVAILABLE',
  ) {
    return this.doctorsService.setStatus(id, status);
  }

  @Post(':id/overrides')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a temporary availability override for a doctor' })
  async addOverride(
    @Param('id') id: string,
    @Body() dto: CreateScheduleOverrideDto,
  ) {
    return this.doctorsService.addScheduleOverride(id, dto);
  }

  @Get(':id/metrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get performance metrics for a doctor' })
  async getMetrics(@Param('id') id: string) {
    return this.doctorsService.getMetrics(id);
  }

  @Get('department/:departmentId')
  @ApiOperation({ summary: 'Get active doctors by department ID' })
  async findByDepartment(@Param('departmentId') departmentId: string) {
    return this.doctorsService.findByDepartment(departmentId);
  }
}
