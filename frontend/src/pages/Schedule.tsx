import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Trash2, Play, Calendar } from 'lucide-react';
import { tournamentsApi } from '../api/tournaments.api';
import { courtsApi } from '../api/courts.api';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const ROUNDS = [
  { key: 'R64',  label: 'Ronda 64'     },
  { key: 'R32',  label: 'Ronda 32'     },
  { key: 'R16',  label: 'Ronda 16'     },
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

interface CourtBlock { start: string; end: string; }
interface CourtConfig { courtId: string; blocks: CourtBlock[]; }

export default function Schedule() {
  const { isAdmin } = useAuth();
  const [selectedTournament, setSelectedTournament] = useState('');
  const [selectedDate, setSelectedDate]             = useState('');
  const [courtConfigs, setCourtConfigs]             = useState<CourtConfig[]>([]);
  const [roundDurations, setRoundDurations]         = useState<Record<string, number>>(DEFAULT_DURATIONS);
  const [scheduleResult, setScheduleResult]         = useState<any>(null);
  const [viewBySede, setViewBySede]                 = useState(true);

  const { data: tournaments = [] } = useQuery({
    queryKey: ['tournaments'],
    queryFn: tournamentsApi.getAll,
  });

  const { data: courts = [] } = useQuery({
    queryKey: ['courts'],
    queryFn: courtsApi.getAll,
  });

  const { data: existingSchedule, refetch } = useQuery({
    queryKey: ['schedule', selectedTournament],
    queryFn: async () => {
      const res = await api.get(`/tournaments/${selectedTournament}/schedule`);
      return res.data;
    },
    enabled: !!selectedTournament,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(
        `/tournaments/${selectedTournament}/schedule`,
        { date: selectedDate, courts: courtConfigs, roundDurations }
      );
      return res.data;
    },
    onSuccess: (data) => {
      setScheduleResult(data);
      refetch();
    },
  });

  // Agrupar canchas por sede
  const sedeMap: Record<string, any[]> = {};
  (courts as any[]).forEach((c: any) => {
    const sede = c.sede || 'Principal';
    if (!sedeMap[sede]) sedeMap[sede] = [];
    sedeMap[sede].push(c);
  });

  const toggleCourt = (courtId: string) => {
    const exists = courtConfigs.find(c => c.courtId === courtId);
    if (exists) {
      setCourtConfigs(courtConfigs.filter(c => c.courtId !== courtId));
    } else {
      setCourtConfigs([...courtConfigs, {
        courtId,
        blocks: [{ start: '08:00', end: '20:00' }],
      }]);
    }
  };

  const addBlock = (courtId: string) => {
    setCourtConfigs(courtConfigs.map(c =>
      c.courtId === courtId
        ? { ...c, blocks: [...c.blocks, { start: '08:00', end: '20:00' }] }
        : c
    ));
  };

  const removeBlock = (courtId: string, idx: number) => {
    setCourtConfigs(courtConfigs.map(c =>
      c.courtId === courtId
        ? { ...c, blocks: c.blocks.filter((_, i) => i !== idx) }
        : c
    ));
  };

  const updateBlock = (courtId: string, idx: number, field: 'start' | 'end', value: string) => {
    setCourtConfigs(courtConfigs.map(c =>
      c.courtId === courtId
        ? {
            ...c,
            blocks: c.blocks.map((b, i) =>
              i === idx ? { ...b, [field]: value } : b
            ),
          }
        : c
    ));
  };

  const isCourtSelected = (courtId: string) =>
    courtConfigs.some(c => c.courtId === courtId);

  const getCourtConfig = (courtId: string) =>
    courtConfigs.find(c => c.courtId === courtId);

  // Aplanar programación existente
  const scheduleRows: any[] = [];
  if (existingSchedule && !scheduleResult) {
    Object.entries(existingSchedule).forEach(([date, sedes]: [string, any]) => {
      Object.entries(sedes).forEach(([sede, courts]: [string, any]) => {
        Object.entries(courts).forEach(([court, matches]: [string, any]) => {
          (matches as any[]).forEach((m: any) => {
            scheduleRows.push({ date, sede, court, ...m });
          });
        });
      });
    });
  }

  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-lat-dark">Programación</h1>
          <p className="text-gray-500">Gestión de horarios por sede y cancha</p>
        </div>

        {/* Paso 1 — Torneo y Fecha */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1B3A1B', marginBottom: '16px' }}>
            1️⃣ Selecciona el torneo y la fecha
          </h2>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                Torneo
              </label>
              <select
                value={selectedTournament}
                onChange={e => { setSelectedTournament(e.target.value); setScheduleResult(null); }}
                style={{ border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', minWidth: '250px' }}
              >
                <option value="">Seleccionar torneo...</option>
                {(tournaments as any[]).map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                Fecha
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                style={{ border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 12px', fontSize: '14px' }}
              />
            </div>
          </div>
        </div>

        {selectedTournament && selectedDate && isAdmin && (
          <>
            {/* Paso 2 — Canchas por sede */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1B3A1B', marginBottom: '4px' }}>
                2️⃣ Selecciona las canchas disponibles ese día
              </h2>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>
                Activa las canchas y define los bloques de horario disponibles
              </p>

              {courts.length === 0 ? (
                <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '16px' }}>
                  No hay canchas registradas. Ve a la sección Canchas para agregar.
                </p>
              ) : (
                Object.entries(sedeMap).map(([sede, sedeCourts]) => (
                  <div key={sede} style={{ marginBottom: '24px' }}>
                    {/* Header sede */}
                    <div style={{
                      backgroundColor: '#F0FDF4', border: '1px solid #86EFAC',
                      borderRadius: '8px', padding: '8px 16px', marginBottom: '12px',
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                      <span style={{ fontSize: '16px' }}>🏟️</span>
                      <span style={{ fontWeight: '600', color: '#15803D' }}>{sede}</span>
                      <span style={{ fontSize: '12px', color: '#6B7280' }}>
                        ({sedeCourts.length} cancha{sedeCourts.length > 1 ? 's' : ''})
                      </span>
                    </div>

                    {/* Canchas de esta sede */}
                    {sedeCourts.map((court: any) => (
                      <div key={court.id} style={{
                        border: `2px solid ${isCourtSelected(court.id) ? '#2D6A2D' : '#E5E7EB'}`,
                        borderRadius: '10px', padding: '16px', marginBottom: '8px',
                        backgroundColor: isCourtSelected(court.id) ? '#F0FDF4' : 'white',
                        transition: 'all 0.2s',
                      }}>
                        {/* Header cancha */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <input
                              type="checkbox"
                              checked={isCourtSelected(court.id)}
                              onChange={() => toggleCourt(court.id)}
                              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2D6A2D' }}
                            />
                            <div>
                              <p style={{ fontWeight: '600', color: '#1B3A1B', fontSize: '14px' }}>
                                {court.surface === 'clay' ? '🟤' : court.surface === 'hard' ? '🔵' : '🟢'} {court.name}
                              </p>
                              <p style={{ fontSize: '12px', color: '#6B7280' }}>
                                {court.surface === 'clay' ? 'Arcilla' : court.surface === 'hard' ? 'Dura' : 'Pasto'}
                                {court.location ? ` · ${court.location}` : ''}
                              </p>
                            </div>
                          </div>
                          {isCourtSelected(court.id) && (
                            <button
                              onClick={() => addBlock(court.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                backgroundColor: '#2D6A2D', color: 'white',
                                padding: '4px 10px', borderRadius: '6px',
                                border: 'none', cursor: 'pointer', fontSize: '12px',
                              }}
                            >
                              <Plus size={12} />
                              Agregar bloque
                            </button>
                          )}
                        </div>

                        {/* Bloques de horario */}
                        {isCourtSelected(court.id) && (
                          <div style={{ marginTop: '12px', paddingLeft: '30px' }}>
                            {getCourtConfig(court.id)?.blocks.map((block, idx) => (
                              <div key={idx} style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                marginBottom: '8px', backgroundColor: 'white',
                                border: '1px solid #D1D5DB', borderRadius: '8px',
                                padding: '8px 12px',
                              }}>
                                <span style={{ fontSize: '12px', color: '#6B7280', minWidth: '60px' }}>
                                  Bloque {idx + 1}
                                </span>
                                <span style={{ fontSize: '12px', color: '#374151' }}>De</span>
                                <input
                                  type="time"
                                  value={block.start}
                                  onChange={e => updateBlock(court.id, idx, 'start', e.target.value)}
                                  style={{ border: '1px solid #D1D5DB', borderRadius: '6px', padding: '4px 8px', fontSize: '13px' }}
                                />
                                <span style={{ fontSize: '12px', color: '#374151' }}>a</span>
                                <input
                                  type="time"
                                  value={block.end}
                                  onChange={e => updateBlock(court.id, idx, 'end', e.target.value)}
                                  style={{ border: '1px solid #D1D5DB', borderRadius: '6px', padding: '4px 8px', fontSize: '13px' }}
                                />
                                {getCourtConfig(court.id)!.blocks.length > 1 && (
                                  <button
                                    onClick={() => removeBlock(court.id, idx)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* Paso 3 — Duración por ronda */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1B3A1B', marginBottom: '4px' }}>
                3️⃣ Define la duración por ronda
              </h2>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>
                Tiempo estimado en minutos para cada ronda
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
                {ROUNDS.map(({ key, label }) => (
                  <div key={key} style={{
                    border: '1px solid #E5E7EB', borderRadius: '8px',
                    padding: '10px 12px', backgroundColor: '#F9FAFB',
                  }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                      {label}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        min={30} max={240} step={15}
                        value={roundDurations[key] || 90}
                        onChange={e => setRoundDurations({ ...roundDurations, [key]: Number(e.target.value) })}
                        style={{
                          width: '70px', border: '1px solid #D1D5DB',
                          borderRadius: '6px', padding: '4px 8px',
                          fontSize: '14px', fontWeight: '600', textAlign: 'center',
                        }}
                      />
                      <span style={{ fontSize: '12px', color: '#9CA3AF' }}>min</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Botón generar */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <button
                onClick={() => generateMutation.mutate()}
                disabled={courtConfigs.length === 0 || generateMutation.isPending}
                style={{
                  width: '100%', backgroundColor: '#2D6A2D', color: 'white',
                  padding: '14px', borderRadius: '10px', border: 'none',
                  cursor: courtConfigs.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '16px', fontWeight: '600',
                  opacity: courtConfigs.length === 0 ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                <Play size={20} />
                {generateMutation.isPending ? 'Generando programación...' : '🎾 Generar Programación Automática'}
              </button>

              {courtConfigs.length === 0 && (
                <p style={{ textAlign: 'center', fontSize: '13px', color: '#9CA3AF', marginTop: '8px' }}>
                  Selecciona al menos una cancha para generar la programación
                </p>
              )}

              {generateMutation.isSuccess && scheduleResult && (
                <div style={{
                  marginTop: '16px', backgroundColor: '#F0FDF4',
                  border: '1px solid #86EFAC', borderRadius: '8px', padding: '14px',
                }}>
                  <p style={{ fontWeight: '600', color: '#15803D', marginBottom: '8px' }}>
                    ✅ Programación generada exitosamente
                  </p>
                  <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: '#374151' }}>
                    <span>📅 {scheduleResult.date}</span>
                    <span>🏟️ {scheduleResult.courtsUsed} canchas</span>
                    <span>✓ {scheduleResult.matchesScheduled} partidos programados</span>
                    {scheduleResult.matchesPending > 0 && (
                      <span style={{ color: '#92400E' }}>⚠️ {scheduleResult.matchesPending} sin programar</span>
                    )}
                  </div>
                </div>
              )}

              {generateMutation.isError && (
                <div style={{
                  marginTop: '16px', backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA', borderRadius: '8px',
                  padding: '14px', fontSize: '13px', color: '#DC2626',
                }}>
                  ❌ Error al generar. Verifica que el torneo tenga partidos pendientes y canchas activas.
                </div>
              )}
            </div>
          </>
        )}

        {/* Vista de programación */}
        {selectedTournament && (scheduleRows.length > 0 || scheduleResult?.schedule?.length > 0) && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1B3A1B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={20} />
                Partidos Programados
              </h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setViewBySede(true)}
                  style={{
                    padding: '6px 14px', borderRadius: '6px', fontSize: '13px',
                    border: 'none', cursor: 'pointer',
                    backgroundColor: viewBySede ? '#2D6A2D' : '#F3F4F6',
                    color: viewBySede ? 'white' : '#374151',
                  }}
                >
                  Por Sede
                </button>
                <button
                  onClick={() => setViewBySede(false)}
                  style={{
                    padding: '6px 14px', borderRadius: '6px', fontSize: '13px',
                    border: 'none', cursor: 'pointer',
                    backgroundColor: !viewBySede ? '#2D6A2D' : '#F3F4F6',
                    color: !viewBySede ? 'white' : '#374151',
                  }}
                >
                  Lista completa
                </button>
              </div>
            </div>

            {/* Vista por sede */}
            {viewBySede && scheduleResult?.schedule && (
              (() => {
                const bySede: Record<string, any[]> = {};
                scheduleResult.schedule.forEach((row: any) => {
                  const s = row.sede || 'Principal';
                  if (!bySede[s]) bySede[s] = [];
                  bySede[s].push(row);
                });
                return Object.entries(bySede).map(([sede, rows]) => (
                  <div key={sede} style={{ marginBottom: '24px' }}>
                    <div style={{
                      backgroundColor: '#1B3A1B', color: 'white',
                      borderRadius: '8px', padding: '10px 16px',
                      marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                      <span>🏟️</span>
                      <span style={{ fontWeight: '600' }}>{sede}</span>
                      <span style={{ fontSize: '12px', opacity: 0.7 }}>({rows.length} partidos)</span>
                    </div>
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F9FAFB' }}>
                          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6B7280', fontWeight: '500' }}>Hora</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6B7280', fontWeight: '500' }}>Cancha</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6B7280', fontWeight: '500' }}>Ronda</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6B7280', fontWeight: '500' }}>Categoría</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6B7280', fontWeight: '500' }}>Jugador 1</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6B7280', fontWeight: '500' }}>Jugador 2</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6B7280', fontWeight: '500' }}>Duración</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row: any, i: number) => (
                          <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: i % 2 === 0 ? 'white' : '#F9FAFB' }}>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ backgroundColor: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: '999px', fontSize: '12px', fontWeight: '600' }}>
                                {row.time}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#374151' }}>🎾 {row.court}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ backgroundColor: '#F3E8FF', color: '#6B21A8', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600' }}>
                                {row.round}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '2px 8px', borderRadius: '999px', fontSize: '11px' }}>
                                {row.category}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: '500', color: '#1B3A1B' }}>{row.player1}</td>
                            <td style={{ padding: '10px 12px', fontWeight: '500', color: '#1B3A1B' }}>{row.player2}</td>
                            <td style={{ padding: '10px 12px', color: '#6B7280' }}>{row.duration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ));
              })()
            )}

            {/* Lista completa */}
            {!viewBySede && (
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6B7280', fontWeight: '500' }}>Hora</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6B7280', fontWeight: '500' }}>Sede</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6B7280', fontWeight: '500' }}>Cancha</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6B7280', fontWeight: '500' }}>Ronda</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6B7280', fontWeight: '500' }}>Jugador 1</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6B7280', fontWeight: '500' }}>Jugador 2</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6B7280', fontWeight: '500' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(scheduleResult?.schedule || scheduleRows).map((row: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: i % 2 === 0 ? 'white' : '#F9FAFB' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ backgroundColor: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: '999px', fontSize: '12px', fontWeight: '600' }}>
                          {row.time}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#374151' }}>🏟️ {row.sede || 'Principal'}</td>
                      <td style={{ padding: '10px 12px', color: '#374151' }}>🎾 {row.court || row.courtId}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ backgroundColor: '#F3E8FF', color: '#6B21A8', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600' }}>
                          {row.round}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '500', color: '#1B3A1B' }}>{row.player1 || '—'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: '500', color: '#1B3A1B' }}>{row.player2 || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '500',
                          backgroundColor: row.status === 'live' ? '#FEE2E2' : row.status === 'completed' ? '#F3F4F6' : '#FEF9C3',
                          color: row.status === 'live' ? '#DC2626' : row.status === 'completed' ? '#4B5563' : '#92400E',
                        }}>
                          {row.status === 'live' ? '🔴 En vivo' : row.status === 'completed' ? '✓ Terminado' : '⏳ Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
    </div>
  );
}