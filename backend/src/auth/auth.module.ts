import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // Importante
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../users/user.entity'; // Importa la entidad User

@Module({
  imports: [
    // Esto es lo que falta: registrar la entidad User en este módulo
    TypeOrmModule.forFeature([User]),

    // Configuración de JWT (Fase 2)
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secretKey',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService], // Exportarlo si otros módulos lo necesitan
})
export class AuthModule {}
