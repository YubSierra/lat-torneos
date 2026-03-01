import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true; // Si no requiere rol, pasa

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}
// ─────────────────────────────────────────────────
// Uso: @Roles('admin', 'referee')
//      @UseGuards(JwtAuthGuard, RolesGuard)
