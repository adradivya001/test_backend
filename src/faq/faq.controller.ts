import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FaqService } from './faq.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Frequently Asked Questions (FAQ)')
@Controller('faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new FAQ (Admin only)' })
  async create(@Body() dto: CreateFaqDto) {
    return this.faqService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all FAQs or search by query term' })
  @ApiQuery({ name: 'query', required: false })
  async find(@Query('query') query?: string) {
    if (query) {
      return this.faqService.search(query);
    }
    return this.faqService.findAll();
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an FAQ (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateFaqDto>) {
    return this.faqService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an FAQ (Admin only)' })
  async delete(@Param('id') id: string) {
    return this.faqService.delete(id);
  }
}
