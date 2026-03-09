// frontend/src/pages/Schedule.tsx  ← REEMPLAZA COMPLETO
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Play, Calendar, CloudRain, RefreshCw } from 'lucide-react';
import { tournamentsApi } from '../api/tournaments.api';
import { courtsApi } from '../api/courts.api';
import { matchesApi } from '../api/matches.api';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { exportSchedulePdf } from '../utils/exportSchedulePdf';
import SuspendModal, { type SuspendMode } from '../components/SuspendModal';

// ── Constantes ─────────────────────────────────────────────────────────────
const ROUNDS = [
  { key: 'R64',  label: 'R64'          },
  { key: 'R32',  label: 'R32'          },
  { key: 'R16',  label: 'R16'          },
  { key: 'QF',   label: 'Cuartos'      },
  { key: 'SF',   label: 'Semifinal'    },
  { key: 'F',    label: 'Final'        },
  { key: 'RR',   label: 'Round Robin'  },
  { key: 'RR_A', label: 'Grupo A'      },
  { key: 'RR_B', label: 'Grupo B'      },
  { key: 'SF_M', label: 'SF Máster'    },
  { key: 'F_M',  label: 'Final Máster' },
];

const DEFAULT_DURATIONS: Record<string, number> = {
  R64: 75, R32: 75, R16: 75, QF: 90,
  SF: 120, F: 150, RR: 75, RR_A: 75,
  RR_B: 75, SF_M: 120, F_M: 150,
};

interface CourtBlock  { start: string; end: string; }
interface CourtConfig { courtId: string; blocks: CourtBlock[]; }

