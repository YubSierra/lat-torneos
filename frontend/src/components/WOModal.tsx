// frontend/src/components/WOModal.tsx
// Modal para declarar W.O. — permite seleccionar el jugador ganador y el motivo

import { useState } from 'react';

// ── Tipos ──────────────────────────────────────────────────────────────────
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
  onConfirm: (matchId: string, winnerId: string, reason: string) => void;
  onCancel: () => void;
}

// ── Motivos W.O. según reglamento LAT ─────────────────────────────────────
const WO_REASONS = [
  { id: 'no_show',          label: 'No se presentó',     icon: '🚫' },
  { id: 'retirement',       label: 'Retiro / Abandono',  icon: '🏳️' },
  { id: 'disqualification', label: 'Descalificación',    icon: '⛔' },
  { id: 'injury',           label: 'Lesión',             icon: '🩹' },
];

const ROUND_LABELS: Record<string, string> = {
  R64: 'R64', R32: 'R32', R16: 'R16',
  QF: 'Cuartos', SF: 'Semifinal', F: 'Final',
  RR: 'Round Robin', RR_A: 'Grupo A', RR_B: 'Grupo B',
};

// ── Componente ─────────────────────────────────────────────────────────────
export default function WOModal({ isOpen, match, onConfirm, onCancel }: WOModalProps) {
  const [selectedWinner, setSelectedWinner] = useState<'player1' | 'player2' | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!isOpen || !match) return null;

  const winnerId   = selectedWinner === 'player1' ? match.player1Id   : match.player2Id;
  const winnerName = selectedWinner === 'player1' ? match.player1Name : match.player2Name;
  const loserName  = selectedWinner === 'player1' ? match.player2Name : match.player1Name;

  const handleConfirm = () => {
    if (!selectedWinner) { setError('Selecciona el jugador que GANA por W.O.'); return; }
    if (!selectedReason) { setError('Selecciona el motivo del W.O.'); return; }
    onConfirm(match.id, winnerId, selectedReason);
    handleReset();
  };

  const handleCancel = () => {
    handleReset();
    onCancel();
  };

  const handleReset = () => {
    setSelectedWinner(null);
    setSelectedReason(null);
    setError('');
  };

  return (
    // Backdrop
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={handleCancel}
    >
      {/* Modal — stopPropagation evita que el clic interno cierre el modal */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          width: '100%', maxWidth: '440px',
          margin: '0 16px',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{
          background: 'linear-gradient(135deg, #F97316, #DC2626)',
          padding: '20px 24px',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <span style={{ fontSize: '28px' }}>🏳️</span>
          <div>
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '700', margin: 0 }}>
              Declarar W.O.
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', margin: 0 }}>
              {ROUND_LABELS[match.round] ?? match.round} · {match.category}
            </p>
          </div>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── Paso 1: ¿Quién GANA? ── */}
          <div>
            <p style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
              1. ¿Quién GANA por W.O.?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {(['player1', 'player2'] as const).map(player => {
                const isSelected = selectedWinner === player;
                const name = player === 'player1' ? match.player1Name : match.player2Name;
                const label = player === 'player1' ? 'Jugador 1' : 'Jugador 2';
                return (
                  <button
                    key={player}
                    onClick={() => { setSelectedWinner(player); setError(''); }}
                    style={{
                      position: 'relative',
                      padding: '14px', borderRadius: '10px', textAlign: 'left',
                      border: isSelected ? '2px solid #16A34A' : '2px solid #E5E7EB',
                      backgroundColor: isSelected ? '#F0FDF4' : '#F9FAFB',
                      cursor: 'pointer', transition: 'all 0.15s',
                      boxShadow: isSelected ? '0 0 0 3px rgba(22,163,74,0.15)' : 'none',
                    }}
                  >
                    {isSelected && (
                      <span style={{ position: 'absolute', top: '8px', right: '8px',
                                     fontSize: '16px' }}>✅</span>
                    )}
                    <div style={{ fontSize: '11px', color: '#9CA3AF',
                                  fontWeight: '600', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontSize: '13px', fontWeight: '600',
                                  color: isSelected ? '#166534' : '#111827',
                                  lineHeight: '1.3' }}>{name}</div>
                    {isSelected && (
                      <div style={{ fontSize: '11px', fontWeight: '700',
                                    color: '#16A34A', marginTop: '6px' }}>🏆 GANA</div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Sub-texto: quién pierde */}
            {selectedWinner && (
              <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center',
                          marginTop: '8px' }}>
                ❌ <strong style={{ color: '#6B7280' }}>{loserName}</strong> pierde — marcador 0-6 0-6
              </p>
            )}
          </div>

          {/* ── Paso 2: Motivo ── */}
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
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{reason.icon}</span>
                    {reason.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Resumen ── */}
          {selectedWinner && selectedReason && (
            <div style={{
              backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
              borderRadius: '10px', padding: '12px 16px',
            }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#92400E',
                          textTransform: 'uppercase', marginBottom: '4px' }}>Resumen</p>
              <p style={{ fontSize: '13px', color: '#78350F', margin: 0 }}>
                <strong>{winnerName}</strong> avanza —{' '}
                {WO_REASONS.find(r => r.id === selectedReason)?.label?.toLowerCase()}
              </p>
              <p style={{ fontSize: '11px', color: '#A16207', marginTop: '4px' }}>
                Marcador: 6-0 6-0 (Art. 23 Reglamento LAT)
              </p>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div style={{
              backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: '8px', padding: '10px 14px',
            }}>
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
                color: '#374151', fontWeight: '600', fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                background: selectedWinner && selectedReason
                  ? 'linear-gradient(135deg, #F97316, #DC2626)'
                  : '#D1D5DB',
                color: 'white', fontWeight: '700', fontSize: '14px',
                cursor: selectedWinner && selectedReason ? 'pointer' : 'not-allowed',
                boxShadow: selectedWinner && selectedReason
                  ? '0 4px 12px rgba(220,38,38,0.3)' : 'none',
              }}
            >
              Confirmar W.O.
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
