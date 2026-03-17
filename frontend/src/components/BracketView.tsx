// frontend/src/components/BracketView.tsx
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
  player1Label?: string;
  player2Label?: string;
  winnerId?: string;
  status: string;
  seeding1?: number;
  seeding2?: number;
  groupLabel?: string;
  scheduledAt?: string;
  suspensionReason?: string;
  sets1?: number;
  sets2?: number;
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
  onResumeMatch?:  (match: BracketMatch) => void;
}

// ── Constantes ─────────────────────────────────────────────────────────────
const ROUND_ORDER = ['RR','RR_A','RR_B','R64','R32','R16','QF','SF','F','SF_M','F_M'];
const ROUND_LABELS: Record<string,string> = {
  RR:'Round Robin', RR_A:'Grupo A', RR_B:'Grupo B',
  R64:'R64', R32:'R32', R16:'R16',
  QF:'Cuartos', SF:'Semifinal', F:'Final',
  SF_M:'SF Máster', F_M:'Final Máster',
};

// Dimensiones fijas — base de todo el cálculo de posición
const CARD_W  = 175;  // ancho de cada tarjeta
const CARD_H  = 72;   // alto de cada tarjeta
const COL_GAP = 40;   // espacio entre columnas (donde van los SVG conectores)
const ROW_GAP = 10;   // espacio entre tarjetas dentro de una misma columna
const SLOT_H  = CARD_H + ROW_GAP;  // alto de cada "slot" en la primera ronda
const HEADER_H = 40;  // espacio para los headers de ronda

// ── Helper: apellido ───────────────────────────────────────────────────────
function lastName(fullName?: string): string {
  if (!fullName || fullName === 'BYE') return fullName || 'BYE';
  const parts = fullName.trim().split(' ');
  return parts.length >= 2 ? parts[1] : parts[0];
}

