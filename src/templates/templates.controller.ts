import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';

@ApiTags('Notification Templates')
@Controller('dashboard/templates')
@ApiBearerAuth()
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @ApiOperation({ summary: 'Create or update a notification template for current tenant' })
  create(@Body() dto: CreateTemplateDto) {
    return this.templatesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all templates for current tenant' })
  findAll() {
    return this.templatesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a template by ID' })
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a template by ID' })
  remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }
}
