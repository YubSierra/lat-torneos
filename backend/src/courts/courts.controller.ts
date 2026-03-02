import { Controller, Get, Post, Patch,
         Body, Param, UseGuards } from '@nestjs/common';
import { CourtsService } from './courts.service';
import { CreateCourtDto } from './dto/create-court.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('courts')
export class CourtsController {
  constructor(private courtsService: CourtsService) {}

  // GET /courts — listar todas las canchas (público)
  @Get()
  findAll() {
    return this.courtsService.findAll();
  }

  // GET /courts/:id — ver una cancha
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.courtsService.findOne(id);
  }

  // POST /courts — crear cancha (solo admins)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  create(@Body() dto: CreateCourtDto) {
    return this.courtsService.create(dto);
  }

  // PATCH /courts/:id — actualizar cancha (solo admins)
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateCourtDto>,
  ) {
    return this.courtsService.update(id, dto);
  }

  // PATCH /courts/:id/deactivate — desactivar cancha
  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  deactivate(@Param('id') id: string) {
    return this.courtsService.deactivate(id);
  }
}
