// frontend/src/components/InscribirJugadorModal.tsx
// Modal para inscribir un jugador individual a singles
// Mismo patrón que el formulario de nuevo jugador en Doubles.tsx

import { useState } from 'react';
import { UserPlus, X } from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────────────────
interface InscribirJugadorModalProps {
  isOpen: boolean;
  tournamentId: string;
  categories: string[];           // Categorías disponibles del torneo
  onConfirm: (data: PlayerForm) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string;
}

export interface PlayerForm {
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string;
  docNumber: string;
  birthDate: string;
  gender: string;
  category: string;
  modality: 'singles' | 'doubles';
  seeding: string;
  ranking: string;
}

const EMPTY_FORM: PlayerForm = {
  nombres: '', apellidos: '', email: '',
  telefono: '', docNumber: '', birthDate: '',
  gender: 'M', category: '',
  modality: 'singles', seeding: '', ranking: '',
};

// ── Componente ─────────────────────────────────────────────────────────────
export default function InscribirJugadorModal({
  isOpen, categories, onConfirm, onCancel, isLoading, error,
}: InscribirJugadorModalProps) {
  const [form, setForm] = useState<PlayerForm>(EMPTY_FORM);
  const [localError, setLocalError] = useState('');

  if (!isOpen) return null;

  const set = (field: keyof PlayerForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setLocalError('');
  };

  const handleConfirm = () => {
    if (!form.nombres.trim() && !form.email.trim() && !form.docNumber.trim()) {
      setLocalError('Completa al menos nombre completo o correo o documento');
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

  const displayError = localError || error;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          backgroundColor: 'white', borderRadius: '18px',
          boxShadow: '0 30px 70px rgba(0,0,0,0.25)',
          width: '100%', maxWidth: '480px',
          margin: '0 16px', maxHeight: '92vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{
          background: 'linear-gradient(135deg, #1B3A1B, #2D6A2D)',
          padding: '20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <UserPlus size={22} color="white" />
            <div>
              <h2 style={{ color: 'white', fontSize: '17px', fontWeight: '700', margin: 0 }}>
                Inscribir Jugador
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: '2px 0 0' }}>
                Inscripción manual · Pago presencial
              </p>
            </div>
          </div>
          <button onClick={handleCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* ── Nota informativa ── */}
          <div style={{
            backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE',
            borderRadius: '10px', padding: '10px 14px',
            fontSize: '12px', color: '#1D4ED8',
          }}>
            💡 Si el jugador ya existe en el sistema se usará su cuenta existente.
            El estado de inscripción quedará como <strong>Aprobado (pago manual)</strong>.
          </div>

          {/* ── Nombres y Apellidos ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={lbl}>Nombres</label>
              <input value={form.nombres} onChange={e => set('nombres', e.target.value)}
                placeholder="Ej: Carlos" style={inp} />
            </div>
            <div>
              <label style={lbl}>Apellidos</label>
              <input value={form.apellidos} onChange={e => set('apellidos', e.target.value)}
                placeholder="Ej: García Ruiz" style={inp} />
            </div>
          </div>

          {/* ── Email ── */}
          <div>
            <label style={lbl}>
              Correo electrónico <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="jugador@email.com" style={inp} />
          </div>

          {/* ── Teléfono + Documento ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={lbl}>Teléfono</label>
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)}
                placeholder="3001234567" style={inp} />
            </div>
            <div>
              <label style={lbl}>Documento</label>
              <input value={form.docNumber} onChange={e => set('docNumber', e.target.value)}
                placeholder="CC 12345678" style={inp} />
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
              <label style={lbl}>
                Categoría <span style={{ color: '#EF4444' }}>*</span>
              </label>
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
              <label style={lbl}>
                Siembra <span style={{ color: '#9CA3AF', fontWeight: '400' }}>(opcional)</span>
              </label>
              <input type="number" min={1} value={form.seeding}
                onChange={e => set('seeding', e.target.value)}
                placeholder="Ej: 1" style={inp} />
            </div>
            <div>
              <label style={lbl}>
                Ranking previo <span style={{ color: '#9CA3AF', fontWeight: '400' }}>(opcional)</span>
              </label>
              <input type="number" min={0} value={form.ranking}
                onChange={e => set('ranking', e.target.value)}
                placeholder="Ej: 125" style={inp} />
            </div>
          </div>

          {/* ── Error ── */}
          {displayError && (
            <div style={{
              backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: '8px', padding: '10px 14px',
            }}>
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
                ...confirmBtn,
                opacity: isLoading ? 0.7 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? 'Inscribiendo...' : '✓ Inscribir Jugador'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '12px',
  fontWeight: '600', color: '#374151', marginBottom: '5px',
};
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  border: '1.5px solid #D1D5DB', fontSize: '13px',
  color: '#111827', backgroundColor: 'white', boxSizing: 'border-box',
};
const cancelBtn: React.CSSProperties = {
  flex: 1, padding: '11px', borderRadius: '10px',
  border: '1.5px solid #E5E7EB', backgroundColor: 'white',
  color: '#374151', fontWeight: '600', fontSize: '14px', cursor: 'pointer',
};
const confirmBtn: React.CSSProperties = {
  flex: 2, padding: '11px', borderRadius: '10px', border: 'none',
  background: 'linear-gradient(135deg, #2D6A2D, #1B3A1B)',
  color: 'white', fontWeight: '700', fontSize: '14px',
  boxShadow: '0 4px 14px rgba(27,58,27,0.3)',
};
