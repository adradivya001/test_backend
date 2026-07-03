import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { AddNoteDto } from './dto/add-note.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('Support Ticketing & Escalation')
@Controller('support/tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Create a new support ticket' })
  async createTicket(@Body() dto: CreateTicketDto) {
    return this.supportService.createTicket(dto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Get all support tickets' })
  async getTickets() {
    return this.supportService.getTickets();
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Get details of a support ticket' })
  async getTicket(@Param('id') id: string) {
    return this.supportService.getTicket(id);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Update support ticket (assign agent, change status/priority)' })
  async updateTicket(
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.supportService.updateTicket(id, dto);
  }

  @Post(':id/notes')
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Add a note/comment to the ticket conversation' })
  async addNote(
    @Param('id') id: string,
    @Body() dto: AddNoteDto,
    @GetUser('id') userId: string,
  ) {
    return this.supportService.addNote(id, userId, dto.noteText);
  }
}
