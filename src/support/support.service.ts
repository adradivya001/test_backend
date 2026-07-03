import * as bcrypt from 'bcrypt';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { SupportTicketPriority } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly redis: RedisService,
  ) {}

  async createTicket(dto: CreateTicketDto, createdBySystem = false) {
    // Check patient exists
    const patient = await this.prisma.patient.findFirst({
      where: { patientId: dto.patientId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // Assign automatically to an agent with least tickets if possible, or leave unassigned
    const agents = await this.prisma.user.findMany({
      where: { role: 'SUPPORT_AGENT' },
      include: {
        assignedTickets: {
          where: { status: { in: ['OPEN', 'PENDING'] } },
        },
      },
    });

    let assignedAgentId: string | null = null;
    if (agents.length > 0) {
      agents.sort((a, b) => a.assignedTickets.length - b.assignedTickets.length);
      assignedAgentId = agents[0].id;
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
                patientId: dto.patientId,
        conversationId: dto.conversationId,
        priority: dto.priority || SupportTicketPriority.MEDIUM,
        status: 'OPEN',
        assignedAgentId,
      },
      include: {
        patient: true,
        assignedAgent: true,
      },
    });

    if (dto.initialNote) {
      await this.prisma.ticketNote.create({
        data: {
        ticketId: ticket.ticketId,
          noteText: dto.initialNote,
          authorId: assignedAgentId || (await this.getSystemUser()).id,
        },
      });
    }

    // Dispatch WhatsApp update notification event
    await this.prisma.notificationLog.create({
      data: {
                patientId: ticket.patientId,
        type: 'ESCALATION_UPDATE',
        payload: JSON.stringify({
          ticketId: ticket.ticketId,
          status: 'OPEN',
          priority: ticket.priority,
          agentName: (ticket as any).assignedAgent ? `${(ticket as any).assignedAgent.firstName} ${(ticket as any).assignedAgent.lastName}` : 'Unassigned',
          phone: patient.phone,
        }),
      },
    });

    await this.auditService.log(
      'Support Ticket Created',
      'SupportTicket',
      ticket.ticketId,
      undefined,
      { patientId: dto.patientId, priority: ticket.priority },
    );

    return ticket;
  }

  async updateTicket(ticketId: string, dto: UpdateTicketDto) {
    const existing = await this.prisma.supportTicket.findFirst({
      where: { ticketId },
      include: { patient: true },
    });
    if (!existing) {
      throw new NotFoundException('Ticket not found');
    }

    if (dto.assignedAgentId) {
      const agent = await this.prisma.user.findFirst({ where: { id: dto.assignedAgentId } });
      if (!agent) {
        throw new NotFoundException('Agent not found');
      }
    }

    const updated = await this.prisma.supportTicket.update({
      where: { ticketId },
      data: dto,
      include: { assignedAgent: true, patient: true },
    });

    // Notify of update
    await this.prisma.notificationLog.create({
      data: {
                patientId: updated.patientId,
        type: 'ESCALATION_UPDATE',
        payload: JSON.stringify({
          ticketId: updated.ticketId,
          status: updated.status,
          priority: updated.priority,
          agentName: updated.assignedAgent ? `${updated.assignedAgent.firstName} ${updated.assignedAgent.lastName}` : 'Unassigned',
          phone: updated.patient.phone,
        }),
      },
    });

    return updated;
  }

  async addNote(ticketId: string, authorId: string, noteText: string) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { ticketId } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Enforce Priority 13: Human Escalation Ownership lock checks via Redis
    const lockKey = `lock:ticket:${ticketId}`;
    const lockedByAgentId = await this.redis.get(lockKey);

    if (lockedByAgentId && lockedByAgentId !== authorId) {
      const activeAgent = await this.prisma.user.findFirst({ where: { id: lockedByAgentId } });
      const activeAgentName = activeAgent ? `${activeAgent.firstName} ${activeAgent.lastName}` : 'another agent';
      throw new ConflictException(`This ticket is currently locked by ${activeAgentName}. You cannot reply until the lock expires.`);
    }

    // Acquire lock for 15 minutes (900 seconds)
    await this.redis.set(lockKey, authorId, 900);

    return this.prisma.ticketNote.create({
      data: {
        ticketId,
        authorId,
        noteText,
      },
      include: { author: true },
    });
  }

  async getTickets() {
    return this.prisma.supportTicket.findMany({
      include: {
        patient: true,
        assignedAgent: true,
        notes: {
          include: { author: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTicket(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { ticketId },
      include: {
        patient: true,
        assignedAgent: true,
        notes: {
          include: { author: true },
        },
      },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  private async getSystemUser() {
    let system = await this.prisma.user.findFirst({
      where: { email: 'system@hospital.com' },
    });
    if (!system) {
      return await this.prisma.user.create({
        data: {
                    email: 'system@hospital.com',
          passwordHash: await bcrypt.hash('password', 10),
          firstName: 'Super',
          lastName: 'Admin',
          role: 'SUPER_ADMIN'
        }
      });
    }
    return system;
  }
}
