import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(action: string, entityType: string, entityId: string, userId?: string, details?: any) {
    return this.prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        userId,
        details: details ? JSON.stringify(details) : null,
      },
    });
  }

  async findAll() {
    return this.prisma.auditLog.findMany({
      include: { user: true },
      orderBy: { timestamp: 'desc' },
    });
  }
}
