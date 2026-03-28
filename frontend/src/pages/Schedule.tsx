// frontend/src/pages/Schedule.tsx
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Play, Calendar, X, AlertTriangle, CheckCircle, Clock, CloudRain } from 'lucide-react';
import { tournamentsApi } from '../api/tournaments.api';
import { courtsApi } from '../api/courts.api';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { matchesApi } from '../api/matches.api';
import SuspendModal from '../components/SuspendModal';
import { exportSchedulePdf } from '../utils/exportSchedulePdf';
import { mailApi } from '../api/mail.api';

// ── Constantes ────────────────────────────────────────────────────────────────
const ROUND_LABELS: Record<string, string> = {
  R64: 'R64', R32: 'R32', R16: 'R16', QF: 'Cuartos',
  SF: 'Semifinal', F: 'Final', RR: 'Round Robin',
  RR_A: 'Grupo A', RR_B: 'Grupo B', SF_M: 'SF Máster', F_M: 'Final Máster',
};

const ROUNDS = [
  { key: 'R64',  label: 'R64' },
  { key: 'R32',  label: 'R32' },
  { key: 'R16',  label: 'R16' },
  { key: 'QF',   label: 'Cuartos' },
  { key: 'SF',   label: 'Semifinal' },
  { key: 'F',    label: 'Final' },
  { key: 'RR',   label: 'Round Robin' },
  { key: 'RR_A', label: 'Grupo A' },
  { key: 'RR_B', label: 'Grupo B' },
  { key: 'SF_M', label: 'SF Máster' },
  { key: 'F_M',  label: 'Final Máster' },
];

const DEFAULT_DURATIONS: Record<string, number> = {
  R64: 75, R32: 75, R16: 75, QF: 90,
  SF: 120, F: 150, RR: 75, RR_A: 75, RR_B: 75, SF_M: 120, F_M: 150,
};

interface CourtBlock  { start: string; end: string; }
interface CourtConfig { courtId: string; blocks: CourtBlock[]; }

// ── Colores por ronda ─────────────────────────────────────────────────────────
const ROUND_COLOR: Record<string, { bg: string; color: string }> = {
  RR:   { bg: '#EDE9FE', color: '#5B21B6' },
  RR_A: { bg: '#EDE9FE', color: '#5B21B6' },
  RR_B: { bg: '#EDE9FE', color: '#5B21B6' },
  R64:  { bg: '#DBEAFE', color: '#1D4ED8' },
  R32:  { bg: '#DBEAFE', color: '#1D4ED8' },
  R16:  { bg: '#DBEAFE', color: '#1D4ED8' },
  QF:   { bg: '#FEF9C3', color: '#854D0E' },
  SF:   { bg: '#FEE2E2', color: '#991B1B' },
  F:    { bg: '#DCF9E0', color: '#14532D' },
};

