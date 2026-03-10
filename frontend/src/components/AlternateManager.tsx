// frontend/src/components/AlternateManager.tsx  ← ARCHIVO NUEVO
// Gestión de jugadores alternos:
//   1. Asignar alterno a BYE del cuadro principal
//   2. Reemplazar jugador retirado en partidos pendientes (RR o Main Draw)

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, AlertTriangle, CheckCircle, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { matchesApi } from '../api/matches.api';
import api from '../api/axios';

const CATEGORIES = ['INTERMEDIA', 'SEGUNDA', 'TERCERA', 'CUARTA', 'QUINTA'];

const ROUND_LABEL: Record<string, string> = {
  R64: '64avos', R32: '32avos', R16: '16avos',
  QF: 'Cuartos', SF: 'Semifinal', F: 'Final',
  RR: 'Round Robin', RR_A: 'Grupo A', RR_B: 'Grupo B',
};

// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  tournamentId: string;
  isAdmin: boolean;
}

export default function AlternateManager({ tournamentId, isAdmin }: Props) {
  const queryClient = useQueryClient();

  // Categoría seleccionada para operar
  const [category, setCategory] = useState(CATEGORIES[0]);

  // Modo activo: 'bye' | 'retire'
  const [mode, setMode] = useState<'bye' | 'retire'>('bye');

  // Estado del modal de confirmación
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    type: 'bye' | 'retire';
    matchId?: string;
    retiredPlayerId?: string;
    retiredName?: string;
    byeRound?: string;
  }>({ open: false, type: 'bye' });

  // Búsqueda de alterno
  const [alternateSearch, setAlternateSearch] = useState('');
  const [selectedAlternate, setSelectedAlternate] = useState<any>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // ── Datos: BYEs disponibles ────────────────────────────────────────────────
  const { data: byes = [], refetch: refetchByes } = useQuery({
    queryKey: ['byes', tournamentId, category],
    queryFn: () => matchesApi.getByesForCategory(tournamentId, category),
    enabled: !!tournamentId && mode === 'bye',
  });

  // ── Datos: Inscritos aprobados (para buscar alternos) ─────────────────────
  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments-approved', tournamentId],
    queryFn: async () => {
      const res = await api.get(`/enrollments/tournament/${tournamentId}`);
      return (res.data as any[]).filter((e: any) => e.status === 'approved');
    },
    enabled: !!tournamentId,
  });

  // ── Datos: Jugadores activos en esta categoría (para modo retire) ──────────
  const { data: activePlayers = [] } = useQuery({
    queryKey: ['active-players', tournamentId, category],
    queryFn: async () => {
      const res = await api.get(`/enrollments/tournament/${tournamentId}`);
      return (res.data as any[]).filter(
        (e: any) => e.status === 'approved' && e.category === category
      );
    },
    enabled: !!tournamentId && mode === 'retire',
  });

  // ── Búsqueda de jugadores alternos ────────────────────────────────────────
  const searchResults = alternateSearch.length >= 2
    ? (enrollments as any[]).filter((e: any) =>
        e.playerName?.toLowerCase().includes(alternateSearch.toLowerCase()) &&
        e.category === category
      )
    : [];

  // ── Mutation: asignar BYE ─────────────────────────────────────────────────
  const assignByeMutation = useMutation({
    mutationFn: () => matchesApi.assignAlternateToBye(
      tournamentId,
      confirmModal.matchId!,
      selectedAlternate.playerId,
      category,
    ),
    onSuccess: () => {
      setFeedback({ ok: true, msg: `✅ ${selectedAlternate.playerName} asignado al BYE correctamente.` });
      resetModal();
      refetchByes();
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] });
    },
    onError: (e: any) => {
      setFeedback({ ok: false, msg: `❌ ${e?.response?.data?.message || 'Error al asignar alterno'}` });
      resetModal();
    },
  });

  // ── Mutation: reemplazar retirado ─────────────────────────────────────────
  const replaceMutation = useMutation({
    mutationFn: () => matchesApi.replaceRetiredPlayer(
      tournamentId,
      confirmModal.retiredPlayerId!,
      selectedAlternate.playerId,
      category,
    ),
    onSuccess: (data: any) => {
      setFeedback({
        ok: true,
        msg: `✅ ${confirmModal.retiredName} reemplazado por ${selectedAlternate.playerName} en ${data.matchesUpdated} partido(s).`,
      });
      resetModal();
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['active-players', tournamentId, category] });
    },
    onError: (e: any) => {
      setFeedback({ ok: false, msg: `❌ ${e?.response?.data?.message || 'Error al reemplazar jugador'}` });
      resetModal();
    },
  });

  const resetModal = () => {
    setConfirmModal({ open: false, type: 'bye' });
    setSelectedAlternate(null);
    setAlternateSearch('');
    setShowSearch(false);
  };

  const openByeModal = (match: any) => {
    setConfirmModal({ open: true, type: 'bye', matchId: match.id, byeRound: match.round });
    setFeedback(null);
  };

  const openRetireModal = (player: any) => {
    setConfirmModal({ open: true, type: 'retire', retiredPlayerId: player.playerId, retiredName: player.playerName });
    setFeedback(null);
  };

  if (!isAdmin) return null;

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: '800', color: '#1B3A1B', margin: '0 0 4px' }}>
          👥 Gestión de Alternos
        </h2>
        <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
          Asigna un jugador alterno a un BYE del cuadro, o reemplaza un jugador retirado en sus partidos pendientes.
        </p>
      </div>

      {/* ── Feedback ────────────────────────────────────────────────────────── */}
      {feedback && (
        <div style={{
          padding: '12px 16px', borderRadius: '10px', marginBottom: '16px',
          backgroundColor: feedback.ok ? '#F0FDF4' : '#FEF2F2',
          border: `1.5px solid ${feedback.ok ? '#86EFAC' : '#FECACA'}`,
          color: feedback.ok ? '#15803D' : '#DC2626',
          fontSize: '13px', fontWeight: '600',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{feedback.msg}</span>
          <button onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'inherit' }}>✕</button>
        </div>
      )}

      {/* ── Controles: Categoría + Modo ─────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '4px' }}>
            Categoría
          </label>
          <select
            value={category}
            onChange={e => { setCategory(e.target.value); setFeedback(null); }}
            style={{ border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#111', outline: 'none' }}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Tabs Modo */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '18px' }}>
          {([
            { key: 'bye',    label: '🎾 Llenar BYE',         desc: 'Partidos con slot vacío' },
            { key: 'retire', label: '🔄 Reemplazar retirado', desc: 'Jugador que se retira del torneo' },
          ] as const).map(m => (
            <button
              key={m.key}
              onClick={() => { setMode(m.key); setFeedback(null); }}
              style={{
                padding: '8px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: '700', transition: 'all 0.15s',
                backgroundColor: mode === m.key ? '#1B3A1B' : '#F3F4F6',
                color: mode === m.key ? 'white' : '#6B7280',
                boxShadow: mode === m.key ? '0 3px 10px rgba(27,58,27,0.3)' : 'none',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODO: LLENAR BYE                                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {mode === 'bye' && (
        <div>
          <div style={{ backgroundColor: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#1E40AF', fontWeight: '600' }}>
              ℹ️ Un <strong>BYE</strong> es un slot vacío del cuadro de eliminación directa. Cuando hay un número impar de clasificados, el sistema asigna BYEs automáticamente a las siembras más altas para que pasen de ronda sin jugar. Puedes ocupar ese slot con un jugador alterno <strong>siempre que el partido no haya sido programado</strong>.
            </p>
          </div>

          {(byes as any[]).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', backgroundColor: '#F9FAFB', borderRadius: '12px', border: '1.5px dashed #E5E7EB' }}>
              <p style={{ fontSize: '32px', margin: '0 0 10px' }}>✅</p>
              <p style={{ fontWeight: '700', color: '#374151', margin: '0 0 4px' }}>No hay BYEs disponibles</p>
              <p style={{ color: '#9CA3AF', fontSize: '13px', margin: 0 }}>Todos los slots del cuadro están ocupados o los BYEs ya fueron programados.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(byes as any[]).map((match: any) => (
                <ByeCard key={match.id} match={match} onAssign={() => openByeModal(match)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODO: REEMPLAZAR RETIRADO                                             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {mode === 'retire' && (
        <div>
          <div style={{ backgroundColor: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#92400E', fontWeight: '600' }}>
              ⚠️ Solo puedes reemplazar a un jugador que <strong>no haya jugado ningún partido</strong> en la fase actual. Si ya completó partidos de RR o está en ronda avanzada del Main Draw, no es posible reemplazarlo.
            </p>
          </div>

          {(activePlayers as any[]).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', backgroundColor: '#F9FAFB', borderRadius: '12px', border: '1.5px dashed #E5E7EB' }}>
              <p style={{ color: '#9CA3AF', fontSize: '13px' }}>No hay jugadores inscritos aprobados en esta categoría.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(activePlayers as any[]).map((player: any) => (
                <ActivePlayerRow
                  key={player.playerId}
                  player={player}
                  tournamentId={tournamentId}
                  category={category}
                  onRetire={() => openRetireModal(player)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL DE CONFIRMACIÓN + SELECCIÓN DE ALTERNO                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {confirmModal.open && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
          padding: '16px',
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '18px', padding: '28px',
            width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>

            {/* Título */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <span style={{ fontSize: '24px' }}>{confirmModal.type === 'bye' ? '🎾' : '🔄'}</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#1B3A1B' }}>
                  {confirmModal.type === 'bye' ? 'Asignar alterno al BYE' : `Reemplazar a ${confirmModal.retiredName}`}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6B7280' }}>
                  {confirmModal.type === 'bye'
                    ? `Ronda: ${ROUND_LABEL[confirmModal.byeRound!] || confirmModal.byeRound}`
                    : `Categoría ${category} — todos sus partidos PENDIENTES serán transferidos`}
                </p>
              </div>
            </div>

            {/* Buscador de alterno */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '8px' }}>
                Selecciona el jugador alterno:
              </label>

              {/* Jugador seleccionado */}
              {selectedAlternate ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: '#F0FDF4', border: '2px solid #22C55E',
                  borderRadius: '10px', padding: '12px 14px',
                }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: '800', fontSize: '14px', color: '#15803D' }}>
                      ✓ {selectedAlternate.playerName}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#166534' }}>
                      Categoría: {selectedAlternate.category}
                    </p>
                  </div>
                  <button
                    onClick={() => { setSelectedAlternate(null); setAlternateSearch(''); setShowSearch(true); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9CA3AF' }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div>
                  {/* Input de búsqueda */}
                  <div style={{ position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                    <input
                      value={alternateSearch}
                      onChange={e => { setAlternateSearch(e.target.value); setShowSearch(true); }}
                      onFocus={() => setShowSearch(true)}
                      placeholder="Buscar jugador por nombre..."
                      style={{
                        width: '100%', border: '1.5px solid #E5E7EB', borderRadius: '9px',
                        padding: '10px 12px 10px 36px', fontSize: '13px', outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Resultados */}
                  {showSearch && searchResults.length > 0 && (
                    <div style={{
                      border: '1.5px solid #E5E7EB', borderRadius: '9px', marginTop: '4px',
                      maxHeight: '200px', overflowY: 'auto', backgroundColor: 'white',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}>
                      {searchResults.map((e: any) => (
                        <button
                          key={e.playerId}
                          onClick={() => { setSelectedAlternate(e); setAlternateSearch(''); setShowSearch(false); }}
                          style={{
                            width: '100%', textAlign: 'left', padding: '10px 14px',
                            border: 'none', background: 'none', cursor: 'pointer',
                            borderBottom: '1px solid #F3F4F6', fontSize: '13px',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <span style={{ fontWeight: '700', color: '#1B3A1B' }}>{e.playerName}</span>
                          <span style={{ color: '#9CA3AF', marginLeft: '8px', fontSize: '11px' }}>{e.category}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {showSearch && alternateSearch.length >= 2 && searchResults.length === 0 && (
                    <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '6px', margin: '6px 0 0' }}>
                      No se encontraron jugadores aprobados con ese nombre en categoría {category}.
                    </p>
                  )}

                  <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '6px', margin: '6px 0 0' }}>
                    Solo aparecen jugadores con inscripción aprobada en esta categoría.
                  </p>
                </div>
              )}
            </div>

            {/* Advertencia de confirmación */}
            {selectedAlternate && (
              <div style={{ backgroundColor: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: '10px', padding: '12px', marginBottom: '20px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#92400E', fontWeight: '600' }}>
                  {confirmModal.type === 'bye'
                    ? `¿Confirmas asignar a ${selectedAlternate.playerName} al BYE de ${ROUND_LABEL[confirmModal.byeRound!] || confirmModal.byeRound}? El partido quedará como PENDIENTE.`
                    : `¿Confirmas reemplazar a ${confirmModal.retiredName} por ${selectedAlternate.playerName}? Todos los partidos pendientes de ${confirmModal.retiredName} serán transferidos al alterno.`}
                </p>
              </div>
            )}

            {/* Botones */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={resetModal}
                style={{ flex: 1, padding: '11px', borderRadius: '9px', border: '1.5px solid #E5E7EB', background: 'white', cursor: 'pointer', fontWeight: '600', fontSize: '13px', color: '#6B7280' }}
              >
                Cancelar
              </button>
              <button
                disabled={!selectedAlternate || assignByeMutation.isPending || replaceMutation.isPending}
                onClick={() => {
                  if (confirmModal.type === 'bye') assignByeMutation.mutate();
                  else replaceMutation.mutate();
                }}
                style={{
                  flex: 2, padding: '11px', borderRadius: '9px', border: 'none', cursor: selectedAlternate ? 'pointer' : 'not-allowed',
                  background: selectedAlternate
                    ? 'linear-gradient(135deg, #1B3A1B 0%, #2D6A2D 100%)'
                    : '#E5E7EB',
                  color: selectedAlternate ? 'white' : '#9CA3AF',
                  fontWeight: '700', fontSize: '13px',
                  boxShadow: selectedAlternate ? '0 3px 10px rgba(27,58,27,0.3)' : 'none',
                }}
              >
                {assignByeMutation.isPending || replaceMutation.isPending
                  ? 'Procesando...'
                  : confirmModal.type === 'bye' ? 'Confirmar asignación' : 'Confirmar reemplazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta de BYE disponible
// ─────────────────────────────────────────────────────────────────────────────
function ByeCard({ match, onAssign }: { match: any; onAssign: () => void }) {
  const realPlayer = match.player1Name || match.player2Name || '—';
  const realPlayerId = match.player1Id || match.player2Id;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
      backgroundColor: 'white', border: '1.5px solid #E5E7EB', borderRadius: '12px', padding: '14px 18px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Icono ronda */}
        <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '18px' }}>🎾</span>
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: '800', fontSize: '14px', color: '#1B3A1B' }}>
            {ROUND_LABEL[match.round] || match.round}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#6B7280' }}>
            Jugador con pase directo:{' '}
            <span style={{ fontWeight: '700', color: '#1D4ED8' }}>{realPlayer}</span>
            {match.seeding1 || match.seeding2
              ? <span style={{ marginLeft: '6px', backgroundColor: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: '4px', fontSize: '11px' }}>Siembra {match.seeding1 || match.seeding2}</span>
              : null}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#22C55E', fontWeight: '600' }}>
            ● Slot disponible para alterno
          </p>
        </div>
      </div>

      <button
        onClick={onAssign}
        style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          backgroundColor: '#1B3A1B', color: 'white',
          padding: '9px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer',
          fontSize: '13px', fontWeight: '700',
          boxShadow: '0 3px 10px rgba(27,58,27,0.3)',
        }}
      >
        <UserPlus size={15} />
        Asignar alterno
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fila de jugador activo (para modo retire)
// ─────────────────────────────────────────────────────────────────────────────
function ActivePlayerRow({
  player, tournamentId, category, onRetire,
}: {
  player: any; tournamentId: string; category: string; onRetire: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Cargar partidos pendientes solo al expandir
  const { data: pendingMatches = [], isLoading } = useQuery({
    queryKey: ['pending-matches', tournamentId, player.playerId, category],
    queryFn: () => matchesApi.getPendingMatchesForPlayer(tournamentId, player.playerId, category),
    enabled: expanded,
  });

  const canRetire = !expanded || (pendingMatches as any[]).length > 0;

  return (
    <div style={{ border: '1.5px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Row principal */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '13px', color: '#15803D', flexShrink: 0 }}>
            {player.playerName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: '#1B3A1B' }}>{player.playerName}</p>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6B7280' }}>
              Categoría: {player.category}
              {player.seeding ? ` · Siembra ${player.seeding}` : ''}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: '7px', padding: '5px 10px', cursor: 'pointer', fontSize: '11px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            Ver partidos {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button
            onClick={onRetire}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              backgroundColor: '#FEF2F2', color: '#DC2626',
              border: '1.5px solid #FECACA', borderRadius: '8px',
              padding: '7px 13px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
            }}
          >
            <AlertTriangle size={13} />
            Retirar y reemplazar
          </button>
        </div>
      </div>

      {/* Partidos pendientes expandibles */}
      {expanded && (
        <div style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#F9FAFB', padding: '12px 16px' }}>
          {isLoading ? (
            <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>Cargando partidos...</p>
          ) : (pendingMatches as any[]).length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={14} style={{ color: '#22C55E' }} />
              <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>
                Este jugador no tiene partidos pendientes. Si ya jugó todos sus partidos, no puede ser reemplazado.
              </p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#374151', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Partidos pendientes ({(pendingMatches as any[]).length}):
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(pendingMatches as any[]).map((m: any) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', borderRadius: '8px', padding: '8px 12px', border: '1px solid #F3F4F6' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: '5px' }}>
                      {ROUND_LABEL[m.round] || m.round}
                    </span>
                    <span style={{ fontSize: '12px', color: '#374151' }}>
                      <strong>{m.player1Name || 'BYE'}</strong>
                      <span style={{ color: '#9CA3AF', margin: '0 6px' }}>vs</span>
                      <strong>{m.player2Name || 'BYE'}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}