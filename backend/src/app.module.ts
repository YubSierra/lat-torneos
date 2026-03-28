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
import { DoublesTeam } from './doubles/doubles-team.entity';
import { AuthModule } from './auth/auth.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { PaymentsModule } from './payments/payments.module';
import { ScheduleModule } from './schedule/schedule.module';
import { MatchesModule } from './matches/matches.module';
import { RankingsModule } from './rankings/rankings.module';
import { Ranking } from './rankings/ranking.entity';
import { CourtsModule } from './courts/courts.module';
import { UsersModule } from './users/users.module';
import { DoublesModule } from './doubles/doubles.module';
import { RankingHistory } from './rankings/ranking-history.entity';
import { CircuitLine } from './circuit-lines/circuit-line.entity';
import { CircuitLinesModule } from './circuit-lines/circuit-lines.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get('PG_URL');

        // 👇 LOG TEMPORAL para ver qué llega
        console.log('🔍 PG_URL:', databaseUrl ? 'PRESENTE ✅' : 'VACÍA ❌');
        console.log('🔍 DB_HOST:', config.get('DB_HOST'));

        if (databaseUrl) {
          // En Railway usa DATABASE_URL directamente
          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [
              User, Player, Tournament,
              Enrollment, Payment,
              Court, CourtSchedule, Match,
              Ranking, RankingHistory,
              DoublesTeam,
              CircuitLine,
            ],
            synchronize: true,
            ssl: { rejectUnauthorized: false },
          };
        }
        // En local usa las variables individuales del .env
        return {
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
            DoublesTeam,
            CircuitLine,
          ],
          synchronize: true,
        };
      },
    }),

    AuthModule,
    TournamentsModule,
    EnrollmentsModule,
    PaymentsModule,
    ScheduleModule,
    MatchesModule,
    RankingsModule,
    CourtsModule,
    UsersModule,
    DoublesModule,
    CircuitLinesModule,
  ],
})
export class AppModule {}
