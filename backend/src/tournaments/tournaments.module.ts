import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TournamentsService } from './tournaments.service';
import { TournamentsController } from './tournaments.controller';
import { Tournament } from './tournament.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Tournament])], // <--- ESTO ES LO MÁS IMPORTANTE
  controllers: [TournamentsController],
  providers: [TournamentsService],
})
export class TournamentsModule {}