// ─────────────────────────────────────────────────────────────────────────────
export default function Schedule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [selectedTournament,   setSelectedTournament]   = useState('');
  const [selectedDate,         setSelectedDate]         = useState('');
  const [courtConfigs,         setCourtConfigs]         = useState<CourtConfig[]>([]);
  const [roundDurations,       setRoundDurations]       = useState<Record<string, number>>(DEFAULT_DURATIONS);
  const [scheduleResult,       setScheduleResult]       = useState<any>(null);
  const [viewBySede,           setViewBySede]           = useState(true);
  const [observations,         setObservations]         = useState('');
  const [referee,              setReferee]              = useState('');
  const [director,             setDirector]             = useState('');
  const [maxMatchesPerPlayer,  setMaxMatchesPerPlayer]  = useState(2);
  const [selectedRounds,       setSelectedRounds]       = useState<string[]>([]);
  const [includeSuspended,     setIncludeSuspended]     = useState(true);
  const [showSuspended,        setShowSuspended]        = useState(false);
  const [suspendModalOpen,     setSuspendModalOpen]     = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────
  const { data: tournaments = [] } = useQuery({ queryKey: ['tournaments'], queryFn: tournamentsApi.getAll });
  const { data: courts = [] }      = useQuery({ queryKey: ['courts'],      queryFn: courtsApi.getAll });

  const { data: existingSchedule, refetch } = useQuery({
    queryKey: ['schedule', selectedTournament],
    queryFn: async () => {
      const res = await api.get(`/tournaments/${selectedTournament}/schedule`);
      return res.data;
    },
    enabled: !!selectedTournament,
  });

  const { data: pendingRounds = [], refetch: refetchPending } = useQuery({
    queryKey: ['pending-rounds', selectedTournament],
    queryFn: () => matchesApi.getPendingRounds(selectedTournament),
    enabled: !!selectedTournament,
  });

  const { data: suspendedMatches = [], refetch: refetchSuspended } = useQuery({
    queryKey: ['suspended', selectedTournament],
    queryFn: () => matchesApi.getSuspended(selectedTournament),
    enabled: !!selectedTournament && showSuspended,
  });

  // ── Mutations ──────────────────────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/tournaments/${selectedTournament}/schedule`, {
        date: selectedDate,
        courts: courtConfigs,
        roundDurations,
        maxMatchesPerPlayer,
        roundFilter: selectedRounds.length > 0 ? selectedRounds : undefined,
        includeSuspended,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setScheduleResult(data);
      refetch();
      refetchPending();
    },
  });

  const suspendDayMutation = useMutation({
    mutationFn: ({ reason, resumeDate }: { reason: string; resumeDate?: string }) =>
      matchesApi.suspendDay(selectedTournament, selectedDate, reason, resumeDate),
    onSuccess: () => {
      setSuspendModalOpen(false);
      refetch();
      refetchSuspended();
      refetchPending();
    },
  });

  const resumeDayMutation = useMutation({
    mutationFn: () => matchesApi.resumeDay(selectedTournament, selectedDate),
    onSuccess: () => { refetch(); refetchSuspended(); refetchPending(); },
  });

  const resumeMatchMutation = useMutation({
    mutationFn: (matchId: string) => matchesApi.resumeMatch(matchId),
    onSuccess: () => { refetchSuspended(); refetchPending(); refetch(); },
  });

  // ── Helpers canchas ────────────────────────────────────────────────────
  const sedeMap: Record<string, any[]> = {};
  (courts as any[]).forEach((c: any) => {
    const sede = c.sede || 'Principal';
    if (!sedeMap[sede]) sedeMap[sede] = [];
    sedeMap[sede].push(c);
  });

  const isCourtSelected = (id: string) => courtConfigs.some(c => c.courtId === id);
  const getCourtConfig  = (id: string) => courtConfigs.find(c => c.courtId === id);

  const toggleCourt = (courtId: string) =>
    setCourtConfigs(prev =>
      prev.find(c => c.courtId === courtId)
        ? prev.filter(c => c.courtId !== courtId)
        : [...prev, { courtId, blocks: [{ start: '08:00', end: '20:00' }] }]
    );

  const addBlock = (courtId: string) =>
    setCourtConfigs(prev => prev.map(c =>
      c.courtId === courtId ? { ...c, blocks: [...c.blocks, { start: '08:00', end: '20:00' }] } : c
    ));

  const removeBlock = (courtId: string, idx: number) =>
    setCourtConfigs(prev => prev.map(c =>
      c.courtId === courtId ? { ...c, blocks: c.blocks.filter((_, i) => i !== idx) } : c
    ));

  const updateBlock = (courtId: string, idx: number, field: 'start' | 'end', value: string) =>
    setCourtConfigs(prev => prev.map(c =>
      c.courtId === courtId
        ? { ...c, blocks: c.blocks.map((b, i) => i === idx ? { ...b, [field]: value } : b) }
        : c
    ));

  const toggleRound = (key: string) =>
    setSelectedRounds(prev => prev.includes(key) ? prev.filter(r => r !== key) : [...prev, key]);

  // Aplanar programación existente
  const scheduleRows: any[] = [];
  if (existingSchedule && !scheduleResult) {
    Object.entries(existingSchedule as Record<string, any>).forEach(([, sedes]) => {
      Object.entries(sedes as Record<string, any>).forEach(([sede, cts]) => {
        Object.entries(cts as Record<string, any>).forEach(([court, ms]) => {
          (ms as any[]).forEach((m: any) => scheduleRows.push({ sede, court, ...m }));
        });
      });
    });
  }

  const tournament      = (tournaments as any[]).find((t: any) => t.id === selectedTournament);
  const suspendedInDate = scheduleRows.filter((r: any) => r.status === 'suspended').length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-lat-dark">Programación</h1>
          <p className="text-gray-500">Gestión de horarios por sede y cancha</p>
        </div>

        {/* ── Paso 1: Torneo y Fecha ── */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 style={h2}>1️⃣ Torneo y fecha</h2>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={lbl}>Torneo</label>
              <select
                value={selectedTournament}
                onChange={e => { setSelectedTournament(e.target.value); setScheduleResult(null); }}
                style={inp}
              >
                <option value="">Seleccionar torneo...</option>
                {(tournaments as any[]).map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Fecha</label>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={inp} />
            </div>

            {/* Acciones de jornada */}
            {selectedTournament && selectedDate && isAdmin && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSuspendModalOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#FEF3C7', color: '#92400E', border: '1.5px solid #FDE68A', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  <CloudRain size={14} /> Suspender jornada
                </button>
                {suspendedInDate > 0 && (
                  <button
                    onClick={() => resumeDayMutation.mutate()}
                    disabled={resumeDayMutation.isPending}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#F0FDF4', color: '#15803D', border: '1.5px solid #86EFAC', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    <RefreshCw size={14} /> Reanudar ({suspendedInDate})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Panel Suspendidos ── */}
        {selectedTournament && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ ...h2, marginBottom: 0, color: '#92400E' }}>
                ⛈️ Partidos Suspendidos
                {(suspendedMatches as any[]).length > 0 && (
                  <span style={{ marginLeft: '8px', backgroundColor: '#F97316', color: 'white', fontSize: '11px', padding: '2px 7px', borderRadius: '999px', fontWeight: '700' }}>
                    {(suspendedMatches as any[]).length}
                  </span>
                )}
              </h2>
              <button
                onClick={() => setShowSuspended(v => !v)}
                style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', color: '#6B7280' }}
              >
                {showSuspended ? 'Ocultar' : 'Ver suspendidos'}
              </button>
            </div>

            {showSuspended && (
              <div style={{ marginTop: '14px' }}>
                {(suspendedMatches as any[]).length === 0 ? (
                  <p style={{ color: '#9CA3AF', fontSize: '13px', fontStyle: 'italic' }}>No hay partidos suspendidos.</p>
                ) : (
                  <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#FEF3C7' }}>
                        {['Ronda','Cat.','Jugador 1','Jugador 2','Motivo','Parcial','Acciones'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '7px 10px', color: '#92400E', fontWeight: '600', fontSize: '11px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(suspendedMatches as any[]).map((m: any, i: number) => (
                        <tr key={m.id} style={{ borderBottom: '1px solid #FEF9C3', backgroundColor: i % 2 === 0 ? 'white' : '#FFFBEB' }}>
                          <td style={{ padding: '7px 10px', fontWeight: '700', color: '#1B3A1B' }}>{m.round}</td>
                          <td style={{ padding: '7px 10px' }}>
                            <span style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '1px 6px', borderRadius: '999px', fontSize: '10px', fontWeight: '600' }}>{m.category}</span>
                          </td>
                          <td style={{ padding: '7px 10px' }}>{m.player1Name}</td>
                          <td style={{ padding: '7px 10px' }}>{m.player2Name}</td>
                          <td style={{ padding: '7px 10px', color: '#92400E', fontSize: '11px' }}>{m.suspensionReason || '—'}</td>
                          <td style={{ padding: '7px 10px', fontWeight: '700', color: '#F97316' }}>
                            {m.partialResult ? `${m.partialResult.sets1}-${m.partialResult.sets2}` : '—'}
                          </td>
                          <td style={{ padding: '7px 10px' }}>
                            <button
                              onClick={() => resumeMatchMutation.mutate(m.id)}
                              disabled={resumeMatchMutation.isPending}
                              style={{ backgroundColor: '#F0FDF4', color: '#15803D', border: '1px solid #86EFAC', borderRadius: '6px', padding: '3px 10px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                            >
                              ▶ Reanudar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {isAdmin && (
          <>
            {/* ── Paso 2: Canchas ── */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 style={h2}>2️⃣ Canchas disponibles</h2>
              {Object.entries(sedeMap).map(([sede, sedeCorts]) => (
                <div key={sede} style={{ marginBottom: '20px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: '#6B7280', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    🏟️ {sede}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {sedeCorts.map((court: any) => {
                      const selected = isCourtSelected(court.id);
                      const config   = getCourtConfig(court.id);
                      return (
                        <div key={court.id} style={{ border: `2px solid ${selected ? '#2D6A2D' : '#E5E7EB'}`, borderRadius: '10px', backgroundColor: selected ? '#F0FDF4' : '#FAFAFA' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', cursor: 'pointer' }} onClick={() => toggleCourt(court.id)}>
                            <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${selected ? '#2D6A2D' : '#D1D5DB'}`, backgroundColor: selected ? '#2D6A2D' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {selected && <span style={{ color: 'white', fontSize: '11px', fontWeight: '800' }}>✓</span>}
                            </div>
                            <span style={{ fontWeight: '600', color: '#1B3A1B', fontSize: '13px' }}>{court.name}</span>
                            {court.surface && (
                              <span style={{ fontSize: '10px', color: '#9CA3AF', backgroundColor: '#F3F4F6', padding: '2px 7px', borderRadius: '999px' }}>{court.surface}</span>
                            )}
                          </div>
                          {selected && config && (
                            <div style={{ padding: '0 14px 12px' }}>
                              {config.blocks.map((block, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '7px' }}>
                                  <span style={{ fontSize: '11px', color: '#6B7280', minWidth: '38px' }}>Desde</span>
                                  <input type="time" value={block.start} onChange={e => updateBlock(court.id, idx, 'start', e.target.value)} style={timeInp} />
                                  <span style={{ fontSize: '11px', color: '#6B7280' }}>hasta</span>
                                  <input type="time" value={block.end} onChange={e => updateBlock(court.id, idx, 'end', e.target.value)} style={timeInp} />
                                  {config.blocks.length > 1 && (
                                    <button onClick={() => removeBlock(court.id, idx)} style={iconBtn}><Trash2 size={13} /></button>
                                  )}
                                </div>
                              ))}
                              <button onClick={() => addBlock(court.id)} style={addBlockBtn}>
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

            {/* ── Paso 3: Filtro de rondas ── */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 style={{ ...h2, marginBottom: '4px' }}>3️⃣ Rondas a programar</h2>
              <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '14px' }}>
                Sin selección = todas las rondas pendientes. Selecciona rondas específicas para programar solo esa jornada.
              </p>

              {(pendingRounds as any[]).length > 0 ? (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    {(pendingRounds as any[]).map((r: any) => {
                      const active = selectedRounds.includes(r.round);
                      return (
                        <button
                          key={r.round}
                          onClick={() => toggleRound(r.round)}
                          style={{
                            padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
                            fontSize: '12px', fontWeight: '600',
                            border: active ? '2px solid #2D6A2D' : '1.5px solid #D1D5DB',
                            backgroundColor: active ? '#F0FDF4' : 'white',
                            color: active ? '#15803D' : '#374151',
                          }}
                        >
                          {ROUNDS.find(ro => ro.key === r.round)?.label || r.round}
                          <span style={{ marginLeft: '5px', fontSize: '10px', color: active ? '#86EFAC' : '#9CA3AF', fontWeight: '400' }}>
                            {r.unscheduled}p
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedRounds.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#15803D', backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', padding: '4px 10px', borderRadius: '6px' }}>
                        ✓ Solo: {selectedRounds.map(r => ROUNDS.find(ro => ro.key === r)?.label || r).join(', ')}
                      </span>
                      <button onClick={() => setSelectedRounds([])} style={{ fontSize: '11px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                        Limpiar
                      </button>
                    </div>
                  )}
                </>
              ) : selectedTournament ? (
                <p style={{ fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic' }}>No hay rondas pendientes.</p>
              ) : (
                <p style={{ fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic' }}>Selecciona un torneo primero.</p>
              )}

              {/* Toggle incluir suspendidos */}
              <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIncludeSuspended(v => !v)}
                  style={{ width: '40px', height: '22px', borderRadius: '999px', border: 'none', cursor: 'pointer', position: 'relative', backgroundColor: includeSuspended ? '#2D6A2D' : '#D1D5DB', transition: 'background-color 0.2s', flexShrink: 0 }}
                >
                  <span style={{ position: 'absolute', top: '2px', left: includeSuspended ? '20px' : '2px', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white', transition: 'left 0.2s', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#374151', margin: 0 }}>Incluir partidos suspendidos</p>
                  <p style={{ fontSize: '11px', color: '#6B7280', margin: 0 }}>Los suspendidos se reprogramarán en esta jornada</p>
                </div>
              </div>
            </div>

            {/* ── Paso 4: Duraciones ── */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 style={h2}>4️⃣ Duración estimada por ronda</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: '10px' }}>
                {ROUNDS.map(({ key, label }) => (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    backgroundColor: selectedRounds.includes(key) ? '#F0FDF4' : '#F9FAFB',
                    borderRadius: '8px', padding: '9px 12px',
                    border: selectedRounds.includes(key) ? '2px solid #86EFAC' : '1px solid #E5E7EB',
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: '#374151' }}>{label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <input
                        type="number" min={30} max={240} step={15}
                        value={roundDurations[key] || 90}
                        onChange={e => setRoundDurations({ ...roundDurations, [key]: Number(e.target.value) })}
                        style={{ width: '52px', border: '1px solid #D1D5DB', borderRadius: '5px', padding: '3px 5px', fontSize: '12px', fontWeight: '600', textAlign: 'center' }}
                      />
                      <span style={{ fontSize: '10px', color: '#9CA3AF' }}>m</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #E5E7EB' }}>
                <label style={lbl}>Máx. partidos por jugador por día</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[1, 2, 3].map(n => (
                    <button key={n} onClick={() => setMaxMatchesPerPlayer(n)}
                      style={{ padding: '7px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '12px', backgroundColor: maxMatchesPerPlayer === n ? '#2D6A2D' : '#F3F4F6', color: maxMatchesPerPlayer === n ? 'white' : '#374151' }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Paso 5: Observaciones ── */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 style={h2}>5️⃣ Observaciones PDF (opcional)</h2>
              <div style={{ display: 'flex', gap: '14px', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Árbitro</label>
                  <input value={referee} onChange={e => setReferee(e.target.value)} placeholder="Nombre árbitro" style={{ ...inp, minWidth: 0, width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Director</label>
                  <input value={director} onChange={e => setDirector(e.target.value)} placeholder="Nombre director" style={{ ...inp, minWidth: 0, width: '100%' }} />
                </div>
              </div>
              <textarea value={observations} onChange={e => setObservations(e.target.value)}
                placeholder="Observaciones generales..." rows={2}
                style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>

            {/* ── Botón Generar ── */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <button
                onClick={() => generateMutation.mutate()}
                disabled={courtConfigs.length === 0 || !selectedDate || generateMutation.isPending}
                style={{
                  width: '100%', backgroundColor: '#2D6A2D', color: 'white',
                  padding: '14px', borderRadius: '10px', border: 'none',
                  cursor: (courtConfigs.length === 0 || !selectedDate) ? 'not-allowed' : 'pointer',
                  fontSize: '15px', fontWeight: '700', opacity: (courtConfigs.length === 0 || !selectedDate) ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                <Play size={18} />
                {generateMutation.isPending ? 'Generando...'
                  : selectedRounds.length > 0
                    ? `🎾 Programar: ${selectedRounds.map(r => ROUNDS.find(ro => ro.key === r)?.label).join(' + ')}`
                    : '🎾 Generar Programación Automática'
                }
              </button>

              {generateMutation.isError && (
                <div style={{ marginTop: '12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#DC2626' }}>
                  ❌ Error al generar. Verifica partidos pendientes y canchas activas.
                </div>
              )}

              {generateMutation.isSuccess && scheduleResult && (
                <div style={{ marginTop: '12px', backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '14px' }}>
                  <p style={{ fontWeight: '700', color: '#15803D', marginBottom: '8px' }}>✅ Programación generada</p>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#374151', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <span>📅 {scheduleResult.date}</span>
                    <span>🏟️ {scheduleResult.courtsUsed} canchas</span>
                    <span>✓ {scheduleResult.matchesScheduled} programados</span>
                    {scheduleResult.matchesPending > 0 && <span style={{ color: '#92400E' }}>⚠️ {scheduleResult.matchesPending} sin programar</span>}
                  </div>
                  <button
                    onClick={() => exportSchedulePdf({ tournamentName: tournament?.name || 'Torneo', date: scheduleResult.date, city: 'Medellín', referee, director, observations, schedule: scheduleResult.schedule })}
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', backgroundColor: '#1D4ED8', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                  >
                    📄 Exportar PDF
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Tabla programación existente ── */}
        {selectedTournament && (scheduleRows.length > 0 || scheduleResult?.schedule?.length > 0) && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 style={{ ...h2, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Calendar size={16} /> Partidos Programados
              </h2>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[{ v: true, label: 'Por Sede' }, { v: false, label: 'Lista' }].map(({ v, label }) => (
                  <button key={label} onClick={() => setViewBySede(v)}
                    style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', border: 'none', cursor: 'pointer', backgroundColor: viewBySede === v ? '#2D6A2D' : '#F3F4F6', color: viewBySede === v ? 'white' : '#374151' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {(() => {
              const rows = scheduleResult?.schedule || scheduleRows;
              if (!viewBySede) {
                return (
                  <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F9FAFB' }}>
                        {['Hora','Cancha','Ronda','Cat.','Jugador 1','Jugador 2','Dur.','Estado'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '7px 9px', color: '#6B7280', fontWeight: '600', fontSize: '11px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row: any, i: number) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: row.status === 'suspended' ? '#FFF7ED' : i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                          <td style={{ padding: '7px 9px', fontWeight: '700', color: row.status === 'suspended' ? '#F97316' : '#1B3A1B' }}>{row.time}</td>
                          <td style={{ padding: '7px 9px' }}>{row.court}</td>
                          <td style={{ padding: '7px 9px' }}><span style={{ backgroundColor: '#F3F4F6', padding: '1px 5px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>{row.round}</span></td>
                          <td style={{ padding: '7px 9px' }}><span style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '1px 5px', borderRadius: '999px', fontSize: '10px', fontWeight: '600' }}>{row.category}</span></td>
                          <td style={{ padding: '7px 9px' }}>{row.player1}</td>
                          <td style={{ padding: '7px 9px' }}>{row.player2}</td>
                          <td style={{ padding: '7px 9px', color: '#9CA3AF' }}>{row.duration}</td>
                          <td style={{ padding: '7px 9px' }}>
                            {row.status === 'suspended'
                              ? <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: '999px', fontSize: '10px', fontWeight: '700' }}>⛈ Suspendido</span>
                              : row.status === 'completed'
                                ? <span style={{ backgroundColor: '#F0FDF4', color: '#15803D', padding: '2px 6px', borderRadius: '999px', fontSize: '10px', fontWeight: '700' }}>✓</span>
                                : <span style={{ backgroundColor: '#F3F4F6', color: '#6B7280', padding: '2px 6px', borderRadius: '999px', fontSize: '10px' }}>⏳</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              }

              const bySede: Record<string, any[]> = {};
              rows.forEach((row: any) => {
                const s = row.sede || 'Principal';
                if (!bySede[s]) bySede[s] = [];
                bySede[s].push(row);
              });

              return Object.entries(bySede).map(([sede, sedeRows]) => (
                <div key={sede} style={{ marginBottom: '20px' }}>
                  <div style={{ backgroundColor: '#1B3A1B', color: 'white', borderRadius: '8px', padding: '9px 14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🏟️</span>
                    <span style={{ fontWeight: '600', fontSize: '13px' }}>{sede}</span>
                    <span style={{ fontSize: '11px', opacity: 0.7 }}>({sedeRows.length})</span>
                    {sedeRows.some((r: any) => r.status === 'suspended') && (
                      <span style={{ fontSize: '10px', backgroundColor: '#F97316', padding: '1px 7px', borderRadius: '999px', marginLeft: 'auto', fontWeight: '700' }}>
                        ⛈ {sedeRows.filter((r: any) => r.status === 'suspended').length} susp.
                      </span>
                    )}
                  </div>
                  <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F9FAFB' }}>
                        {['Hora','Cancha','Ronda','Categoría','Jugador 1','Jugador 2','Duración'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 9px', color: '#6B7280', fontWeight: '500', fontSize: '11px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sedeRows.map((row: any, i: number) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: row.status === 'suspended' ? '#FFF7ED' : i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                          <td style={{ padding: '6px 9px', fontWeight: '700', color: row.status === 'suspended' ? '#F97316' : '#1B3A1B' }}>{row.time} {row.status === 'suspended' ? '⛈' : ''}</td>
                          <td style={{ padding: '6px 9px' }}>{row.court}</td>
                          <td style={{ padding: '6px 9px' }}><span style={{ backgroundColor: '#F3F4F6', padding: '1px 5px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>{row.round}</span></td>
                          <td style={{ padding: '6px 9px' }}><span style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '1px 5px', borderRadius: '999px', fontSize: '10px', fontWeight: '600' }}>{row.category}</span></td>
                          <td style={{ padding: '6px 9px' }}>{row.player1}</td>
                          <td style={{ padding: '6px 9px' }}>{row.player2}</td>
                          <td style={{ padding: '6px 9px', color: '#9CA3AF' }}>{row.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ));
            })()}
          </div>
        )}
      </main>

      {/* Modal suspender jornada */}
      <SuspendModal
        isOpen={suspendModalOpen}
        mode="day"
        date={selectedDate}
        matchCount={scheduleRows.filter((r: any) => ['pending','live'].includes(r.status)).length}
        onConfirm={(reason, resumeDate) => suspendDayMutation.mutate({ reason, resumeDate })}
        onCancel={() => setSuspendModalOpen(false)}
        isLoading={suspendDayMutation.isPending}
      />
    </div>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────
const h2: React.CSSProperties      = { fontSize: '15px', fontWeight: '700', color: '#1B3A1B', marginBottom: '14px' };
const lbl: React.CSSProperties     = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' };
const inp: React.CSSProperties     = { border: '1.5px solid #D1D5DB', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', minWidth: '200px' };
const timeInp: React.CSSProperties = { border: '1px solid #D1D5DB', borderRadius: '6px', padding: '5px 8px', fontSize: '13px', width: '88px' };
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '3px' };
const addBlockBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '5px', marginTop: '7px',
  fontSize: '11px', color: '#2D6A2D', background: 'none',
  border: '1px dashed #86EFAC', borderRadius: '6px', padding: '4px 9px', cursor: 'pointer',
};