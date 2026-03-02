import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentStatus } from './payment.entity';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import MercadoPagoConfig, { Preference } from 'mercadopago';

@Injectable()
export class PaymentsService {
  private mpClient: MercadoPagoConfig;

  constructor(
    @InjectRepository(Payment)
    private repo: Repository<Payment>,
    private enrollmentsService: EnrollmentsService,
    private config: ConfigService,
  ) {
    // Inicializar cliente de Mercado Pago con el token del .env
    this.mpClient = new MercadoPagoConfig({
      accessToken: this.config.get('MP_ACCESS_TOKEN'),
    });
  }

  // ── CREAR PREFERENCIA DE PAGO ───────────────────
  async createPreference(enrollmentId: string, amount: number, playerName: string) {
    const frontendUrl = this.config.get(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const backendUrl = this.config.get('BACKEND_URL', 'http://localhost:3000');

    try {
      const preference = new Preference(this.mpClient);
      const response = await preference.create({
        body: {
          items: [
            {
              id: enrollmentId,
              title: `Inscripción Torneo LAT - ${playerName}`,
              quantity: 1,
              unit_price: amount,
              currency_id: 'COP',
            },
          ],
          back_urls: {
            success: `${frontendUrl}/payment/success`,
            failure: `${frontendUrl}/payment/failure`,
            pending: `${frontendUrl}/payment/pending`,
          },
          // auto_return solo funciona con URLs HTTPS públicas — omitir en desarrollo
          notification_url: `${backendUrl}/payments/webhook`,
          external_reference: enrollmentId,
        },
      });

      const payment = this.repo.create({
        enrollmentId,
        mpPreferenceId: response.id,
        amount,
        status: PaymentStatus.PENDING,
      });
      await this.repo.save(payment);

      return {
        preferenceId: response.id,
        initPoint: response.init_point,
      };
    } catch {
      throw new BadRequestException(
        'No se pudo generar el link de pago. Intenta nuevamente.',
      );
    }
  }

  // ── WEBHOOK DE MERCADO PAGO ─────────────────────
  // MP llama a este endpoint cuando el pago cambia de estado
  async handleWebhook(body: any) {
    if (body.type !== 'payment') return { ok: true };

    const mpPaymentId = body.data?.id;
    if (!mpPaymentId) return { ok: true };

    // Buscar el pago en nuestra BD por el ID de preferencia
    const payment = await this.repo.findOne({
      where: { mpPreferenceId: body.data?.metadata?.preference_id },
    });

    if (!payment) return { ok: true };

    // Actualizar estado según lo que diga Mercado Pago
    if (body.action === 'payment.updated') {
      const status = body.data?.status;

      if (status === 'approved') {
        payment.status = PaymentStatus.APPROVED;
        payment.mpPaymentId = String(mpPaymentId);
        payment.paidAt = new Date();
        await this.repo.save(payment);

        // Aprobar la inscripción asociada
        await this.enrollmentsService.approve(
          payment.enrollmentId,
          String(mpPaymentId),
        );
      }

      if (status === 'rejected') {
        payment.status = PaymentStatus.REJECTED;
        await this.repo.save(payment);
        await this.enrollmentsService.reject(payment.enrollmentId);
      }
    }

    return { ok: true };
  }

  // ── LISTAR PAGOS POR TORNEO ─────────────────────
  async findByTournament(tournamentId: string) {
    return this.repo
      .createQueryBuilder('payment')
      .innerJoin('enrollments', 'e', 'e.id = payment.enrollmentId')
      .where('e.tournamentId = :tournamentId', { tournamentId })
      .getMany();
  }

  // ── RESUMEN DE RECAUDO ──────────────────────────
  async getSummary(tournamentId: string) {
    const payments = await this.findByTournament(tournamentId);
    const approved = payments.filter(p => p.status === PaymentStatus.APPROVED);
    const total = approved.reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      total,
      approved: approved.length,
      pending: payments.filter(p => p.status === PaymentStatus.PENDING).length,
      rejected: payments.filter(p => p.status === PaymentStatus.REJECTED).length,
    };
  }
}
