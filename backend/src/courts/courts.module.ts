import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Court } from './court.entity';
import { CourtSchedule } from './court-schedule.entity';
import { CourtsService } from './courts.service';
import { CourtsController } from './courts.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Court, CourtSchedule]),
  ],
  controllers: [CourtsController],
  providers: [CourtsService],
  exports: [CourtsService],
})
export class CourtsModule {}