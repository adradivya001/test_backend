import { Controller, Get, Post, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post(':id/replay')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Replay/resubmit a failed notification log' })
  async replay(@Param('id') id: string) {
    const log = await this.prisma.notificationLog.findFirst({
      where: { id },
    });
    if (!log) {
      throw new NotFoundException('Notification log not found');
    }

    return this.prisma.notificationLog.update({
      where: { id },
      data: {
        deliveryStatus: 'PENDING',
        retryCount: 0,
        failureReason: null,
      },
    });
  }

  @Get('analytics')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Get notification delivery status counts and analytics' })
  async getAnalytics() {
    const counts = await this.prisma.notificationLog.groupBy({
      by: ['deliveryStatus'],
      _count: {
        id: true,
      },
    });

    const statusCounts = counts.reduce((acc, curr) => {
      acc[curr.deliveryStatus] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    // Ensure all delivery status values are initialized to 0 if not present in DB
    const allStatuses = [
      'PENDING',
      'PROCESSING',
      'SENT',
      'DELIVERED',
      'READ',
      'FAILED',
      'RETRYING',
      'RETRY_LIMIT_REACHED',
      'ESCALATED',
    ];

    allStatuses.forEach((status) => {
      if (statusCounts[status] === undefined) {
        statusCounts[status] = 0;
      }
    });

    return {
      statusCounts,
      totalCount: Object.values(statusCounts).reduce((a, b) => a + b, 0),
    };
  }
}
