import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { OtpService } from './otp.service';
import { OtpController } from './otp.controller';
import { OtpVerifiedGuard } from './guards/otp-verified.guard';
import { RedisModule } from '../common/redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    UsersModule,
    RedisModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'dfo-core-backend-super-secret-key-change-me'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '24h') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController, OtpController],
  providers: [AuthService, JwtStrategy, RolesGuard, OtpService, OtpVerifiedGuard],
  exports: [AuthService, PassportModule, JwtModule, RolesGuard, OtpService, OtpVerifiedGuard],
})
export class AuthModule {}
