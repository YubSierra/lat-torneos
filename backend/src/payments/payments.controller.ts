import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  // POST /payments/preference
  // Genera el link de pago en Mercado Pago
  @Post('preference')
  @UseGuards(JwtAuthGuard)
  createPreference(@Body() body: {
    enrollmentId: string;
    amount: number;
    playerName: string;
  }) {
    return this.paymentsService.createPreference(
      body.enrollmentId,
      body.amount,
      body.playerName,
    );
  }

  // POST /payments/webhook
  // Mercado Pago llama aquí cuando el pago cambia de estado
  // No requiere autenticación — lo llama MP directamente
  @Post('webhook')
  handleWebhook(@Body() body: any) {
    return this.paymentsService.handleWebhook(body);
  }

  // GET /payments/tournament/:id/summary
  // Resumen de recaudo de un torneo (solo admins)
  @Get('tournament/:id/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  getSummary(@Param('id') id: string) {
    return this.paymentsService.getSummary(id);
  }

  // GET /payments/tournament/:id
  // Lista todos los pagos de un torneo (solo admins)
  @Get('tournament/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  findByTournament(@Param('id') id: string) {
    return this.paymentsService.findByTournament(id);
  }
}
