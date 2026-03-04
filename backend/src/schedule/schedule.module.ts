import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match } from '../matches/match.entity';
import { Court } from '../courts/court.entity';
import { CourtSchedule } from '../courts/court-schedule.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { User } from '../users/user.entity';
import { DrawService } from './draw.service';
import { SchedulingService } from './scheduling.service';
import { ScheduleController } from './schedule.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Match, Court, CourtSchedule, Enrollment, User]),
  ],
  controllers: [ScheduleController],
  providers: [DrawService, SchedulingService],
  exports: [DrawService, SchedulingService],
})
export class ScheduleModule {}