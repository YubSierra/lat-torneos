import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Este guard verifica el token JWT en el header Authorization
// Uso: @UseGuards(JwtAuthGuard) encima de cualquier ruta protegida
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}