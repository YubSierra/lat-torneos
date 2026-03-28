// backend/src/auth/auth.service.ts
import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../users/user.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  // ── REGISTRO PÚBLICO (solo jugadores) ──────────────────────────────
  async registerPlayer(data: {
    email: string;
    password: string;
    nombres: string;
    apellidos: string;
    telefono?: string;
    docNumber?: string;
    birthDate?: string;
    gender?: string;
  }) {
    const exists = await this.usersRepo.findOne({ where: { email: data.email } });
    if (exists) throw new ConflictException('El email ya está registrado');

    if (data.docNumber) {
      const docExists = await this.usersRepo.findOne({ where: { docNumber: data.docNumber } });
      if (docExists) throw new ConflictException('El número de documento ya está registrado');
    }

    const hash = await bcrypt.hash(data.password, 12);

    const user = this.usersRepo.create({
      email:     data.email,
      password:  hash,
      role:      UserRole.PLAYER,
      nombres:   data.nombres,
      apellidos: data.apellidos,
      telefono:  data.telefono,
      docNumber: data.docNumber,
      birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
      gender:    data.gender || 'M',
      isActive:  true,
    });

    await this.usersRepo.save(user);

    // Enviar bienvenida (fire-and-forget)
    this.mailService.sendWelcome(data.email, data.nombres).catch(() => {});

    return { message: '¡Registro exitoso! Ya puedes iniciar sesión.' };
  }

  // ── REGISTRO ADMIN (acepta cualquier rol) ──────────────────────────
  async register(
    email: string,
    password: string,
    role?: string,
    extra?: {
      nombres?: string;
      apellidos?: string;
      telefono?: string;
      docNumber?: string;
      birthDate?: string;
      gender?: string;
    }
  ) {
    const exists = await this.usersRepo.findOne({ where: { email } });
    if (exists) throw new ConflictException('El email ya está registrado');

    const hash = await bcrypt.hash(password, 12);

    const user = this.usersRepo.create({
      email,
      password: hash,
      role: (role as UserRole) || UserRole.PLAYER,
      ...extra,
      birthDate: extra?.birthDate ? new Date(extra.birthDate) : undefined,
      isActive: true,
    });

    const saved = await this.usersRepo.save(user);

    // Enviar bienvenida (fire-and-forget)
    this.mailService.sendWelcome(email, extra?.nombres || email).catch(() => {});

    return saved;
  }

  // ── LOGIN ──────────────────────────────────────────────────────────
  async login(email: string, password: string) {
    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');
    if (!user.isActive) throw new UnauthorizedException('Usuario inactivo. Contacta al administrador.');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      role:    user.role,
      nombres: user.nombres,
      userId:  user.id,
    };
  }

  // ── CAMBIAR CONTRASEÑA ─────────────────────────────────────────────
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('La contraseña actual es incorrecta');

    user.password = await bcrypt.hash(newPassword, 12);
    user.mustChangePassword = false;
    await this.usersRepo.save(user);

    // Notificar por email (fire-and-forget)
    this.mailService.sendPasswordChanged(user.email, user.nombres || user.email).catch(() => {});

    return { message: 'Contraseña actualizada correctamente.' };
  }
}
