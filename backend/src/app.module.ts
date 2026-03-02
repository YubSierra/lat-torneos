import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/user.entity';
import { Player } from './users/player.entity';
import { Tournament } from './tournaments/tournament.entity';
import { Enrollment } from './enrollments/enrollment.entity';
import { Payment } from './payments/payment.entity';
import { Court } from './courts/court.entity';
import { CourtSchedule } from './courts/court-schedule.entity';
import { Match } from './matches/match.entity';
import { AuthModule } from './auth/auth.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { PaymentsModule } from './payments/payments.module';
import { ScheduleModule } from './schedule/schedule.module';
import { MatchesModule } from './matches/matches.module';
import { RankingsModule } from './rankings/rankings.module';
import { Ranking } from './rankings/ranking.entity';
import { CourtsModule } from './courts/courts.module';
import { RankingHistory } from './rankings/ranking-history.entity';
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
        entities: [
          User, Player, Tournament,
          Enrollment, Payment,
          Court, CourtSchedule, Match,
          Ranking, RankingHistory,
        ],
        synchronize: true,
        logging: true,
      }),
    }),

    AuthModule,
    TournamentsModule,
    EnrollmentsModule,
    PaymentsModule,
    ScheduleModule,
    MatchesModule,
    RankingsModule,
    CourtsModule,
  ],
})
export class AppModule {}
