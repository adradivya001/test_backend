import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKbDto } from './dto/create-kb.dto';
import { AuditService } from '../audit/audit.service';
import { Language } from '@prisma/client';

@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateKbDto) {
    const kb = await this.prisma.knowledgeBase.create({ data: dto });

    await this.auditService.log(
      'Knowledge Base Updated',
      'KnowledgeBase',
      kb.id,
      undefined,
      { action: 'CREATE', title: dto.title },
    );

    return kb;
  }

  async findAll() {
    return this.prisma.knowledgeBase.findMany();
  }

  async search(query: string, language: Language = Language.EN) {
    await this.auditService.log(
      'KNOWLEDGE_BASE_LANGUAGE_RETRIEVAL',
      'KnowledgeBase',
      'SYSTEM',
      undefined,
      { language, query },
    );

    const now = new Date();

    let results = await this.prisma.knowledgeBase.findMany({
      where: {
        language,
        reviewStatus: 'APPROVED',
        OR: [
          { expiryDate: null },
          { expiryDate: { gt: now } },
        ],
        AND: [
          {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { category: { contains: query, mode: 'insensitive' } },
              { content: { contains: query, mode: 'insensitive' } },
            ],
          }
        ],
      },
    });

    if (results.length === 0 && language !== Language.EN) {
      results = await this.prisma.knowledgeBase.findMany({
        where: {
          language: Language.EN,
          reviewStatus: 'APPROVED',
          OR: [
            { expiryDate: null },
            { expiryDate: { gt: now } },
          ],
          AND: [
            {
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { category: { contains: query, mode: 'insensitive' } },
                { content: { contains: query, mode: 'insensitive' } },
              ],
            }
          ],
        },
      });
    }

    return results;
  }

  async update(id: string, dto: Partial<CreateKbDto>) {
    const existing = await this.prisma.knowledgeBase.findFirst({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Knowledge Base entry not found');
    }
    const updated = await this.prisma.knowledgeBase.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log(
      'Knowledge Base Updated',
      'KnowledgeBase',
      id,
      undefined,
      { action: 'UPDATE', title: updated.title },
    );

    return updated;
  }

  async delete(id: string) {
    const existing = await this.prisma.knowledgeBase.findFirst({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Knowledge Base entry not found');
    }
    const deleted = await this.prisma.knowledgeBase.delete({ where: { id } });

    await this.auditService.log(
      'Knowledge Base Updated',
      'KnowledgeBase',
      id,
      undefined,
      { action: 'DELETE', title: existing.title },
    );

    return deleted;
  }
}
