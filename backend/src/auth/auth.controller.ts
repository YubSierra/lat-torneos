// backend/src/auth/auth.controller.ts  ← REEMPLAZA EL ARCHIVO COMPLETO
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
  // Solo llamado desde la página de Players (admin) — acepta rol
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