// ── Tarjeta de un partido ──────────────────────────────────────────────────
function MatchCard({
  match, isAdmin, onSuspend, onResume,
  // Textos calculados externamente para no repetir lógica
  p1Text, p2Text, p1Placeholder, p2Placeholder,
  p1Eliminated, p2Eliminated,
}: {
  match: BracketMatch;
  isAdmin?: boolean;
  onSuspend?: () => void;
  onResume?:  () => void;
  p1Text: string; p2Text: string;
  p1Placeholder: boolean; p2Placeholder: boolean;
  p1Eliminated: boolean; p2Eliminated: boolean;
}) {
  const isLive      = match.status === 'live';
  const isDone      = match.status === 'completed' || match.status === 'wo';
  const isSuspended = match.status === 'suspended';
  const isWO        = match.status === 'wo';

  const border = isSuspended ? '#F97316'
    : isLive    ? '#EF4444'
    : isDone    ? '#86EFAC'
    : '#E5E7EB';

  const bg = isSuspended ? '#FFF7ED'
    : isDone    ? '#F0FDF4'
    : 'white';

  return (
    <div style={{
      width: `${CARD_W}px`,
      border: `2px solid ${border}`,
      borderRadius: '10px',
      backgroundColor: bg,
      overflow: 'hidden',
      boxShadow: isLive ? '0 0 0 3px rgba(239,68,68,0.15)' : '0 1px 3px rgba(0,0,0,0.07)',
    }}>
      {/* Badge estado */}
      {(isLive || isSuspended) && (
        <div style={{
          backgroundColor: isSuspended ? '#F97316' : '#EF4444',
          color: 'white', fontSize: '9px', fontWeight: '800',
          textAlign: 'center', padding: '2px 4px',
          letterSpacing: '0.06em',
        }}>
          {isSuspended ? `⛈ SUSP.${match.suspensionReason ? ' · ' + match.suspensionReason : ''}` : '🔴 EN VIVO'}
        </div>
      )}

      <div style={{ padding: '6px 9px' }}>
        {/* Jugador 1 */}
        <PlayerRow
          text={p1Text} placeholder={p1Placeholder} eliminated={p1Eliminated}
          seeding={match.seeding1}
          winner={match.winnerId === match.player1Id}
          sets={isDone ? match.sets1 : isSuspended ? match.partialResult?.sets1 : undefined}
          suspended={isSuspended}
        />

        <div style={{ height: '1px', backgroundColor: '#F3F4F6', margin: '3px 0' }} />

        {/* Jugador 2 */}
        <PlayerRow
          text={p2Text} placeholder={p2Placeholder} eliminated={p2Eliminated}
          seeding={match.seeding2}
          winner={match.winnerId === match.player2Id}
          sets={isDone ? match.sets2 : isSuspended ? match.partialResult?.sets2 : undefined}
          suspended={isSuspended}
        />

        {/* Info suspensión */}
        {isSuspended && match.partialResult && (
          <div style={{ marginTop: '4px', padding: '3px 6px', backgroundColor: '#FED7AA', borderRadius: '4px' }}>
            <p style={{ fontSize: '9px', color: '#92400E', margin: 0 }}>
              {match.partialResult.note || 'Partido suspendido'}
              {(match.partialResult.games1 > 0 || match.partialResult.games2 > 0) &&
                ` · Games ${match.partialResult.games1}-${match.partialResult.games2}`}
            </p>
          </div>
        )}

        {/* Hora */}
        {match.scheduledAt && !isDone && !isLive && !isSuspended && (
          <p style={{ fontSize: '9px', color: '#9CA3AF', margin: '3px 0 0', textAlign: 'center' }}>
            ⏰ {new Date(match.scheduledAt).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })}
            {' · '}{new Date(match.scheduledAt).toLocaleDateString('es-CO', { day:'2-digit', month:'short' })}
          </p>
        )}

        {/* Acciones admin */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: '4px', marginTop: '5px' }}>
            {!isDone && !isSuspended && match.player1Id && match.player2Id && (
              <button onClick={onSuspend} style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #FDE68A', backgroundColor: '#FFFBEB', color: '#92400E', cursor: 'pointer', fontWeight: '600' }}>
                ⛈ Susp.
              </button>
            )}
            {isSuspended && (
              <button onClick={onResume} style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #86EFAC', backgroundColor: '#F0FDF4', color: '#15803D', cursor: 'pointer', fontWeight: '600' }}>
                ▶ Reanudar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerRow({ text, placeholder, eliminated, seeding, winner, sets, suspended }: {
  text: string; placeholder: boolean; eliminated: boolean;
  seeding?: number; winner?: boolean; sets?: number; suspended?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '4px',
      opacity: eliminated ? 0.38 : 1,
    }}>
      {seeding && (
        <span style={{ fontSize: '9px', color: '#92400E', backgroundColor: '#FEF3C7', padding: '1px 3px', borderRadius: '3px', flexShrink: 0, fontWeight: '700' }}>
          [{seeding}]
        </span>
      )}
      <span style={{
        fontSize: '12px', flex: 1,
        fontWeight: winner ? '800' : '500',
        color: placeholder ? '#9CA3AF' : winner ? '#15803D' : '#1F2937',
        fontStyle: placeholder ? 'italic' : 'normal',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {winner && !placeholder && '🏆 '}
        {text}
      </span>
      {sets !== undefined && (
        <span style={{
          fontSize: '12px', fontWeight: '800', minWidth: '14px', textAlign: 'right',
          color: suspended ? '#F97316' : winner ? '#15803D' : '#9CA3AF',
          fontFamily: 'monospace',
        }}>
          {sets}
        </span>
      )}
    </div>
  );
}

// ── Calcular info de jugador con fallback a ganador anterior ───────────────
function getPlayerInfo(
  match: BracketMatch,
  player: 1 | 2,
  prevRoundMatches: BracketMatch[],
  matchIndexInRound: number,
): { text: string; placeholder: boolean; eliminated: boolean } {
  const id    = player === 1 ? match.player1Id    : match.player2Id;
  const name  = player === 1 ? match.player1Name  : match.player2Name;
  const label = player === 1 ? match.player1Label : match.player2Label;

  // Tiene jugador real
  if (id && name) {
    const eliminated = !!match.winnerId && match.winnerId !== id;
    return { text: lastName(name), placeholder: false, eliminated };
  }

  // Tiene label guardado
  if (label) return { text: label, placeholder: true, eliminated: false };

  // Intentar inferir de la ronda anterior
  // Cada partido de esta ronda = resultado de 2 partidos de la ronda anterior
  const prevIdx1 = matchIndexInRound * 2 + (player === 1 ? 0 : 1);
  const prevMatch = prevRoundMatches[prevIdx1];

  if (prevMatch) {
    // Si ya hay ganador definido → mostrar su apellido
    if (prevMatch.winnerId) {
      const winnerName = prevMatch.winnerId === prevMatch.player1Id
        ? prevMatch.player1Name : prevMatch.player2Name;
      return { text: `Gan. ${lastName(winnerName)}`, placeholder: true, eliminated: false };
    }
    // Si tiene jugadores pero sin ganador → mostrar "Gan. Apellido1 / Apellido2"
    if (prevMatch.player1Name || prevMatch.player2Name) {
      const n1 = lastName(prevMatch.player1Name);
      const n2 = lastName(prevMatch.player2Name);
      return { text: `${n1} / ${n2}`, placeholder: true, eliminated: false };
    }
  }

  return { text: 'Por definir', placeholder: true, eliminated: false };
}

// ── Cuadro de eliminación con conectores SVG ───────────────────────────────
function ElimBracket({
  rounds, isAdmin, onSuspendMatch, onResumeMatch,
}: {
  rounds: Record<string, BracketMatch[]>;
  isAdmin?: boolean;
  onSuspendMatch?: (m: BracketMatch) => void;
  onResumeMatch?:  (m: BracketMatch) => void;
}) {
  const existingElimRounds = ROUND_ORDER.filter(r =>
    !['RR','RR_A','RR_B'].includes(r) && rounds[r]
  );
  if (existingElimRounds.length === 0) return null;

  // Generar todas las rondas hasta la Final, aunque no existan aún
  const ELIM_PROGRESSION = ['R64','R32','R16','QF','SF','F'];
  const firstRoundIdx = ELIM_PROGRESSION.indexOf(existingElimRounds[0]);
  const lastRoundIdx  = ELIM_PROGRESSION.indexOf('F');
  const allElimRounds = ELIM_PROGRESSION.slice(
    firstRoundIdx,
    Math.max(ELIM_PROGRESSION.indexOf(existingElimRounds[existingElimRounds.length - 1]), lastRoundIdx) + 1
  );

  // Completar rounds con placeholders para rondas futuras
  const firstCount = rounds[existingElimRounds[0]]?.length ?? 0;
  allElimRounds.forEach((r, rIdx) => {
    if (!rounds[r]) {
      const count = Math.max(1, Math.ceil(firstCount / Math.pow(2, rIdx)));
      rounds[r] = Array.from({ length: count }, (_, i) => ({
        id:       `placeholder-${r}-${i}`,
        round:    r,
        category: '',
        status:   'pending',
      } as BracketMatch));
    }
  });

  const elimRounds = allElimRounds;

  // La primera ronda define el número de slots base
  const firstRoundCount = rounds[elimRounds[0]]?.length ?? 1;
  // Alto total del bracket (basado en primera ronda)
  const totalH = firstRoundCount * SLOT_H - ROW_GAP;

  // Calcula las posiciones top de cada tarjeta en una ronda dado el índice de ronda
  function getTopPositions(roundIdx: number, count: number): number[] {
    if (roundIdx === 0) {
      // Primera ronda: posiciones uniformes
      return Array.from({ length: count }, (_, i) => i * SLOT_H);
    }
    // Rondas siguientes: centradas entre los dos partidos de la ronda anterior
    const prevPositions = getTopPositions(roundIdx - 1, count * 2);
    return Array.from({ length: count }, (_, i) => {
      const top1 = prevPositions[i * 2];
      const top2 = prevPositions[i * 2 + 1] ?? top1;
      return (top1 + top2) / 2;
    });
  }

  const colWidth = CARD_W + COL_GAP;
  const totalW   = elimRounds.length * CARD_W + (elimRounds.length - 1) * COL_GAP;

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '12px' }}>
      {/* Contenedor principal con position relative para SVGs */}
      <div style={{
        position: 'relative',
        width:    `${totalW}px`,
        height:   `${totalH + HEADER_H}px`,
        minWidth: `${totalW}px`,
      }}>

        {elimRounds.map((round, rIdx) => {
          const roundMatches = rounds[round] ?? [];
          const positions    = getTopPositions(rIdx, roundMatches.length);
          const prevRound    = rIdx > 0 ? rounds[elimRounds[rIdx - 1]] ?? [] : [];
          const colLeft      = rIdx * colWidth;

          return (
            <div key={round}>
              {/* Header ronda */}
              <div style={{
                position: 'absolute',
                top:   0,
                left:  colLeft,
                width: CARD_W,
                backgroundColor: '#1B3A1B',
                color: 'white',
                borderRadius: '6px',
                padding: '5px 8px',
                textAlign: 'center',
                fontSize: '11px', fontWeight: '700',
              }}>
                {ROUND_LABELS[round] || round}
                <span style={{ fontSize: '10px', opacity: 0.65, marginLeft: '4px' }}>
                  ({roundMatches.length})
                </span>
              </div>

              {/* Tarjetas de partidos */}
              {roundMatches.map((m, mIdx) => {
                const topPos = positions[mIdx] + HEADER_H;
                const p1 = getPlayerInfo(m, 1, prevRound, mIdx);
                const p2 = getPlayerInfo(m, 2, prevRound, mIdx);

                return (
                  <div
                    key={m.id}
                    style={{
                      position: 'absolute',
                      top:  topPos,
                      left: colLeft,
                    }}
                  >
                    <MatchCard
                      match={m}
                      isAdmin={isAdmin}
                      p1Text={p1.text} p1Placeholder={p1.placeholder} p1Eliminated={p1.eliminated}
                      p2Text={p2.text} p2Placeholder={p2.placeholder} p2Eliminated={p2.eliminated}
                      onSuspend={() => onSuspendMatch?.(m)}
                      onResume={() => onResumeMatch?.(m)}
                    />
                  </div>
                );
              })}

              {/* SVG Conectores hacia la siguiente ronda */}
              {rIdx < elimRounds.length - 1 && (() => {
                const nextRound = elimRounds[rIdx + 1];
                const nextPositions = getTopPositions(rIdx + 1, (rounds[nextRound] ?? []).length);
                const svgLeft = colLeft + CARD_W;

                return (
                  <svg
                    style={{
                      position: 'absolute',
                      top:  HEADER_H,
                      left: svgLeft,
                      overflow: 'visible',
                      pointerEvents: 'none',
                    }}
                    width={COL_GAP}
                    height={totalH}
                  >
                    {roundMatches.map((_, mIdx) => {
                      // Cada par de partidos conecta a 1 en la siguiente ronda
                      const nextMatchIdx = Math.floor(mIdx / 2);
                      const topThis = positions[mIdx] + CARD_H / 2;
                      const topNext = (nextPositions[nextMatchIdx] ?? 0) + CARD_H / 2;

                      return (
                        <g key={mIdx}>
                          {/* Línea horizontal desde la tarjeta */}
                          <line
                            x1={0} y1={topThis}
                            x2={COL_GAP / 2} y2={topThis}
                            stroke="#CBD5E1" strokeWidth="1.5"
                          />
                          {/* Línea vertical de unión (solo en el primer de cada par) */}
                          {mIdx % 2 === 0 && positions[mIdx + 1] !== undefined && (
                            <line
                              x1={COL_GAP / 2} y1={topThis}
                              x2={COL_GAP / 2} y2={positions[mIdx + 1] + CARD_H / 2}
                              stroke="#CBD5E1" strokeWidth="1.5"
                            />
                          )}
                          {/* Línea horizontal hacia la siguiente columna (solo en el primer de cada par) */}
                          {mIdx % 2 === 0 && (
                            <line
                              x1={COL_GAP / 2} y1={topNext}
                              x2={COL_GAP}     y2={topNext}
                              stroke="#CBD5E1" strokeWidth="1.5"
                            />
                          )}
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Grupos Round Robin ─────────────────────────────────────────────────────
function RRGroups({
  rounds, isAdmin, onSuspendMatch, onResumeMatch,
}: {
  rounds: Record<string, BracketMatch[]>;
  isAdmin?: boolean;
  onSuspendMatch?: (m: BracketMatch) => void;
  onResumeMatch?:  (m: BracketMatch) => void;
}) {
  const rrRounds = ROUND_ORDER.filter(r => ['RR','RR_A','RR_B'].includes(r) && rounds[r]);
  if (rrRounds.length === 0) return null;

  // Agrupar por groupLabel
  const groups: Record<string, BracketMatch[]> = {};
  rrRounds.forEach(r => {
    rounds[r].forEach(m => {
      const g = m.groupLabel || (r === 'RR_A' ? 'A' : r === 'RR_B' ? 'B' : 'A');
      if (!groups[g]) groups[g] = [];
      groups[g].push(m);
    });
  });

  return (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
      {Object.entries(groups).sort().map(([groupLabel, gMatches]) => {
        // Standings
        const standings: Record<string, { name: string; wins: number; losses: number }> = {};
        gMatches.forEach(m => {
          [[m.player1Id, m.player1Name], [m.player2Id, m.player2Name]].forEach(([pid, name]) => {
            if (!pid) return;
            if (!standings[pid]) standings[pid] = { name: name || '', wins: 0, losses: 0 };
          });
          if (m.winnerId && (m.status === 'completed' || m.status === 'wo')) {
            const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
            if (standings[m.winnerId]) standings[m.winnerId].wins++;
            if (loserId && standings[loserId]) standings[loserId].losses++;
          }
        });
        const sorted = Object.entries(standings).sort(([,a],[,b]) => b.wins - a.wins);
        const done   = gMatches.filter(m => m.status === 'completed' || m.status === 'wo').length;

        return (
          <div key={groupLabel} style={{ flex: '1 1 280px', minWidth: '260px' }}>
            {/* Header */}
            <div style={{ backgroundColor: '#1B3A1B', color: 'white', borderRadius: '8px 8px 0 0', padding: '8px 14px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '700', fontSize: '13px' }}>Grupo {groupLabel}</span>
              <span style={{ fontSize: '11px', opacity: 0.7 }}>{done}/{gMatches.length} jugados</span>
            </div>
            <div style={{ border: '1px solid #E5E7EB', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
              {/* Standings */}
              {sorted.map(([pid, s], pos) => (
                <div key={pid} style={{ display: 'flex', alignItems: 'center', padding: '7px 12px', backgroundColor: pos === 0 ? '#F0FDF4' : 'white', borderBottom: '1px solid #F3F4F6' }}>
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
                  <span style={{ fontSize: '11px', color: '#6B7280' }}>{s.wins}V {s.losses}D</span>
                </div>
              ))}
              {/* Partidos */}
              <div style={{ padding: '8px 12px', backgroundColor: '#FAFAFA' }}>
                {gMatches.map(m => {
                  const isSusp = m.status === 'suspended';
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F3F4F6', fontSize: '11px' }}>
                      <span style={{ color: '#374151' }}>{lastName(m.player1Name)} vs {lastName(m.player2Name)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{
                          color: m.status === 'completed' ? '#15803D' : m.status === 'wo' ? '#92400E' : isSusp ? '#F97316' : '#9CA3AF',
                          fontWeight: '600',
                        }}>
                          {m.status === 'completed' ? `${m.sets1}-${m.sets2}`
                            : m.status === 'wo' ? 'W.O.'
                            : isSusp ? `⛈ ${m.partialResult?.sets1 ?? 0}-${m.partialResult?.sets2 ?? 0}`
                            : '—'}
                        </span>
                        {isAdmin && !['completed','wo'].includes(m.status) && m.player1Id && (
                          <button
                            onClick={() => isSusp ? onResumeMatch?.(m) : onSuspendMatch?.(m)}
                            style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', border: '1px solid #E5E7EB', backgroundColor: 'white', cursor: 'pointer', marginLeft: '2px' }}
                          >
                            {isSusp ? '▶' : '⛈'}
                          </button>
                        )}
                      </div>
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

// ── Componente principal ───────────────────────────────────────────────────
export default function BracketView({ matches, isAdmin, onSuspendMatch, onResumeMatch }: BracketViewProps) {
  const byCategory = useMemo(() => {
    const cat: Record<string, Record<string, BracketMatch[]>> = {};
    matches.forEach(m => {
      if (!cat[m.category])         cat[m.category] = {};
      if (!cat[m.category][m.round]) cat[m.category][m.round] = [];
      cat[m.category][m.round].push(m);
    });
    return cat;
  }, [matches]);

  return (
    <div>
      {Object.entries(byCategory).map(([category, rounds]) => {
        const hasRR   = ROUND_ORDER.some(r => ['RR','RR_A','RR_B'].includes(r) && rounds[r]);
        const hasElim = ROUND_ORDER.some(r => !['RR','RR_A','RR_B'].includes(r) && rounds[r]);
        const total     = Object.values(rounds).flat().length;
        const completed = Object.values(rounds).flat().filter(m => m.status === 'completed' || m.status === 'wo').length;
        const suspended = Object.values(rounds).flat().filter(m => m.status === 'suspended').length;

        return (
          <div key={category} style={{ marginBottom: '48px' }}>
            {/* Header categoría */}
            <div style={{ background: 'linear-gradient(135deg,#1B3A1B,#2D6A2D)', color: 'white', borderRadius: '10px', padding: '12px 18px', marginBottom: '24px' }}>
              <span style={{ fontWeight: '800', fontSize: '15px' }}>🎾 {category}</span>
              <span style={{ fontSize: '12px', opacity: 0.7, marginLeft: '12px' }}>
                {completed}/{total} completados
                {suspended > 0 && <span style={{ color: '#FED7AA', marginLeft: '8px' }}>⛈ {suspended} suspendidos</span>}
              </span>
            </div>

            {/* Grupos RR */}
            {hasRR && (
              <RRGroups rounds={rounds} isAdmin={isAdmin} onSuspendMatch={onSuspendMatch} onResumeMatch={onResumeMatch} />
            )}

            {/* Separador RR → Main Draw */}
            {hasRR && hasElim && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 20px' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }} />
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', backgroundColor: '#F3F4F6', padding: '4px 12px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                  ↓ MAIN DRAW
                </span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }} />
              </div>
            )}

            {/* Cuadro eliminación con conectores */}
            {hasElim && (
              <ElimBracket
                rounds={rounds}
                isAdmin={isAdmin}
                onSuspendMatch={onSuspendMatch}
                onResumeMatch={onResumeMatch}
              />
            )}
          </div>
        );
      })}
    </div>
  );  
}