// frontend/src/components/InscribirJugadorModal.tsx  ← REEMPLAZA COMPLETO
import { useState } from 'react';
import { UserPlus, X } from 'lucide-react';

// ── Formas de pago ────────────────────────────────────────────────────────────
export const PAYMENT_METHODS = [
  { value: 'manual',      label: '💵 Efectivo / Presencial', color: '#15803D', bg: '#F0FDF4', border: '#86EFAC',  desc: 'El jugador ya pagó en efectivo'         },
  { value: 'transfer',    label: '🏦 Transferencia',          color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE',  desc: 'Pagó por transferencia bancaria'        },
  { value: 'courtesy',    label: '🎁 Cortesía',               color: '#6B21A8', bg: '#F3E8FF', border: '#DDD6FE',  desc: 'Exento de pago (invitado/patrocinador)' },
  { value: 'reserved',    label: '⏳ Reservado',              color: '#92400E', bg: '#FEF3C7', border: '#FDE68A',  desc: 'Inscrito pero pago NO confirmado aún'   },
] as const;

export type PaymentMethodValue = typeof PAYMENT_METHODS[number]['value'];

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface InscribirJugadorModalProps {
  isOpen: boolean;
  tournamentId: string;
  categories: string[];
  onConfirm: (data: PlayerForm) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export interface PlayerForm {
  nombres: string; apellidos: string; email: string;
  telefono: string; docNumber: string; birthDate: string;
  gender: string; category: string;
  modality: 'singles' | 'doubles';
  seeding: string; ranking: string;
  paymentMethod: PaymentMethodValue;
  adminNotes: string;
}

const EMPTY_FORM: PlayerForm = {
  nombres: '', apellidos: '', email: '',
  telefono: '', docNumber: '', birthDate: '',
  gender: 'M', category: '',
  modality: 'singles', seeding: '', ranking: '',
  paymentMethod: 'manual',
  adminNotes: '',
};

// ─────────────────────────────────────────────────────────────────────────────
export default function InscribirJugadorModal({
  isOpen, categories, onConfirm, onCancel, isLoading, error,
}: InscribirJugadorModalProps) {
  const [form,       setForm]       = useState<PlayerForm>(EMPTY_FORM);
  const [localError, setLocalError] = useState('');

  if (!isOpen) return null;

  const set = (field: keyof PlayerForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setLocalError('');
  };

  const handleConfirm = () => {
    if (!form.nombres.trim() && !form.email.trim() && !form.docNumber.trim()) {
      setLocalError('Completa al menos nombre, correo o documento');
      return;
    }
    if (!form.category) {
      setLocalError('Selecciona la categoría');
      return;
    }
    onConfirm(form);
  };

  const handleCancel = () => {
    setForm(EMPTY_FORM);
    setLocalError('');
    onCancel();
  };

  const selectedPM = PAYMENT_METHODS.find(pm => pm.value === form.paymentMethod)!;
  const isReserved = form.paymentMethod === 'reserved';
  const displayError = localError || error;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={handleCancel}
    >
      <div
        style={{ backgroundColor: 'white', borderRadius: '18px', boxShadow: '0 30px 70px rgba(0,0,0,0.25)', width: '100%', maxWidth: '520px', margin: '0 16px', maxHeight: '94vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ background: 'linear-gradient(135deg, #1B3A1B, #2D6A2D)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '18px 18px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <UserPlus size={22} color="white" />
            <div>
              <h2 style={{ color: 'white', fontSize: '17px', fontWeight: '700', margin: 0 }}>Inscribir Jugador</h2>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: '2px 0 0' }}>
                {isReserved ? '⏳ Se guardará como Reservado' : '✓ Se guardará como Inscrito'}
              </p>
            </div>
          </div>
          <button onClick={handleCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* ── FORMA DE PAGO — lo primero, lo más importante ── */}
          <div>
            <label style={{ ...lbl, fontSize: '13px', marginBottom: '8px' }}>
              💳 Forma de pago <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {PAYMENT_METHODS.map(pm => (
                <button
                  key={pm.value}
                  type="button"
                  onClick={() => set('paymentMethod', pm.value)}
                  style={{
                    padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
                    border: `2px solid ${form.paymentMethod === pm.value ? pm.border : '#E5E7EB'}`,
                    backgroundColor: form.paymentMethod === pm.value ? pm.bg : 'white',
                    textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  <p style={{ fontSize: '12px', fontWeight: '700', color: form.paymentMethod === pm.value ? pm.color : '#374151', margin: 0 }}>
                    {pm.label}
                  </p>
                  <p style={{ fontSize: '10px', color: '#9CA3AF', margin: '2px 0 0' }}>{pm.desc}</p>
                </button>
              ))}
            </div>

            {/* Banner según la selección */}
            <div style={{
              marginTop: '10px', borderRadius: '8px', padding: '9px 13px',
              backgroundColor: selectedPM.bg, border: `1px solid ${selectedPM.border}`,
              fontSize: '12px', color: selectedPM.color, fontWeight: '600',
            }}>
              {isReserved
                ? '⚠️ El jugador quedará como RESERVADO. No aparecerá en el cuadro hasta que confirmes su pago, a menos que elijas incluir reservados al generar el draw.'
                : `✓ La inscripción quedará como APROBADA con pago: ${selectedPM.label}`
              }
            </div>
          </div>

          {/* ── Nombres y Apellidos ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={lbl}>Nombres</label>
              <input value={form.nombres} onChange={e => set('nombres', e.target.value)} placeholder="Ej: Carlos" style={inp} />
            </div>
            <div>
              <label style={lbl}>Apellidos</label>
              <input value={form.apellidos} onChange={e => set('apellidos', e.target.value)} placeholder="Ej: García" style={inp} />
            </div>
          </div>

          {/* ── Email ── */}
          <div>
            <label style={lbl}>Correo electrónico <span style={{ color: '#EF4444' }}>*</span></label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jugador@email.com" style={inp} />
          </div>

          {/* ── Teléfono + Documento ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={lbl}>Teléfono</label>
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="3001234567" style={inp} />
            </div>
            <div>
              <label style={lbl}>Documento</label>
              <input value={form.docNumber} onChange={e => set('docNumber', e.target.value)} placeholder="12345678" style={inp} />
            </div>
          </div>

          {/* ── Fecha nacimiento + Género ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={lbl}>Fecha de nacimiento</label>
              <input type="date" value={form.birthDate} onChange={e => set('birthDate', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Género</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)} style={inp}>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </div>
          </div>

          {/* ── Categoría + Modalidad ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={lbl}>Categoría <span style={{ color: '#EF4444' }}>*</span></label>
              <select value={form.category} onChange={e => set('category', e.target.value)} style={inp}>
                <option value="">Seleccionar...</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Modalidad</label>
              <select value={form.modality} onChange={e => set('modality', e.target.value as any)} style={inp}>
                <option value="singles">Singles</option>
                <option value="doubles">Dobles</option>
              </select>
            </div>
          </div>

          {/* ── Siembra + Ranking previo ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={lbl}>Siembra <span style={{ color: '#9CA3AF', fontWeight: '400' }}>(opcional)</span></label>
              <input type="number" min={1} value={form.seeding} onChange={e => set('seeding', e.target.value)} placeholder="Ej: 1" style={inp} />
            </div>
            <div>
              <label style={lbl}>Ranking previo <span style={{ color: '#9CA3AF', fontWeight: '400' }}>(opcional)</span></label>
              <input type="number" min={0} value={form.ranking} onChange={e => set('ranking', e.target.value)} placeholder="Ej: 125" style={inp} />
            </div>
          </div>

          {/* ── Notas del admin ── */}
          <div>
            <label style={lbl}>Notas internas <span style={{ color: '#9CA3AF', fontWeight: '400' }}>(opcional)</span></label>
            <input
              value={form.adminNotes}
              onChange={e => set('adminNotes', e.target.value)}
              placeholder={isReserved ? 'Ej: Pago pendiente hasta el viernes 14' : 'Ej: Jugador invitado especial'}
              style={inp}
            />
          </div>

          {/* ── Error ── */}
          {displayError && (
            <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px' }}>
              <p style={{ fontSize: '13px', color: '#DC2626', margin: 0 }}>⚠️ {displayError}</p>
            </div>
          )}

          {/* ── Botones ── */}
          <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
            <button onClick={handleCancel} style={cancelBtn}>Cancelar</button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              style={{
                flex: 2, padding: '11px', borderRadius: '10px', border: 'none',
                background: isReserved
                  ? 'linear-gradient(135deg, #92400E, #B45309)'
                  : 'linear-gradient(135deg, #2D6A2D, #1B3A1B)',
                color: 'white', fontWeight: '700', fontSize: '14px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                boxShadow: isReserved
                  ? '0 4px 14px rgba(146,64,14,0.3)'
                  : '0 4px 14px rgba(27,58,27,0.3)',
              }}
            >
              {isLoading
                ? 'Inscribiendo...'
                : isReserved
                  ? '⏳ Guardar como Reservado'
                  : '✓ Inscribir Jugador'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────────
const lbl: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '13px', color: '#111827', backgroundColor: 'white', boxSizing: 'border-box' };
const cancelBtn: React.CSSProperties = { flex: 1, padding: '11px', borderRadius: '10px', border: '1.5px solid #E5E7EB', backgroundColor: 'white', color: '#374151', fontWeight: '600', fontSize: '14px', cursor: 'pointer' };