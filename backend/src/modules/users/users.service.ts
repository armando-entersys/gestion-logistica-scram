import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';

import { User } from './entities/user.entity';
import { UserRole } from '@/common/enums';

interface CreateUserDto {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  roleCode?: UserRole;
  phone?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create({
      ...dto,
      roleCode: dto.roleCode || UserRole.SALES,
    });
    return this.userRepository.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      order: { firstName: 'ASC' },
    });
  }

  async findByRole(role: UserRole): Promise<User[]> {
    return this.userRepository.find({
      where: { roleCode: role, isActive: true },
      order: { firstName: 'ASC' },
    });
  }

  async findDrivers(): Promise<User[]> {
    return this.findByRole(UserRole.DRIVER);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepository.update(userId, { lastLogin: new Date() });
  }

  async update(id: string, dto: Partial<User> & { password?: string }): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    // Extract password and prepare update data
    const { password, ...updateData } = dto as any;

    // If password is provided, hash it
    if (password && password.trim()) {
      updateData.passwordHash = await argon2.hash(password);
    }

    // Only update if there's something to update
    if (Object.keys(updateData).length > 0) {
      await this.userRepository.update(id, updateData);
    }

    return this.findById(id) as Promise<User>;
  }

  async deactivate(id: string): Promise<void> {
    await this.userRepository.update(id, { isActive: false });
  }

  async setResetToken(userId: string, token: string, expires: Date): Promise<void> {
    await this.userRepository.update(userId, {
      resetToken: token,
      resetTokenExpires: expires,
    });
  }

  async findByResetToken(token: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { resetToken: token },
    });
  }

  async clearResetToken(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      resetToken: null,
      resetTokenExpires: null,
    });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.userRepository.update(userId, { passwordHash });
  }
}
