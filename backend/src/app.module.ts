import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { TournamentsModule } from './tournaments/tournaments.module';

@Module({
  imports: [
    // 1. Cargar variables de entorno (.env)
    ConfigModule.forRoot({ isGlobal: true }),

    // 2. Conectar con PostgreSQL usando las variables de entorno
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host:     config.get('DB_HOST'),
        port:     config.get<number>('DB_PORT'),
        database: config.get('DB_NAME'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASS'),
        entities:     [__dirname + '/**/*.entity{.ts,.js}'],
        // Busca automáticamente todos los archivos .entity.ts
        synchronize: true,
        // En desarrollo: crea/actualiza tablas automáticamente
        // En producción: cambia a false y usa migraciones
        logging: true,
        // Muestra las queries SQL en consola (útil para aprender)
      }),
    }),

    AuthModule,

    TournamentsModule,
  ],
})
export class AppModule {}
