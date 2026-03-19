import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CircuitLine } from './circuit-line.entity';
import { CircuitLinesService } from './circuit-lines.service';
import { CircuitLinesController } from './circuit-lines.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CircuitLine])],
  controllers: [CircuitLinesController],
  providers: [CircuitLinesService],
  exports: [CircuitLinesService],
})
export class CircuitLinesModule {}
