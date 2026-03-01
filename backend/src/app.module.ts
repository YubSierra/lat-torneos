import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/user.entity';
import { Player } from './users/player.entity';
import { Tournament } from './tournaments/tournament.entity';
import { Enrollment } from './enrollments/enrollment.entity';
import { Payment } from './payments/payment.entity';
import { AuthModule } from './auth/auth.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host:     config.get('DB_HOST'),
        port:     config.get<number>('DB_PORT'),
        database: config.get('DB_NAME'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASS'),
        entities: [User, Player, Tournament, Enrollment, Payment],
        synchronize: true,
        logging: true,
      }),
    }),

    AuthModule,
    TournamentsModule,
    EnrollmentsModule,
    PaymentsModule,
  ],
})
export class AppModule {}
