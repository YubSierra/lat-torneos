import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoublesTeam } from './doubles-team.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { Tournament } from '../tournaments/tournament.entity';
import { User } from '../users/user.entity';
import { DoublesService } from './doubles.service';
import { DoublesController } from './doubles.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DoublesTeam, Enrollment, Tournament, User]),
  ],
  controllers: [DoublesController],
  providers: [DoublesService],
  exports: [DoublesService],
})
export class DoublesModule {}
