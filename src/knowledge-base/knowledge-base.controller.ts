import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { CreateKbDto } from './dto/create-kb.dto';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Knowledge Base')
@Controller('knowledge-base')
export class KnowledgeBaseController {
  constructor(private readonly kbService: KnowledgeBaseService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new knowledge base entry (Admin only)' })
  async create(@Body() dto: CreateKbDto) {
    return this.kbService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all KB entries or search by query term' })
  @ApiQuery({ name: 'query', required: false })
  async find(@Query('query') query?: string) {
    if (query) {
      return this.kbService.search(query);
    }
    return this.kbService.findAll();
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a KB entry (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateKbDto>) {
    return this.kbService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a KB entry (Admin only)' })
  async delete(@Param('id') id: string) {
    return this.kbService.delete(id);
  }
}
