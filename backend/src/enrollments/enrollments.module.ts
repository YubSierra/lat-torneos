import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Enrollment } from './enrollment.entity';
import { User } from '../users/user.entity';
import { EnrollmentsService } from './enrollments.service';
import { EnrollmentsController } from './enrollments.controller';
import { TournamentsModule } from '../tournaments/tournaments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Enrollment, User]),
    MulterModule.register({ storage: undefined }),
    TournamentsModule,
  ],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}