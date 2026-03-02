import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('users')
export class UsersController {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  // GET /users — listar todos los usuarios (solo admins)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findAll() {
    return this.userRepo.find({
      select: ['id', 'email', 'role', 'isActive', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }
}
