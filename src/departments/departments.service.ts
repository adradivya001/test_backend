import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDepartmentDto) {
    const existing = await this.prisma.department.findFirst({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException('Department name already exists');
    }
    return this.prisma.department.create({ data: dto });
  }

  async findAll() {
    return this.prisma.department.findMany({
      include: {
        doctors: true,
      },
    });
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id },
      include: { doctors: true },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    return department;
  }
}
