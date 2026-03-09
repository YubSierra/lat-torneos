// frontend/src/components/BracketView.tsx
// Cuadro de llaves mejorado:
//  ✅ RR → Main Draw: muestra "1° Grupo A" / "2° Grupo B"
//  ✅ Main Draw: apellidos de posibles ganadores de ronda anterior
//  ✅ Rondas futuras: solo nombre de ronda (sin jugadores hasta que estén definidos)
//  ✅ Partidos suspendidos: muestra resultado parcial

import { useMemo } from 'react';

// ── Tipos ──────────────────────────────────────────────────────────────────
interface BracketMatch {
  id: string;
  round: string;
  category: string;
  player1Id?: string;
  player2Id?: string;
  player1Name?: string;
  player2Name?: string;
  player1Label?: string;   // ← "Ganador Grupo A", "Ganador QF1"
  player2Label?: string;
  winnerId?: string;
  status: string;
  seeding1?: number;
  seeding2?: number;
  groupLabel?: string;
  scheduledAt?: string;
  suspensionReason?: string;
  partialResult?: {
    sets1: number; sets2: number;
    games1: number; games2: number;
    note?: string;
  };
}

interface BracketViewProps {
  matches: BracketMatch[];
  isAdmin?: boolean;
  onSuspendMatch?: (match: BracketMatch) => void;
  onResumeMatch?: (match: BracketMatch) => void;
}

// ── Constantes ─────────────────────────────────────────────────────────────
const ROUND_ORDER = ['RR','RR_A','RR_B','R64','R32','R16','QF','SF','F','SF_M','F_M'];
const ROUND_LABELS: Record<string,string> = {
  RR:'Round Robin', RR_A:'Grupo A', RR_B:'Grupo B',
  R64:'R64', R32:'R32', R16:'R16',
  QF:'Cuartos de Final', SF:'Semifinal', F:'Final',
  SF_M:'Semifinal Máster', F_M:'Final Máster',
};
// Abreviaciones para el cuadro
const ROUND_SHORT: Record<string,string> = {
  QF:'Cuartos', SF:'Semifinal', F:'Final', SF_M:'SF Máster', F_M:'Final Máster',
};

// ── Helper: obtener apellido ───────────────────────────────────────────────
function lastName(fullName?: string): string {
  if (!fullName || fullName === 'BYE') return fullName || 'BYE';
  const parts = fullName.trim().split(' ');
  // Si tiene 2+ palabras, tomar la segunda (apellido)
  return parts.length >= 2 ? parts[1] : parts[0];
}

// ── Helper: nombre display en cuadro ─────────────────────────────────────
function playerDisplay(
  match: BracketMatch,
  player: 1 | 2,
  prevRoundWinners: Map<string, BracketMatch[]>, // matchIndex → partido anterior
): { text: string; isPlaceholder: boolean; isEliminated: boolean } {
  const id     = player === 1 ? match.player1Id    : match.player2Id;
  const name   = player === 1 ? match.player1Name  : match.player2Name;
  const label  = player === 1 ? match.player1Label : match.player2Label;

  // Si tiene jugador real
  if (id && name) {
    const isEliminated = !!match.winnerId && match.winnerId !== id;
    return { text: lastName(name), isPlaceholder: false, isEliminated };
  }

  // Si tiene etiqueta guardada ("Ganador Grupo A", etc.)
  if (label) {
    return { text: label, isPlaceholder: true, isEliminated: false };
  }

  // Sin datos — solo mostrar nombre de ronda
  return { text: '---', isPlaceholder: true, isEliminated: false };
}

