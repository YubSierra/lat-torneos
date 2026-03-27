// frontend/src/components/WOModal.tsx
import { useState } from 'react';

interface WOModalProps {
  isOpen: boolean;
  match: {
    id: string;
    player1Id: string;
    player2Id: string;
    player1Name: string;
    player2Name: string;
    round: string;
    category: string;
  } | null;
  onConfirm:     (matchId: string, winnerId: string, reason: string) => void;
  onDoubleWO:    (matchId: string) => void;   // ← NUEVO
  onCancel:      () => void;
}

const WO_REASONS = [
  { id: 'no_show',          label: 'No se presentó',   icon: '🚫' },
  { id: 'retirement',       label: 'Retiro / Abandono', icon: '🏳️' },
  { id: 'disqualification', label: 'Descalificación',  icon: '⛔' },
  { id: 'injury',           label: 'Lesión',            icon: '🩹' },
];

const ROUND_LABELS: Record<string, string> = {
  R64: 'R64', R32: 'R32', R16: 'R16',
  QF: 'Cuartos', SF: 'Semifinal', F: 'Final',
  RR: 'Round Robin', RR_A: 'Grupo A', RR_B: 'Grupo B',
};

type Mode = 'normal' | 'double';

export default function WOModal({ isOpen, match, onConfirm, onDoubleWO, onCancel }: WOModalProps) {
  const [mode, setMode]                   = useState<Mode>('normal');
  const [selectedWinner, setSelectedWinner] = useState<'player1' | 'player2' | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [error, setError]                 = useState('');

  if (!isOpen || !match) return null;

  const winnerId   = selectedWinner === 'player1' ? match.player1Id   : match.player2Id;
  const winnerName = selectedWinner === 'player1' ? match.player1Name : match.player2Name;
  const loserName  = selectedWinner === 'player1' ? match.player2Name : match.player1Name;

  const handleReset = () => {
    setMode('normal');
    setSelectedWinner(null);
    setSelectedReason(null);
    setError('');
  };

  const handleCancel = () => { handleReset(); onCancel(); };

  const handleConfirmNormal = () => {
    if (!selectedWinner) { setError('Selecciona el jugador que GANA por W.O.'); return; }
    if (!selectedReason) { setError('Selecciona el motivo del W.O.'); return; }
    onConfirm(match.id, winnerId, selectedReason);
    handleReset();
  };

  const handleConfirmDouble = () => {
    onDoubleWO(match.id);
    handleReset();
  };

  // ── Colores según modo ──────────────────────────
  const headerBg = mode === 'double'
    ? 'linear-gradient(135deg, #6B7280, #374151)'
    : 'linear-gradient(135deg, #F97316, #DC2626)';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          backgroundColor: 'white', borderRadius: '16px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          width: '100%', maxWidth: '460px',
          margin: '0 16px', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{
          background: headerBg,
          padding: '20px 24px',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <span style={{ fontSize: '28px' }}>{mode === 'double' ? '🤝' : '🏳️'}</span>
          <div>
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '700', margin: 0 }}>
              {mode === 'double' ? 'Doble W.O.' : 'Declarar W.O.'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', margin: 0 }}>
              {ROUND_LABELS[match.round] ?? match.round} · {match.category}
            </p>
          </div>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── Selector de modo ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
          }}>
            <button
              onClick={() => { setMode('normal'); setError(''); }}
              style={{
                padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                border: mode === 'normal' ? '2px solid #F97316' : '2px solid #E5E7EB',
                backgroundColor: mode === 'normal' ? '#FFF7ED' : 'white',
                color: mode === 'normal' ? '#C2410C' : '#374151',
                fontWeight: '600', fontSize: '13px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              🏳️ W.O. Normal
            </button>
            <button
              onClick={() => { setMode('double'); setSelectedWinner(null); setError(''); }}
              style={{
                padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                border: mode === 'double' ? '2px solid #6B7280' : '2px solid #E5E7EB',
                backgroundColor: mode === 'double' ? '#F3F4F6' : 'white',
                color: mode === 'double' ? '#374151' : '#6B7280',
                fontWeight: '600', fontSize: '13px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              🤝 Doble W.O.
            </button>
          </div>

          {/* ══════════════════════════════════════════
              MODO NORMAL
          ══════════════════════════════════════════ */}
          {mode === 'normal' && (
            <>
              {/* Paso 1: ¿Quién GANA? */}
              <div>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280',
                            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                  1. ¿Quién GANA por W.O.?
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {(['player1', 'player2'] as const).map(player => {
                    const isSelected = selectedWinner === player;
                    const name  = player === 'player1' ? match.player1Name : match.player2Name;
                    const label = player === 'player1' ? 'Jugador 1' : 'Jugador 2';
                    return (
                      <button
                        key={player}
                        onClick={() => { setSelectedWinner(player); setError(''); }}
                        style={{
                          position: 'relative', padding: '14px', borderRadius: '10px',
                          textAlign: 'left',
                          border: isSelected ? '2px solid #16A34A' : '2px solid #E5E7EB',
                          backgroundColor: isSelected ? '#F0FDF4' : '#F9FAFB',
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 0 0 3px rgba(22,163,74,0.15)' : 'none',
                        }}
                      >
                        {isSelected && (
                          <span style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '16px' }}>✅</span>
                        )}
                        <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600', marginBottom: '4px' }}>{label}</div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: isSelected ? '#166534' : '#111827', lineHeight: '1.3' }}>{name}</div>
                        {isSelected && (
                          <div style={{ fontSize: '11px', fontWeight: '700', color: '#16A34A', marginTop: '6px' }}>🏆 GANA</div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedWinner && (
                  <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', marginTop: '8px' }}>
                    ❌ <strong style={{ color: '#6B7280' }}>{loserName}</strong> pierde — marcador 0-6 0-6
                  </p>
                )}
              </div>

              {/* Paso 2: Motivo */}
              <div>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280',
                            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                  2. Motivo del W.O.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {WO_REASONS.map(reason => {
                    const isSelected = selectedReason === reason.id;
                    return (
                      <button
                        key={reason.id}
                        onClick={() => { setSelectedReason(reason.id); setError(''); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '10px 12px', borderRadius: '8px', textAlign: 'left',
                          border: isSelected ? '2px solid #F97316' : '2px solid #E5E7EB',
                          backgroundColor: isSelected ? '#FFF7ED' : 'white',
                          cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                          color: isSelected ? '#C2410C' : '#374151',
                        }}
                      >
                        <span style={{ fontSize: '16px' }}>{reason.icon}</span>
                        {reason.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Resumen */}
              {selectedWinner && selectedReason && (
                <div style={{
                  backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
                  borderRadius: '10px', padding: '12px 16px',
                }}>
                  <p style={{ fontSize: '11px', fontWeight: '700', color: '#92400E', textTransform: 'uppercase', marginBottom: '4px' }}>Resumen</p>
                  <p style={{ fontSize: '13px', color: '#78350F', margin: 0 }}>
                    <strong>{winnerName}</strong> avanza —{' '}
                    {WO_REASONS.find(r => r.id === selectedReason)?.label?.toLowerCase()}
                  </p>
                  <p style={{ fontSize: '11px', color: '#A16207', marginTop: '4px' }}>
                    Marcador: 6-0 6-0 (Art. 23 Reglamento)
                  </p>
                </div>
              )}
            </>
          )}

          {/* ══════════════════════════════════════════
              MODO DOBLE W.O.
          ══════════════════════════════════════════ */}
          {mode === 'double' && (
            <>
              {/* Mostrar ambos jugadores */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'Jugador 1', name: match.player1Name },
                  { label: 'Jugador 2', name: match.player2Name },
                ].map(p => (
                  <div
                    key={p.label}
                    style={{
                      padding: '14px', borderRadius: '10px',
                      border: '2px solid #E5E7EB', backgroundColor: '#F9FAFB',
                      opacity: 0.7,
                    }}
                  >
                    <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600', marginBottom: '4px' }}>{p.label}</div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', lineHeight: '1.3' }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '6px', fontWeight: '600' }}>❌ No se presentó</div>
                  </div>
                ))}
              </div>

              {/* Info */}
              <div style={{
                backgroundColor: '#F3F4F6', border: '1px solid #D1D5DB',
                borderRadius: '10px', padding: '14px 16px',
              }}>
                <p style={{ fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', marginBottom: '6px' }}>
                  ℹ️ Doble W.O. — Ninguno se presentó
                </p>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0, lineHeight: '1.5' }}>
                  El partido quedará <strong>finalizado con resultado 0-0</strong>.<br />
                  No se otorgan puntos a ningún jugador.<br />
                  Ninguno avanza en el torneo.
                </p>
              </div>
            </>
          )}

          {/* ── Error ── */}
          {error && (
            <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px' }}>
              <p style={{ fontSize: '13px', color: '#DC2626', margin: 0 }}>⚠️ {error}</p>
            </div>
          )}

          {/* ── Botones ── */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleCancel}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px',
                border: '2px solid #E5E7EB', backgroundColor: 'white',
                color: '#374151', fontWeight: '600', fontSize: '14px', cursor: 'pointer',
              }}
            >
              Cancelar
            </button>

            {mode === 'normal' ? (
              <button
                onClick={handleConfirmNormal}
                style={{
                  flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                  background: selectedWinner && selectedReason
                    ? 'linear-gradient(135deg, #F97316, #DC2626)' : '#D1D5DB',
                  color: 'white', fontWeight: '700', fontSize: '14px',
                  cursor: selectedWinner && selectedReason ? 'pointer' : 'not-allowed',
                  boxShadow: selectedWinner && selectedReason ? '0 4px 12px rgba(220,38,38,0.3)' : 'none',
                }}
              >
                Confirmar W.O.
              </button>
            ) : (
              <button
                onClick={handleConfirmDouble}
                style={{
                  flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #6B7280, #374151)',
                  color: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(55,65,81,0.3)',
                }}
              >
                🤝 Confirmar Doble W.O.
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}