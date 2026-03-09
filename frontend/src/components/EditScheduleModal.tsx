// frontend/src/components/EditScheduleModal.tsx
// Modal para reprogramar un partido ya programado (o del preview)
// Permite cambiar: fecha, hora, cancha, duración y agregar nota

import { useState, useEffect } from 'react';
import { Clock, MapPin, Calendar, FileText, AlertTriangle } from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Court {
  id: string;
  name: string;
  sede: string;
  surface?: string;
}

interface ScheduledMatch {
  matchId: string;
  player1: string;
  player2: string;
  round: string;
  category: string;
  time: string;       // "09:00"
  date: string;       // "2025-07-15"
  court: string;      // nombre de la cancha
  courtId?: string;
  sede: string;
  duration: string;   // "90 min"
}

interface EditScheduleModalProps {
  isOpen: boolean;
  match: ScheduledMatch | null;
  courts: Court[];
  onConfirm: (matchId: string, data: {
    scheduledAt: string;
    courtId?: string;
    estimatedDuration?: number;
    notes?: string;
  }) => void;
  onCancel: () => void;
}

const ROUND_LABELS: Record<string, string> = {
  R64: 'R64', R32: 'R32', R16: 'R16',
  QF: 'Cuartos', SF: 'Semifinal', F: 'Final',
  RR: 'Round Robin', RR_A: 'Grupo A', RR_B: 'Grupo B',
};

const DURATIONS = [
  { label: '60 min', value: 60 },
  { label: '75 min', value: 75 },
  { label: '90 min', value: 90 },
  { label: '120 min', value: 120 },
  { label: '150 min', value: 150 },
];

