// frontend/src/components/CambiarPagoModal.tsx  ← ARCHIVO NUEVO
import { useState } from 'react';
import { X, CreditCard } from 'lucide-react';

// ── Opciones de pago disponibles ─────────────────────────────────────────────
const PAYMENT_OPTIONS = [
  { value: 'manual',      label: '💵 Efectivo',       desc: 'Pagó en efectivo presencialmente',  color: '#15803D', bg: '#F0FDF4', border: '#86EFAC'  },
  { value: 'transfer',    label: '🏦 Transferencia',   desc: 'Pagó por transferencia bancaria',    color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE'  },
  { value: 'courtesy',    label: '🎁 Cortesía',        desc: 'Exento de pago (invitado/sponsor)',  color: '#6B21A8', bg: '#F3E8FF', border: '#DDD6FE'  },
  { value: 'mercadopago', label: '💳 MercadoPago',     desc: 'Confirmar pago recibido por MP',     color: '#009EE3', bg: '#E0F3FF', border: '#7DD3FC'  },
  { value: 'reserved',    label: '⏳ Mantener Reservado', desc: 'Aún no ha pagado',               color: '#92400E', bg: '#FEF3C7', border: '#FDE68A'  },
] as const;

type PaymentValue = typeof PAYMENT_OPTIONS[number]['value'];

interface CambiarPagoModalProps {
  isOpen:      boolean;
  enrollment:  { id: string; playerName: string; category: string; status: string; paymentMethod?: string; adminNotes?: string } | null;
  onConfirm:   (enrollmentId: string, paymentMethod: PaymentValue, adminNotes: string) => void;
  onCancel:    () => void;
  isLoading?:  boolean;
}

export default function CambiarPagoModal({
  isOpen, enrollment, onConfirm, onCancel, isLoading,
}: CambiarPagoModalProps) {
  const [selected,    setSelected]    = useState<PaymentValue>('manual');
  const [adminNotes,  setAdminNotes]  = useState('');

  // Sincroniza el estado inicial cada vez que se abre con un enrollment diferente
  const currentPM = enrollment?.paymentMethod as PaymentValue ?? 'manual';

  if (!isOpen || !enrollment) return null;

  const opt = PAYMENT_OPTIONS.find(o => o.value === selected)!;

  const handleOpen = () => {
    setSelected(currentPM);
    setAdminNotes(enrollment.adminNotes || '');
  };

  const handleConfirm = () => {
    onConfirm(enrollment.id, selected, adminNotes);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 24px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: '440px', margin: '0 16px' }}
        onClick={e => e.stopPropagation()}
        ref={() => handleOpen()}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1B3A1B, #2D6A2D)', padding: '18px 22px', borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CreditCard size={20} color="white" />
            <div>
              <p style={{ color: 'white', fontWeight: '700', fontSize: '15px', margin: 0 }}>Cambiar forma de pago</p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: '2px 0 0' }}>{enrollment.playerName} · {enrollment.category}</p>
            </div>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Estado actual */}
          <div style={{ backgroundColor: '#F9FAFB', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#6B7280' }}>
            Estado actual: <strong style={{ color: '#374151' }}>{enrollment.paymentMethod || enrollment.status}</strong>
          </div>

          {/* Opciones */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {PAYMENT_OPTIONS.map(op => (
              <button
                key={op.value}
                onClick={() => setSelected(op.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '11px 14px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                  border: `2px solid ${selected === op.value ? op.border : '#E5E7EB'}`,
                  backgroundColor: selected === op.value ? op.bg : 'white',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: selected === op.value ? op.color : '#374151', margin: 0 }}>{op.label}</p>
                  <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '2px 0 0' }}>{op.desc}</p>
                </div>
                {selected === op.value && (
                  <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: op.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: 'white', fontSize: '11px', fontWeight: '900' }}>✓</span>
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Banner resumen */}
          <div style={{ backgroundColor: opt.bg, border: `1px solid ${opt.border}`, borderRadius: '8px', padding: '9px 13px', fontSize: '12px', color: opt.color, fontWeight: '600' }}>
            {selected === 'reserved'
              ? '⚠️ La inscripción permanecerá como Reservada. El jugador verá un pendiente de pago en su perfil.'
              : `✓ La inscripción quedará como APROBADA con pago: ${opt.label}`
            }
          </div>

          {/* Notas */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>
              Notas internas <span style={{ color: '#9CA3AF', fontWeight: '400' }}>(opcional)</span>
            </label>
            <input
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              placeholder="Ej: Pagó el viernes 14 en recepción"
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
            <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #E5E7EB', backgroundColor: 'white', color: '#374151', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              style={{ flex: 2, padding: '10px', borderRadius: '10px', border: 'none', background: selected === 'reserved' ? 'linear-gradient(135deg, #92400E, #B45309)' : 'linear-gradient(135deg, #2D6A2D, #1B3A1B)', color: 'white', fontWeight: '700', fontSize: '13px', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1 }}
            >
              {isLoading ? 'Guardando...' : '✓ Confirmar cambio'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}