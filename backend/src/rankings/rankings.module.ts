import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ranking } from './ranking.entity';
import { RankingHistory } from './ranking-history.entity';
import { Match } from '../matches/match.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { Tournament } from '../tournaments/tournament.entity';
import { CircuitLine } from '../circuit-lines/circuit-line.entity';
import { RankingsService } from './rankings.service';
import { RankingsController } from './rankings.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ranking,
      RankingHistory,
      Match,
      Enrollment,
      Tournament,
      CircuitLine,
    ]),
  ],
  controllers: [RankingsController],
  providers: [RankingsService],
  exports: [RankingsService],
})
export class RankingsModule {}
