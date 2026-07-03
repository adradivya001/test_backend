import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AlertingService } from './alerting.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Observability & Analytics')
@Controller('monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MonitoringController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly alerting: AlertingService,
  ) {}

  @Get('health')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Check system health indicators (Database & Redis)' })
  async getHealth() {
    let dbStatus = 'UP';
    let redisStatus = 'UP';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      dbStatus = `DOWN: ${err.message}`;
      this.alerting.triggerAlert('PostgreSQL Database', err.message, 'CRITICAL');
    }

    try {
      const pingRes = await this.redis.get('health_ping');
      await this.redis.set('health_ping', 'pong', 5);
    } catch (err) {
      redisStatus = `DOWN: ${err.message}`;
      this.alerting.triggerAlert('Redis Cache', err.message, 'HIGH');
    }

    const overall = dbStatus === 'UP' && redisStatus === 'UP' ? 'HEALTHY' : 'UNHEALTHY';

    return {
      status: overall,
      components: {
        database: dbStatus,
        redis: redisStatus,
      },
      timestamp: new Date(),
    };
  }

  @Get('metrics')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Retrieve system operations metrics' })
  async getMetrics() {
    // 1. Failed notifications count
    const failedNotifications = await this.prisma.notificationLog.count({
      where: {
        deliveryStatus: { in: ['FAILED', 'RETRY_LIMIT_REACHED'] },
      },
    });

    const totalNotifications = await this.prisma.notificationLog.count();

    // 2. Escalation rates
    const totalTickets = await this.prisma.supportTicket.count();
    const totalAppointments = await this.prisma.appointment.count();

    // Estimate escalation rate as tickets compared to overall appointments
    const escalationRate = totalAppointments > 0 ? (totalTickets / totalAppointments) * 100 : 0;
    const botResolutionRate = 100 - escalationRate;

    // 3. Queue latency / Pending notifications
    const pendingNotifications = await this.prisma.notificationLog.count({
      where: {
        deliveryStatus: 'PENDING',
      },
    });

    return {
      averageResponseTimeMs: 142, // Simulated dashboard API performance metric
      notifications: {
        total: totalNotifications,
        failed: failedNotifications,
        pendingInQueue: pendingNotifications,
        failureRatePercent: totalNotifications > 0 ? parseFloat(((failedNotifications / totalNotifications) * 100).toFixed(2)) : 0,
      },
      supportEscalations: {
        totalTickets,
        escalationRatePercent: parseFloat(escalationRate.toFixed(2)),
        botResolutionRatePercent: parseFloat(botResolutionRate.toFixed(2)),
      },
    };
  }

  @Get('analytics')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Retrieve conversation and conversion funnel analytics' })
  async getAnalytics() {
    // 1. Most booked departments
    const deptBookings = await this.prisma.appointment.groupBy({
      by: ['departmentId'],
      _count: {
        appointmentId: true,
      },
      orderBy: {
        _count: {
          appointmentId: 'desc',
        },
      },
      take: 5,
    });

    const departments = await this.prisma.department.findMany({
      where: {
        id: { in: deptBookings.map((db) => db.departmentId) },
      },
    });

    const mostBookedDepartments = deptBookings.map((db) => {
      const deptName = departments.find((d) => d.id === db.departmentId)?.name || 'Unknown';
      return {
        departmentName: deptName,
        bookingsCount: db._count.appointmentId,
      };
    });

    // 2. Most booked doctors
    const docBookings = await this.prisma.appointment.groupBy({
      by: ['doctorId'],
      _count: {
        appointmentId: true,
      },
      orderBy: {
        _count: {
          appointmentId: 'desc',
        },
      },
      take: 5,
    });

    const doctors = await this.prisma.doctor.findMany({
      where: {
        doctorId: { in: docBookings.map((db) => db.doctorId) },
      },
    });

    const mostBookedDoctors = docBookings.map((db) => {
      const docName = doctors.find((d) => d.doctorId === db.doctorId)?.name || 'Unknown';
      return {
        doctorName: docName,
        bookingsCount: db._count.appointmentId,
      };
    });

    // 3. Conversation Funnel conversion rate
    // We estimate conversion funnel by comparing total registration mappings vs completed bookings
    const totalRegistrationAttempts = await this.prisma.conversationMapping.count();
    const completedBookings = await this.prisma.appointment.count({
      where: {
        status: { in: ['BOOKED', 'CONFIRMED', 'COMPLETED'] },
      },
    });

    const conversionRatePercent = totalRegistrationAttempts > 0
      ? (completedBookings / totalRegistrationAttempts) * 100
      : 100;

    // 4. Language Distribution & Most Used Languages
    const patientCount = await this.prisma.patient.count();
    const languageStats = await this.prisma.patient.groupBy({
      by: ['preferredLanguage'],
      _count: {
        patientId: true,
      },
    });
    const languageDistribution = languageStats.map(stat => ({
      language: stat.preferredLanguage,
      count: stat._count.patientId,
      percentage: patientCount > 0 ? parseFloat(((stat._count.patientId / patientCount) * 100).toFixed(2)) : 0,
    }));

    const mostUsedLanguages = [...languageDistribution].sort((a, b) => b.count - a.count);

    // 5. Language-Specific Workflow (appointments) usage
    const appointments = await this.prisma.appointment.findMany({
      select: {
        patient: {
          select: {
            preferredLanguage: true,
          },
        },
      },
    });
    const workflowUsageByLanguage: Record<string, number> = { EN: 0, HI: 0, TE: 0 };
    appointments.forEach((appt) => {
      if (appt.patient) {
        const lang = appt.patient.preferredLanguage;
        workflowUsageByLanguage[lang] = (workflowUsageByLanguage[lang] || 0) + 1;
      }
    });

    // 6. Language-Specific Support Escalations
    const supportTickets = await this.prisma.supportTicket.findMany({
      select: {
        patient: {
          select: {
            preferredLanguage: true,
          },
        },
      },
    });
    const supportEscalationsByLanguage: Record<string, number> = { EN: 0, HI: 0, TE: 0 };
    supportTickets.forEach((ticket) => {
      if (ticket.patient) {
        const lang = ticket.patient.preferredLanguage;
        supportEscalationsByLanguage[lang] = (supportEscalationsByLanguage[lang] || 0) + 1;
      }
    });

    return {
      mostBookedDepartments,
      mostBookedDoctors,
      funnel: {
        totalRegistrationAttempts,
        completedBookings,
        conversionRatePercent: parseFloat(conversionRatePercent.toFixed(2)),
      },
      multilingualAnalytics: {
        languageDistribution,
        mostUsedLanguages,
        workflowUsageByLanguage,
        supportEscalationsByLanguage,
      },
    };
  }
}
