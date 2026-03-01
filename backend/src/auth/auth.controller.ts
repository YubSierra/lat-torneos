import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth') // <--- Asegúrate de que diga 'auth' aquí
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() body: any) {
    return this.authService.register(body.email, body.password);
  }

  @Post('login')
  login(@Body() body: any) {
    return this.authService.login(body.email, body.password);
  }
}
