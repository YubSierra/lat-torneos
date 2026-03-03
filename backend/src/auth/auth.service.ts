import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  // ── REGISTRO ────────────────────────────────────

  async register(email: string, password: string, role?: string) {
    const exists = await this.usersRepo.findOne({ where: { email } });
    if (exists) throw new ConflictException('El email ya está registrado');

    const hash = await bcrypt.hash(password, 12);

    const user = this.usersRepo.create({
      email,
      password: hash,
      role: (role as UserRole) || UserRole.PLAYER,
    });

  return this.usersRepo.save(user);
}

  // ── LOGIN ────────────────────────────────────────
  async login(email: string, password: string) {
    // Buscar el usuario por email
    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    // Comparar la contraseña con el hash guardado
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    // Generar el JWT
    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    return { access_token: token, role: user.role };
  }
}