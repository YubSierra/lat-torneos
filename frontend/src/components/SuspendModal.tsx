// frontend/src/components/SuspendModal.tsx
// Modal para suspender un partido individual o toda una jornada
import { useState } from 'react';
import { CloudRain, X, AlertTriangle } from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────────────────
export type SuspendMode = 'match' | 'day';

interface SuspendModalProps {
  isOpen: boolean;
  mode: SuspendMode;
  // Datos del partido (modo 'match')
  match?: {
    id: string;
    player1Name: string;
    player2Name: string;
    round: string;
    category: string;
    sets1?: number;
    sets2?: number;
    games1?: number;
    games2?: number;
  };
  // Datos de la jornada (modo 'day')
  date?: string;
  matchCount?: number;
  tournamentId?: string;
  onConfirm: (reason: string, resumeDate?: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const SUSPEND_REASONS = [
  { value: 'rain',      label: '🌧️ Lluvia' },
  { value: 'darkness',  label: '🌑 Oscuridad' },
  { value: 'court',     label: '🏟️ Problemas con la cancha' },
  { value: 'injury',    label: '🩹 Lesión de jugador' },
  { value: 'weather',   label: '⛈️ Condiciones climáticas' },
  { value: 'emergency', label: '🚨 Fuerza mayor' },
  { value: 'other',     label: '📝 Otro motivo' },
];

const ROUND_LABELS: Record<string, string> = {
  R64: 'R64', R32: 'R32', R16: 'R16',
  QF: 'Cuartos', SF: 'Semifinal', F: 'Final',
  RR: 'Round Robin', RR_A: 'Grupo A', RR_B: 'Grupo B',
};

// ── Componente ─────────────────────────────────────────────────────────────
export default function SuspendModal({
  isOpen, mode, match, date, matchCount,
  onConfirm, onCancel, isLoading,
}: SuspendModalProps) {
  const [reasonKey, setReasonKey]   = useState('rain');
  const [customReason, setCustomReason] = useState('');
  const [resumeDate, setResumeDate] = useState('');
  const [resumeTime, setResumeTime] = useState('');

  if (!isOpen) return null;

  const finalReason = reasonKey === 'other'
    ? (customReason.trim() || 'Motivo no especificado')
    : SUSPEND_REASONS.find(r => r.value === reasonKey)?.label || reasonKey;

  const resumeDateTime = resumeDate
    ? `${resumeDate}T${resumeTime || '08:00'}:00`
    : undefined;

  const handleConfirm = () => {
    onConfirm(finalReason, resumeDateTime);
  };

  // Score parcial del partido
  const hasScore = match && (match.sets1! > 0 || match.sets2! > 0 || match.games1! > 0 || match.games2! > 0);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: 'white', borderRadius: '18px',
          boxShadow: '0 30px 70px rgba(0,0,0,0.3)',
          width: '100%', maxWidth: '480px',
          margin: '0 16px', maxHeight: '90vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{
          background: 'linear-gradient(135deg, #92400E, #B45309)',
          padding: '20px 24px', borderRadius: '18px 18px 0 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CloudRain size={22} color="white" />
            <div>
              <h2 style={{ color: 'white', fontSize: '17px', fontWeight: '700', margin: 0 }}>
                {mode === 'day' ? 'Suspender Jornada' : 'Suspender Partido'}
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', margin: '2px 0 0' }}>
                {mode === 'day'
                  ? `${matchCount || 0} partidos del ${date}`
                  : `${ROUND_LABELS[match?.round || ''] || match?.round} · ${match?.category}`
                }
              </p>
            </div>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── Info del partido (modo match) ── */}
          {mode === 'match' && match && (
            <div style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '10px', padding: '12px 14px' }}>
              <p style={{ fontSize: '13px', fontWeight: '700', color: '#92400E', margin: '0 0 6px' }}>
                {match.player1Name} vs {match.player2Name}
              </p>
              {hasScore && (
                <div style={{ fontSize: '12px', color: '#78350F' }}>
                  <span>Marcador parcial: </span>
                  <strong>
                    {match.player1Name?.split(' ')[0]} {match.sets1}-{match.sets2} {match.player2Name?.split(' ')[0]}
                    {(match.games1! > 0 || match.games2! > 0) && ` (${match.games1}-${match.games2} en game)`}
                  </strong>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#92400E' }}>
                    ✅ El resultado parcial se guardará y se mostrará en el cuadro hasta que el partido se reanude.
                  </p>
                </div>
              )}
              {!hasScore && (
                <p style={{ fontSize: '12px', color: '#78350F', margin: 0 }}>
                  El partido no ha iniciado — se reprogramará para la siguiente jornada.
                </p>
              )}
            </div>
          )}

          {/* ── Aviso jornada completa ── */}
          {mode === 'day' && (
            <div style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '10px', padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <AlertTriangle size={16} color="#92400E" style={{ flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: '#92400E', margin: '0 0 4px' }}>
                    Se suspenden {matchCount} partidos
                  </p>
                  <p style={{ fontSize: '12px', color: '#78350F', margin: 0 }}>
                    Los partidos que estaban en curso guardan su marcador parcial.
                    Los que no habían iniciado se marcan como pendientes de reprogramar.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Motivo ── */}
          <div>
            <label style={lbl}>Motivo de la suspensión</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {SUSPEND_REASONS.filter(r => r.value !== 'other').map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReasonKey(r.value)}
                  style={{
                    padding: '9px 12px', borderRadius: '8px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: '600', textAlign: 'left',
                    border: reasonKey === r.value ? '2px solid #B45309' : '1.5px solid #E5E7EB',
                    backgroundColor: reasonKey === r.value ? '#FEF3C7' : 'white',
                    color: reasonKey === r.value ? '#92400E' : '#374151',
                    transition: 'all 0.12s',
                  }}
                >
                  {r.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setReasonKey('other')}
                style={{
                  padding: '9px 12px', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '12px', fontWeight: '600', textAlign: 'left',
                  gridColumn: '1 / -1',
                  border: reasonKey === 'other' ? '2px solid #B45309' : '1.5px solid #E5E7EB',
                  backgroundColor: reasonKey === 'other' ? '#FEF3C7' : 'white',
                  color: reasonKey === 'other' ? '#92400E' : '#374151',
                }}
              >
                📝 Otro motivo
              </button>
            </div>
            {reasonKey === 'other' && (
              <input
                type="text"
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Describe el motivo..."
                style={{ ...inp, marginTop: '8px' }}
              />
            )}
          </div>

          {/* ── Reprogramación (opcional) ── */}
          <div>
            <label style={lbl}>
              Fecha de reanudación{' '}
              <span style={{ color: '#9CA3AF', fontWeight: '400' }}>(opcional)</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '3px', display: 'block' }}>Fecha</label>
                <input type="date" value={resumeDate} onChange={e => setResumeDate(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '3px', display: 'block' }}>Hora</label>
                <input type="time" value={resumeTime} onChange={e => setResumeTime(e.target.value)} style={inp} />
              </div>
            </div>
            {resumeDate && (
              <p style={{ fontSize: '11px', color: '#059669', margin: '6px 0 0' }}>
                📅 Los jugadores verán esta fecha en su cuadro como "Reanuda el {resumeDate} a las {resumeTime || '08:00'}"
              </p>
            )}
          </div>

          {/* ── Botones ── */}
          <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
            <button onClick={onCancel} style={cancelBtn}>Cancelar</button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              style={{
                ...confirmBtn,
                opacity: isLoading ? 0.7 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading
                ? 'Suspendiendo...'
                : mode === 'day'
                  ? `⛈️ Suspender ${matchCount} partidos`
                  : '⛈️ Suspender partido'
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '13px', boxSizing: 'border-box' };
const cancelBtn: React.CSSProperties = { flex: 1, padding: '11px', borderRadius: '10px', border: '1.5px solid #E5E7EB', backgroundColor: 'white', color: '#374151', fontWeight: '600', fontSize: '14px', cursor: 'pointer' };
const confirmBtn: React.CSSProperties = { flex: 2, padding: '11px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #B45309, #92400E)', color: 'white', fontWeight: '700', fontSize: '14px', boxShadow: '0 4px 14px rgba(146,64,14,0.3)' };