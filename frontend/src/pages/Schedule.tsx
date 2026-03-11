// frontend/src/pages/Schedule.tsx
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Play, Calendar, X, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { tournamentsApi } from '../api/tournaments.api';
import { courtsApi } from '../api/courts.api';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { exportSchedulePdf } from '../utils/exportSchedulePdf';

// ── Constantes ────────────────────────────────────────────────────────────────
const ROUND_LABELS: Record<string, string> = {
  R64: 'R64', R32: 'R32', R16: 'R16', QF: 'Cuartos',
  SF: 'Semifinal', F: 'Final', RR: 'Round Robin',
  RR_A: 'Grupo A', RR_B: 'Grupo B', SF_M: 'SF Máster', F_M: 'Final Máster',
};

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
}: {
  tournamentId : string;
  courts       : any[];
  onClose      : () => void;
  onAssigned   : () => void;
  flatSchedule : any[];   // programación ya cargada — para calcular slots ocupados
}) {
  const [matchId,  setMatchId]  = useState('');
  const [date,     setDate]     = useState('');
  const [slotKey,  setSlotKey]  = useState('');   // "courtId|||HH:MM"
  const [duration, setDuration] = useState<string>('90');

  // ── Partidos pendientes sin programar ─────────────────────────────────────
  const { data: pending = [], isLoading: loadingPending } = useQuery<any[]>({
    queryKey: ['pending-unscheduled', tournamentId],
    queryFn : async () => {
      const res = await api.get(`/matches/tournament/${tournamentId}/pending-unscheduled`);
      return res.data;
    },
  });

  // ── Slots disponibles: se calculan a partir de la programación existente ──
  // Lógica: para cada cancha que ya tiene partidos ese día, calculamos
  // los huecos disponibles (gaps). También incluimos canchas sin partidos ese día.
  const availableSlots = useMemo(() => {
    if (!date) return [];

    // Partidos de ese día en la programación ya cargada
    const dayRows = flatSchedule.filter(r => {
      const d = r.date || r.scheduledAt?.slice(0, 10);
      return d === date;
    });

    // Horas ocupadas por cancha: { courtName → Set<"HH:MM"> }
    const occupiedByCourt = new Map<string, Set<string>>();
    dayRows.forEach((r: any) => {
      const key = r.courtName || r.court || 'Sin cancha';
      if (!occupiedByCourt.has(key)) occupiedByCourt.set(key, new Set());
      const t = r.time || (r.scheduledAt ? new Date(r.scheduledAt).toTimeString().slice(0,5) : null);
      if (t) occupiedByCourt.get(key)!.add(t);
    });

    const slots: { courtId: string; courtName: string; sede: string; time: string }[] = [];

    // Para cada cancha, generar slots de 08:00 a 21:00 cada 30 min
    // y marcar cuáles están libres
    courts.forEach((c: any) => {
      const occupied = occupiedByCourt.get(c.name) || new Set<string>();
      // Slots de 07:00 a 22:00 cada 30 minutos
      for (let h = 7; h < 22; h++) {
        for (const min of [0, 30]) {
          const t = `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
          if (!occupied.has(t)) {
            slots.push({
              courtId  : c.id,
              courtName: c.name,
              sede     : c.sede || 'Principal',
              time     : t,
            });
          }
        }
      }
    });

    // Ordenar por hora, luego por cancha
    return slots.sort((a, b) =>
      a.time.localeCompare(b.time) || a.courtName.localeCompare(b.courtName)
    );
  }, [date, flatSchedule, courts]);

  // Agrupar slots por hora para el select agrupado
  const slotsByHour = useMemo(() => {
    const map = new Map<string, typeof availableSlots>();
    availableSlots.forEach(s => {
      const h = s.time.slice(0, 2) + ':00';
      if (!map.has(h)) map.set(h, []);
      map.get(h)!.push(s);
    });
    return map;
  }, [availableSlots]);

  const selectedSlot = availableSlots.find(s => `${s.courtId}|||${s.time}` === slotKey);

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedSlot) throw new Error('Selecciona un slot');
      return api.patch(`/matches/${matchId}/reschedule`, {
        date,
        time    : selectedSlot.time,
        courtId : selectedSlot.courtId,
        duration: Number(duration) || 90,
      });
    },
    onSuccess: () => { onAssigned(); onClose(); },
    onError  : (e: any) => alert(`❌ ${e?.response?.data?.message ?? 'Error al asignar'}`),
  });

  const canSubmit = matchId && date && slotKey && Number(duration) > 0;

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
                Asignar Partido Pendiente
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#6B7280' }}>
                {loadingPending ? 'Cargando...' : `${pending.length} partido${pending.length !== 1 ? 's' : ''} sin programar`}
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
            {loadingPending ? (
              <p style={{ color: '#6B7280', fontSize: '0.85rem' }}>Cargando partidos...</p>
            ) : pending.length === 0 ? (
              <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '12px', textAlign: 'center', color: '#16A34A', fontWeight: 600, fontSize: '0.85rem' }}>
                ✅ No hay partidos pendientes por programar
              </div>
            ) : (
              <select
                value={matchId}
                onChange={e => { setMatchId(e.target.value); setSlotKey(''); }}
                style={selectStyle}
              >
                <option value="">— Selecciona el partido —</option>
                {(pending as any[]).map((m: any) => (
                  <option key={m.id} value={m.id}>
                    [{m.category}] {ROUND_LABELS[m.round] ?? m.round} · {m.player1Name} vs {m.player2Name}
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
                onChange={e => { setDate(e.target.value); setSlotKey(''); }}
                style={{ ...selectStyle, cursor: 'pointer' }}
              />
              {date && availableSlots.length === 0 && (
                <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '6px' }}>
                  ⚠ No hay slots disponibles para esa fecha. Todas las canchas están ocupadas.
                </p>
              )}
            </div>
          )}

          {/* PASO 3 — Slot disponible (solo si hay fecha) */}
          {matchId && date && availableSlots.length > 0 && (
            <div>
              <label style={labelStyle}>
                <span style={stepBadge}>3</span> Cancha y hora disponible *
              </label>
              <select
                value={slotKey}
                onChange={e => setSlotKey(e.target.value)}
                style={selectStyle}
                size={1}
              >
                <option value="">— Selecciona cancha y hora —</option>
                {[...slotsByHour.entries()].map(([hour, slots]) => (
                  <optgroup key={hour} label={`🕐 ${hour}`}>
                    {slots.map(s => (
                      <option key={`${s.courtId}|||${s.time}`} value={`${s.courtId}|||${s.time}`}>
                        {s.time} — {s.courtName} ({s.sede})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {selectedSlot && (
                <div style={{ marginTop: '8px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '7px', padding: '8px 12px', fontSize: '13px', color: '#15803D', display: 'flex', gap: '16px' }}>
                  <span>🎾 <strong>{selectedSlot.courtName}</strong></span>
                  <span>🕐 <strong>{selectedSlot.time}</strong></span>
                  <span>🏟️ {selectedSlot.sede}</span>
                </div>
              )}
            </div>
          )}

          {/* PASO 4 — Duración manual */}
          {matchId && date && slotKey && (
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
        {pending.length > 0 && (
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
  const [maxMatchesPerPlayer,  setMaxMatchesPerPlayer]  = useState(2);
  const [showAssignModal,      setShowAssignModal]      = useState(false);
  const [filterDate,           setFilterDate]           = useState('');
  const [selectedCategories,   setSelectedCategories]   = useState<string[]>([]);

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

  const refetchAll = () => { refetchSchedule(); refetchPending(); };

  // ── Generar programación automática ───────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/tournaments/${selectedTournament}/schedule`, {
        date: selectedDate,
        courts: courtConfigs,
        roundDurations,
        maxMatchesPerPlayer,
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
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
                    onClick={() => {
                      const tournament = (tournaments as any[]).find((t: any) => t.id === selectedTournament);
                      
                      const scheduleForPdf = filteredSchedule.map((r: any) => ({
                        time    : r.time || (r.scheduledAt ? new Date(r.scheduledAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''),
                        court   : r.court || r.courtName || '',
                        sede    : r.sede || 'Principal',
                        round   : r.round || '',
                        category: r.category || '',
                        player1 : r.player1Name || r.player1 || '',
                        player2 : r.player2Name || r.player2 || '',
                        duration: r.duration || (r.estimatedDuration ? `${r.estimatedDuration} min` : '90 min'),
                      }));

                      const dateToExport = filterDate || (scheduledDates[0] || new Date().toISOString().split('T')[0]);

                      exportSchedulePdf({
                        tournamentName: tournament?.name || 'Torneo',
                        date          : dateToExport,
                        city          : 'Medellín',
                        referee,
                        director,
                        observations,
                        schedule      : scheduleForPdf,
                      });
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: '#1D4ED8', border: 'none',
                      color: 'white', borderRadius: '8px',
                      padding: '7px 14px', cursor: 'pointer',
                      fontSize: '13px', fontWeight: 700,
                    }}
                  >
                    📄 Exportar PDF
                  </button>
                )}

                {isAdmin && flatSchedule.length > 0 && (
                  <button
                    onClick={() => {
                      const dates = [...new Set(flatSchedule.map((r: any) => r.date || r.scheduledAt?.slice(0, 10)).filter(Boolean))];
                      if (confirm(`⚠️ ¿Eliminar TODA la programación del torneo?\n\nLos ${flatSchedule.length} partidos quedarán pendientes sin horario.`)) {
                        Promise.all(
                          dates.map((d) => api.delete(`/matches/tournament/${selectedTournament}/schedule/${d}`)),
                        )
                          .then(() => {
                            refetchAll();
                            setFilterDate('');
                            alert(`✅ Programación eliminada (${dates.length} fecha${dates.length !== 1 ? 's' : ''}).`);
                          })
                          .catch(() => alert('❌ Error al eliminar la programación'));
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: '#FEF2F2', border: '1.5px solid #FECACA',
                      color: '#DC2626', borderRadius: '8px',
                      padding: '6px 12px', cursor: 'pointer',
                      fontSize: '12px', fontWeight: 700,
                    }}
                  >
                    🗑️ Eliminar toda la programación
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
                                      {row.player1Name || row.player1 || 'BYE'}
                                    </td>
                                    <td style={{ padding: '9px 4px', textAlign: 'center', color: '#9CA3AF', fontSize: '11px' }}>vs</td>
                                    <td style={{ padding: '9px 12px', fontWeight: 500, color: '#111827' }}>
                                      {row.player2Name || row.player2 || 'BYE'}
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
                      <td style={{ padding: '8px 12px', fontWeight: 500, color: '#111827' }}>{m.player1Name || 'BYE'}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 500, color: '#111827' }}>{m.player2Name || 'BYE'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {isAdmin && (
                          <button
                            onClick={() => setShowAssignModal(true)}
                            style={{
                              padding: '5px 12px', borderRadius: '6px', border: 'none',
                              background: '#1B3A1B', color: '#fff', cursor: 'pointer',
                              fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px',
                            }}
                          >
                            <Plus size={11} /> Asignar
                          </button>
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
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[1, 2, 3].map(n => (
                    <button key={n} onClick={() => setMaxMatchesPerPlayer(n)} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px', background: maxMatchesPerPlayer === n ? '#2D6A2D' : '#F3F4F6', color: maxMatchesPerPlayer === n ? 'white' : '#374151' }}>
                      {n} {n === 1 ? 'partido' : 'partidos'}
                    </button>
                  ))}
                </div>
              </div>
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
                  ❌ Error al generar. Verifica que el torneo tenga partidos pendientes y canchas activas.
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
                      exportSchedulePdf({ tournamentName: t?.name || 'Torneo', date: scheduleResult.date, city: 'Medellín', referee, director, observations, schedule: scheduleResult.schedule });
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

      {/* ── Modal Asignar partido pendiente ────────────────────────────── */}
      {showAssignModal && (
        <AssignModal
          tournamentId={selectedTournament}
          courts={courts as any[]}
          onClose={() => setShowAssignModal(false)}
          onAssigned={() => { refetchAll(); queryClient.invalidateQueries({ queryKey: ['pending-unscheduled', selectedTournament] }); }}
          flatSchedule={flatSchedule}
        />
      )}
    </div>
  );
}
