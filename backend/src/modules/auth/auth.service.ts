import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '@/common/enums';

interface LoginDto {
  email: string;
  password: string;
}

interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleCode?: UserRole;
  phone?: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectQueue('notifications')
    private readonly notificationQueue: Queue,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) {
      return null;
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async login(dto: LoginDto): Promise<{ accessToken: string; user: Partial<User> }> {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.roleCode,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleCode: user.roleCode,
      },
    };
  }

  async register(dto: RegisterDto): Promise<User> {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await argon2.hash(dto.password);

    return this.usersService.create({
      ...dto,
      passwordHash,
    });
  }

  async refreshToken(userId: string): Promise<{ accessToken: string }> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.roleCode,
    };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);

    // Always return success to prevent email enumeration
    if (!user || !user.isActive) {
      return { message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña' };
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Token expires in 1 hour
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await this.usersService.setResetToken(user.id, tokenHash, expires);

    // Build reset URL
    const appUrl = process.env.APP_URL || 'https://gestion-logistica.scram2k.com';
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    // Queue email
    await this.notificationQueue.add('send-password-reset', {
      email: user.email,
      userName: user.firstName,
      resetUrl,
    });

    return { message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    // Hash the token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.usersService.findByResetToken(tokenHash);

    if (!user) {
      throw new BadRequestException('Token inválido o expirado');
    }

    // Check if token is expired
    if (!user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      await this.usersService.clearResetToken(user.id);
      throw new BadRequestException('Token inválido o expirado');
    }

    // Hash new password and update
    const passwordHash = await argon2.hash(newPassword);
    await this.usersService.updatePassword(user.id, passwordHash);

    // Clear reset token
    await this.usersService.clearResetToken(user.id);

    return { message: 'Contraseña actualizada exitosamente' };
  }

  async validateResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.usersService.findByResetToken(tokenHash);

    if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      return { valid: false };
    }

    return { valid: true, email: user.email };
  }
}