// ── Modal: Asignar partido pendiente a un slot ────────────────────────────────
function AssignModal({
  tournamentId,
  courts,
  onClose,
  onAssigned,
  flatSchedule,
  preselectedMatch,
}: {
  tournamentId      : string;
  courts            : any[];
  onClose           : () => void;
  onAssigned        : () => void;
  flatSchedule      : any[];
  preselectedMatch ?: { id: string; label: string };  // suspended / specific match
}) {
  const [matchId,  setMatchId]  = useState(preselectedMatch?.id ?? '');
  const [date,     setDate]     = useState('');
  const [time,     setTime]     = useState('');
  const [courtId,  setCourtId]  = useState('');
  const [duration, setDuration] = useState<string>('90');

  // ── Partidos pendientes sin programar ─────────────────────────────────────
  const { data: pending = [], isLoading: loadingPending } = useQuery<any[]>({
    queryKey: ['pending-unscheduled', tournamentId],
    queryFn : async () => {
      const res = await api.get(`/matches/tournament/${tournamentId}/pending-unscheduled`);
      return res.data;
    },
  });

  const mutation = useMutation({
    mutationFn: () => {
      return api.patch(`/matches/${matchId}/reschedule`, {
        date,
        time,
        courtId : courtId || undefined,
        duration: Number(duration) || 90,
      });
    },
    onSuccess: () => { onAssigned(); onClose(); },
    onError  : (e: any) => alert(`❌ ${e?.response?.data?.message ?? 'Error al asignar'}`),
  });

  const canSubmit = matchId && date && time && Number(duration) > 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      zIndex: 3000, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{
        background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '520px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '1.25rem 1.5rem', borderBottom: '1px solid #E5E7EB',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#DBEAFE', borderRadius: '8px', padding: '6px' }}>
              <Plus size={18} color="#1D4ED8" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                {preselectedMatch ? 'Reprogramar Partido Suspendido' : 'Asignar Partido Pendiente'}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#6B7280' }}>
                {preselectedMatch ? 'Elige nueva fecha, cancha y hora' : loadingPending ? 'Cargando...' : `${pending.length} partido${pending.length !== 1 ? 's' : ''} sin programar`}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
            <X size={20} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* PASO 1 — Partido */}
          <div>
            <label style={labelStyle}>
              <span style={stepBadge}>1</span> Partido *
            </label>
            {preselectedMatch ? (
              /* Modo reprogramar suspendido: partido ya fijado */
              <div style={{ background: '#FFF7ED', border: '1.5px solid #FDE68A', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>⛈</span>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#92400E' }}>{preselectedMatch.label}</span>
              </div>
            ) : loadingPending ? (
              <p style={{ color: '#6B7280', fontSize: '0.85rem' }}>Cargando partidos...</p>
            ) : pending.length === 0 ? (
              <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '12px', textAlign: 'center', color: '#16A34A', fontWeight: 600, fontSize: '0.85rem' }}>
                ✅ No hay partidos pendientes por programar
              </div>
            ) : (
              <select
                value={matchId}
                onChange={e => { setMatchId(e.target.value);  }}
                style={selectStyle}
              >
                <option value="">— Selecciona el partido —</option>
                {(pending as any[])
                  .filter((m: any) => m.player1Name !== 'BYE' || m.player2Name !== 'BYE')
                  .map((m: any) => (
                    <option key={m.id} value={m.id}>
                      [{m.category}] {ROUND_LABELS[m.round] ?? m.round} · {m.player1Name || 'Por definir'} vs {m.player2Name || 'Por definir'}
                    </option>
                  ))}
              </select>
            )}
          </div>

          {/* PASO 2 — Fecha (solo si hay partido seleccionado) */}
          {matchId && (
            <div>
              <label style={labelStyle}>
                <span style={stepBadge}>2</span> Fecha del partido *
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{ ...selectStyle, cursor: 'pointer' }}
              />
            </div>
          )}

          {/* PASO 3 — Hora y cancha */}
          {matchId && date && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 auto' }}>
                <label style={labelStyle}>
                  <span style={stepBadge}>3</span> Hora *
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  style={{ padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '14px', fontWeight: 600, color: '#111827', width: '130px' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ ...labelStyle, paddingLeft: 0 }}>
                  Cancha
                </label>
                <select
                  value={courtId}
                  onChange={e => setCourtId(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">— Sin cancha asignada —</option>
                  {courts.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.sede ? ` (${c.sede})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* PASO 4 — Duración manual */}
          {matchId && date && time && (
            <div>
              <label style={labelStyle}>
                <span style={stepBadge}>4</span> Duración estimada (minutos) *
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="number"
                  min={15}
                  max={300}
                  step={5}
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  placeholder="Ej: 90"
                  style={{
                    width: '120px', padding: '9px 12px',
                    borderRadius: '8px', border: '1.5px solid #D1D5DB',
                    fontSize: '16px', fontWeight: 700,
                    textAlign: 'center', color: '#111827',
                  }}
                />
                <span style={{ fontSize: '13px', color: '#6B7280' }}>minutos</span>
                {/* Sugerencias rápidas */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[60, 75, 90, 120].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(String(d))}
                      style={{
                        padding: '5px 9px', borderRadius: '6px', border: 'none',
                        cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                        background: duration === String(d) ? '#1B3A1B' : '#F3F4F6',
                        color:      duration === String(d) ? '#fff'    : '#6B7280',
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                El referee define la duración según el sistema de juego del torneo
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {(pending.length > 0 || preselectedMatch) && (
          <div style={{
            padding: '1rem 1.5rem', borderTop: '1px solid #E5E7EB',
            display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0,
          }}>
            <button
              onClick={onClose}
              style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontWeight: 500 }}
            >
              Cancelar
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!canSubmit || mutation.isPending}
              style={{
                padding: '9px 22px', borderRadius: '8px', border: 'none',
                background: canSubmit ? '#1B3A1B' : '#D1D5DB',
                color: '#fff',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                fontWeight: 700, display: 'flex', alignItems: 'center', gap: '7px',
                opacity: mutation.isPending ? 0.7 : 1,
              }}
            >
              <CheckCircle size={15} />
              {mutation.isPending ? 'Asignando...' : 'Confirmar asignación'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Estilos reutilizables ────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px',
  fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '8px',
};

const stepBadge: React.CSSProperties = {
  background: '#1B3A1B', color: '#fff',
  borderRadius: '50%', width: '20px', height: '20px',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '11px', fontWeight: 800, flexShrink: 0,
};

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  borderRadius: '8px', border: '1.5px solid #D1D5DB',
  fontSize: '13px', background: '#fff', color: '#111827',
  boxSizing: 'border-box',
};

// ── Componente principal ──────────────────────────────────────────────────────
export default function Schedule() {
  const { isAdmin }   = useAuth();
  const queryClient   = useQueryClient();

  const [selectedTournament,   setSelectedTournament]   = useState('');
  const [selectedDate,         setSelectedDate]         = useState('');
  const [courtConfigs,         setCourtConfigs]         = useState<CourtConfig[]>([]);
  const [roundDurations,       setRoundDurations]       = useState<Record<string, number>>(DEFAULT_DURATIONS);
  const [scheduleResult,       setScheduleResult]       = useState<any>(null);
  const [observations,         setObservations]         = useState('');
  const [referee,              setReferee]              = useState('');
  const [director,             setDirector]             = useState('');
  const [withLed,              setWithLed]              = useState(false);
  const [maxMatchesPerPlayer,  setMaxMatchesPerPlayer]  = useState(2);
  const [customMaxMatches,     setCustomMaxMatches]     = useState('4');
  const [maxMatchesMode,       setMaxMatchesMode]       = useState<'preset'|'unlimited'|'custom'>('preset');
  const [restTimeBetweenMatches, setRestTimeBetweenMatches] = useState(0);
  const [singlesDoublesGap,      setSinglesDoublesGap]      = useState(0);
  const [roundBreakTime,         setRoundBreakTime]         = useState(0);
  const [showAssignModal,      setShowAssignModal]      = useState(false);
  const [filterDate,           setFilterDate]           = useState('');
  const [selectedCategories,   setSelectedCategories]   = useState<string[]>([]);
  const [showDeleteModal,      setShowDeleteModal]       = useState(false);
  const [showExportModal,      setShowExportModal]       = useState(false);
  const [showSendEmailModal,   setShowSendEmailModal]    = useState(false);
  const [sendEmailDates,       setSendEmailDates]        = useState<string[]>([]);
  const [sendEmailStatus,      setSendEmailStatus]       = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [sendEmailResult,      setSendEmailResult]       = useState<{ sent: number; total: number } | null>(null);
  const [modalDeleteDate,      setModalDeleteDate]       = useState('');
  const [modalDeleteModality,  setModalDeleteModality]   = useState<'all' | 'singles' | 'doubles'>('all');
  const [modalExportDates,     setModalExportDates]      = useState<string[]>([]);
  const [selectedRounds,       setSelectedRounds]        = useState<string[]>([]);
  const [roundModality,        setRoundModality]         = useState<'all' | 'singles' | 'doubles'>('all');
  const [suspendModal,         setSuspendModal]          = useState<{ isOpen: boolean; match: any | null }>({ isOpen: false, match: null });
  const [rescheduleMatch,      setRescheduleMatch]       = useState<{ id: string; label: string } | null>(null);
  const [bulkRescheduleModal,  setBulkRescheduleModal]   = useState(false);
  const [bulkDate,             setBulkDate]              = useState('');
  const [bulkStartTime,        setBulkStartTime]         = useState('08:00');
  const [bulkMaxTime,          setBulkMaxTime]           = useState('22:00');
  const [bulkCourts,           setBulkCourts]            = useState<string[]>([]);
  const [bulkLoading,          setBulkLoading]           = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: tournaments = [] } = useQuery({
    queryKey: ['tournaments'],
    queryFn: tournamentsApi.getAll,
  });

  const { data: courts = [] } = useQuery({
    queryKey: ['courts'],
    queryFn: courtsApi.getAll,
  });

  // Programación existente — se aplana en un array plano de filas
  const { data: flatSchedule = [], refetch: refetchSchedule } = useQuery<any[]>({
    queryKey: ['schedule-flat', selectedTournament],
    queryFn: async () => {
      const res = await api.get(`/tournaments/${selectedTournament}/schedule`);
      const raw = res.data;
      const flat: any[] = [];
      if (Array.isArray(raw)) return raw;
      Object.entries(raw).forEach(([date, sedes]: [string, any]) => {
        Object.entries(sedes).forEach(([sede, courtMap]: [string, any]) => {
          Object.entries(courtMap).forEach(([courtName, matches]: [string, any]) => {
            (matches as any[]).forEach((m: any) => flat.push({ ...m, date, sede, courtName }));
          });
        });
      });
      return flat;
    },
    enabled: !!selectedTournament,
  });

  // Categorías disponibles en el torneo
  const { data: tournamentCategories = [] } = useQuery<string[]>({
    queryKey: ['tournament-categories', selectedTournament],
    queryFn: async () => {
      const res = await api.get(`/matches/tournament/${selectedTournament}/categories`);
      return res.data;
    },
    enabled: !!selectedTournament,
  });

  // Partidos pendientes sin programar
  const { data: pendingUnscheduled = [], refetch: refetchPending } = useQuery<any[]>({
    queryKey: ['pending-unscheduled', selectedTournament],
    queryFn: async () => {
      const res = await api.get(`/matches/tournament/${selectedTournament}/pending-unscheduled`);
      return res.data;
    },
    enabled: !!selectedTournament,
  });

  // Partidos suspendidos
  const { data: suspendedMatches = [], refetch: refetchSuspended } = useQuery<any[]>({
    queryKey: ['suspended-schedule', selectedTournament],
    queryFn: () => matchesApi.getSuspended(selectedTournament),
    enabled: !!selectedTournament,
  });

  const refetchAll = () => { refetchSchedule(); refetchPending(); refetchSuspended(); };

  // ── Generar programación automática ───────────────────────────────────────
  const effectiveMaxMatches = maxMatchesMode === 'unlimited' ? 0
    : maxMatchesMode === 'custom' ? (parseInt(customMaxMatches) || 2)
    : maxMatchesPerPlayer;

  const generateMutation = useMutation({
    mutationFn: async () => {
      // Si hay filtro de rondas con modalidad específica, restringir categorías
      let effectiveCategories: string[] | undefined = selectedCategories.length > 0 ? selectedCategories : undefined;
      if (selectedRounds.length > 0 && roundModality !== 'all') {
        const base = selectedCategories.length > 0 ? selectedCategories : tournamentCategories;
        if (roundModality === 'singles') {
          effectiveCategories = base.filter((c: string) => !c.endsWith('_DOBLES'));
        } else {
          effectiveCategories = base.filter((c: string) => c.endsWith('_DOBLES'));
        }
        if (effectiveCategories.length === 0) effectiveCategories = undefined;
      }
      const res = await api.post(`/tournaments/${selectedTournament}/schedule`, {
        date: selectedDate,
        courts: courtConfigs,
        roundDurations,
        maxMatchesPerPlayer: effectiveMaxMatches,
        categories: effectiveCategories,
        roundFilter: selectedRounds.length > 0 ? selectedRounds : undefined,
        restTimeBetweenMatches,
        singlesDoublesGap,
        roundBreakTime,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setScheduleResult(data);
      refetchAll();
    },
  });

  // ── Desprogramar partido (liberar slot) ───────────────────────────────────
  const unscheduleMutation = useMutation({
    mutationFn: (matchId: string) => api.patch(`/matches/${matchId}/unschedule`),
    onSuccess: () => { refetchAll(); queryClient.invalidateQueries({ queryKey: ['pending-unscheduled', selectedTournament] }); },
  });

  // ── Suspender partido individual ──────────────────────────────────────────
  const suspendMutation = useMutation({
    mutationFn: ({ matchId, reason, resumeDate, partialResult }: {
      matchId: string; reason: string; resumeDate?: string;
      partialResult?: { sets1: number; sets2: number; games1: number; games2: number } | null;
    }) => matchesApi.suspendMatch(matchId, reason, resumeDate, partialResult),
    onSuccess: () => {
      setSuspendModal({ isOpen: false, match: null });
      refetchAll();
      queryClient.invalidateQueries({ queryKey: ['pending-unscheduled', selectedTournament] });
    },
  });
  
  // ── Declarar W.O. (gana un jugador) ──────────────────────────────────────
  const handleWalkover = async (matchId: string, winnerId: string) => {
    try {
      await api.patch(`/matches/${matchId}/walkover`, { winnerId });
      refetchAll();
      queryClient.invalidateQueries({ queryKey: ['pending-unscheduled', selectedTournament] });
    } catch {
      alert('❌ Error al declarar W.O.');
    }
  };

  // ── Eliminar programación de una fecha completa ───────────────────────────
  const clearScheduleMutation = useMutation({
    mutationFn: (date: string) =>
      api.delete(`/matches/tournament/${selectedTournament}/schedule/${date}`),
    onSuccess: (_data, date) => {
      refetchAll();
      // Quitar el filtro si era la fecha eliminada
      if (filterDate === date) setFilterDate('');
    },
    onError: () => alert('❌ Error al eliminar la programación'),
  });

  // Filas aplanadas de la programación existente
  const scheduleRows = useMemo(() => {
    if (scheduleResult) return [];
    return flatSchedule;
  }, [flatSchedule, scheduleResult]);

  // Fechas disponibles en la programación actual
  const availableDates = useMemo(() => {
    const dates = [...new Set(flatSchedule.map((r: any) => r.date || r.scheduledAt?.slice(0, 10)).filter(Boolean))];
    return (dates as string[]).sort();
  }, [flatSchedule]);

  // ── Helpers canchas ───────────────────────────────────────────────────────
  const sedeMap: Record<string, any[]> = {};
  (courts as any[]).forEach((c: any) => {
    const sede = c.sede || 'Principal';
    if (!sedeMap[sede]) sedeMap[sede] = [];
    sedeMap[sede].push(c);
  });

  const toggleCourt  = (courtId: string) => {
    if (courtConfigs.find(c => c.courtId === courtId)) {
      setCourtConfigs(courtConfigs.filter(c => c.courtId !== courtId));
    } else {
      setCourtConfigs([...courtConfigs, { courtId, blocks: [{ start: '08:00', end: '20:00' }] }]);
    }
  };
  const addBlock    = (courtId: string) =>
    setCourtConfigs(courtConfigs.map(c => c.courtId === courtId ? { ...c, blocks: [...c.blocks, { start: '08:00', end: '20:00' }] } : c));
  const removeBlock = (courtId: string, idx: number) =>
    setCourtConfigs(courtConfigs.map(c => c.courtId === courtId ? { ...c, blocks: c.blocks.filter((_, i) => i !== idx) } : c));
  const updateBlock = (courtId: string, idx: number, field: 'start' | 'end', value: string) =>
    setCourtConfigs(courtConfigs.map(c => c.courtId === courtId ? { ...c, blocks: c.blocks.map((b, i) => i === idx ? { ...b, [field]: value } : b) } : c));
  const isCourtSelected = (courtId: string) => courtConfigs.some(c => c.courtId === courtId);
  const getCourtConfig  = (courtId: string) => courtConfigs.find(c => c.courtId === courtId);

  // ── Calcular stats de programación ────────────────────────────────────────
  // Filtrar por fecha seleccionada si hay una
  const filteredSchedule = filterDate
    ? flatSchedule.filter(r => (r.date || r.scheduledAt?.slice(0, 10)) === filterDate)
    : flatSchedule;

  const scheduledCount  = filteredSchedule.length;
  const pendingCount    = pendingUnscheduled.length;
  const totalCount      = scheduledCount + pendingCount;

  // Fechas únicas con partidos
  const scheduledDates  = [...new Set(flatSchedule.map(r => r.date || r.scheduledAt?.slice(0, 10)).filter(Boolean))].sort();

  // Agrupar programación filtrada por fecha → sede → cancha
  const grouped: Record<string, Record<string, any[]>> = {};
  filteredSchedule.forEach((row: any) => {
    const date = row.date || row.scheduledAt?.slice(0, 10) || 'Sin fecha';
    const sede = row.sede || 'Principal';
    const key  = `${date}___${sede}`;
    if (!grouped[key]) grouped[key] = {};
    const courtKey = row.courtName || row.court || 'Sin cancha';
    if (!grouped[key][courtKey]) grouped[key][courtKey] = [];
    grouped[key][courtKey].push(row);
  });

  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-lat-dark">Programación</h1>
            <p className="text-gray-500">Gestión de horarios por sede y cancha</p>
          </div>
          {selectedTournament && isAdmin && (
            <button
              onClick={() => setShowAssignModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: '#1B3A1B', color: '#fff',
                padding: '10px 18px', borderRadius: '8px', border: 'none',
                cursor: 'pointer', fontWeight: 600, fontSize: '14px',
              }}
            >
              <Plus size={16} />
              Asignar partido pendiente
              {pendingCount > 0 && (
                <span style={{
                  background: '#DC2626', color: '#fff', borderRadius: '999px',
                  padding: '1px 7px', fontSize: '11px', fontWeight: 700,
                }}>
                  {pendingCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* ── Paso 1: Torneo y fecha ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1B3A1B', marginBottom: '16px' }}>
            1️⃣ Selecciona el torneo y la fecha
          </h2>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Torneo</label>
              <select
                value={selectedTournament}
                onChange={e => { setSelectedTournament(e.target.value); setScheduleResult(null); setFilterDate(''); }}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14px' }}
              >
                <option value="">— Selecciona un torneo —</option>
                {(tournaments as any[]).map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Fecha para generar</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14px' }}
              />
            </div>
          </div>
        </div>

        {/* ── Stats de programación ─────────────────────────────────────── */}
        {selectedTournament && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px', marginBottom: '24px',
          }}>
            {[
              { label: 'Total partidos',  value: totalCount,     bg: '#F9FAFB', color: '#374151', icon: '🎾' },
              { label: 'Programados',     value: scheduledCount, bg: '#F0FDF4', color: '#16A34A', icon: '✅' },
              { label: 'Sin programar',   value: pendingCount,   bg: pendingCount > 0 ? '#FEF2F2' : '#F0FDF4', color: pendingCount > 0 ? '#DC2626' : '#16A34A', icon: pendingCount > 0 ? '⚠️' : '✅' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '22px' }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Partidos suspendidos ──────────────────────────────────────── */}
        {selectedTournament && isAdmin && suspendedMatches.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6" style={{ border: '1.5px solid #FDE68A' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CloudRain size={16} color="#92400E" />
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#92400E' }}>
                  Partidos Suspendidos
                </h2>
                <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', fontSize: '11px', fontWeight: 700, padding: '1px 9px', borderRadius: '999px' }}>
                  {suspendedMatches.length}
                </span>
              </div>
              <button
                onClick={() => { setBulkDate(''); setBulkCourts([]); setBulkRescheduleModal(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#EFF6FF', border: '1.5px solid #BFDBFE', color: '#1D4ED8', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
              >
                <Calendar size={13} /> Reprogramar todos
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(suspendedMatches as any[]).map((m: any) => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: '10px', gap: '10px', flexWrap: 'wrap',
                  backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ padding: '1px 7px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                        {m.category}
                      </span>
                      <span style={{ padding: '1px 7px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, backgroundColor: '#F3E8FF', color: '#6B21A8' }}>
                        {ROUND_LABELS[m.round] ?? m.round}
                      </span>
                      <span style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>
                        {m.player1Name} <span style={{ color: '#9CA3AF', fontWeight: 400 }}>vs</span> {m.player2Name}
                      </span>
                    </div>
                    {m.suspendReason && (
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#92400E' }}>⛈ {m.suspendReason}</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setRescheduleMatch({
                        id: m.id,
                        label: `[${m.category}] ${ROUND_LABELS[m.round] ?? m.round} · ${m.player1Name} vs ${m.player2Name}`,
                      });
                      setShowAssignModal(true);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: '#EFF6FF', border: '1.5px solid #BFDBFE',
                      color: '#1D4ED8', borderRadius: '8px',
                      padding: '6px 12px', cursor: 'pointer',
                      fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap',
                    }}
                  >
                    <Calendar size={13} /> Reprogramar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Programación existente ────────────────────────────────────── */}
        {selectedTournament && flatSchedule.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1B3A1B', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Calendar size={18} /> Programación del torneo
                </h2>

                {/* Botón exportar PDF */}
                {filteredSchedule.length > 0 && (
                  <button
                    onClick={() => setShowExportModal(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: '#EFF6FF', border: '1.5px solid #BFDBFE',
                      color: '#1D4ED8', borderRadius: '8px',
                      padding: '7px 14px', cursor: 'pointer',
                      fontSize: '13px', fontWeight: 700,
                    }}
                  >
                    📄 Exportar PDF
                  </button>
                )}

                {/* Botón enviar programación por correo */}
                {isAdmin && filteredSchedule.length > 0 && (
                  <button
                    onClick={() => {
                      setSendEmailDates([]);
                      setSendEmailStatus('idle');
                      setSendEmailResult(null);
                      setShowSendEmailModal(true);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: '#F0FDF4', border: '1.5px solid #86EFAC',
                      color: '#15803D', borderRadius: '8px',
                      padding: '7px 14px', cursor: 'pointer',
                      fontSize: '13px', fontWeight: 700,
                    }}
                  >
                    ✉️ Enviar por correo
                  </button>
                )}

                {isAdmin && flatSchedule.length > 0 && (
                  <button
                    onClick={() => {
                      setModalDeleteDate(availableDates[0] || '');
                      setShowDeleteModal(true);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: '#FEF2F2', border: '1.5px solid #FECACA',
                      color: '#DC2626', borderRadius: '8px',
                      padding: '7px 14px', cursor: 'pointer',
                      fontSize: '13px', fontWeight: 700,
                    }}
                  >
                    🗑️ Eliminar programación
                  </button>
                )}
                {isAdmin && scheduleRows.length > 0 && (
                  <button
                    onClick={async () => {
                      if (!confirm(`⚠️ ¿Suspender TODA la programación del torneo?\n\nLos partidos quedarán marcados como SUSPENDIDOS (no pendientes).`)) return;
                      try {
                        // Obtener IDs únicos de todos los partidos programados
                        const matchIds = [...new Set(
                          scheduleRows.map((r: any) => r.matchId).filter(Boolean)
                        )];
                        await Promise.all(
                          matchIds.map(id => api.patch(`/matches/${id}/suspend`))
                        );
                        refetchAll();
                        alert(`✅ ${matchIds.length} partidos suspendidos.`);
                      } catch {
                        alert('❌ Error al suspender');
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: '#FEF3C7', border: '1.5px solid #FCD34D',
                      color: '#92400E', borderRadius: '8px',
                      padding: '7px 14px', cursor: 'pointer',
                      fontSize: '13px', fontWeight: 700,
                    }}
                  >
                    ⏸️ Suspender programación
                  </button>
                )}
              </div>

              {/* Filtro por fecha */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', color: '#6B7280' }}>Ver fecha:</span>
                <button
                  onClick={() => setFilterDate('')}
                  style={{
                    padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                    border: 'none', cursor: 'pointer',
                    background: !filterDate ? '#1B3A1B' : '#F3F4F6',
                    color:      !filterDate ? '#fff'    : '#374151',
                  }}
                >
                  Todas
                </button>
                {scheduledDates.map(d => (
                  <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {/* Botón seleccionar fecha */}
                    <button
                      onClick={() => setFilterDate(d)}
                      style={{
                        padding: '5px 12px', borderRadius: '6px 0 0 6px', fontSize: '12px', fontWeight: 600,
                        border: 'none', cursor: 'pointer',
                        background: filterDate === d ? '#1B3A1B' : '#F3F4F6',
                        color:      filterDate === d ? '#fff'    : '#374151',
                      }}
                    >
                      {d}
                    </button>
                    {/* Botón eliminar programación de esa fecha */}
                    <button
                      title={`Eliminar programación del ${d}`}
                      onClick={() => {
                        if (confirm(`¿Eliminar la programación del día ${d}?`)) {
                          clearScheduleMutation.mutate(d);
                        }
                      }}
                      disabled={clearScheduleMutation.isPending}
                      style={{
                        padding: '5px 7px', borderRadius: '0 6px 6px 0', fontSize: '11px',
                        border: 'none', cursor: 'pointer',
                        background: filterDate === d ? '#DC2626' : '#FEE2E2',
                        color: '#DC2626',
                        borderLeft: '1px solid #FECACA',
                      }}
                    >
                      <span style={{ color: filterDate === d ? '#fff' : '#DC2626', fontWeight: 700 }}>✕</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {Object.keys(grouped).length === 0 ? (
              <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '2rem' }}>Sin partidos para la fecha seleccionada</p>
            ) : (
              Object.entries(grouped).sort().map(([dateSedeKey, courtMap]) => {
                const [dateLabel, sedeLabel] = dateSedeKey.split('___');
                const totalInGroup = Object.values(courtMap).flat().length;
                return (
                  <div key={dateSedeKey} style={{ marginBottom: '24px' }}>
                    {/* Header sede/fecha */}
                    <div style={{
                      background: '#1B3A1B', color: '#fff', borderRadius: '8px',
                      padding: '10px 16px', marginBottom: '12px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span style={{ fontWeight: 700 }}>🏟️ {sedeLabel} · {dateLabel}</span>
                      <span style={{ fontSize: '12px', opacity: 0.7 }}>{totalInGroup} partido{totalInGroup !== 1 ? 's' : ''}</span>
                    </div>

                    {Object.entries(courtMap).map(([courtName, rows]) => (
                      <div key={courtName} style={{ marginBottom: '16px', border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
                        {/* Header cancha */}
                        <div style={{
                          background: '#F9FAFB', padding: '8px 16px',
                          display: 'flex', alignItems: 'center', gap: '8px',
                          borderBottom: '1px solid #E5E7EB',
                        }}>
                          <span style={{ fontWeight: 600, fontSize: '13px', color: '#374151' }}>🎾 {courtName}</span>
                          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>({rows.length} partido{rows.length !== 1 ? 's' : ''})</span>
                        </div>

                        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#F3F4F6' }}>
                              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 500, width: '80px' }}>Hora</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 500, width: '80px' }}>Ronda</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 500, width: '80px' }}>Categ.</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 500 }}>Jugador 1</th>
                              <th style={{ padding: '8px 4px', textAlign: 'center', color: '#6B7280', fontWeight: 500, width: '24px' }}>vs</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 500 }}>Jugador 2</th>
                              <th style={{ padding: '8px 12px', textAlign: 'center', color: '#6B7280', fontWeight: 500, width: '80px' }}>Dur.</th>
                              <th style={{ padding: '8px 12px', textAlign: 'center', color: '#6B7280', fontWeight: 500, width: '80px' }}>Estado</th>
                              {isAdmin && <th style={{ padding: '8px 12px', textAlign: 'center', color: '#6B7280', fontWeight: 500, width: '60px' }}>Acc.</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {(rows as any[])
                              .slice()
                              .sort((a, b) => {
                                const ta = a.scheduledAt || a.time || '';
                                const tb = b.scheduledAt || b.time || '';
                                return ta.localeCompare(tb);
                              })
                              .map((row: any, i: number) => {
                                const timeStr = row.scheduledAt
                                  ? new Date(row.scheduledAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
                                  : (row.time || '—');
                                const rColor  = ROUND_COLOR[row.round] || { bg: '#F3F4F6', color: '#374151' };
                                const isLive  = row.status === 'live';
                                const isDone  = row.status === 'completed' || row.status === 'wo';
                                return (
                                  <tr
                                    key={row.id || i}
                                    style={{
                                      borderBottom: '1px solid #F3F4F6',
                                      background: isLive ? '#FEF9C3' : isDone ? '#F9FAFB' : i % 2 === 0 ? '#fff' : '#FAFAFA',
                                      opacity: isDone ? 0.65 : 1,
                                    }}
                                  >
                                    <td style={{ padding: '9px 12px', fontWeight: 700, color: '#1B3A1B', whiteSpace: 'nowrap' }}>
                                      <Clock size={12} style={{ marginRight: '4px', verticalAlign: 'middle', opacity: 0.5 }} />
                                      {timeStr}
                                    </td>
                                    <td style={{ padding: '9px 12px' }}>
                                      <span style={{ padding: '2px 7px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: rColor.bg, color: rColor.color }}>
                                        {ROUND_LABELS[row.round] ?? row.round}
                                      </span>
                                    </td>
                                    <td style={{ padding: '9px 12px' }}>
                                      <span style={{ padding: '2px 7px', borderRadius: '999px', fontSize: '11px', background: '#DBEAFE', color: '#1D4ED8', fontWeight: 600 }}>
                                        {row.category}
                                      </span>
                                    </td>
                                    <td style={{ padding: '9px 12px', fontWeight: 500, color: '#111827' }}>
                                      {(row.player1Name && row.player1Name !== 'BYE') || (row.player1 && row.player1 !== 'BYE') ? (row.player1Name || row.player1) : <span style={{ color: '#9CA3AF', fontSize: '11px', fontStyle: 'italic' }}>Por definir</span>}
                                    </td>
                                    <td style={{ padding: '9px 4px', textAlign: 'center', color: '#9CA3AF', fontSize: '11px' }}>vs</td>
                                    <td style={{ padding: '9px 12px', fontWeight: 500, color: '#111827' }}>
                                      {(row.player2Name && row.player2Name !== 'BYE') || (row.player2 && row.player2 !== 'BYE') ? (row.player2Name || row.player2) : <span style={{ color: '#9CA3AF', fontSize: '11px', fontStyle: 'italic' }}>Por definir</span>}
                                    </td>
                                    <td style={{ padding: '9px 12px', textAlign: 'center', color: '#6B7280', fontSize: '12px' }}>
                                      {row.estimatedDuration || 90}min
                                    </td>
                                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                                      <span style={{
                                        padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                                        background: isLive ? '#FEE2E2' : isDone ? '#F3F4F6' : '#FEF9C3',
                                        color:      isLive ? '#DC2626' : isDone ? '#4B5563' : '#92400E',
                                      }}>
                                        {isLive ? '🔴 En vivo' : isDone ? '✓ Terminado' : '⏳ Pend.'}
                                      </span>
                                    </td>
                                    {isAdmin && (
                                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                          {!isDone && (
                                            <button
                                              title="Liberar slot (dejar pendiente)"
                                              onClick={() => {
                                                if (confirm('¿Liberar este partido? Quedará pendiente sin horario asignado.')) {
                                                  unscheduleMutation.mutate(row.matchId || row.id);
                                                }
                                              }}
                                              disabled={unscheduleMutation.isPending}
                                              style={{
                                                background: '#FEF2F2', border: '1px solid #FECACA',
                                                borderRadius: '6px', padding: '4px 8px',
                                                cursor: 'pointer', color: '#DC2626',
                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                fontSize: '11px', fontWeight: 600,
                                              }}
                                            >
                                              <X size={12} /> Liberar
                                            </button>
                                          )}
                                          {!isDone && (
                                            <button
                                              title="Suspender partido"
                                              onClick={() => setSuspendModal({
                                                isOpen: true,
                                                match: {
                                                  id: row.matchId || row.id,
                                                  player1Name: row.player1Name || row.player1 || 'Jugador 1',
                                                  player2Name: row.player2Name || row.player2 || 'Jugador 2',
                                                  round: row.round,
                                                  category: row.category,
                                                  sets1:  row.sets1  ?? 0,
                                                  sets2:  row.sets2  ?? 0,
                                                  games1: row.games1 ?? 0,
                                                  games2: row.games2 ?? 0,
                                                },
                                              })}
                                              style={{
                                                background: '#FEF3C7', border: '1px solid #FDE68A',
                                                borderRadius: '6px', padding: '4px 8px',
                                                cursor: 'pointer', color: '#92400E',
                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                fontSize: '11px', fontWeight: 600,
                                              }}
                                            >
                                              <CloudRain size={12} /> Susp.
                                            </button>
                                          )}
                                          {!isDone && (
                                            <button
                                              title="W.O. — gana jugador 1"
                                              onClick={() => {
                                                if (confirm('¿Declarar W.O.? El jugador 1 gana 6-0 6-0')) {
                                                  handleWalkover(row.matchId || row.id, row.player1Id);
                                                }
                                              }}
                                              style={{
                                                backgroundColor: '#FEF3C7', color: '#92400E',
                                                padding: '4px 8px', borderRadius: '6px',
                                                border: 'none', cursor: 'pointer', fontSize: '11px',
                                                fontWeight: 600,
                                              }}
                                            >
                                              W.O.
                                            </button>
                                          )}
                                          {!isDone && (
                                            <button
                                              title="Doble W.O. — ninguno se presentó"
                                              onClick={async () => {
                                                if (!confirm('⚠️ ¿Doble W.O.?\n\nNingún jugador se presentó.\nEl partido quedará 0-0 sin ganador.')) return;
                                                try {
                                                  await api.patch(`/matches/${row.matchId || row.id}/double-walkover`);
                                                  refetchAll();
                                                  queryClient.invalidateQueries({ queryKey: ['pending-unscheduled', selectedTournament] });
                                                } catch {
                                                  alert('❌ Error al declarar Doble W.O.');
                                                }
                                              }}
                                              style={{
                                                backgroundColor: '#F3F4F6', color: '#6B7280',
                                                padding: '4px 8px', borderRadius: '6px',
                                                border: '1px solid #D1D5DB', cursor: 'pointer', fontSize: '11px',
                                                fontWeight: 600,
                                              }}
                                            >
                                              D.W.O.
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Partidos sin programar ────────────────────────────────────── */}
        {selectedTournament && pendingUnscheduled.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#92400E', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} />
              Partidos sin programar ({pendingUnscheduled.length})
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FEF3C7' }}>
                    {['Categoría','Ronda','Jugador 1','Jugador 2','Acción'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#92400E', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(pendingUnscheduled as any[]).map((m: any, i: number) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #FEF3C7', background: i % 2 === 0 ? '#fff' : '#FFFBEB' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ padding: '2px 7px', borderRadius: '999px', fontSize: '11px', background: '#DBEAFE', color: '#1D4ED8', fontWeight: 600 }}>{m.category}</span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ padding: '2px 7px', borderRadius: '999px', fontSize: '11px', background: '#EDE9FE', color: '#5B21B6', fontWeight: 600 }}>
                          {ROUND_LABELS[m.round] ?? m.round}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 500, color: '#111827' }}>
                        {m.player1Name && m.player1Name !== 'BYE' ? m.player1Name : <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '11px' }}>Por definir</span>}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 500, color: '#111827' }}>
                        {m.player2Name && m.player2Name !== 'BYE' ? m.player2Name : <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '11px' }}>Por definir</span>}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {isAdmin ? (
                          <button
                            onClick={() => setShowAssignModal(true)}
                            style={{
                              padding: '5px 12px', borderRadius: '6px', border: 'none',
                              background: (!m.player1Name || !m.player2Name) ? '#6B7280' : '#1B3A1B',
                              color: '#fff', cursor: 'pointer',
                              fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px',
                            }}
                            title={(!m.player1Name || !m.player2Name) ? 'Pre-programar ronda (jugadores por definir)' : ''}
                          >
                            <Plus size={11} /> {(!m.player1Name || !m.player2Name) ? 'Pre-asignar' : 'Asignar'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#9CA3AF', fontStyle: 'italic' }}>En espera</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Generador automático ──────────────────────────────────────── */}
        {isAdmin && (
          <>
            {/* Paso 2: Canchas */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1B3A1B', marginBottom: '4px' }}>2️⃣ Canchas disponibles</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>Selecciona y configura los bloques horarios de cada cancha</p>
              {Object.entries(sedeMap).map(([sede, sedeCoruts]) => (
                <div key={sede} style={{ marginBottom: '20px' }}>
                  <div style={{ background: '#F3F4F6', borderRadius: '6px', padding: '8px 12px', marginBottom: '10px', fontWeight: 600, fontSize: '13px', color: '#374151' }}>
                    🏟️ {sede}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {sedeCoruts.map((court: any) => {
                      const selected = isCourtSelected(court.id);
                      const config   = getCourtConfig(court.id);
                      return (
                        <div key={court.id} style={{ border: `1.5px solid ${selected ? '#2D6A2D' : '#E5E7EB'}`, borderRadius: '8px', overflow: 'hidden' }}>
                          <div
                            onClick={() => toggleCourt(court.id)}
                            style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: selected ? '#F0FDF4' : '#fff' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <input type="checkbox" checked={selected} onChange={() => {}} style={{ accentColor: '#2D6A2D', width: '16px', height: '16px' }} />
                              <span style={{ fontWeight: 600, color: '#111827', fontSize: '14px' }}>🎾 {court.name}</span>
                              {court.surface && <span style={{ fontSize: '11px', color: '#6B7280', background: '#F3F4F6', padding: '2px 6px', borderRadius: '4px' }}>{court.surface}</span>}
                            </div>
                          </div>
                          {selected && config && (
                            <div style={{ padding: '12px 16px', borderTop: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                              {config.blocks.map((block, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '12px', color: '#6B7280', minWidth: '60px' }}>Bloque {idx + 1}</span>
                                  <span style={{ fontSize: '12px', color: '#374151' }}>De</span>
                                  <input type="time" value={block.start} onChange={e => updateBlock(court.id, idx, 'start', e.target.value)} style={{ border: '1px solid #D1D5DB', borderRadius: '6px', padding: '4px 8px', fontSize: '13px' }} />
                                  <span style={{ fontSize: '12px', color: '#374151' }}>a</span>
                                  <input type="time" value={block.end} onChange={e => updateBlock(court.id, idx, 'end', e.target.value)} style={{ border: '1px solid #D1D5DB', borderRadius: '6px', padding: '4px 8px', fontSize: '13px' }} />
                                  {config.blocks.length > 1 && (
                                    <button onClick={() => removeBlock(court.id, idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}>
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button onClick={() => addBlock(court.id)} style={{ fontSize: '12px', color: '#2D6A2D', background: 'none', border: '1px dashed #2D6A2D', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Plus size={12} /> Agregar bloque
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Paso 3: Duraciones */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1B3A1B', marginBottom: '4px' }}>3️⃣ Duración estimada por ronda</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>Ajusta el tiempo de cada partido según la ronda</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                {Object.entries(DEFAULT_DURATIONS).map(([key]) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{ROUND_LABELS[key] ?? key}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number" min={30} max={240} step={15}
                        value={roundDurations[key] || 90}
                        onChange={e => setRoundDurations({ ...roundDurations, [key]: Number(e.target.value) })}
                        style={{ width: '70px', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '4px 8px', fontSize: '14px', fontWeight: 600, textAlign: 'center' }}
                      />
                      <span style={{ fontSize: '12px', color: '#9CA3AF' }}>min</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#1B3A1B', marginBottom: '8px' }}>
                  Máximo de partidos por jugador por día
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {[1, 2, 3].map(n => (
                    <button key={n}
                      onClick={() => { setMaxMatchesMode('preset'); setMaxMatchesPerPlayer(n); }}
                      style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                        background: maxMatchesMode === 'preset' && maxMatchesPerPlayer === n ? '#2D6A2D' : '#F3F4F6',
                        color:      maxMatchesMode === 'preset' && maxMatchesPerPlayer === n ? 'white' : '#374151' }}>
                      {n} {n === 1 ? 'partido' : 'partidos'}
                    </button>
                  ))}
                  <button
                    onClick={() => setMaxMatchesMode('unlimited')}
                    style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                      background: maxMatchesMode === 'unlimited' ? '#1D4ED8' : '#F3F4F6',
                      color:      maxMatchesMode === 'unlimited' ? 'white'   : '#374151' }}>
                    ∞ Sin restricción
                  </button>
                  <button
                    onClick={() => setMaxMatchesMode('custom')}
                    style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                      background: maxMatchesMode === 'custom' ? '#7C3AED' : '#F3F4F6',
                      color:      maxMatchesMode === 'custom' ? 'white'   : '#374151' }}>
                    Personalizado
                  </button>
                  {maxMatchesMode === 'custom' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number" min={1} max={10}
                        value={customMaxMatches}
                        onChange={e => setCustomMaxMatches(e.target.value)}
                        style={{ width: '60px', padding: '7px 10px', borderRadius: '8px', border: '1.5px solid #7C3AED', fontSize: '14px', fontWeight: 700, textAlign: 'center' }}
                      />
                      <span style={{ fontSize: '13px', color: '#6B7280' }}>partidos</span>
                    </div>
                  )}
                </div>
                {maxMatchesMode === 'unlimited' && (
                  <p style={{ fontSize: '12px', color: '#1D4ED8', marginTop: '6px', fontWeight: 600 }}>
                    Sin restricción: el sistema asigna todos los partidos posibles sin límite por jugador
                  </p>
                )}
              </div>

              {/* Tiempo de descanso entre partidos */}
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#1B3A1B', marginBottom: '4px' }}>
                  Tiempo de descanso entre partidos del mismo jugador
                </label>
                <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '10px' }}>
                  Minutos mínimos de espera entre un partido y el siguiente del mismo jugador en el mismo día
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {[0, 15, 20, 30, 45, 60].map(n => (
                    <button key={n}
                      onClick={() => setRestTimeBetweenMatches(n)}
                      style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                        background: restTimeBetweenMatches === n ? '#2D6A2D' : '#F3F4F6',
                        color:      restTimeBetweenMatches === n ? 'white'   : '#374151' }}>
                      {n === 0 ? 'Sin espera' : `${n} min`}
                    </button>
                  ))}
                </div>
                {restTimeBetweenMatches > 0 && (
                  <p style={{ fontSize: '12px', color: '#2D6A2D', marginTop: '6px', fontWeight: 600 }}>
                    El sistema dejará al menos {restTimeBetweenMatches} min libres entre partidos del mismo jugador
                  </p>
                )}
              </div>

              {/* Tiempo de espera entre singles y dobles */}
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#1B3A1B', marginBottom: '4px' }}>
                  Tiempo de espera entre Singles y Dobles
                </label>
                <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '10px' }}>
                  Minutos de espera después de que terminen los partidos de singles antes de iniciar los de dobles
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {[0, 15, 30, 45, 60, 90].map(n => (
                    <button key={n}
                      onClick={() => setSinglesDoublesGap(n)}
                      style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                        background: singlesDoublesGap === n ? '#7C3AED' : '#F3F4F6',
                        color:      singlesDoublesGap === n ? 'white'   : '#374151' }}>
                      {n === 0 ? 'Sin espera' : `${n} min`}
                    </button>
                  ))}
                </div>
                {singlesDoublesGap > 0 && (
                  <p style={{ fontSize: '12px', color: '#6D28D9', marginTop: '6px', fontWeight: 600 }}>
                    Se esperarán {singlesDoublesGap} min después del último partido de singles antes de iniciar dobles
                  </p>
                )}
              </div>

              {/* Tiempo de espera entre rondas del cuadro principal */}
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#1B3A1B', marginBottom: '4px' }}>
                  Tiempo de espera entre rondas del cuadro principal
                </label>
                <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '10px' }}>
                  Minutos mínimos entre el fin de una ronda (R16, Cuartos, SF) y el inicio de la siguiente en el cuadro principal
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {[0, 15, 20, 30, 45, 60, 90].map(n => (
                    <button key={n}
                      onClick={() => setRoundBreakTime(n)}
                      style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                        background: roundBreakTime === n ? '#B45309' : '#F3F4F6',
                        color:      roundBreakTime === n ? 'white'   : '#374151' }}>
                      {n === 0 ? 'Sin espera' : `${n} min`}
                    </button>
                  ))}
                </div>
                {roundBreakTime > 0 && (
                  <p style={{ fontSize: '12px', color: '#B45309', marginTop: '6px', fontWeight: 600 }}>
                    Se dejarán {roundBreakTime} min libres entre rondas del cuadro principal (R16 → QF → SF → F)
                  </p>
                )}
              </div>
            </div>

            {/* Paso X — Filtro de rondas (opcional) */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1B3A1B', marginBottom: '4px' }}>
                🎯 Filtrar rondas a programar <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: '400' }}>(opcional — vacío = todas)</span>
              </h2>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>
                Selecciona solo las rondas que quieres programar hoy. Útil para programar por días.
              </p>

              {/* Filtro de modalidad para rondas */}
              <div style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginRight: '10px' }}>Modalidad:</span>
                {(['all', 'singles', 'doubles'] as const).map((m) => {
                  const label = m === 'all' ? 'Todos' : m === 'singles' ? 'Solo Singles' : 'Solo Dobles';
                  const active = roundModality === m;
                  return (
                    <button
                      key={m}
                      onClick={() => setRoundModality(m)}
                      style={{
                        marginRight: '6px', padding: '5px 13px', borderRadius: '20px', fontSize: '13px',
                        fontWeight: '600', cursor: 'pointer', border: '2px solid',
                        borderColor: active ? (m === 'doubles' ? '#7C3AED' : m === 'singles' ? '#B45309' : '#2D6A2D') : '#E5E7EB',
                        backgroundColor: active ? (m === 'doubles' ? '#F5F3FF' : m === 'singles' ? '#FFFBEB' : '#F0FDF4') : 'white',
                        color: active ? (m === 'doubles' ? '#6D28D9' : m === 'singles' ? '#92400E' : '#166534') : '#6B7280',
                      }}
                    >
                      {active ? '✓ ' : ''}{label}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {ROUNDS.map(({ key, label }) => {
                  const isSelected = selectedRounds.includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedRounds(prev =>
                        isSelected ? prev.filter(r => r !== key) : [...prev, key]
                      )}
                      style={{
                        padding: '7px 14px', borderRadius: '8px', fontSize: '13px',
                        fontWeight: '600', cursor: 'pointer', border: '2px solid',
                        borderColor: isSelected ? '#2D6A2D' : '#E5E7EB',
                        backgroundColor: isSelected ? '#F0FDF4' : 'white',
                        color: isSelected ? '#166534' : '#6B7280',
                      }}
                    >
                      {isSelected ? '✓ ' : ''}{label}
                    </button>
                  );
                })}
                {(selectedRounds.length > 0 || roundModality !== 'all') && (
                  <button
                    onClick={() => { setSelectedRounds([]); setRoundModality('all'); }}
                    style={{
                      padding: '7px 14px', borderRadius: '8px', fontSize: '13px',
                      fontWeight: '500', cursor: 'pointer', border: '1px solid #FECACA',
                      backgroundColor: '#FEF2F2', color: '#DC2626',
                    }}
                  >
                    ✕ Limpiar
                  </button>
                )}
              </div>
              {selectedRounds.length > 0 && (
                <p style={{ fontSize: '12px', color: '#2D6A2D', marginTop: '10px', fontWeight: '600' }}>
                  ✓ Solo se programarán: {selectedRounds.map(r => ROUNDS.find(x => x.key === r)?.label).join(', ')}
                  {roundModality !== 'all' && (
                    <span style={{ marginLeft: '6px', color: roundModality === 'doubles' ? '#6D28D9' : '#92400E' }}>
                      — {roundModality === 'singles' ? 'Solo Singles' : 'Solo Dobles'}
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Paso 4: Observaciones */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1B3A1B', marginBottom: '4px' }}>4️⃣ Datos del PDF (opcional)</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Árbitro</label>
                  <input value={referee} onChange={e => setReferee(e.target.value)} placeholder="Nombre del árbitro" style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' as any }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Director de torneo</label>
                  <input value={director} onChange={e => setDirector(e.target.value)} placeholder="Nombre del director" style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' as any }} />
                </div>
              </div>
              {/* Toggle LED */}
              <div
                onClick={() => setWithLed(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                  padding: '10px 14px', borderRadius: 10, marginBottom: 12,
                  border: `2px solid ${withLed ? '#F59E0B' : '#E5E7EB'}`,
                  background: withLed ? '#FFFBEB' : '#F9FAFB',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 40, height: 22, borderRadius: 999, position: 'relative', flexShrink: 0,
                  background: withLed ? '#F59E0B' : '#D1D5DB', transition: 'background 0.2s',
                }}>
                  <span style={{
                    position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s',
                    left: withLed ? 20 : 3, display: 'block',
                  }} />
                </div>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: withLed ? '#92400E' : '#374151' }}>
                    ⚡ Sistema de juego LET
                  </span>
                  <span style={{ fontSize: 11, color: '#6B7280', display: 'block' }}>
                    Si el saque toca la red y cae en el cuadro, se juega el punto (no se repite)
                  </span>
                </div>
              </div>

              <textarea
                value={observations}
                onChange={e => setObservations(e.target.value)}
                placeholder="Observaciones para el pie de la programación..."
                rows={2}
                style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' as any, fontFamily: 'inherit' }}
              />
            </div>

            {/* Selector de categorías */}
            {tournamentCategories.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1B3A1B', marginBottom: '4px' }}>
                  🏷️ Categorías a programar
                </h2>
                <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '14px' }}>
                  Selecciona solo las categorías que quieres incluir en esta programación
                </p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedCategories([...tournamentCategories])}
                    style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', background: '#F9FAFB', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                  >
                    ✅ Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCategories([])}
                    style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', background: '#F9FAFB', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                  >
                    ☐ Ninguna
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {tournamentCategories.map((cat: string) => {
                    const checked = selectedCategories.includes(cat);
                    return (
                      <label
                        key={cat}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '7px',
                          padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
                          border: `2px solid ${checked ? '#2D6A2D' : '#E5E7EB'}`,
                          background: checked ? '#F0FDF4' : '#F9FAFB',
                          fontWeight: checked ? 700 : 500,
                          fontSize: '13px',
                          color: checked ? '#166534' : '#374151',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setSelectedCategories(prev =>
                            checked ? prev.filter(c => c !== cat) : [...prev, cat]
                          )}
                          style={{ display: 'none' }}
                        />
                        {checked ? '✅' : '◻️'} {cat}
                      </label>
                    );
                  })}
                </div>
                {selectedCategories.length === 0 && (
                  <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '10px', fontWeight: 600 }}>
                    ⚠️ Debes seleccionar al menos una categoría
                  </p>
                )}
                {selectedCategories.length > 0 && (
                  <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '10px' }}>
                    {selectedCategories.length} de {tournamentCategories.length} categorías seleccionadas
                  </p>
                )}
              </div>
            )}

            {/* Botón generar */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <button
                onClick={() => generateMutation.mutate()}
                disabled={!selectedTournament || !selectedDate || courtConfigs.length === 0 || selectedCategories.length === 0 || generateMutation.isPending}
                style={{
                  width: '100%', background: '#2D6A2D', color: 'white',
                  padding: '14px', borderRadius: '10px', border: 'none',
                  cursor: (!selectedTournament || !selectedDate || courtConfigs.length === 0 || selectedCategories.length === 0) ? 'not-allowed' : 'pointer',
                  fontSize: '16px', fontWeight: 600, opacity: (!selectedTournament || !selectedDate || courtConfigs.length === 0 || selectedCategories.length === 0) ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                <Play size={20} />
                {generateMutation.isPending ? 'Generando programación...' : '🎾 Generar Programación Automática'}
              </button>
              {(!selectedTournament || !selectedDate) && (
                <p style={{ textAlign: 'center', fontSize: '13px', color: '#9CA3AF', marginTop: '8px' }}>
                  Selecciona torneo y fecha para continuar
                </p>
              )}
              {generateMutation.isError && (
                <div style={{ marginTop: '16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '14px', fontSize: '13px', color: '#DC2626' }}>
                  ❌ {(generateMutation.error as any)?.response?.data?.message || 'Error al generar. Verifica que el torneo tenga partidos pendientes y canchas activas.'}
                </div>
              )}
              {generateMutation.isSuccess && scheduleResult && (
                <div style={{ marginTop: '16px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '14px' }}>
                  <p style={{ fontWeight: 600, color: '#15803D', marginBottom: '8px' }}>✅ Programación generada</p>
                  <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: '#374151', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <span>📅 {scheduleResult.date}</span>
                    <span>🏟️ {scheduleResult.courtsUsed} canchas</span>
                    <span style={{ color: '#16A34A', fontWeight: 600 }}>✅ {scheduleResult.matchesScheduled} programados</span>
                    {scheduleResult.matchesPending > 0 && (
                      <span style={{ color: '#DC2626', fontWeight: 600 }}>⚠️ {scheduleResult.matchesPending} sin programar</span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const t = (tournaments as any[]).find((t: any) => t.id === selectedTournament);
                      exportSchedulePdf({ tournamentName: t?.name || 'Torneo', date: scheduleResult.date, city: 'Medellín', referee, director, observations, withLed, schedule: scheduleResult.schedule });
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1D4ED8', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
                  >
                    📄 Exportar PDF
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* ═══ MODAL ENVIAR PROGRAMACIÓN POR CORREO ═══ */}
      {showSendEmailModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '28px',
            width: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#15803D', marginBottom: '8px' }}>
              ✉️ Enviar programación por correo
            </h3>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
              Selecciona los días y se enviará el PDF de programación a todos los inscritos del torneo.
            </p>

            {sendEmailStatus === 'done' && sendEmailResult && (
              <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                <p style={{ margin: 0, color: '#15803D', fontWeight: 700, fontSize: '14px' }}>
                  ✅ ¡Correos enviados! ({sendEmailResult.sent} de {sendEmailResult.total} destinatarios)
                </p>
              </div>
            )}
            {sendEmailStatus === 'error' && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                <p style={{ margin: 0, color: '#DC2626', fontWeight: 700, fontSize: '14px' }}>
                  ❌ Error al enviar los correos. Intenta de nuevo.
                </p>
              </div>
            )}

            {sendEmailStatus !== 'done' && (
              <>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Días a enviar
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {availableDates.map(date => {
                    const selected = sendEmailDates.includes(date);
                    return (
                      <button
                        key={date}
                        onClick={() => setSendEmailDates(prev =>
                          selected ? prev.filter(d => d !== date) : [...prev, date]
                        )}
                        style={{
                          padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
                          fontWeight: '600', cursor: 'pointer', border: '2px solid',
                          borderColor: selected ? '#15803D' : '#E5E7EB',
                          backgroundColor: selected ? '#F0FDF4' : 'white',
                          color: selected ? '#15803D' : '#374151',
                        }}
                      >
                        {selected ? '✓ ' : ''}📅 {new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setSendEmailDates(
                      sendEmailDates.length === availableDates.length ? [] : [...availableDates]
                    )}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
                      fontWeight: '600', cursor: 'pointer', border: '2px solid',
                      borderColor: sendEmailDates.length === availableDates.length ? '#15803D' : '#E5E7EB',
                      backgroundColor: sendEmailDates.length === availableDates.length ? '#F0FDF4' : 'white',
                      color: sendEmailDates.length === availableDates.length ? '#15803D' : '#374151',
                    }}
                  >
                    {sendEmailDates.length === availableDates.length ? '✓ ' : ''}Todos los días
                  </button>
                </div>
                {sendEmailDates.length > 0 && (
                  <p style={{ fontSize: '12px', color: '#15803D', marginBottom: '16px', fontWeight: 600 }}>
                    ✓ {sendEmailDates.length} día{sendEmailDates.length > 1 ? 's' : ''} seleccionado{sendEmailDates.length > 1 ? 's' : ''}
                  </p>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                onClick={() => { setShowSendEmailModal(false); setSendEmailStatus('idle'); setSendEmailDates([]); }}
                style={{
                  padding: '9px 20px', borderRadius: '8px', fontSize: '13px',
                  border: '1px solid #E5E7EB', background: 'white',
                  cursor: 'pointer', color: '#374151', fontWeight: '500',
                }}
              >
                {sendEmailStatus === 'done' ? 'Cerrar' : 'Cancelar'}
              </button>
              {sendEmailStatus !== 'done' && (
                <button
                  disabled={sendEmailDates.length === 0 || sendEmailStatus === 'sending'}
                  onClick={async () => {
                    if (sendEmailDates.length === 0) return;
                    const tournament = (tournaments as any[]).find((t: any) => t.id === selectedTournament);
                    const sortedDates = [...sendEmailDates].sort();
                    const rowsForDays = (flatSchedule as any[])
                      .filter((r: any) => sortedDates.includes(r.date))
                      .map((r: any) => ({ ...r, court: r.courtName || r.court || 'Sin cancha' }));

                    const dateLabel = sortedDates.length === 1
                      ? new Date(sortedDates[0] + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
                      : `${sortedDates[0]} al ${sortedDates[sortedDates.length - 1]}`;

                    const safeName = (tournament?.name || 'Torneo').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
                    const dateTag  = sortedDates.length === 1 ? sortedDates[0] : `${sortedDates[0]}_al_${sortedDates[sortedDates.length - 1]}`;
                    const filename = `Programacion_${safeName}_${dateTag}.pdf`;

                    setSendEmailStatus('sending');
                    try {
                      const pdfBase64 = exportSchedulePdf({
                        tournamentName: tournament?.name || 'Torneo',
                        dates: sortedDates, city: 'Medellín',
                        referee, director, observations, withLed,
                        schedule: rowsForDays,
                        returnBase64: true,
                      }) as string;

                      const result = await mailApi.sendSchedule(selectedTournament, {
                        tournamentName: tournament?.name || 'Torneo',
                        dateLabel,
                        pdfBase64,
                        filename,
                      });
                      setSendEmailResult(result);
                      setSendEmailStatus('done');
                    } catch {
                      setSendEmailStatus('error');
                    }
                  }}
                  style={{
                    padding: '9px 20px', borderRadius: '8px', fontSize: '13px',
                    border: 'none',
                    cursor: sendEmailDates.length > 0 && sendEmailStatus !== 'sending' ? 'pointer' : 'not-allowed',
                    background: sendEmailDates.length > 0 ? '#15803D' : '#E5E7EB',
                    color: 'white', fontWeight: '700',
                    opacity: sendEmailDates.length > 0 && sendEmailStatus !== 'sending' ? 1 : 0.6,
                  }}
                >
                  {sendEmailStatus === 'sending' ? '⏳ Enviando...' : '✉️ Enviar correos'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL ELIMINAR PROGRAMACIÓN POR DÍA ═══ */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '28px',
            width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#DC2626', marginBottom: '8px' }}>
              🗑️ Eliminar programación
            </h3>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
              Selecciona el día que deseas eliminar. Los partidos volverán a estado pendiente.
            </p>

            {/* Toggle modalidad */}
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              Modalidad a eliminar
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {(['all', 'singles', 'doubles'] as const).map((m) => {
                const label = m === 'all' ? 'Todos' : m === 'singles' ? 'Solo Singles' : 'Solo Dobles';
                const active = modalDeleteModality === m;
                const activeColor = m === 'doubles' ? '#7C3AED' : m === 'singles' ? '#B45309' : '#DC2626';
                const activeBg = m === 'doubles' ? '#F5F3FF' : m === 'singles' ? '#FFFBEB' : '#FEF2F2';
                return (
                  <button key={m} onClick={() => setModalDeleteModality(m)} style={{
                    padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                    cursor: 'pointer', border: '2px solid',
                    borderColor: active ? activeColor : '#E5E7EB',
                    backgroundColor: active ? activeBg : 'white',
                    color: active ? activeColor : '#6B7280',
                  }}>
                    {active ? '✓ ' : ''}{label}
                  </button>
                );
              })}
            </div>

            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              Día a eliminar
            </label>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
              {availableDates.map(date => (
                <button
                  key={date}
                  onClick={() => setModalDeleteDate(date)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
                    fontWeight: '600', cursor: 'pointer', border: '2px solid',
                    borderColor: modalDeleteDate === date ? '#DC2626' : '#E5E7EB',
                    backgroundColor: modalDeleteDate === date ? '#FEF2F2' : 'white',
                    color: modalDeleteDate === date ? '#DC2626' : '#374151',
                  }}
                >
                  📅 {new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                </button>
              ))}
              <button
                onClick={() => setModalDeleteDate('ALL')}
                style={{
                  padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
                  fontWeight: '600', cursor: 'pointer', border: '2px solid',
                  borderColor: modalDeleteDate === 'ALL' ? '#DC2626' : '#E5E7EB',
                  backgroundColor: modalDeleteDate === 'ALL' ? '#FEF2F2' : 'white',
                  color: modalDeleteDate === 'ALL' ? '#DC2626' : '#374151',
                }}
              >
                ⚠️ Todos los días
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  padding: '9px 20px', borderRadius: '8px', fontSize: '13px',
                  border: '1px solid #E5E7EB', background: 'white',
                  cursor: 'pointer', color: '#374151', fontWeight: '500',
                }}
              >
                Cancelar
              </button>
              <button
                disabled={!modalDeleteDate}
                onClick={async () => {
                  if (!modalDeleteDate) return;
                  const modalityLabel = modalDeleteModality === 'doubles' ? ' de dobles' : modalDeleteModality === 'singles' ? ' de singles' : '';
                  const label = modalDeleteDate === 'ALL'
                    ? `TODA la programación${modalityLabel} del torneo`
                    : `la programación${modalityLabel} del ${modalDeleteDate}`;
                  if (!confirm(`¿Confirmas eliminar ${label}?\n\nLos partidos volverán a estado PENDIENTE.`)) return;
                  try {
                    const params = modalDeleteModality !== 'all' ? `?modality=${modalDeleteModality}` : '';
                    if (modalDeleteDate === 'ALL') {
                      await Promise.all(
                        availableDates.map(d =>
                          api.delete(`/matches/tournament/${selectedTournament}/schedule/${d}${params}`)
                        )
                      );
                    } else {
                      await api.delete(`/matches/tournament/${selectedTournament}/schedule/${modalDeleteDate}${params}`);
                    }
                    setShowDeleteModal(false);
                    setModalDeleteDate('');
                    setModalDeleteModality('all');
                    setScheduleResult(null);
                    refetchAll();
                    alert('✅ Programación eliminada correctamente');
                  } catch {
                    alert('❌ Error al eliminar la programación');
                  }
                }}
                style={{
                  padding: '9px 20px', borderRadius: '8px', fontSize: '13px',
                  border: 'none', cursor: modalDeleteDate ? 'pointer' : 'not-allowed',
                  background: modalDeleteDate ? '#DC2626' : '#E5E7EB',
                  color: 'white', fontWeight: '700',
                  opacity: modalDeleteDate ? 1 : 0.6,
                }}
              >
                🗑️ Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL EXPORTAR PDF POR DÍA ═══ */}
      {showExportModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '28px',
            width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1D4ED8', marginBottom: '8px' }}>
              📄 Exportar PDF
            </h3>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
              Selecciona uno o varios días para exportar en un solo PDF.
            </p>

            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              Días a exportar
            </label>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {availableDates.map(date => {
                const selected = modalExportDates.includes(date);
                return (
                  <button
                    key={date}
                    onClick={() => setModalExportDates(prev =>
                      selected ? prev.filter(d => d !== date) : [...prev, date]
                    )}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
                      fontWeight: '600', cursor: 'pointer', border: '2px solid',
                      borderColor: selected ? '#1D4ED8' : '#E5E7EB',
                      backgroundColor: selected ? '#EFF6FF' : 'white',
                      color: selected ? '#1D4ED8' : '#374151',
                    }}
                  >
                    {selected ? '✓ ' : ''}📅 {new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </button>
                );
              })}
              <button
                onClick={() => setModalExportDates(
                  modalExportDates.length === availableDates.length ? [] : [...availableDates]
                )}
                style={{
                  padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
                  fontWeight: '600', cursor: 'pointer', border: '2px solid',
                  borderColor: modalExportDates.length === availableDates.length ? '#1D4ED8' : '#E5E7EB',
                  backgroundColor: modalExportDates.length === availableDates.length ? '#EFF6FF' : 'white',
                  color: modalExportDates.length === availableDates.length ? '#1D4ED8' : '#374151',
                }}
              >
                {modalExportDates.length === availableDates.length ? '✓ ' : ''}Todos los días
              </button>
            </div>
            {modalExportDates.length > 0 && (
              <p style={{ fontSize: '12px', color: '#1D4ED8', marginBottom: '16px', fontWeight: 600 }}>
                ✓ {modalExportDates.length} día{modalExportDates.length > 1 ? 's' : ''} seleccionado{modalExportDates.length > 1 ? 's' : ''}
              </p>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowExportModal(false); setModalExportDates([]); }}
                style={{
                  padding: '9px 20px', borderRadius: '8px', fontSize: '13px',
                  border: '1px solid #E5E7EB', background: 'white',
                  cursor: 'pointer', color: '#374151', fontWeight: '500',
                }}
              >
                Cancelar
              </button>
              <button
                disabled={modalExportDates.length === 0}
                onClick={() => {
                  if (modalExportDates.length === 0) return;
                  const tournament = (tournaments as any[]).find((t: any) => t.id === selectedTournament);
                  const sortedDates = [...modalExportDates].sort();
                  const rowsForDays = (flatSchedule as any[])
                    .filter((r: any) => sortedDates.includes(r.date))
                    .map((r: any) => ({ ...r, court: r.courtName || r.court || 'Sin cancha' }));

                  exportSchedulePdf({
                    tournamentName: tournament?.name || 'Torneo',
                    dates: sortedDates,
                    city: 'Medellín',
                    referee,
                    director,
                    observations,
                    withLed,
                    schedule: rowsForDays,
                  });
                  setShowExportModal(false);
                  setModalExportDates([]);
                }}
                style={{
                  padding: '9px 20px', borderRadius: '8px', fontSize: '13px',
                  border: 'none', cursor: modalExportDates.length > 0 ? 'pointer' : 'not-allowed',
                  background: modalExportDates.length > 0 ? '#1D4ED8' : '#E5E7EB',
                  color: 'white', fontWeight: '700',
                  opacity: modalExportDates.length > 0 ? 1 : 0.6,
                }}
              >
                📄 Exportar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Asignar / Reprogramar partido ────────────────────────── */}
      {showAssignModal && (
        <AssignModal
          tournamentId={selectedTournament}
          courts={courts as any[]}
          onClose={() => { setShowAssignModal(false); setRescheduleMatch(null); }}
          onAssigned={() => {
            setRescheduleMatch(null);
            refetchAll();
            queryClient.invalidateQueries({ queryKey: ['pending-unscheduled', selectedTournament] });
            queryClient.invalidateQueries({ queryKey: ['suspended-schedule', selectedTournament] });
          }}
          flatSchedule={flatSchedule}
          preselectedMatch={rescheduleMatch ?? undefined}
        />
      )}

      {/* ── Modal Suspender partido individual ──────────────────────────── */}
      <SuspendModal
        isOpen={suspendModal.isOpen}
        mode="match"
        match={suspendModal.match}
        onConfirm={(reason, resumeDate, partialResult) => {
          if (!suspendModal.match) return;
          suspendMutation.mutate({ matchId: suspendModal.match.id, reason, resumeDate, partialResult });
        }}
        onCancel={() => setSuspendModal({ isOpen: false, match: null })}
        isLoading={suspendMutation.isPending}
      />

      {/* ── Modal Reprogramar TODOS los suspendidos ──────────────────────── */}
      {bulkRescheduleModal && (() => {
        const suspended = suspendedMatches as any[];
        const timeToMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
        const minToTime = (n: number) => `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
        const MAX_HOUR = bulkMaxTime ? timeToMin(bulkMaxTime) : 22 * 60;

        // Cursor de cada cancha: máximo entre hora de inicio global y fin del último partido ya programado ese día
        const getCourtCursor = (courtId: string) => {
          const court = (courts as any[]).find((c: any) => c.id === courtId);
          const base = bulkStartTime ? timeToMin(bulkStartTime) : 8 * 60;
          if (!court) return base;
          const existing = (flatSchedule as any[]).filter(m => m.date === bulkDate && m.courtName === court.name);
          let lastEnd = base;
          for (const m of existing) {
            lastEnd = Math.max(lastEnd, timeToMin(m.time) + (parseInt(m.duration) || 90));
          }
          return lastEnd;
        };

        // Algoritmo greedy con detección de conflictos de jugadores:
        // Para cada partido busca la cancha con el slot más temprano donde ambos jugadores estén libres
        const buildPreview = () => {
          if (bulkCourts.length === 0 || !bulkDate) return [];

          // Cursors por cancha (próximo slot libre a partir de la hora de inicio global)
          const courtCursors: Record<string, number> = {};
          for (const courtId of bulkCourts) {
            courtCursors[courtId] = getCourtCursor(courtId);
          }

          // Intervalos ocupados por jugador (solo de los partidos que ya estamos asignando)
          const playerSlots: Record<string, { start: number; end: number }[]> = {};
          const isFree = (pid: string | undefined, s: number, e: number) =>
            !pid || !(playerSlots[pid] || []).some(b => s < b.end && e > b.start);
          const markBusy = (pid: string | undefined, s: number, e: number) => {
            if (!pid) return;
            if (!playerSlots[pid]) playerSlots[pid] = [];
            playerSlots[pid].push({ start: s, end: e });
          };

          return suspended.map(m => {
            const dur = m.estimatedDuration || 90;
            const p1 = m.player1Id, p2 = m.player2Id;
            let bestSlot: { courtId: string; time: number } | null = null;

            // Probar cada cancha — encontrar el slot más temprano sin conflicto de jugadores
            for (const courtId of bulkCourts) {
              let start = courtCursors[courtId];
              for (let attempt = 0; attempt < 12; attempt++) {
                const end = start + dur;
                if (end > MAX_HOUR) break;
                if (isFree(p1, start, end) && isFree(p2, start, end)) {
                  if (!bestSlot || start < bestSlot.time) bestSlot = { courtId, time: start };
                  break;
                }
                start += dur; // avanzar un slot e intentar de nuevo
              }
            }

            if (!bestSlot) return { match: m, courtId: bulkCourts[0], time: null as string | null, fits: false };

            const end = bestSlot.time + dur;
            courtCursors[bestSlot.courtId] = Math.max(courtCursors[bestSlot.courtId], end);
            markBusy(p1, bestSlot.time, end);
            markBusy(p2, bestSlot.time, end);
            return { match: m, courtId: bestSlot.courtId, time: minToTime(bestSlot.time), fits: true };
          });
        };

        const preview = buildPreview();
        const schedulable = preview.filter(p => p.fits);
        const unschedulable = preview.filter(p => !p.fits);

        const handleBulkConfirm = async () => {
          if (!bulkDate || bulkCourts.length === 0) return;
          setBulkLoading(true);
          try {
            for (const item of schedulable) {
              await matchesApi.rescheduleMatch(item.match.id, {
                scheduledAt: `${bulkDate}T${item.time}:00`,
                courtId: item.courtId || undefined,
                estimatedDuration: item.match.estimatedDuration || 90,
              });
            }
            setBulkRescheduleModal(false);
            refetchAll();
          } finally {
            setBulkLoading(false);
          }
        };

        const toggleCourt = (courtId: string) => {
          setBulkCourts(prev =>
            prev.includes(courtId) ? prev.filter(id => id !== courtId) : [...prev, courtId]
          );
        };

        const canConfirm = bulkDate && bulkStartTime && bulkCourts.length > 0 && !bulkLoading;

        return (
          <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', backgroundColor:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)' }}
            onClick={() => setBulkRescheduleModal(false)}>
            <div style={{ backgroundColor:'white', borderRadius:'18px', boxShadow:'0 30px 70px rgba(0,0,0,0.25)', width:'100%', maxWidth:'640px', margin:'0 16px', overflow:'hidden', maxHeight:'92vh', display:'flex', flexDirection:'column' }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ background:'linear-gradient(135deg,#1B3A1B,#2D6A2D)', padding:'18px 24px', flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <span style={{ fontSize:'24px' }}>📅</span>
                  <div>
                    <h2 style={{ color:'white', fontSize:'16px', fontWeight:'700', margin:0 }}>Reprogramar partidos suspendidos</h2>
                    <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'12px', margin:0 }}>{suspended.length} partidos · define fecha, horario y canchas a usar</p>
                  </div>
                </div>
              </div>

              <div style={{ padding:'18px 24px', overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:'16px' }}>

                {/* Nueva fecha + hora inicio + hora máxima */}
                <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', alignItems:'flex-end' }}>
                  <div>
                    <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#4B5563', marginBottom:'6px' }}>
                      📅 Nueva fecha <span style={{ color:'#EF4444' }}>*</span>
                    </label>
                    <input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)}
                      style={{ width:'170px', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #D1D5DB', fontSize:'13px', boxSizing:'border-box' as any }} />
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#4B5563', marginBottom:'6px' }}>
                      ⏰ Hora inicio <span style={{ color:'#EF4444' }}>*</span>
                    </label>
                    <input type="time" value={bulkStartTime} onChange={e => setBulkStartTime(e.target.value)}
                      style={{ width:'110px', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #D1D5DB', fontSize:'13px', color:'#1F2937', boxSizing:'border-box' as any }} />
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#4B5563', marginBottom:'6px' }}>
                      🕐 Hora fin <span style={{ color:'#EF4444' }}>*</span>
                    </label>
                    <input type="time" value={bulkMaxTime} onChange={e => setBulkMaxTime(e.target.value)}
                      style={{ width:'110px', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #D1D5DB', fontSize:'13px', color:'#1F2937', boxSizing:'border-box' as any }} />
                  </div>
                </div>

                {/* Selección de canchas */}
                <div>
                  <p style={{ fontSize:'12px', fontWeight:'600', color:'#4B5563', marginBottom:'8px' }}>
                    🏟️ Canchas a usar <span style={{ color:'#EF4444' }}>*</span>
                    <span style={{ color:'#9CA3AF', fontWeight:400, marginLeft:'6px' }}>Selecciona una o varias · los partidos se distribuyen en paralelo entre ellas</span>
                  </p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
                    {(courts as any[]).map((c: any) => {
                      const selected = bulkCourts.includes(c.id);
                      return (
                        <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 14px', borderRadius:'10px', border: selected ? '1.5px solid #6366F1' : '1.5px solid #E5E7EB', backgroundColor: selected ? '#EEF2FF' : 'white', cursor:'pointer', transition:'all 0.12s' }}
                          onClick={() => toggleCourt(c.id)}>
                          <div style={{ width:'16px', height:'16px', borderRadius:'4px', border: selected ? '2px solid #6366F1' : '2px solid #D1D5DB', backgroundColor: selected ? '#6366F1' : 'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            {selected && <span style={{ color:'white', fontSize:'11px', fontWeight:'800' }}>✓</span>}
                          </div>
                          <span style={{ fontSize:'13px', fontWeight: selected ? '700' : '500', color:'#1F2937' }}>{c.name}</span>
                          {c.sede && <span style={{ fontSize:'11px', color:'#9CA3AF' }}>{c.sede}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Vista previa de distribución */}
                {preview.length > 0 && (
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
                      <p style={{ fontSize:'12px', fontWeight:'600', color:'#4B5563', margin:0 }}>Vista previa:</p>
                      {schedulable.length > 0 && <span style={{ fontSize:'11px', backgroundColor:'#DCFCE7', color:'#15803D', padding:'2px 8px', borderRadius:'999px', fontWeight:'600' }}>✓ {schedulable.length} programados</span>}
                      {unschedulable.length > 0 && <span style={{ fontSize:'11px', backgroundColor:'#FEF2F2', color:'#DC2626', padding:'2px 8px', borderRadius:'999px', fontWeight:'600' }}>⚠ {unschedulable.length} sin espacio</span>}
                    </div>
                    <div style={{ border:'1px solid #E5E7EB', borderRadius:'8px', overflow:'hidden' }}>
                      {preview.map((item, i) => {
                        const court = (courts as any[]).find((c: any) => c.id === item.courtId);
                        return (
                          <div key={item.match.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 12px', backgroundColor: !item.fits ? '#FEF2F2' : i%2===0 ? 'white' : '#FAFAFA', borderBottom: i < preview.length-1 ? '1px solid #F3F4F6' : 'none', fontSize:'11px' }}>
                            {item.fits
                              ? <span style={{ fontWeight:'700', color:'#6366F1', minWidth:'42px' }}>{item.time}</span>
                              : <span style={{ fontWeight:'700', color:'#DC2626', minWidth:'42px', fontSize:'10px' }}>Sin esp.</span>
                            }
                            <span style={{ backgroundColor: item.fits ? '#EEF2FF' : '#FEE2E2', color: item.fits ? '#4338CA' : '#DC2626', padding:'1px 7px', borderRadius:'999px', fontWeight:'600', whiteSpace:'nowrap' }}>{court?.name || '—'}</span>
                            <span style={{ color: item.fits ? '#374151' : '#9CA3AF', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {item.match.player1Name} vs {item.match.player2Name}
                            </span>
                            <span style={{ color:'#9CA3AF', whiteSpace:'nowrap' }}>{ROUND_LABELS[item.match.round] ?? item.match.round}</span>
                          </div>
                        );
                      })}
                    </div>
                    {unschedulable.length > 0 && (
                      <p style={{ fontSize:'11px', color:'#9CA3AF', marginTop:'6px', margin:'6px 0 0' }}>
                        ⚠ Los partidos en rojo superan las {bulkMaxTime || '22:00'}. Quedarán suspendidos sin cambios.
                      </p>
                    )}
                  </div>
                )}

                {bulkCourts.length === 0 && (
                  <p style={{ fontSize:'12px', color:'#9CA3AF', textAlign:'center', padding:'8px 0', margin:0 }}>
                    Selecciona al menos una cancha para ver la distribución de partidos.
                  </p>
                )}

                {/* Botones */}
                <div style={{ display:'flex', gap:'10px', paddingTop:'4px' }}>
                  <button onClick={() => setBulkRescheduleModal(false)} disabled={bulkLoading}
                    style={{ flex:1, padding:'11px', borderRadius:'10px', border:'1.5px solid #E5E7EB', backgroundColor:'white', color:'#374151', fontWeight:'600', fontSize:'14px', cursor:'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={handleBulkConfirm} disabled={!canConfirm}
                    style={{ flex:2, padding:'11px', borderRadius:'10px', border:'none', background: !canConfirm ? '#D1D5DB' : 'linear-gradient(135deg,#1D4ED8,#1E40AF)', color:'white', fontWeight:'700', fontSize:'14px', cursor: !canConfirm ? 'not-allowed' : 'pointer', boxShadow: canConfirm ? '0 4px 14px rgba(29,78,216,0.3)' : 'none' }}>
                    {bulkLoading ? '⏳ Reprogramando...' : schedulable.length > 0 ? `✓ Programar ${schedulable.length} de ${suspended.length} partidos` : 'Selecciona cancha y fecha'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
