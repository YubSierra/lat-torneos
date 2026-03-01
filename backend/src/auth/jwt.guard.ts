import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Este guard verifica el token JWT en el header Authorization
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// ─────────────────────────────────────────────────
// Uso en un controlador:
// @UseGuards(JwtAuthGuard)   ← protege toda la clase
// @Get('profile')
// getProfile(@Request() req) {
//   return req.user;   ← contiene { sub, email, role }
// }
