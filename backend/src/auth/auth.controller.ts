// ══════════════════════════════════════════════════════════
// backend/src/auth/auth.controller.ts  ← REEMPLAZA COMPLETO
// ══════════════════════════════════════════════════════════
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // POST /auth/register
  // Registro público — role siempre es 'player' (ignoramos si viene otro valor)
  @Post('register')
  register(
    @Body() body: {
      email: string;
      password: string;
      nombres: string;
      apellidos: string;
      telefono?: string;
      docNumber?: string;
      birthDate?: string;
      gender?: string;
      // NOTE: role se ignora aquí intencionalmente — siempre será 'player'
    },
  ) {
    return this.authService.registerPlayer({
      email:     body.email,
      password:  body.password,
      nombres:   body.nombres,
      apellidos: body.apellidos,
      telefono:  body.telefono,
      docNumber: body.docNumber,
      birthDate: body.birthDate,
      gender:    body.gender || 'M',
    });
  }

  // POST /auth/register/admin
  // Solo llamado internamente desde admin (Players page)
  // Acepta rol porque el admin lo elige
  @Post('register/admin')
  registerAdmin(
    @Body() body: {
      email: string;
      password: string;
      role?: string;
      nombres?: string;
      apellidos?: string;
      telefono?: string;
      docNumber?: string;
      birthDate?: string;
      gender?: string;
    },
  ) {
    return this.authService.register(
      body.email,
      body.password,
      body.role,
      {
        nombres:   body.nombres,
        apellidos: body.apellidos,
        telefono:  body.telefono,
        docNumber: body.docNumber,
        birthDate: body.birthDate,
        gender:    body.gender,
      }
    );
  }

  // POST /auth/login
  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }
}


// ══════════════════════════════════════════════════════════
// backend/src/auth/auth.service.ts  ← REEMPLAZA COMPLETO
// ══════════════════════════════════════════════════════════
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  // ── REGISTRO PÚBLICO (solo jugadores) ──────────────────
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
      role:      UserRole.PLAYER,          // ← siempre player, nunca admin
      nombres:   data.nombres,
      apellidos: data.apellidos,
      telefono:  data.telefono,
      docNumber: data.docNumber,
      birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
      gender:    data.gender || 'M',
      isActive:  true,
    });

    await this.usersRepo.save(user);
    return { message: '¡Registro exitoso! Ya puedes iniciar sesión.' };
  }

  // ── REGISTRO ADMIN (acepta cualquier rol) ──────────────
  async register(
    email: string,
    password: string,
    role?: string,
    extra?: {
      nombres?: string; apellidos?: string; telefono?: string;
      docNumber?: string; birthDate?: string; gender?: string;
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

    return this.usersRepo.save(user);
  }

  // ── LOGIN ───────────────────────────────────────────────
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
}