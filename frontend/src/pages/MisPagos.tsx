// frontend/src/pages/MisPagos.tsx  ← ARCHIVO NUEVO
// El jugador ve sus inscripciones reservadas/pendientes y puede pagar por MP
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CreditCard, ExternalLink, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import api     from '../api/axios';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
export default function MisPagos() {
  const { role } = useAuth();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [mpLink,   setMpLink]   = useState<string | null>(null);

  // ── Obtener inscripciones pendientes del jugador logueado ─────────────────
  const { data: pending = [], isLoading, refetch } = useQuery({
    queryKey: ['my-pending'],
    queryFn: async () => {
      const res = await api.get('/enrollments/my/pending');
      return res.data;
    },
  });

  // ── Generar preferencia de MercadoPago ───────────────────────────────────
  const payMutation = useMutation({
    mutationFn: async (enrollment: any) => {
      const res = await api.post('/payments/preference', {
        enrollmentId: enrollment.id,
        amount:       enrollment.inscriptionValue,
        playerName:   enrollment.playerName || 'Jugador',
      });
      return res.data; // { checkoutUrl, preferenceId }
    },
    onSuccess: (data) => {
      // Abre MP en nueva pestaña
      if (data.checkoutUrl) {
        setMpLink(data.checkoutUrl);
        window.open(data.checkoutUrl, '_blank');
      }
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-lat-bg">
        <Sidebar />
        <main className="flex-1 p-8">
          <p className="text-gray-400 text-center py-12">Cargando tus pagos...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />

      <main className="flex-1 p-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-lat-dark" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CreditCard size={24} color="#2D6A2D" /> Mis Pagos Pendientes
          </h1>
          <p className="text-gray-500 mt-1">Inscripciones que tienes reservadas con pago por confirmar</p>
        </div>

        {pending.length === 0 ? (
          /* Sin pendientes */
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '48px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <CheckCircle size={48} color="#22C55E" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: '18px', fontWeight: '700', color: '#1B3A1B' }}>¡Todo al día!</p>
            <p style={{ color: '#9CA3AF', marginTop: '6px' }}>No tienes inscripciones con pago pendiente.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Banner informativo */}
            <div style={{ backgroundColor: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: '12px', padding: '14px 18px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <AlertCircle size={20} color="#B45309" style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                <p style={{ fontWeight: '700', color: '#92400E', fontSize: '14px', margin: 0 }}>Tienes {pending.length} inscripción{pending.length > 1 ? 'es' : ''} con pago pendiente</p>
                <p style={{ color: '#B45309', fontSize: '12px', margin: '3px 0 0' }}>
                  Tu cupo está reservado. Confirma tu pago antes del inicio del torneo para asegurar tu participación.
                </p>
              </div>
            </div>

            {/* Tarjetas de inscripción */}
            {(pending as any[]).map((e: any) => (
              <div key={e.id} style={{ backgroundColor: 'white', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden', border: '1.5px solid #FEF3C7' }}>

                {/* Top: nombre torneo */}
                <div style={{ background: 'linear-gradient(135deg, #1B3A1B, #2D6A2D)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ color: 'white', fontWeight: '700', fontSize: '15px', margin: 0 }}>{e.tournamentName}</p>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: '3px 0 0' }}>
                      🗓 Inicio: {formatDate(e.tournamentStart)}
                    </p>
                  </div>
                  <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Clock size={13} /> Reservado
                  </span>
                </div>

                {/* Body: detalles */}
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 3px' }}>Categoría</p>
                      <span style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '700' }}>
                        {e.category}
                      </span>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 3px' }}>Modalidad</p>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: '#374151', margin: 0 }}>{e.modality || 'Singles'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 3px' }}>Valor a pagar</p>
                      <p style={{ fontSize: '16px', fontWeight: '800', color: '#1B3A1B', margin: 0 }}>
                        {e.inscriptionValue ? formatCOP(e.inscriptionValue) : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Notas del admin */}
                  {e.adminNotes && (
                    <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '9px 13px', marginBottom: '14px', fontSize: '12px', color: '#92400E' }}>
                      📝 Nota del organizador: <em>{e.adminNotes}</em>
                    </div>
                  )}

                  {/* Botón pagar */}
                  <button
                    onClick={() => {
                      setPayingId(e.id);
                      payMutation.mutate(e, { onSettled: () => setPayingId(null) });
                    }}
                    disabled={payMutation.isPending && payingId === e.id}
                    style={{
                      width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
                      background: 'linear-gradient(135deg, #009EE3, #0073B7)',
                      color: 'white', fontWeight: '700', fontSize: '14px',
                      cursor: payMutation.isPending && payingId === e.id ? 'not-allowed' : 'pointer',
                      opacity: payMutation.isPending && payingId === e.id ? 0.7 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}
                  >
                    {payMutation.isPending && payingId === e.id
                      ? 'Generando link de pago...'
                      : (
                        <>
                          <CreditCard size={17} />
                          Pagar con MercadoPago{e.inscriptionValue ? ` — ${formatCOP(e.inscriptionValue)}` : ''}
                          <ExternalLink size={14} />
                        </>
                      )
                    }
                  </button>

                  {/* Enlace directo si ya se generó */}
                  {mpLink && payingId === null && (
                    <div style={{ marginTop: '10px', textAlign: 'center' }}>
                      <a href={mpLink} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#009EE3', textDecoration: 'underline' }}>
                        ¿No se abrió? Haz clic aquí para ir a MercadoPago →
                      </a>
                    </div>
                  )}

                  {/* Error */}
                  {payMutation.isError && payingId === null && (
                    <p style={{ fontSize: '12px', color: '#DC2626', textAlign: 'center', marginTop: '8px' }}>
                      ⚠️ No se pudo generar el link de pago. Intenta de nuevo o contacta al organizador.
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Nota final */}
            <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', padding: '8px 0' }}>
              💡 Si ya realizaste el pago por otro medio, contacta al organizador del torneo para que confirme tu inscripción.
            </p>

          </div>
        )}
      </main>
    </div>
  );
}