// backend/src/auth/auth.controller.ts
import { Controller, Post, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // POST /auth/register — registro público (solo jugadores)
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

  // POST /auth/register/admin — solo admins autenticados
  @UseGuards(JwtAuthGuard)
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

  // PATCH /auth/change-password — usuario autenticado cambia su contraseña
  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  changePassword(
    @Req() req: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(req.user.id, body.currentPassword, body.newPassword);
  }
}