// ── Componente ─────────────────────────────────────────────────────────────
export default function EditScheduleModal({
  isOpen, match, courts, onConfirm, onCancel,
}: EditScheduleModalProps) {

  const [date, setDate]           = useState('');
  const [time, setTime]           = useState('');
  const [courtId, setCourtId]     = useState('');
  const [duration, setDuration]   = useState(90);
  const [notes, setNotes]         = useState('');
  const [error, setError]         = useState('');

  // Inicializar con los valores actuales del partido
  useEffect(() => {
    if (match) {
      setDate(match.date || '');
      setTime(match.time || '');
      setDuration(parseInt(match.duration) || 90);
      setCourtId(match.courtId || '');
      setNotes('');
      setError('');
    }
  }, [match]);

  if (!isOpen || !match) return null;

  const handleConfirm = () => {
    if (!date) { setError('Selecciona una fecha'); return; }
    if (!time) { setError('Selecciona una hora'); return; }

    const scheduledAt = `${date}T${time}:00`;

    onConfirm(match.matchId, {
      scheduledAt,
      courtId: courtId || undefined,
      estimatedDuration: duration,
      notes: notes || undefined,
    });
  };

  // Agrupar canchas por sede
  const sedeMap: Record<string, Court[]> = {};
  courts.forEach(c => {
    const s = c.sede || 'Principal';
    if (!sedeMap[s]) sedeMap[s] = [];
    sedeMap[s].push(c);
  });

  const surfaceIcon = (surface?: string) =>
    surface === 'clay' ? '🟤' : surface === 'hard' ? '🔵' : '🟢';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: 'white', borderRadius: '18px',
          boxShadow: '0 30px 70px rgba(0,0,0,0.25)',
          width: '100%', maxWidth: '500px',
          margin: '0 16px', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{
          background: 'linear-gradient(135deg, #1B3A1B, #2D6A2D)',
          padding: '20px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span style={{ fontSize: '26px' }}>📅</span>
            <div>
              <h2 style={{ color: 'white', fontSize: '17px', fontWeight: '700', margin: 0 }}>
                Reprogramar Partido
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: 0 }}>
                {ROUND_LABELS[match.round] ?? match.round} · {match.category}
              </p>
            </div>
          </div>

          {/* Jugadores */}
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderRadius: '10px', padding: '10px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>
              {match.player1}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: '700' }}>VS</span>
            <span style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>
              {match.player2}
            </span>
          </div>

          {/* Info actual */}
          <div style={{
            display: 'flex', gap: '16px', marginTop: '10px',
            fontSize: '12px', color: 'rgba(255,255,255,0.65)',
          }}>
            <span>⏰ Actual: {match.time}</span>
            <span>🏟️ {match.court} · {match.sede}</span>
            <span>⏱ {match.duration}</span>
          </div>
        </div>

        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* ── Fecha y Hora ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>
                <Calendar size={13} style={{ display: 'inline', marginRight: '5px' }} />
                Nueva Fecha
              </label>
              <input
                type="date"
                value={date}
                onChange={e => { setDate(e.target.value); setError(''); }}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                <Clock size={13} style={{ display: 'inline', marginRight: '5px' }} />
                Nueva Hora
              </label>
              <input
                type="time"
                value={time}
                onChange={e => { setTime(e.target.value); setError(''); }}
                style={inputStyle}
              />
            </div>
          </div>

          {/* ── Cancha ── */}
          <div>
            <label style={labelStyle}>
              <MapPin size={13} style={{ display: 'inline', marginRight: '5px' }} />
              Cancha
            </label>
            <select
              value={courtId}
              onChange={e => setCourtId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Mantener cancha actual ({match.court})</option>
              {Object.entries(sedeMap).map(([sede, sédeCourts]) => (
                <optgroup key={sede} label={`📍 Sede ${sede}`}>
                  {sédeCourts.map(c => (
                    <option key={c.id} value={c.id}>
                      {surfaceIcon(c.surface)} {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* ── Duración ── */}
          <div>
            <label style={labelStyle}>⏱ Duración estimada</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {DURATIONS.map(d => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  style={{
                    padding: '6px 12px', borderRadius: '8px', fontSize: '12px',
                    border: duration === d.value ? '2px solid #2D6A2D' : '2px solid #E5E7EB',
                    backgroundColor: duration === d.value ? '#F0FDF4' : 'white',
                    color: duration === d.value ? '#166534' : '#374151',
                    cursor: 'pointer', fontWeight: duration === d.value ? '700' : '400',
                    transition: 'all 0.12s',
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Notas / Motivo ── */}
          <div>
            <label style={labelStyle}>
              <FileText size={13} style={{ display: 'inline', marginRight: '5px' }} />
              Motivo del cambio <span style={{ color: '#9CA3AF', fontWeight: '400' }}>(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Solicitud del jugador — viaje, lesión menor, conflicto de horario..."
              rows={2}
              style={{
                ...inputStyle,
                resize: 'none',
                lineHeight: '1.5',
              }}
            />
          </div>

          {/* ── Error ── */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: '8px', padding: '10px 14px',
            }}>
              <AlertTriangle size={14} color="#DC2626" />
              <p style={{ fontSize: '13px', color: '#DC2626', margin: 0 }}>{error}</p>
            </div>
          )}

          {/* ── Botones ── */}
          <div style={{ display: 'flex', gap: '10px', paddingTop: '2px' }}>
            <button onClick={onCancel} style={cancelBtnStyle}>
              Cancelar
            </button>
            <button onClick={handleConfirm} style={confirmBtnStyle}>
              ✓ Aplicar Cambio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Estilos reutilizables ──────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px', fontWeight: '600', color: '#4B5563',
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  borderRadius: '8px', border: '1.5px solid #D1D5DB',
  fontSize: '13px', color: '#111827',
  backgroundColor: 'white', outline: 'none',
  boxSizing: 'border-box',
};

const cancelBtnStyle: React.CSSProperties = {
  flex: 1, padding: '11px', borderRadius: '10px',
  border: '1.5px solid #E5E7EB', backgroundColor: 'white',
  color: '#374151', fontWeight: '600', fontSize: '14px',
  cursor: 'pointer',
};

const confirmBtnStyle: React.CSSProperties = {
  flex: 2, padding: '11px', borderRadius: '10px',
  border: 'none',
  background: 'linear-gradient(135deg, #2D6A2D, #1B3A1B)',
  color: 'white', fontWeight: '700', fontSize: '14px',
  cursor: 'pointer',
  boxShadow: '0 4px 14px rgba(27,58,27,0.3)',
};
