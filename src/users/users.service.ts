import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOneByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { email } });
  }

  async findOneById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id } });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    const existing = await this.findOneByEmail(data.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.passwordHash, salt);

    const { passwordHash: _, ...userData } = data;
    return this.prisma.user.create({
      data: {
                ...userData,
        passwordHash,
      },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        createdAt: true,
      },
    });
  }
}
