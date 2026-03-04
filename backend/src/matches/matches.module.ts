import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match } from './match.entity';
import { User } from '../users/user.entity';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { MatchesGateway } from './matches.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Match, User]),
  ],
  controllers: [MatchesController],
  providers: [MatchesService, MatchesGateway],
  exports: [MatchesService],
})
export class MatchesModule {}