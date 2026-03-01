import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/user.entity';
import { Player } from './users/player.entity';
import { Tournament } from './tournaments/tournament.entity';
import { AuthModule } from './auth/auth.module';
import { TournamentsModule } from './tournaments/tournaments.module';

@Module({
  imports: [
    // 1. Variables de entorno
    ConfigModule.forRoot({ isGlobal: true }),

    // 2. Conexión PostgreSQL
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        database: config.get('DB_NAME'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASS'),
        entities: [User, Player, Tournament],
        synchronize: true,
        logging: true,
      }),
    }),

    // 3. Módulos de la aplicación
    AuthModule,
    TournamentsModule,
  ],
})
export class AppModule {}
