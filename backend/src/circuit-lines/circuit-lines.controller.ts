import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CircuitLinesService } from './circuit-lines.service';
import { CircuitRankingPoints } from './circuit-line.entity';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';

class CreateCircuitLineDto {
  slug: string;
  label: string;
  rankingPoints?: CircuitRankingPoints;
}

class UpdateCircuitLineDto {
  label?: string;
  rankingPoints?: CircuitRankingPoints;
}

@Controller('circuit-lines')
export class CircuitLinesController {
  constructor(private svc: CircuitLinesService) {}

  /** Public — needed to populate dropdowns */
  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  create(@Body() dto: CreateCircuitLineDto) {
    return this.svc.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCircuitLineDto) {
    return this.svc.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  /** Add a custom category to a circuit line (by slug) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':slug/categories')
  addCategory(@Param('slug') slug: string, @Body('category') category: string) {
    return this.svc.addCategory(slug, category);
  }

  /** Remove a custom category from a circuit line (by slug) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':slug/categories/:category')
  removeCategory(@Param('slug') slug: string, @Param('category') category: string) {
    return this.svc.removeCategory(slug, category);
  }
}
