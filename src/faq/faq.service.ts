import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { AuditService } from '../audit/audit.service';
import { Language } from '@prisma/client';

@Injectable()
export class FaqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateFaqDto) {
    return this.prisma.fAQ.create({ data: dto });
  }

  async findAll() {
    return this.prisma.fAQ.findMany();
  }

  async search(query: string, language: Language = Language.EN) {
    await this.auditService.log(
      'FAQ_LANGUAGE_RETRIEVAL',
      'FAQ',
      'SYSTEM',
      undefined,
      { language, query },
    );

    const now = new Date();

    let results = await this.prisma.fAQ.findMany({
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
              { question: { contains: query, mode: 'insensitive' } },
              { answer: { contains: query, mode: 'insensitive' } },
              { title: { contains: query, mode: 'insensitive' } },
              { category: { contains: query, mode: 'insensitive' } },
            ],
          }
        ],
      },
    });

    if (results.length === 0 && language !== Language.EN) {
      results = await this.prisma.fAQ.findMany({
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
                { question: { contains: query, mode: 'insensitive' } },
                { answer: { contains: query, mode: 'insensitive' } },
                { title: { contains: query, mode: 'insensitive' } },
                { category: { contains: query, mode: 'insensitive' } },
              ],
            }
          ],
        },
      });
    }

    return results;
  }

  async update(id: string, dto: Partial<CreateFaqDto>) {
    const existing = await this.prisma.fAQ.findFirst({ where: { id } });
    if (!existing) {
      throw new NotFoundException('FAQ not found');
    }
    return this.prisma.fAQ.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string) {
    const existing = await this.prisma.fAQ.findFirst({ where: { id } });
    if (!existing) {
      throw new NotFoundException('FAQ not found');
    }
    return this.prisma.fAQ.delete({ where: { id } });
  }
}
