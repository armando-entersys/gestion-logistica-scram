import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

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
}