// ── Componente de un partido individual ───────────────────────────────────
function MatchCard({
  match, isAdmin, onSuspend, onResume, p1Info, p2Info,
}: {
  match: BracketMatch;
  isAdmin?: boolean;
  onSuspend?: () => void;
  onResume?: () => void;
  p1Info: ReturnType<typeof playerDisplay>;
  p2Info: ReturnType<typeof playerDisplay>;
}) {
  const isSuspended  = match.status === 'suspended';
  const isCompleted  = match.status === 'completed' || match.status === 'wo';
  const isLive       = match.status === 'live';
  const isEmptySlot  = !match.player1Id && !match.player2Id && !match.player1Label;

  // Color de borde del card
  const borderColor = isSuspended ? '#F97316'
    : isCompleted ? '#86EFAC'
    : isLive ? '#EF4444'
    : '#E5E7EB';

  // Si es un slot vacío (ronda futura sin jugadores) → mostrar solo ronda
  if (isEmptySlot) {
    return (
      <div style={{
        border: '1.5px dashed #D1D5DB', borderRadius: '10px',
        padding: '10px 12px', marginBottom: '8px', marginRight: '8px',
        backgroundColor: '#F9FAFB', minWidth: '160px',
      }}>
        <p style={{ fontSize: '11px', color: '#9CA3AF', textAlign: 'center', margin: 0, fontStyle: 'italic' }}>
          Por definir
        </p>
      </div>
    );
  }

  return (
    <div style={{
      border: `2px solid ${borderColor}`,
      borderRadius: '10px',
      backgroundColor: isSuspended ? '#FFF7ED' : isCompleted ? '#F0FDF4' : 'white',
      marginBottom: '8px', marginRight: '8px',
      minWidth: '165px', maxWidth: '185px',
      boxShadow: isLive ? '0 0 0 3px rgba(239,68,68,0.2)' : 'none',
    }}>
      {/* Badge de estado */}
      {(isLive || isSuspended) && (
        <div style={{
          backgroundColor: isSuspended ? '#F97316' : '#EF4444',
          color: 'white', fontSize: '9px', fontWeight: '700',
          textAlign: 'center', padding: '2px',
          borderRadius: '8px 8px 0 0',
          letterSpacing: '0.08em',
        }}>
          {isSuspended ? `⛈ SUSPENDIDO · ${match.suspensionReason || ''}` : '🔴 EN VIVO'}
        </div>
      )}

      <div style={{ padding: '8px 10px' }}>
        {/* Jugador 1 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '3px 0',
          borderBottom: '1px solid #F3F4F6',
          opacity: p1Info.isEliminated ? 0.4 : 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {match.seeding1 && (
              <span style={{ fontSize: '9px', color: '#9CA3AF', fontWeight: '700', minWidth: '12px' }}>
                [{match.seeding1}]
              </span>
            )}
            <span style={{
              fontSize: '12px',
              fontWeight: match.winnerId === match.player1Id ? '800' : '500',
              color: p1Info.isPlaceholder ? '#9CA3AF'
                : match.winnerId === match.player1Id ? '#15803D' : '#1F2937',
              fontStyle: p1Info.isPlaceholder ? 'italic' : 'normal',
            }}>
              {p1Info.text}
            </span>
          </div>
          {/* Score parcial o final */}
          {isSuspended && match.partialResult && (
            <span style={{ fontSize: '11px', color: '#F97316', fontWeight: '700' }}>
              {match.partialResult.sets1}
            </span>
          )}
          {isCompleted && (
            <span style={{ fontSize: '11px', fontWeight: '700', color: match.winnerId === match.player1Id ? '#15803D' : '#9CA3AF' }}>
              {match.sets1}
            </span>
          )}
        </div>

        {/* Jugador 2 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '3px 0',
          opacity: p2Info.isEliminated ? 0.4 : 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {match.seeding2 && (
              <span style={{ fontSize: '9px', color: '#9CA3AF', fontWeight: '700', minWidth: '12px' }}>
                [{match.seeding2}]
              </span>
            )}
            <span style={{
              fontSize: '12px',
              fontWeight: match.winnerId === match.player2Id ? '800' : '500',
              color: p2Info.isPlaceholder ? '#9CA3AF'
                : match.winnerId === match.player2Id ? '#15803D' : '#1F2937',
              fontStyle: p2Info.isPlaceholder ? 'italic' : 'normal',
            }}>
              {p2Info.text}
            </span>
          </div>
          {isSuspended && match.partialResult && (
            <span style={{ fontSize: '11px', color: '#F97316', fontWeight: '700' }}>
              {match.partialResult.sets2}
            </span>
          )}
          {isCompleted && (
            <span style={{ fontSize: '11px', fontWeight: '700', color: match.winnerId === match.player2Id ? '#15803D' : '#9CA3AF' }}>
              {match.sets2}
            </span>
          )}
        </div>

        {/* Nota de suspensión con parcial extendido */}
        {isSuspended && match.partialResult && (
          <div style={{ marginTop: '5px', padding: '4px 6px', backgroundColor: '#FED7AA', borderRadius: '5px' }}>
            <p style={{ fontSize: '10px', color: '#92400E', margin: 0 }}>
              {match.partialResult.note || 'Partido suspendido'}
            </p>
            {match.partialResult.games1 > 0 || match.partialResult.games2 > 0 ? (
              <p style={{ fontSize: '10px', color: '#78350F', margin: '2px 0 0', fontWeight: '600' }}>
                Games: {match.partialResult.games1}-{match.partialResult.games2}
              </p>
            ) : null}
          </div>
        )}

        {/* Acciones admin */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
            {!isCompleted && !isSuspended && match.player1Id && match.player2Id && (
              <button
                onClick={onSuspend}
                title="Suspender partido"
                style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #FDE68A', backgroundColor: '#FFFBEB', color: '#92400E', cursor: 'pointer', fontWeight: '600' }}
              >
                ⛈ Susp.
              </button>
            )}
            {isSuspended && (
              <button
                onClick={onResume}
                title="Reanudar partido"
                style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #86EFAC', backgroundColor: '#F0FDF4', color: '#15803D', cursor: 'pointer', fontWeight: '600' }}
              >
                ▶ Reanudar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
export default function BracketView({ matches, isAdmin, onSuspendMatch, onResumeMatch }: BracketViewProps) {

  // Agrupar por categoría
  const byCategory = useMemo(() => {
    const cat: Record<string, Record<string, BracketMatch[]>> = {};
    matches.forEach(m => {
      if (!cat[m.category]) cat[m.category] = {};
      if (!cat[m.category][m.round]) cat[m.category][m.round] = [];
      cat[m.category][m.round].push(m);
    });
    return cat;
  }, [matches]);

  // Build map: matchId → ganador para labels de ronda siguiente
  const winnerMap = useMemo(() => {
    const map = new Map<string, BracketMatch>();
    matches.forEach(m => { map.set(m.id, m); });
    return map;
  }, [matches]);

  // ── Para rondas de eliminación directa: calcular labels para slots vacíos ──
  // Ej: si QF partido 0 no tiene jugador, mostrar "Gan. García" (apellido ganador R16 correspondiente)
  function getPlayerInfo(match: BracketMatch, player: 1|2, categoryRounds: Record<string, BracketMatch[]>): ReturnType<typeof playerDisplay> {
    return playerDisplay(match, player, new Map());
  }

  // ── Renderizar rondas de eliminación como cuadro horizontal ──────────────
  function renderElimBracket(category: string, rounds: Record<string, BracketMatch[]>) {
    const elimRounds = ROUND_ORDER.filter(r =>
      !['RR','RR_A','RR_B'].includes(r) && rounds[r]
    );
    if (elimRounds.length === 0) return null;

    return (
      <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', gap: '0', minWidth: `${elimRounds.length * 185}px` }}>
          {elimRounds.map(round => {
            const roundMatches = rounds[round];
            const allPending = roundMatches.every(m => !m.player1Id && !m.player2Id);
            const someHavePlayers = roundMatches.some(m => m.player1Id || m.player2Id || m.player1Label);

            return (
              <div key={round} style={{ minWidth: '185px', flex: '0 0 185px' }}>
                {/* Header ronda */}
                <div style={{
                  backgroundColor: '#1B3A1B', color: 'white',
                  borderRadius: '6px', padding: '6px 10px',
                  marginBottom: '10px', marginRight: '8px', textAlign: 'center',
                }}>
                  <span style={{ fontSize: '12px', fontWeight: '700' }}>
                    {ROUND_SHORT[round] || ROUND_LABELS[round] || round}
                  </span>
                  {!allPending && (
                    <span style={{ fontSize: '10px', opacity: 0.7, marginLeft: '4px' }}>
                      ({roundMatches.length})
                    </span>
                  )}
                </div>

                {/* Si la ronda no tiene jugadores aún → mostrar placeholder simple */}
                {allPending && !someHavePlayers ? (
                  <div style={{
                    border: '1.5px dashed #D1D5DB', borderRadius: '10px',
                    padding: '14px', marginRight: '8px',
                    backgroundColor: '#F9FAFB', textAlign: 'center',
                  }}>
                    <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0, fontStyle: 'italic' }}>
                      {ROUND_SHORT[round] || round}
                    </p>
                    <p style={{ fontSize: '10px', color: '#D1D5DB', margin: '3px 0 0' }}>
                      Clasificados pendientes
                    </p>
                  </div>
                ) : (
                  roundMatches.map((m, idx) => {
                    const p1 = getPlayerInfo(m, 1, rounds);
                    const p2 = getPlayerInfo(m, 2, rounds);
                    return (
                      <MatchCard
                        key={m.id}
                        match={m}
                        isAdmin={isAdmin}
                        p1Info={p1}
                        p2Info={p2}
                        onSuspend={() => onSuspendMatch?.(m)}
                        onResume={() => onResumeMatch?.(m)}
                      />
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Renderizar grupos RR ─────────────────────────────────────────────────
  function renderRRGroups(rounds: Record<string, BracketMatch[]>) {
    const rrRounds = ROUND_ORDER.filter(r => ['RR','RR_A','RR_B'].includes(r) && rounds[r]);
    if (rrRounds.length === 0) return null;

    // Agrupar por groupLabel para mostrar "Grupo A" / "Grupo B"
    const groups: Record<string, BracketMatch[]> = {};
    rrRounds.forEach(r => {
      rounds[r].forEach(m => {
        const g = m.groupLabel || (r === 'RR_A' ? 'A' : r === 'RR_B' ? 'B' : 'A');
        if (!groups[g]) groups[g] = [];
        groups[g].push(m);
      });
    });

    return (
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {Object.entries(groups).sort().map(([groupLabel, gMatches]) => {
          // Calcular standings del grupo
          const standings: Record<string, { name: string; wins: number; losses: number; played: number }> = {};
          gMatches.forEach(m => {
            [m.player1Id, m.player2Id].forEach((pid, i) => {
              if (!pid) return;
              const name = (i === 0 ? m.player1Name : m.player2Name) || pid;
              if (!standings[pid]) standings[pid] = { name, wins: 0, losses: 0, played: 0 };
            });
            if (m.winnerId && (m.status === 'completed' || m.status === 'wo')) {
              const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
              if (standings[m.winnerId]) { standings[m.winnerId].wins++; standings[m.winnerId].played++; }
              if (loserId && standings[loserId]) { standings[loserId].losses++; standings[loserId].played++; }
            }
          });
          const sortedStandings = Object.entries(standings)
            .sort(([,a],[,b]) => b.wins - a.wins);

          return (
            <div key={groupLabel} style={{ flex: '1 1 300px', minWidth: '280px' }}>
              {/* Header grupo */}
              <div style={{
                backgroundColor: '#1B3A1B', color: 'white',
                borderRadius: '8px 8px 0 0', padding: '8px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontWeight: '700', fontSize: '13px' }}>
                  Grupo {groupLabel}
                </span>
                <span style={{ fontSize: '11px', opacity: 0.7 }}>
                  {gMatches.filter(m => m.status === 'completed' || m.status === 'wo').length}/{gMatches.length} jugados
                </span>
              </div>

              {/* Standings */}
              <div style={{ border: '1px solid #E5E7EB', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                {sortedStandings.map(([pid, s], pos) => (
                  <div key={pid} style={{
                    display: 'flex', alignItems: 'center', padding: '7px 12px',
                    backgroundColor: pos === 0 ? '#F0FDF4' : 'white',
                    borderBottom: '1px solid #F3F4F6',
                  }}>
                    <span style={{
                      width: '20px', height: '20px', borderRadius: '50%',
                      backgroundColor: pos === 0 ? '#22C55E' : pos === 1 ? '#3B82F6' : '#9CA3AF',
                      color: 'white', fontSize: '10px', fontWeight: '800',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginRight: '8px', flexShrink: 0,
                    }}>
                      {pos + 1}
                    </span>
                    <span style={{ flex: 1, fontSize: '12px', fontWeight: pos === 0 ? '700' : '500', color: '#1F2937' }}>
                      {lastName(s.name)}
                    </span>
                    <span style={{ fontSize: '11px', color: '#6B7280' }}>
                      {s.wins}V {s.losses}D
                    </span>
                  </div>
                ))}

                {/* Partidos del grupo */}
                <div style={{ padding: '8px 12px', backgroundColor: '#FAFAFA' }}>
                  {gMatches.map(m => {
                    const isSusp = m.status === 'suspended';
                    return (
                      <div key={m.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '4px 0', borderBottom: '1px solid #F3F4F6',
                        fontSize: '11px',
                      }}>
                        <span style={{ color: '#374151' }}>
                          {lastName(m.player1Name)} vs {lastName(m.player2Name)}
                        </span>
                        <span style={{
                          color: m.status === 'completed' ? '#15803D'
                            : m.status === 'wo' ? '#92400E'
                            : isSusp ? '#F97316' : '#9CA3AF',
                          fontWeight: '600',
                        }}>
                          {m.status === 'completed' ? `${m.sets1}-${m.sets2}`
                            : m.status === 'wo' ? 'W.O.'
                            : isSusp ? `⛈ ${m.partialResult?.sets1 || 0}-${m.partialResult?.sets2 || 0}`
                            : '—'
                          }
                        </span>
                        {isAdmin && !['completed','wo'].includes(m.status) && m.player1Id && (
                          <button
                            onClick={() => isSusp ? onResumeMatch?.(m) : onSuspendMatch?.(m)}
                            style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', border: '1px solid #E5E7EB', backgroundColor: 'white', cursor: 'pointer', marginLeft: '4px' }}
                          >
                            {isSusp ? '▶' : '⛈'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Render principal ─────────────────────────────────────────────────────
  return (
    <div>
      {Object.entries(byCategory).map(([category, rounds]) => {
        const hasRR   = ROUND_ORDER.some(r => ['RR','RR_A','RR_B'].includes(r) && rounds[r]);
        const hasElim = ROUND_ORDER.some(r => !['RR','RR_A','RR_B'].includes(r) && rounds[r]);

        return (
          <div key={category} style={{ marginBottom: '40px' }}>
            {/* Header categoría */}
            <div style={{
              background: 'linear-gradient(135deg, #1B3A1B, #2D6A2D)',
              color: 'white', borderRadius: '10px',
              padding: '12px 18px', marginBottom: '20px',
            }}>
              <span style={{ fontWeight: '800', fontSize: '15px' }}>🎾 {category}</span>
              <span style={{ fontSize: '12px', opacity: 0.75, marginLeft: '12px' }}>
                {Object.values(rounds).flat().length} partidos ·{' '}
                {Object.values(rounds).flat().filter(m => m.status === 'completed' || m.status === 'wo').length} completados ·{' '}
                {Object.values(rounds).flat().filter(m => m.status === 'suspended').length > 0
                  ? `⛈ ${Object.values(rounds).flat().filter(m => m.status === 'suspended').length} suspendidos`
                  : ''
                }
              </span>
            </div>

            {/* Grupos RR */}
            {hasRR && renderRRGroups(rounds)}

            {/* Etiqueta transición RR → Main Draw */}
            {hasRR && hasElim && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                margin: '0 0 16px',
              }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }} />
                <span style={{
                  fontSize: '11px', fontWeight: '700', color: '#6B7280',
                  backgroundColor: '#F3F4F6', padding: '4px 12px',
                  borderRadius: '999px', whiteSpace: 'nowrap',
                }}>
                  ↓ MAIN DRAW
                </span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }} />
              </div>
            )}

            {/* Cuadro de eliminación */}
            {hasElim && renderElimBracket(category, rounds)}
          </div>
        );
      })}
    </div>
  );
}
