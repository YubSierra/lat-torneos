// frontend/src/pages/TournamentDetail.tsx  ← REEMPLAZA COMPLETO
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Trophy, Calendar, Settings } from 'lucide-react';
import { tournamentsApi } from '../api/tournaments.api';
import { enrollmentsApi } from '../api/enrollments.api';
import { matchesApi } from '../api/matches.api';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import GameFormatConfig, {
  type GameFormat, DEFAULT_FORMAT, formatDescription,
} from '../components/GameFormatConfig';
import { exportBracketPdf } from '../utils/exportBracketPdf';
import BracketView from '../components/BracketView';
import SuspendModal, { type SuspendMode } from '../components/SuspendModal';
import InscribirJugadorModal from '../components/InscribirJugadorModal';

// ── Constantes ──────────────────────────────────────────────────────────────
const CATEGORIES = ['INTERMEDIA', 'SEGUNDA', 'TERCERA', 'CUARTA', 'QUINTA'];

// ── Helper: el backend puede devolver categories como string[] o {name,isDefault}[]
// Esta función normaliza siempre a string[]
function normalizeCategories(cats: any[]): string[] {
  if (!cats || cats.length === 0) return [];
  return cats.map(c => (typeof c === 'string' ? c : c?.name ?? ''));
}

// ─────────────────────────────────────────────────────────────────────────────
export default function TournamentDetail() {
  const { id }       = useParams<{ id: string }>();
  const { isAdmin }  = useAuth();
  const queryClient  = useQueryClient();

  // ── Tabs ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'info' | 'enrollments' | 'matches' | 'draw' | 'bracket'>('info');

  // ── Draw config ───────────────────────────────────────────────────────
  const [selectedCategory,  setSelectedCategory]  = useState('TERCERA');
  const [drawType,          setDrawType]          = useState('elimination');
  const [drawModality,      setDrawModality]      = useState<'singles' | 'doubles'>('singles');
  const [advancingPerGroup, setAdvancingPerGroup] = useState(1);
  const [roundGameFormats,  setRoundGameFormats]  = useState<Record<string, GameFormat>>({ default: { ...DEFAULT_FORMAT } });
  const [expandedRound,     setExpandedRound]     = useState<string | null>(null);

  // ── Import CSV ────────────────────────────────────────────────────────
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // ── Main Draw modal ───────────────────────────────────────────────────
  const [rrStatus,          setRrStatus]          = useState<any>(null);
  const [showMainDrawModal, setShowMainDrawModal] = useState(false);
  const [mdCategory,        setMdCategory]        = useState('');
  const [mdAdvancing,       setMdAdvancing]       = useState(1);

  // ── Suspensión de partido desde el cuadro ────────────────────────────
  const [suspendModal, setSuspendModal] = useState<{
    open: boolean;
    match?: any;
  }>({ open: false });

  // ── Modal inscribir jugador individual ───────────────────────────────
  const [showInscribirModal, setShowInscribirModal] = useState(false);
  const [inscribirError,     setInscribirError]     = useState<string | null>(null);
  const [inscribirLoading,   setInscribirLoading]   = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────
  const { data: tournament, isLoading } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => tournamentsApi.getOne(id!),
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', id],
    queryFn: () => enrollmentsApi.getByTournament(id!),
    enabled: activeTab === 'enrollments',
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['matches', id],
    queryFn: () => matchesApi.getByTournament(id!),
    enabled: activeTab === 'matches',
  });

  const { data: bracketMatches = [], refetch: refetchBracket } = useQuery({
    queryKey: ['bracket-matches', id],
    queryFn: () => matchesApi.getByTournament(id!),
    enabled: !!id,
  });

  // ── Mutations ─────────────────────────────────────────────────────────
  const drawMutation = useMutation({
    mutationFn: () =>
      tournamentsApi.generateDraw(id!, selectedCategory, drawType, advancingPerGroup, drawModality, roundGameFormats),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', id] });
      queryClient.invalidateQueries({ queryKey: ['bracket-matches', id] });
      setActiveTab('bracket');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => tournamentsApi.update(id!, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournament', id] }),
  });

  const generateMainDrawMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/matches/tournament/${id}/generate-main-draw`, {
        category: mdCategory,
        advancingPerGroup: mdAdvancing,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bracket-matches', id] });
      setShowMainDrawModal(false);
    },
  });

  // ── Suspender partido individual desde el cuadro ─────────────────────
  const suspendMatchMutation = useMutation({
    mutationFn: ({ matchId, reason, resumeDate }: { matchId: string; reason: string; resumeDate?: string }) =>
      matchesApi.suspendMatch(matchId, reason, resumeDate),
    onSuccess: () => {
      setSuspendModal({ open: false });
      refetchBracket();
      queryClient.invalidateQueries({ queryKey: ['matches', id] });
    },
  });

  // ── Reanudar partido individual desde el cuadro ──────────────────────
  const resumeMatchMutation = useMutation({
    mutationFn: (matchId: string) => matchesApi.resumeMatch(matchId),
    onSuccess: () => {
      refetchBracket();
      queryClient.invalidateQueries({ queryKey: ['matches', id] });
    },
  });

  // ── Import CSV ────────────────────────────────────────────────────────
  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post(`/enrollments/import/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['enrollments', id] });
    } catch {
      setImportResult({ error: 'Error al importar el archivo' });
    } finally {
      setImporting(false);
    }
  };

  // ── Aprobar pago ──────────────────────────────────────────────────────
  const approvePayment = async (enrollmentId: string) => {
    await api.patch(`/enrollments/${enrollmentId}/approve-payment`);
    queryClient.invalidateQueries({ queryKey: ['enrollments', id] });
  };

  // ── Inscribir jugador individual ──────────────────────────────────────
  const handleInscribir = async (data: any) => {
    setInscribirLoading(true);
    setInscribirError(null);
    try {
      await api.post(`/enrollments/enroll-single/${id}`, data);
      queryClient.invalidateQueries({ queryKey: ['enrollments', id] });
      setShowInscribirModal(false);
    } catch (err: any) {
      setInscribirError(err?.response?.data?.message || 'Error al inscribir jugador');
    } finally {
      setInscribirLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-lat-bg">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-gray-400">Cargando torneo...</p>
        </main>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex min-h-screen bg-lat-bg">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-red-400">Torneo no encontrado</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* ── Header ── */}
        <div className="mb-6">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 className="text-2xl font-bold text-lat-dark">{tournament.name}</h1>
              <p className="text-gray-500 text-sm">{tournament.location} · {tournament.eventStart}</p>
            </div>
            {isAdmin && (
              <div style={{ display: 'flex', gap: '8px' }}>
                {['registration', 'active', 'completed'].map(s => (
                  <button
                    key={s}
                    onClick={() => updateStatusMutation.mutate(s)}
                    style={{
                      padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                      border: 'none', cursor: 'pointer',
                      backgroundColor: tournament.status === s ? '#2D6A2D' : '#F3F4F6',
                      color: tournament.status === s ? 'white' : '#374151',
                    }}
                  >
                    {s === 'registration' ? '📋 Inscripciones' : s === 'active' ? '🎾 En curso' : '🏆 Finalizado'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Stats rápidos */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
            {[
              { label: 'jugadores', value: tournament.maxPlayers },
              { label: 'Inicio inscripciones', value: tournament.registrationStart },
              { label: 'Inicio torneo', value: tournament.eventStart },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-lg p-4 text-center shadow-sm" style={{ minWidth: '140px' }}>
                <p className="text-sm font-bold text-lat-dark">{item.value}</p>
                <p className="text-gray-500 text-xs mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 shadow-sm w-fit">
          {[
            { key: 'info',        icon: Settings, label: 'Info'         },
            { key: 'enrollments', icon: Users,    label: 'Inscritos'    },
            { key: 'matches',     icon: Trophy,   label: 'Partidos'     },
            { key: 'draw',        icon: Calendar, label: 'Generar Draw' },
            { key: 'bracket',     icon: Trophy,   label: 'Cuadro'       },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === key ? 'bg-lat-green text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TAB: INFO                                                      */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'info' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-lat-dark mb-4">Configuración del Torneo</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Tipo:</span>     <span className="font-medium ml-2">{tournament.type}</span></div>
              <div><span className="text-gray-500">Circuito:</span> <span className="font-medium ml-2">{tournament.circuitLine}</span></div>
              <div><span className="text-gray-500">Etapa:</span>    <span className="font-medium ml-2">{tournament.stageNumber || '—'}</span></div>
              <div><span className="text-gray-500">Estado:</span>   <span className="font-medium ml-2">{tournament.status}</span></div>
              {tournament.doublesPlayerValue && (
                <div><span className="text-gray-500">Valor dobles (por jugador):</span> <span className="font-medium ml-2">${Number(tournament.doublesPlayerValue).toLocaleString()}</span></div>
              )}
              {tournament.categories?.length > 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span className="text-gray-500">Categorías:</span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {normalizeCategories(tournament.categories).map((cat: string) => (
                      <span key={cat} style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600' }}>
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TAB: INSCRITOS                                                 */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'enrollments' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 className="text-lg font-bold text-lat-dark">
                Jugadores inscritos ({(enrollments as any[]).length})
              </h2>
              {isAdmin && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>

                  {/* 👤 Inscribir jugador individual */}
                  <button
                    onClick={() => setShowInscribirModal(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      backgroundColor: '#2D6A2D', color: 'white',
                      padding: '7px 14px', borderRadius: '8px',
                      fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                      border: 'none',
                    }}
                  >
                    👤 Inscribir Jugador
                  </button>

                  {/* 📥 Descargar plantilla CSV */}
                  <button
                    onClick={() => {
                      const headers = 'nombres,apellidos,email,telefono,docNumber,birthDate,gender,category,modality,seeding,ranking\n';
                      const example = 'Juan,García,juan@email.com,3001234567,12345678,1990-05-15,M,TERCERA,singles,1,100\n';
                      const blob = new Blob([headers + example], { type: 'text/csv;charset=utf-8;' });
                      const url  = URL.createObjectURL(blob);
                      const a    = document.createElement('a');
                      a.href     = url;
                      a.download = 'plantilla_inscripcion.csv';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      backgroundColor: '#EFF6FF', color: '#1D4ED8',
                      border: '1.5px solid #BFDBFE', borderRadius: '8px',
                      padding: '7px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                    }}
                  >
                    📥 Plantilla CSV
                  </button>

                  {/* 📂 Importar CSV */}
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    backgroundColor: importing ? '#F3F4F6' : '#1D4ED8',
                    color: importing ? '#6B7280' : 'white',
                    padding: '7px 14px', borderRadius: '8px',
                    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                  }}>
                    {importing ? 'Importando...' : '📂 Importar CSV'}
                    <input type="file" accept=".csv" onChange={handleImportCsv} style={{ display: 'none' }} />
                  </label>

                </div>
              )}
            </div>

            {importResult && (
              <div style={{ marginBottom: '16px', backgroundColor: importResult.error ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${importResult.error ? '#FECACA' : '#86EFAC'}`, borderRadius: '8px', padding: '12px', fontSize: '13px' }}>
                {importResult.error
                  ? <span style={{ color: '#DC2626' }}>❌ {importResult.error}</span>
                  : <span style={{ color: '#15803D' }}>✅ {importResult.created} inscritos · {importResult.errors?.length || 0} errores</span>
                }
              </div>
            )}

            {(enrollments as any[]).length === 0 ? (
              <p className="text-gray-400 text-center py-8">No hay inscritos aún.</p>
            ) : (
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB' }}>
                    {['Jugador','Categoría','Modalidad','Siembra','Estado pago','Acciones'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '9px 12px', color: '#6B7280', fontWeight: '600', fontSize: '12px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(enrollments as any[]).map((e: any, i: number) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ fontWeight: '600', color: '#1B3A1B' }}>{e.playerName}</div>
                        <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{e.playerEmail}</div>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600' }}>
                          {e.category}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', color: '#374151' }}>{e.modality || 'Singles'}</td>
                      <td style={{ padding: '9px 12px', color: '#374151' }}>{e.seeding ? `#${e.seeding}` : '—'}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '700',
                          backgroundColor: e.paymentStatus === 'approved' ? '#DCFCE7' : e.paymentStatus === 'pending' ? '#FEF9C3' : '#FEE2E2',
                          color: e.paymentStatus === 'approved' ? '#15803D' : e.paymentStatus === 'pending' ? '#92400E' : '#DC2626',
                        }}>
                          {e.paymentStatus === 'approved' ? '✓ Aprobado' : e.paymentStatus === 'pending' ? '⏳ Pendiente' : '✗ Rechazado'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {isAdmin && e.paymentStatus === 'pending' && (
                            <button
                              onClick={() => approvePayment(e.id)}
                              style={{ backgroundColor: '#F0FDF4', color: '#15803D', border: '1px solid #86EFAC', borderRadius: '6px', padding: '3px 9px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
                            >
                              💵 Aprobar
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={async () => {
                                if (!confirm(`¿Eliminar inscripción de ${e.playerName}?`)) return;
                                await api.delete(`/enrollments/${e.id}`);
                                queryClient.invalidateQueries({ queryKey: ['enrollments', id] });
                              }}
                              style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}
                            >
                              🗑
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TAB: PARTIDOS                                                  */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'matches' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-lat-dark mb-4">
              Partidos ({(matches as any[]).length})
            </h2>
            {(matches as any[]).length === 0 ? (
              <p className="text-gray-400 text-center py-8">No hay partidos generados. Ve a "Generar Draw".</p>
            ) : (
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB' }}>
                    {['Ronda','Categoría','Jugador 1','Jugador 2','Resultado','Estado','Hora'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '9px 12px', color: '#6B7280', fontWeight: '600', fontSize: '12px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(matches as any[]).map((m: any, i: number) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: m.status === 'suspended' ? '#FFF7ED' : i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ backgroundColor: '#F3F4F6', padding: '2px 7px', borderRadius: '5px', fontSize: '11px', fontWeight: '700' }}>{m.round}</span>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '2px 7px', borderRadius: '999px', fontSize: '11px', fontWeight: '600' }}>{m.category}</span>
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: m.winnerId === m.player1Id ? '700' : '400', color: m.player1Id ? '#1B3A1B' : '#9CA3AF' }}>
                        {m.player1Name || 'BYE'}
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: m.winnerId === m.player2Id ? '700' : '400', color: m.player2Id ? '#1B3A1B' : '#9CA3AF' }}>
                        {m.player2Name || 'BYE'}
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: '700', color: '#1B3A1B' }}>
                        {m.status === 'completed' || m.status === 'wo'
                          ? `${m.sets1}-${m.sets2}`
                          : m.status === 'suspended' && m.partialResult
                            ? <span style={{ color: '#F97316' }}>⛈ {m.partialResult.sets1}-{m.partialResult.sets2}</span>
                            : '—'
                        }
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '700',
                          backgroundColor:
                            m.status === 'live'      ? '#FEE2E2' :
                            m.status === 'completed' ? '#F0FDF4' :
                            m.status === 'wo'        ? '#FEF3C7' :
                            m.status === 'suspended' ? '#FFF7ED' : '#F9FAFB',
                          color:
                            m.status === 'live'      ? '#DC2626' :
                            m.status === 'completed' ? '#15803D' :
                            m.status === 'wo'        ? '#92400E' :
                            m.status === 'suspended' ? '#F97316' : '#6B7280',
                        }}>
                          {m.status === 'live'      ? '🔴 En vivo'   :
                           m.status === 'completed' ? '✓ Terminado'  :
                           m.status === 'wo'        ? 'W.O.'         :
                           m.status === 'suspended' ? '⛈ Suspendido' : '⏳ Pendiente'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', color: '#9CA3AF', fontSize: '12px' }}>
                        {m.scheduledAt
                          ? new Date(m.scheduledAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                          : '—'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TAB: GENERAR DRAW                                              */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'draw' && isAdmin && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-lat-dark mb-6">Generar Draw / Cuadro</h2>
            <div style={{ maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Categoría */}
              <div>
                <label style={lbl}>Categoría</label>
                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} style={sel}>
                  {(normalizeCategories(tournament.categories?.length > 0 ? tournament.categories : CATEGORIES)).map((cat: string) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Sistema de juego */}
              <div>
                <label style={lbl}>Sistema de juego</label>
                <select value={drawType} onChange={e => setDrawType(e.target.value)} style={sel}>
                  <option value="elimination">Eliminación Directa</option>
                  <option value="round_robin">Round Robin</option>
                  <option value="master">Torneo Máster LAT</option>
                </select>
              </div>

              {/* Modalidad (si tiene dobles) */}
              {tournament?.hasDoubles && (
                <div>
                  <label style={lbl}>Modalidad</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['singles', 'doubles'] as const).map(m => (
                      <button
                        key={m} type="button" onClick={() => setDrawModality(m)}
                        style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', backgroundColor: drawModality === m ? '#2D6A2D' : '#F3F4F6', color: drawModality === m ? 'white' : '#374151' }}
                      >
                        {m === 'singles' ? '🎾 Singles' : '👥 Dobles'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Avanzados por grupo (solo RR / Máster) */}
              {(drawType === 'round_robin' || drawType === 'master') && (
                <div>
                  <label style={lbl}>Jugadores que avanzan por grupo</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2].map(n => (
                      <button
                        key={n} onClick={() => setAdvancingPerGroup(n)}
                        style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', backgroundColor: advancingPerGroup === n ? '#2D6A2D' : '#F3F4F6', color: advancingPerGroup === n ? 'white' : '#374151' }}
                      >
                        {n} jugador{n > 1 ? 'es' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Formato de juego por ronda */}
              <div>
                <label style={lbl}>Formato de juego</label>
                <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
                  Formato general: <strong>{formatDescription(roundGameFormats.default)}</strong>
                </div>

                {/* Formato general — siempre visible y editable */}
                <div style={{ border: '2px solid #2D6A2D', borderRadius: '8px', marginBottom: '10px', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setExpandedRound(expandedRound === 'default' ? null : 'default')}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F0FDF4', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                  >
                    <span style={{ fontWeight: '700', color: '#15803D' }}>⚙️ Formato general</span>
                    <span style={{ fontSize: '11px', color: '#6B7280' }}>
                      {formatDescription(roundGameFormats.default)} {expandedRound === 'default' ? '▲' : '▼'}
                    </span>
                  </button>
                  {expandedRound === 'default' && (
                    <div style={{ padding: '0 14px 14px', borderTop: '1px solid #DCFCE7' }}>
                      <GameFormatConfig
                        value={roundGameFormats.default}
                        onChange={fmt => setRoundGameFormats({ ...roundGameFormats, default: fmt })}
                      />
                    </div>
                  )}
                </div>

                {/* Rondas específicas según tipo de draw */}
                {(() => {
                  const roundConfig: { key: string; label: string }[] =
                    drawType === 'round_robin'
                      ? [
                          { key: 'RR',   label: 'Round Robin (Grupo A y B)' },
                          { key: 'SF',   label: 'Semifinal (Main Draw)'     },
                          { key: 'F',    label: 'Final (Main Draw)'         },
                        ]
                      : drawType === 'master'
                      ? [
                          { key: 'RR_A', label: 'Grupo A'       },
                          { key: 'RR_B', label: 'Grupo B'       },
                          { key: 'SF_M', label: 'Semifinal Máster' },
                          { key: 'F_M',  label: 'Final Máster'  },
                        ]
                      : [
                          { key: 'QF', label: 'Cuartos de Final' },
                          { key: 'SF', label: 'Semifinal'        },
                          { key: 'F',  label: 'Final'            },
                        ];

                  return roundConfig.map(({ key: round, label }) => {
                    const isExpanded = expandedRound === round;
                    return (
                      <div key={round} style={{ border: '1px solid #E5E7EB', borderRadius: '8px', marginBottom: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setExpandedRound(isExpanded ? null : round)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                        >
                          <span style={{ fontWeight: '600', color: '#374151' }}>{label}</span>
                          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                          {roundGameFormats[round]
                            ? formatDescription(roundGameFormats[round])
                            : 'Usa formato general'
                          } {isExpanded ? '▲' : '▼'}
                        </span>
                      </button>
                      {isExpanded && (
                        <div style={{ padding: '0 14px 14px', borderTop: '1px solid #F3F4F6' }}>
                          <GameFormatConfig
                            value={roundGameFormats[round] || roundGameFormats.default}
                            onChange={fmt => setRoundGameFormats({ ...roundGameFormats, [round]: fmt })}
                          />
                          {roundGameFormats[round] && (
                            <button
                              onClick={() => {
                                const { [round]: _, ...rest } = roundGameFormats;
                                setRoundGameFormats(rest);
                              }}
                              style={{ fontSize: '11px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginTop: '4px' }}
                            >
                              Usar formato general
                            </button>
                          )}
                        </div>
                      )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Botón generar */}
              <button
                onClick={() => drawMutation.mutate()}
                disabled={drawMutation.isPending}
                style={{ width: '100%', backgroundColor: '#2D6A2D', color: 'white', padding: '13px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '700', opacity: drawMutation.isPending ? 0.7 : 1 }}
              >
                {drawMutation.isPending ? 'Generando...' : '🎾 Generar Draw'}
              </button>

              {drawMutation.isSuccess && (
                <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#15803D' }}>
                  ✅ Draw generado exitosamente. Ve a la pestaña "Cuadro" para verlo.
                </div>
              )}
              {drawMutation.isError && (
                <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#DC2626' }}>
                  ❌ Error al generar draw. Verifica que haya mínimo 6 jugadores inscritos.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TAB: CUADRO DE LLAVES                                          */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'bracket' && (
          <div className="bg-white rounded-xl shadow-sm p-6">

            {/* ── Cabecera del cuadro ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <h2 className="text-lg font-bold text-lat-dark">Cuadro de Llaves</h2>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {/* Exportar PDF */}
                <button
                  onClick={() => exportBracketPdf({ tournamentName: tournament?.name || 'Torneo', matches: bracketMatches })}
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', backgroundColor: '#1D4ED8', color: 'white', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                >
                  📄 Exportar PDF
                </button>

                {/* Generar Main Draw (solo si hay RR) */}
                {isAdmin && (bracketMatches as any[]).some((m: any) => ['RR','RR_A','RR_B'].includes(m.round)) && (
                  <button
                    onClick={async () => {
                      const cats = [...new Set((bracketMatches as any[])
                        .filter((m: any) => ['RR','RR_A','RR_B'].includes(m.round))
                        .map((m: any) => m.category)
                      )] as string[];
                      setMdCategory(cats[0]);
                      const res = await api.get(`/matches/tournament/${id}/rr-status/${cats[0]}`);
                      setRrStatus(res.data);
                      setShowMainDrawModal(true);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', backgroundColor: '#2D6A2D', color: 'white', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                  >
                    🏆 Generar Main Draw
                  </button>
                )}
              </div>
            </div>

            {/* ── Cuadro ── */}
            {(bracketMatches as any[]).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '15px', marginBottom: '8px' }}>No hay partidos generados aún.</p>
                <p style={{ fontSize: '13px' }}>Ve a "Generar Draw" para crear el cuadro.</p>
              </div>
            ) : (
              <BracketView
                matches={bracketMatches as any[]}
                isAdmin={isAdmin}
                onSuspendMatch={(match) => setSuspendModal({ open: true, match })}
                onResumeMatch={(match) => resumeMatchMutation.mutate(match.id)}
              />
            )}
          </div>
        )}
      </main>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Generar Main Draw desde RR                                 */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showMainDrawModal && rrStatus && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '520px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1B3A1B', marginBottom: '4px' }}>
              🏆 Generar Main Draw
            </h3>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
              Categoría: <strong>{mdCategory}</strong> · Los ganadores pasan al cuadro de eliminación.
            </p>

            {/* Estado de grupos */}
            <div style={{ marginBottom: '18px' }}>
              {rrStatus.groups?.map((g: any) => (
                <div key={g.groupLabel} style={{ border: `1px solid ${g.complete ? '#86EFAC' : '#FDE68A'}`, borderRadius: '8px', padding: '12px', marginBottom: '8px', backgroundColor: g.complete ? '#F0FDF4' : '#FFFBEB' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '700', color: '#1B3A1B' }}>Grupo {g.groupLabel}</span>
                    <span style={{ fontSize: '12px', color: g.complete ? '#15803D' : '#92400E' }}>
                      {g.complete ? '✓ Completo' : `${g.finished}/${g.total} partidos jugados`}
                    </span>
                  </div>
                  <table style={{ width: '100%', fontSize: '12px' }}>
                    <tbody>
                      {g.standings?.map((p: any, idx: number) => (
                        <tr key={p.playerId} style={{ opacity: idx < mdAdvancing ? 1 : 0.45 }}>
                          <td style={{ padding: '4px 6px', width: '24px' }}>
                            <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: idx === 0 ? '#22C55E' : idx === 1 ? '#3B82F6' : '#D1D5DB', color: 'white', fontSize: '9px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              {idx + 1}
                            </span>
                          </td>
                          <td style={{ padding: '4px 6px', fontWeight: idx < mdAdvancing ? '700' : '400' }}>{p.name}</td>
                          <td style={{ padding: '4px 6px', color: '#6B7280' }}>{p.wins}V {p.losses}D</td>
                          {idx < mdAdvancing && (
                            <td style={{ padding: '4px 6px', color: '#15803D', fontSize: '11px', fontWeight: '600' }}>→ Main Draw</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {/* Cuántos avanzan */}
            <div style={{ marginBottom: '16px' }}>
              <label style={lbl}>Jugadores que avanzan por grupo al Main Draw</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2].map(n => (
                  <button key={n} onClick={() => setMdAdvancing(n)}
                    style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', backgroundColor: mdAdvancing === n ? '#2D6A2D' : '#F3F4F6', color: mdAdvancing === n ? 'white' : '#374151' }}
                  >
                    {n} jugador{n > 1 ? 'es' : ''}
                  </button>
                ))}
              </div>
            </div>

            {!rrStatus.allComplete && (
              <div style={{ backgroundColor: '#FEF9C3', border: '1px solid #FDE047', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#92400E', marginBottom: '14px' }}>
                ⚠️ Hay grupos con partidos pendientes. El Main Draw se generará con los resultados actuales.
              </div>
            )}

            {generateMainDrawMutation.isError && (
              <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#DC2626', marginBottom: '14px' }}>
                ❌ Error al generar. Verifica que todos los grupos tengan resultados.
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowMainDrawModal(false)}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => generateMainDrawMutation.mutate()}
                disabled={generateMainDrawMutation.isPending}
                style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#2D6A2D', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '700', opacity: generateMainDrawMutation.isPending ? 0.6 : 1 }}
              >
                {generateMainDrawMutation.isPending ? 'Generando...' : '🏆 Confirmar Main Draw'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Inscribir jugador individual                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <InscribirJugadorModal
        isOpen={showInscribirModal}
        tournamentId={id!}
        categories={normalizeCategories(tournament?.categories?.length > 0 ? tournament.categories : CATEGORIES)}
        onConfirm={handleInscribir}
        onCancel={() => { setShowInscribirModal(false); setInscribirError(null); }}
        isLoading={inscribirLoading}
        error={inscribirError}
      />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Suspender partido individual desde el cuadro               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <SuspendModal
        isOpen={suspendModal.open}
        mode="match"
        match={suspendModal.match}
        onConfirm={(reason, resumeDate) => {
          if (!suspendModal.match) return;
          suspendMatchMutation.mutate({
            matchId:    suspendModal.match.id,
            reason,
            resumeDate,
          });
        }}
        onCancel={() => setSuspendModal({ open: false })}
        isLoading={suspendMatchMutation.isPending}
      />
    </div>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────
const lbl: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' };
const sel: React.CSSProperties = { width: '100%', border: '1.5px solid #D1D5DB', borderRadius: '8px', padding: '9px 12px', fontSize: '13px' };