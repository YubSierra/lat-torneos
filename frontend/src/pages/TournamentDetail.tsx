// frontend/src/pages/TournamentDetail.tsx  ← REEMPLAZA COMPLETO
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Trophy, Calendar, Settings, UserPlus } from 'lucide-react';
import AlternateManager from '../components/AlternateManager';
import CategoryMergeModal from '../components/CategoryMergeModal';
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
import EditScheduleModal from '../components/EditScheduleModal';
import { courtsApi } from '../api/courts.api';
import InscribirJugadorModal from '../components/InscribirJugadorModal';
import CambiarPagoModal      from '../components/CambiarPagoModal';
import DeleteDrawButton from '../components/DeleteDrawButton';


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
  const [activeTab, setActiveTab] = useState<'info' | 'enrollments' | 'matches' | 'draw' | 'bracket' | 'alternos'>('info');

  // ── Modals ────────────────────────────────────────────────────────────
  const [showMergeModal, setShowMergeModal] = useState(false);

  // ── Draw config ───────────────────────────────────────────────────────
  const [selectedCategory,  setSelectedCategory]  = useState('');
  const [drawType,          setDrawType]          = useState('elimination');
  const [drawModality,      setDrawModality]      = useState<'singles' | 'doubles'>('singles');
  const [advancingPerGroup, setAdvancingPerGroup] = useState(1);
  const [roundGameFormats,  setRoundGameFormats]  = useState<Record<string, GameFormat>>({ default: { ...DEFAULT_FORMAT } });
  const [expandedRound,     setExpandedRound]     = useState<string | null>(null);
  const [includeReserved,   setIncludeReserved]   = useState(false); // ← draw con reservados
  const [minPlayersPerGroup, setMinPlayersPerGroup] = useState(3);

  // ── Import CSV ────────────────────────────────────────────────────────
  const [importing,         setImporting]         = useState(false);
  const [importResult,      setImportResult]       = useState<any>(null);
  const [csvPaymentMethod,  setCsvPaymentMethod]   = useState('manual'); // ← forma de pago CSV

  // ── Main Draw modal ───────────────────────────────────────────────────
  const [rrStatus,          setRrStatus]          = useState<any>(null);
  const [showMainDrawModal,       setShowMainDrawModal]       = useState(false);
  const [showExportBracketModal,  setShowExportBracketModal]  = useState(false);
  const [exportModality, setExportModality] = useState<'all' | 'singles' | 'doubles'>('all');
  const [mdCategory,        setMdCategory]        = useState('');
  const [mdAdvancing,       setMdAdvancing]       = useState(1);
  const [rrCategories,      setRrCategories]      = useState<string[]>([]);

  // ── Editar resultado de partido ───────────────────────────────────────
  const [editMatch,  setEditMatch]  = useState<any>(null);
  const [editSets1,  setEditSets1]  = useState('');
  const [editSets2,  setEditSets2]  = useState('');
  const [editGames1, setEditGames1] = useState('');
  const [editGames2, setEditGames2] = useState('');

  // ── Suspensión de partido desde el cuadro ────────────────────────────
  const [suspendModal, setSuspendModal] = useState<{
    open: boolean;
    match?: any;
  }>({ open: false });

  const [rescheduleModal, setRescheduleModal] = useState<{
    open: boolean;
    match?: any;
  }>({ open: false });

  const [bulkRescheduleModal, setBulkRescheduleModal] = useState(false);
  const [bulkDate, setBulkDate] = useState('');
  const [bulkStartTime, setBulkStartTime] = useState('');
  const [bulkCourtId, setBulkCourtId] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // ── Modal inscribir jugador individual ───────────────────────────────
  const [showInscribirModal, setShowInscribirModal] = useState(false);
  const [inscribirError,     setInscribirError]     = useState<string | null>(null);
  const [inscribirLoading,   setInscribirLoading]   = useState(false);

  // ── Filtros sección inscritos ─────────────────────────────────────────
  const [enrollSearch,    setEnrollSearch]    = useState('');
  const [enrollCategory,  setEnrollCategory]  = useState('');
  const [enrollModality,  setEnrollModality]  = useState('');

  // ── Modal preparar rondas (crear placeholders main draw) ─────────────
  const [prepRondasModal, setPrepRondasModal] = useState(false);
  const [prepRondasCat,   setPrepRondasCat]   = useState('');
  const [prepRondasAdv,   setPrepRondasAdv]   = useState(2);
  const [prepRondasMsg,   setPrepRondasMsg]   = useState('');
  const [prepRondasErr,   setPrepRondasErr]   = useState('');

  // ── Modal cambiar forma de pago ───────────────────────────────────────
  const [cambiarPagoModal, setCambiarPagoModal] = useState<{ open: boolean; enrollment: any | null }>({ open: false, enrollment: null });
  const [cambiarPagoLoading, setCambiarPagoLoading] = useState(false);

  // ── Modal cambiar categoría de inscripción ────────────────────────────
  const [changeCatModal, setChangeCatModal] = useState<{ open: boolean; enrollment: any | null; newCat: string }>({ open: false, enrollment: null, newCat: '' });
  const [changeCatLoading, setChangeCatLoading] = useState(false);
  const [changeCatError, setChangeCatError] = useState('');

  // ── Modal renombrar categoría ─────────────────────────────────────────
  const [renameCatModal, setRenameCatModal] = useState<{ open: boolean; oldName: string; newName: string }>({ open: false, oldName: '', newName: '' });
  const [renameCatLoading, setRenameCatLoading] = useState(false);
  const [renameCatError, setRenameCatError] = useState('');

  // ── Queries ───────────────────────────────────────────────────────────
  const { data: tournament, isLoading } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => tournamentsApi.getOne(id!),
  });

  // Auto-seleccionar primera categoría real del torneo cuando cargue
  useEffect(() => {
    if (tournament && !selectedCategory) {
      const cats = normalizeCategories(
        tournament.categories?.length > 0 ? tournament.categories : CATEGORIES
      );
      if (cats.length > 0) setSelectedCategory(cats[0]);
    }
  }, [tournament]);

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
      tournamentsApi.generateDraw(id!, selectedCategory, drawType, advancingPerGroup, drawModality, roundGameFormats, includeReserved, minPlayersPerGroup),
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

  const updateDoublesMutation = useMutation({
    mutationFn: (open: boolean) =>
      tournamentsApi.update(id!, { doublesOpenForRegistration: open } as any),
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

  // ── Canchas (para modal de reprogramar) ──────────────────────────────
  const { data: courts = [] } = useQuery({
    queryKey: ['courts'],
    queryFn: () => courtsApi.getAll(),
  });

  // ── Reprogramar partido suspendido desde el cuadro ───────────────────
  const rescheduleMatchMutation = useMutation({
    mutationFn: ({ matchId, data }: { matchId: string; data: any }) =>
      matchesApi.rescheduleMatch(matchId, data),
    onSuccess: () => {
      setRescheduleModal({ open: false });
      refetchBracket();
      queryClient.invalidateQueries({ queryKey: ['matches', id] });
    },
  });

  // ── Editar grupos RR ──────────────────────────────────────────────────
  const [editRRModal, setEditRRModal] = useState<{ open: boolean; category: string }>({ open: false, category: '' });
  // groups: { groupLabel → playerIds[] } — se construye al abrir el modal
  const [editRRGroups, setEditRRGroups] = useState<Record<string, string[]>>({});
  // map playerId → name (para mostrar en el modal)
  const [editRRNames, setEditRRNames] = useState<Record<string, string>>({});

  const editRRGroupsMutation = useMutation({
    mutationFn: ({ category, groups }: { category: string; groups: Record<string, string[]> }) =>
      api.put(`/tournaments/${id}/draw/rr-groups`, { category, groups }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bracket-matches', id] });
      setEditRRModal({ open: false, category: '' });
    },
  });

  const openEditRRModal = (category: string) => {
    // Construir estado inicial de grupos desde bracketMatches
    const rrMatches = (bracketMatches as any[]).filter(
      (m: any) => m.category === category && m.round === 'RR',
    );
    const groups: Record<string, string[]> = {};
    const names: Record<string, string> = {};
    rrMatches.forEach((m: any) => {
      const g = m.groupLabel || 'A';
      if (!groups[g]) groups[g] = [];
      if (m.player1Id && !groups[g].includes(m.player1Id)) {
        groups[g].push(m.player1Id);
        names[m.player1Id] = m.player1Name || m.player1Id;
      }
      if (m.player2Id && !groups[g].includes(m.player2Id)) {
        groups[g].push(m.player2Id);
        names[m.player2Id] = m.player2Name || m.player2Id;
      }
    });
    setEditRRGroups(groups);
    setEditRRNames(names);
    setEditRRModal({ open: true, category });
  };

  // ── Import CSV ────────────────────────────────────────────────────────
  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('paymentMethod', csvPaymentMethod); // ← envía forma de pago
    try {
      // ⚠️ El endpoint del backend es import-csv (no import)
      const res = await api.post(`/enrollments/import-csv/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['enrollments', id] });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Error al importar el archivo';
      setImportResult({ error: msg });
    } finally {
      setImporting(false);
      // Resetear el input para permitir subir el mismo archivo de nuevo
      e.target.value = '';
    }
  };

  // ── Aprobar pago ──────────────────────────────────────────────────────
  const approvePayment = async (enrollmentId: string) => {
    await api.patch(`/enrollments/${enrollmentId}/approve-payment`);
    queryClient.invalidateQueries({ queryKey: ['enrollments', id] });
  };

  // ── Cambiar forma de pago (admin) ─────────────────────────────────────
  const handleCambiarPago = async (enrollmentId: string, paymentMethod: string, adminNotes: string) => {
    setCambiarPagoLoading(true);
    try {
      await api.patch(`/enrollments/${enrollmentId}/payment-method`, { paymentMethod, adminNotes });
      queryClient.invalidateQueries({ queryKey: ['enrollments', id] });
      setCambiarPagoModal({ open: false, enrollment: null });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Error al cambiar forma de pago');
    } finally {
      setCambiarPagoLoading(false);
    }
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

  // Helper: BYE real vs slot pendiente
  const getPlayerName = (m: any, player: 1 | 2) => {
    const pid = player === 1 ? m.player1Id : m.player2Id;
    if (pid) return player === 1 ? m.player1Name : m.player2Name;
    // Sin playerId: si hay winnerId → BYE real (el otro avanzó directo)
    //              si no hay winnerId → slot pendiente (esperando ganador)
    return m.winnerId ? 'BYE' : 'Por definir';
  };

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>
                  Estado:
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={tournament.status}
                    onChange={e => updateStatusMutation.mutate(e.target.value)}
                    disabled={updateStatusMutation.isPending}
                    style={{
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      padding: '8px 36px 8px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      border: '2px solid',
                      outline: 'none',
                      ...(tournament.status === 'draft'     ? { backgroundColor: '#F3F4F6', color: '#6B7280', borderColor: '#D1D5DB' } :
                          tournament.status === 'open'      ? { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' } :
                          tournament.status === 'closed'    ? { backgroundColor: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A' } :
                          tournament.status === 'active'    ? { backgroundColor: '#F0FDF4', color: '#15803D', borderColor: '#86EFAC' } :
                          tournament.status === 'completed' ? { backgroundColor: '#F3F4F6', color: '#374151', borderColor: '#D1D5DB' } :
                                                             { backgroundColor: '#F3F4F6', color: '#6B7280', borderColor: '#D1D5DB' }),
                    }}
                  >
                    <option value="draft">     📝 Borrador        </option>
                    <option value="open">      📋 Inscripciones   </option>
                    <option value="closed">    🔒 Inscripciones cerradas </option>
                    <option value="active">    🎾 En curso         </option>
                    <option value="completed"> 🏆 Finalizado       </option>
                  </select>
                  <span style={{
                    position: 'absolute', right: '10px', top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none', fontSize: '10px', color: '#6B7280',
                  }}>
                    ▼
                  </span>
                </div>
                {updateStatusMutation.isPending && (
                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Guardando...</span>
                )}
              </div>
            )}
          </div>

          {/* ── Toggle dobles — solo si el torneo tiene dobles ─────────── */}
          {isAdmin && tournament?.hasDoubles && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: tournament.doublesOpenForRegistration ? '#F0FDF4' : '#F9FAFB',
              border: `1.5px solid ${tournament.doublesOpenForRegistration ? '#86EFAC' : '#E5E7EB'}`,
              borderRadius: '10px', padding: '10px 14px', gap: '12px',
              marginTop: '12px',
              transition: 'all 0.2s ease',
            }}>
              <div>
                <p style={{
                  margin: 0, fontSize: '13px', fontWeight: '700',
                  color: tournament.doublesOpenForRegistration ? '#15803D' : '#6B7280',
                }}>
                  🤝 Inscripciones de dobles
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9CA3AF', lineHeight: '1.4' }}>
                  {tournament.doublesOpenForRegistration
                    ? 'Abiertas · Los jugadores pueden inscribirse en dobles'
                    : 'Cerradas · Cierra esto antes de programar el cuadro de dobles'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => updateDoublesMutation.mutate(!tournament.doublesOpenForRegistration)}
                disabled={updateDoublesMutation.isPending}
                style={{
                  position: 'relative', flexShrink: 0,
                  width: '44px', height: '24px', borderRadius: '12px',
                  border: 'none', cursor: updateDoublesMutation.isPending ? 'not-allowed' : 'pointer',
                  backgroundColor: tournament.doublesOpenForRegistration ? '#22C55E' : '#D1D5DB',
                  transition: 'background-color 0.2s ease',
                  padding: 0,
                }}
                title={tournament.doublesOpenForRegistration
                  ? 'Clic para cerrar inscripciones de dobles'
                  : 'Clic para abrir inscripciones de dobles'}
              >
                <span style={{
                  position: 'absolute', top: '3px',
                  left: tournament.doublesOpenForRegistration ? '23px' : '3px',
                  width: '18px', height: '18px', borderRadius: '50%',
                  backgroundColor: 'white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  transition: 'left 0.2s ease',
                  display: 'block',
                }} />
              </button>
            </div>
          )}

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
            { key: 'alternos',    icon: UserPlus, label: 'Alternos'     },
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
                    {normalizeCategories(tournament.categories).map((cat: string) => {
                      const hasDraw = (matches as any[]).some(m => m.category === cat);
                      return (
                        <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600' }}>
                            {cat}
                          </span>
                          {isAdmin && (
                            <button
                              onClick={() => !hasDraw && setRenameCatModal({ open: true, oldName: cat, newName: cat })}
                              disabled={hasDraw}
                              title={hasDraw ? 'Elimina el cuadro para renombrar' : `Renombrar "${cat}"`}
                              style={{ background: 'none', border: 'none', cursor: hasDraw ? 'not-allowed' : 'pointer', color: hasDraw ? '#D1D5DB' : '#6B7280', fontSize: '12px', padding: '1px 3px', lineHeight: 1 }}
                            >
                              ✏️
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Árbitro y Director */}
              {(tournament.refereeName || tournament.directorName) && (
                <div style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
                  <div style={{ height: '1px', backgroundColor: '#F3F4F6', margin: '4px 0 14px' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {tournament.refereeName && (
                      <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '10px', padding: '12px 14px' }}>
                        <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          🧑‍⚖️ Árbitro (Referee)
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: '700', color: '#1B3A1B' }}>
                          {tournament.refereeName}
                        </p>
                        {tournament.refereePhone && (
                          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#374151' }}>
                            📞 {tournament.refereePhone}
                          </p>
                        )}
                      </div>
                    )}
                    {tournament.directorName && (
                      <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '12px 14px' }}>
                        <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          👔 Director del torneo
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: '700', color: '#1B3A1B' }}>
                          {tournament.directorName}
                        </p>
                        {tournament.directorPhone && (
                          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#374151' }}>
                            📞 {tournament.directorPhone}
                          </p>
                        )}
                      </div>
                    )}
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
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h2 className="text-lg font-bold text-lat-dark">
                  Jugadores inscritos ({(enrollments as any[]).length})
                </h2>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>

                    {/* 👤 Inscribir jugador individual */}
                    <button
                      onClick={() => setShowInscribirModal(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#2D6A2D', color: 'white', padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: 'none' }}
                    >
                      👤 Inscribir Jugador
                    </button>

                    {/* 📥 Descargar plantilla CSV */}
                    <button
                      onClick={() => {
                        // Obligatorios: nombres, apellidos, email
                        // Opcionales: telefono, docNumber, birthDate, gender, categoryGender, seeding, ranking, adminNotes
                        const headers = 'nombres,apellidos,email,telefono,docNumber,birthDate,gender,category,categoryGender,modality,seeding,ranking,adminNotes\n';
                        const example1 = 'Juan,García,juan@email.com,3001234567,12345678,1990-05-15,M,TERCERA,M,singles,1,100,\n';
                        const example2 = 'María,López,maria@email.com,3009876543,87654321,1995-08-20,F,TERCERA,F,singles,2,80,\n';
                        const example3 = 'Carlos,Pérez,carlos@email.com,,,,M,CUARTA,,singles,,,\n';
                        const example = example1 + example2 + example3;
                        const blob = new Blob([headers + example], { type: 'text/csv;charset=utf-8;' });
                        const url  = URL.createObjectURL(blob);
                        const a    = document.createElement('a');
                        a.href = url; a.download = 'plantilla_inscripcion.csv'; a.click();
                        URL.revokeObjectURL(url);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1.5px solid #BFDBFE', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      📥 Plantilla CSV
                    </button>

                    {/* 📂 Importar CSV */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: importing ? '#F3F4F6' : '#1D4ED8', color: importing ? '#6B7280' : 'white', padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                      {importing ? 'Importando...' : '📂 Importar CSV'}
                      <input type="file" accept=".csv" onChange={handleImportCsv} style={{ display: 'none' }} />
                    </label>

                  </div>
                )}
              </div>

              {/* ── Selector forma de pago para CSV ── */}
              {isAdmin && (
                <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '12px 14px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '8px' }}>
                    💳 Forma de pago para el CSV que importes:
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                      { value: 'manual',   label: '💵 Efectivo',     color: '#15803D', bg: '#F0FDF4', border: '#86EFAC'  },
                      { value: 'transfer', label: '🏦 Transferencia', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE'  },
                      { value: 'courtesy', label: '🎁 Cortesía',      color: '#6B21A8', bg: '#F3E8FF', border: '#DDD6FE'  },
                      { value: 'reserved', label: '⏳ Reservado',     color: '#92400E', bg: '#FEF3C7', border: '#FDE68A'  },
                    ].map(pm => (
                      <button
                        key={pm.value}
                        type="button"
                        onClick={() => setCsvPaymentMethod(pm.value)}
                        style={{
                          padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700',
                          border: `2px solid ${csvPaymentMethod === pm.value ? pm.border : '#E5E7EB'}`,
                          backgroundColor: csvPaymentMethod === pm.value ? pm.bg : 'white',
                          color: csvPaymentMethod === pm.value ? pm.color : '#6B7280',
                        }}
                      >
                        {pm.label}
                      </button>
                    ))}
                  </div>
                  {csvPaymentMethod === 'reserved' && (
                    <p style={{ fontSize: '11px', color: '#92400E', marginTop: '6px', fontStyle: 'italic' }}>
                      ⚠️ Los jugadores importados quedarán como <strong>Reservados</strong>. No aparecerán en el draw hasta que confirmes su pago o actives "incluir reservados" al generar el cuadro.
                    </p>
                  )}
                </div>
              )}
            </div>

            {importResult && (
              <div style={{ marginBottom: '16px', backgroundColor: importResult.error ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${importResult.error ? '#FECACA' : '#86EFAC'}`, borderRadius: '8px', padding: '12px', fontSize: '13px' }}>
                {importResult.error
                  ? <span style={{ color: '#DC2626' }}>❌ {importResult.error}</span>
                  : (
                    <div>
                      <p style={{ fontWeight: '700', color: '#15803D', marginBottom: '6px' }}>
                        ✅ Importación completada
                      </p>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px' }}>
                        <span style={{ color: '#15803D' }}>✅ Inscritos: <strong>{importResult.enrolled ?? importResult.created ?? 0}</strong></span>
                        <span style={{ color: '#1D4ED8' }}>👤 Usuarios nuevos: <strong>{importResult.created ?? 0}</strong></span>
                        <span style={{ color: '#92400E' }}>🔄 Ya existían: <strong>{importResult.existing ?? 0}</strong></span>
                        {(importResult.skipped ?? 0) > 0 && (
                          <span style={{ color: '#DC2626' }}>⚠️ Omitidos: <strong>{importResult.skipped}</strong></span>
                        )}
                      </div>
                      {importResult.errors?.length > 0 && (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #DCFCE7' }}>
                          <p style={{ fontSize: '11px', color: '#DC2626', fontWeight: '600', marginBottom: '4px' }}>Errores por fila:</p>
                          {importResult.errors.map((err: string, i: number) => (
                            <p key={i} style={{ fontSize: '11px', color: '#DC2626', margin: '2px 0' }}>• {err}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }
              </div>
            )}

            {/* ── Filtros inscritos ─────────────────────────────────── */}
            {(enrollments as any[]).length > 0 && (() => {
              const enrollCats = [...new Set((enrollments as any[]).map((e: any) => e.category).filter(Boolean))].sort();
              const hasEnrollFilters = enrollSearch.trim() || enrollCategory || enrollModality;
              return (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px', padding: '10px 12px', backgroundColor: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                  <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: '600', whiteSpace: 'nowrap' }}>🔍 Filtrar:</span>

                  {/* Texto libre */}
                  <input
                    type="text"
                    placeholder="Nombre, documento, correo o teléfono..."
                    value={enrollSearch}
                    onChange={e => setEnrollSearch(e.target.value)}
                    style={{
                      flex: 1, minWidth: '200px', maxWidth: '320px',
                      border: '1.5px solid #E5E7EB', borderRadius: '8px',
                      padding: '6px 10px', fontSize: '12px', outline: 'none',
                      backgroundColor: enrollSearch ? '#F0FDF4' : 'white',
                      borderColor: enrollSearch ? '#86EFAC' : '#E5E7EB',
                    }}
                  />

                  {/* Categoría */}
                  <select
                    value={enrollCategory}
                    onChange={e => setEnrollCategory(e.target.value)}
                    style={{
                      border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '6px 10px',
                      fontSize: '12px', outline: 'none', cursor: 'pointer',
                      backgroundColor: enrollCategory ? '#F0FDF4' : 'white',
                      borderColor: enrollCategory ? '#86EFAC' : '#E5E7EB',
                    }}
                  >
                    <option value="">Todas las categorías</option>
                    {enrollCats.map((c: string) => <option key={c} value={c}>{c}</option>)}
                  </select>

                  {/* Modalidad */}
                  <select
                    value={enrollModality}
                    onChange={e => setEnrollModality(e.target.value)}
                    style={{
                      border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '6px 10px',
                      fontSize: '12px', outline: 'none', cursor: 'pointer',
                      backgroundColor: enrollModality ? '#F0FDF4' : 'white',
                      borderColor: enrollModality ? '#86EFAC' : '#E5E7EB',
                    }}
                  >
                    <option value="">Todas las modalidades</option>
                    <option value="singles">Singles</option>
                    <option value="doubles">Dobles</option>
                  </select>

                  {/* Limpiar */}
                  {hasEnrollFilters && (
                    <button
                      onClick={() => { setEnrollSearch(''); setEnrollCategory(''); setEnrollModality(''); }}
                      style={{ padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #FECACA', backgroundColor: '#FFF5F5', color: '#DC2626', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      ✕ Limpiar
                    </button>
                  )}

                  {/* Contador */}
                  {hasEnrollFilters && (() => {
                    const q = enrollSearch.trim().toLowerCase();
                    const filtered = (enrollments as any[]).filter((e: any) => {
                      const textMatch = !q || [e.playerName, e.playerEmail, e.playerPhone, e.playerDocNumber]
                        .some(v => v?.toLowerCase().includes(q));
                      const catMatch  = !enrollCategory || e.category === enrollCategory;
                      const modMatch  = !enrollModality || (e.modality || 'singles') === enrollModality;
                      return textMatch && catMatch && modMatch;
                    });
                    return <span style={{ fontSize: '12px', color: '#6B7280', marginLeft: 'auto' }}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>;
                  })()}
                </div>
              );
            })()}

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
                  {((enrollments as any[]).filter((e: any) => {
                      const q = enrollSearch.trim().toLowerCase();
                      const textMatch = !q || [e.playerName, e.playerEmail, e.playerPhone, e.playerDocNumber]
                        .some((v: any) => v?.toLowerCase().includes(q));
                      const catMatch  = !enrollCategory || e.category === enrollCategory;
                      const modMatch  = !enrollModality || (e.modality || 'singles') === enrollModality;
                      return textMatch && catMatch && modMatch;
                    })).map((e: any, i: number) => {
                    // ── Helper: mapea e.status → color + label
                    const statusCfg: Record<string, { bg: string; color: string; label: string }> = {
                      approved:  { bg: '#DCFCE7', color: '#15803D', label: '✓ Aprobado'    },
                      pending:   { bg: '#FEF9C3', color: '#92400E', label: '⏳ Pendiente'   },
                      reserved:  { bg: '#FEF3C7', color: '#B45309', label: '⏳ Reservado'   },
                      rejected:  { bg: '#FEE2E2', color: '#DC2626', label: '✗ Rechazado'   },
                      alternate: { bg: '#F3E8FF', color: '#6B21A8', label: '🔄 Alterno'     },
                    };
                    const sc = statusCfg[e.status] ?? statusCfg['rejected'];

                    // Forma de pago (si viene del backend)
                    const pmLabels: Record<string, string> = {
                      manual:      '💵 Efectivo',
                      transfer:    '🏦 Transferencia',
                      courtesy:    '🎁 Cortesía',
                      reserved:    '⏳ Reservado',
                      mercadopago: '💳 MercadoPago',
                      MANUAL:      '💵 Efectivo',
                      TRANSFER:    '🏦 Transferencia',
                    };
                    const pmLabel = e.paymentMethod
                      ? pmLabels[e.paymentMethod] ?? e.paymentMethod
                      : e.paymentId
                        ? pmLabels[e.paymentId] ?? null
                        : null;

                    return (
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
                      <td style={{ padding: '9px 12px', color: '#374151' }}>{e.modality || 'singles'}</td>
                      <td style={{ padding: '9px 12px', color: '#374151' }}>{e.seeding ? `#${e.seeding}` : '—'}</td>
                      <td style={{ padding: '9px 12px' }}>
                        {/* Estado de inscripción */}
                        <span style={{ padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', backgroundColor: sc.bg, color: sc.color }}>
                          {sc.label}
                        </span>
                        {/* Forma de pago debajo si existe */}
                        {pmLabel && (
                          <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '3px' }}>{pmLabel}</div>
                        )}
                        {/* Notas del admin */}
                        {e.adminNotes && (
                          <div style={{ fontSize: '10px', color: '#B45309', marginTop: '2px', fontStyle: 'italic' }}>📝 {e.adminNotes}</div>
                        )}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {/* Aprobar pago — para pending y reserved */}
                          {isAdmin && (e.status === 'pending' || e.status === 'reserved') && (
                            <button
                              onClick={() => approvePayment(e.id)}
                              style={{ backgroundColor: '#F0FDF4', color: '#15803D', border: '1px solid #86EFAC', borderRadius: '6px', padding: '3px 9px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
                            >
                              💵 Aprobar
                            </button>
                          )}
                          {/* Cambiar forma de pago — siempre visible para admin */}
                          {isAdmin && (
                            <button
                              onClick={() => setCambiarPagoModal({ open: true, enrollment: e })}
                              style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '3px 9px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
                            >
                              💳 Pago
                            </button>
                          )}
                          {/* Cambiar categoría — solo si no hay cuadros generados */}
                          {isAdmin && (() => {
                            const hasDraw = (matches as any[]).some(m => m.category === e.category);
                            return (
                              <button
                                onClick={() => !hasDraw && setChangeCatModal({ open: true, enrollment: e, newCat: e.category })}
                                disabled={hasDraw}
                                title={hasDraw ? 'Elimina el cuadro antes de cambiar la categoría' : 'Cambiar categoría'}
                                style={{ backgroundColor: hasDraw ? '#F9FAFB' : '#FFF7ED', color: hasDraw ? '#9CA3AF' : '#C2410C', border: `1px solid ${hasDraw ? '#E5E7EB' : '#FDBA74'}`, borderRadius: '6px', padding: '3px 9px', fontSize: '11px', cursor: hasDraw ? 'not-allowed' : 'pointer', fontWeight: '600' }}
                              >
                                📂 Cat.
                              </button>
                            );
                          })()}
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
                    );
                  })}
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
                    {['Ronda','Categoría','Jugador 1','Jugador 2','Resultado','Estado','Hora', ...(isAdmin ? ['Acciones'] : [])].map(h => (
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
                        {getPlayerName(m, 1)}
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: m.winnerId === m.player2Id ? '700' : '400', color: m.player2Id ? '#1B3A1B' : '#9CA3AF' }}>
                        {getPlayerName(m, 2)}
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
                      {isAdmin && (
                        <td style={{ padding: '9px 12px' }}>
                          {(m.status === 'completed' || m.status === 'wo') && (
                            <button
                              onClick={() => {
                                setEditMatch(m);
                                setEditSets1(String(m.sets1 ?? ''));
                                setEditSets2(String(m.sets2 ?? ''));
                                setEditGames1(String(m.games1 ?? ''));
                                setEditGames2(String(m.games2 ?? ''));
                              }}
                              style={{
                                backgroundColor: '#EFF6FF', color: '#1D4ED8',
                                border: '1px solid #BFDBFE', borderRadius: '6px',
                                padding: '4px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: '600',
                              }}
                            >
                              ✏️ Editar
                            </button>
                          )}
                        </td>
                      )}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-lat-dark" style={{ margin: 0 }}>Generar Draw / Cuadro</h2>
              {(normalizeCategories(tournament?.categories?.length > 0 ? tournament.categories : CATEGORIES)).length > 1 && (
                <button
                  onClick={() => setShowMergeModal(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px', borderRadius: '8px',
                    border: '1.5px solid #FDE68A', backgroundColor: '#FFFBEB',
                    color: '#92400E', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                  }}
                >
                  ⚡ Unificar categorías
                </button>
              )}
            </div>
            <div style={{ maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Categoría */}
              <div>
                <label style={lbl}>
                  Categoría
                  {selectedCategory && (
                    <span style={{ fontWeight: '400', color: '#9CA3AF', marginLeft: '8px', fontSize: '11px' }}>
                      seleccionada: <strong style={{ color: '#1D4ED8' }}>{selectedCategory}</strong>
                    </span>
                  )}
                </label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  style={{ ...sel, borderColor: selectedCategory ? '#6EE7B7' : '#F87171' }}
                >
                  <option value="">-- Selecciona una categoría --</option>
                  {(normalizeCategories(tournament.categories?.length > 0 ? tournament.categories : CATEGORIES)).map((cat: string) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {!selectedCategory && (
                  <p style={{ fontSize: '11px', color: '#EF4444', marginTop: '4px' }}>⚠️ Debes seleccionar una categoría</p>
                )}
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

              {/* Opciones Round Robin */}
              {drawType === 'round_robin' && (
                <>
                  {/* Tamaño mínimo de grupo */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Jugadores por grupo (mínimo)
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {[3, 4, 5, 6].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setMinPlayersPerGroup(n)}
                          style={{
                            padding: '8px 16px', borderRadius: '8px', border: 'none',
                            cursor: 'pointer', fontWeight: '600', fontSize: '14px',
                            backgroundColor: minPlayersPerGroup === n ? '#2D6A2D' : '#F3F4F6',
                            color: minPlayersPerGroup === n ? 'white' : '#374151',
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                      Con grupos de <strong>{minPlayersPerGroup}</strong> jugadores.{' '}
                      Si hay <strong>≤ {minPlayersPerGroup}</strong> inscritos → <strong>grupo único sin Main Draw</strong>, el líder es campeón.
                    </p>
                  </div>

                  {/* Jugadores que pasan al Main Draw */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Jugadores que pasan al Main Draw por grupo
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {[1, 2].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setAdvancingPerGroup(n)}
                          style={{
                            padding: '8px 20px', borderRadius: '8px', border: 'none',
                            cursor: 'pointer', fontWeight: '600', fontSize: '14px',
                            backgroundColor: advancingPerGroup === n ? '#2D6A2D' : '#F3F4F6',
                            color: advancingPerGroup === n ? 'white' : '#374151',
                          }}
                        >
                          {n} {n === 1 ? 'jugador' : 'jugadores'}
                        </button>
                      ))}
                    </div>
                    <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                      El ganador{advancingPerGroup === 2 ? ' y subcampeón' : ''} de cada grupo pasa al Main Draw
                    </p>
                  </div>
                </>
              )}

              {/* Avanzados por grupo (solo Máster) */}
              {drawType === 'master' && (
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
                          { key: 'RR',  label: 'Round Robin (Grupos)'   },
                          { key: 'R64', label: '64avos (Main Draw)'     },
                          { key: 'R32', label: '32avos (Main Draw)'     },
                          { key: 'R16', label: '16avos (Main Draw)'     },
                          { key: 'QF',  label: 'Cuartos (Main Draw)'    },
                          { key: 'SF',  label: 'Semifinal (Main Draw)'  },
                          { key: 'F',   label: 'Final (Main Draw)'      },
                        ]
                      : drawType === 'master'
                      ? [
                          { key: 'RR_A', label: 'Grupo A'              },
                          { key: 'RR_B', label: 'Grupo B'              },
                          { key: 'R64',  label: '64avos (Main Draw)'   },
                          { key: 'R32',  label: '32avos (Main Draw)'   },
                          { key: 'R16',  label: '16avos (Main Draw)'   },
                          { key: 'QF',   label: 'Cuartos (Main Draw)'  },
                          { key: 'SF_M', label: 'Semifinal Máster'     },
                          { key: 'F_M',  label: 'Final Máster'         },
                        ]
                      : [
                          { key: 'R64', label: '64avos de Final'  },
                          { key: 'R32', label: '32avos de Final'  },
                          { key: 'R16', label: '16avos de Final'  },
                          { key: 'QF',  label: 'Cuartos de Final' },
                          { key: 'SF',  label: 'Semifinal'        },
                          { key: 'F',   label: 'Final'            },
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

              {/* ── Toggle incluir reservados ── */}
              <div style={{ backgroundColor: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIncludeReserved(v => !v)}
                  style={{ width: '42px', height: '24px', borderRadius: '999px', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, marginTop: '2px', backgroundColor: includeReserved ? '#F59E0B' : '#D1D5DB', transition: 'background-color 0.2s' }}
                >
                  <span style={{ position: 'absolute', top: '3px', left: includeReserved ? '21px' : '3px', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white', transition: 'left 0.2s', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: '#92400E', margin: 0 }}>
                    {includeReserved ? '⏳ Incluir jugadores Reservados en el draw' : '⏳ Excluir jugadores Reservados del draw'}
                  </p>
                  <p style={{ fontSize: '11px', color: '#92400E', opacity: 0.8, margin: '3px 0 0' }}>
                    {includeReserved
                      ? 'Los jugadores con pago pendiente (Reservados) SÍ entrarán al cuadro. Confirma que realmente participarán antes de continuar.'
                      : 'Solo los jugadores con pago Aprobado entrarán al cuadro. Los Reservados quedan fuera.'}
                  </p>
                </div>
              </div>

              {/* Botón generar */}
              <button
                onClick={() => drawMutation.mutate()}
                disabled={drawMutation.isPending || !selectedCategory}
                style={{ width: '100%', backgroundColor: !selectedCategory ? '#D1FAE5' : '#2D6A2D', color: !selectedCategory ? '#9CA3AF' : 'white', padding: '13px', borderRadius: '10px', border: 'none', cursor: !selectedCategory ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '700', opacity: drawMutation.isPending ? 0.7 : 1 }}
              >
                {drawMutation.isPending
                  ? 'Generando...'
                  : !selectedCategory
                    ? '⚠️ Selecciona una categoría primero'
                    : `🎾 Generar Draw${includeReserved ? ' (con Reservados)' : ''} — ${selectedCategory}`
                }
              </button>

              {drawMutation.isSuccess && (
                <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#15803D' }}>
                  ✅ Draw generado exitosamente. Ve a la pestaña "Cuadro" para verlo.
                </div>
              )}
              {drawMutation.isError && (
                <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#DC2626' }}>
                  ❌ {(drawMutation.error as any)?.response?.data?.message || (drawMutation.error as any)?.message || 'Error al generar el draw.'}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h2 className="text-lg font-bold text-lat-dark" style={{ margin: 0 }}>
                  Cuadro de Llaves
                </h2>
                {isAdmin && (
                  <DeleteDrawButton
                    tournamentId={id!}
                    onDeleted={() => queryClient.invalidateQueries({ queryKey: ['matches', id] })}
                  />
                )}
                {isAdmin && (
                  <button
                    onClick={async () => {
                      if (!confirm('¿Reparar el cuadro de llaves? Esto corregirá jugadores duplicados o mal asignados en las rondas siguientes (QF/SF/F).')) return;
                      try {
                        const res = await import('../api/axios').then(m => m.default.post(`/tournaments/${id}/draw/repair`, {}));
                        queryClient.invalidateQueries({ queryKey: ['matches', id] });
                        alert(`✅ Cuadro reparado: ${res.data.fixed} slots corregidos, ${res.data.reset} reseteados.`);
                      } catch (e: any) {
                        alert(`❌ ${e?.response?.data?.message ?? 'Error al reparar'}`);
                      }
                    }}
                    style={{
                      padding: '8px 14px', borderRadius: '7px',
                      border: '1.5px solid #FDE68A', background: '#FFFBEB',
                      color: '#92400E', cursor: 'pointer', fontWeight: 600,
                      fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    🔧 Reparar Cuadro
                  </button>
                )}
                {isAdmin && (bracketMatches as any[]).some((m: any) => m.status === 'suspended') && (
                  <button
                    onClick={() => {
                      setBulkDate('');
                      setBulkStartTime('');
                      setBulkCourtId('');
                      setBulkRescheduleModal(true);
                    }}
                    style={{
                      padding: '8px 14px', borderRadius: '7px',
                      border: '1.5px solid #BFDBFE', background: '#EFF6FF',
                      color: '#1D4ED8', cursor: 'pointer', fontWeight: 600,
                      fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    📅 Reprogramar suspendidos
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {/* Exportar PDF */}
                <button
                  onClick={() => setShowExportBracketModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#1D4ED8', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                >
                  📄 Exportar PDF
                </button>

                {/* Preparar Rondas Siguientes (crear placeholders para grupo único) */}
                {isAdmin && (
                  <button
                    onClick={() => {
                      const rrCats = [...new Set((bracketMatches as any[])
                        .filter((m: any) => ['RR','RR_A','RR_B'].includes(m.round))
                        .map((m: any) => m.category)
                      )] as string[];
                      setPrepRondasCat(rrCats[0] || '');
                      setPrepRondasAdv(2);
                      setPrepRondasMsg('');
                      setPrepRondasErr('');
                      setPrepRondasModal(true);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', backgroundColor: '#7C3AED', color: 'white', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                  >
                    📋 Preparar Rondas
                  </button>
                )}

                {/* Generar Main Draw (solo si hay RR) */}
                {isAdmin && (bracketMatches as any[]).some((m: any) => ['RR','RR_A','RR_B'].includes(m.round)) && (
                  <button
                    onClick={async () => {
                      const rrCats = [...new Set((bracketMatches as any[])
                        .filter((m: any) => ['RR','RR_A','RR_B'].includes(m.round))
                        .map((m: any) => m.category)
                      )] as string[];
                      if (rrCats.length === 0) {
                        alert('No hay categorías con Round Robin generado.');
                        return;
                      }
                      const firstCat = rrCats[0];
                      setMdCategory(firstCat);
                      setRrCategories(rrCats);
                      const res = await api.get(`/matches/tournament/${id}/rr-status/${firstCat}`);
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
                advancingPerGroup={mdAdvancing || advancingPerGroup}
                onSuspendMatch={(match) => setSuspendModal({ open: true, match })}
                onResumeMatch={(match) => resumeMatchMutation.mutate(match.id)}
                onRescheduleMatch={(match) => setRescheduleModal({ open: true, match })}
                onEditRRGroups={isAdmin ? openEditRRModal : undefined}
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
              Selecciona la categoría y cuántos jugadores avanzan por grupo.
            </p>

            {/* ── Selector de categoría ── */}
            {rrCategories.length > 1 && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Categoría
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {rrCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={async () => {
                        setMdCategory(cat);
                        const res = await api.get(`/matches/tournament/${id}/rr-status/${cat}`);
                        setRrStatus(res.data);
                      }}
                      style={{
                        padding: '7px 16px', borderRadius: '8px', fontSize: '13px',
                        fontWeight: '600', cursor: 'pointer', border: '2px solid',
                        borderColor: mdCategory === cat ? '#2D6A2D' : '#E5E7EB',
                        backgroundColor: mdCategory === cat ? '#F0FDF4' : 'white',
                        color: mdCategory === cat ? '#166534' : '#374151',
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Categoría activa */}
            <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#166534', fontWeight: '600' }}>
              📋 Categoría seleccionada: <strong>{mdCategory}</strong>
            </div>

            {/* ── Jugadores que avanzan ── */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Jugadores que avanzan por grupo
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2].map(n => (
                  <button
                    key={n}
                    onClick={() => setMdAdvancing(n)}
                    style={{
                      padding: '8px 20px', borderRadius: '8px', fontSize: '14px',
                      fontWeight: '600', cursor: 'pointer', border: '2px solid',
                      borderColor: mdAdvancing === n ? '#2D6A2D' : '#E5E7EB',
                      backgroundColor: mdAdvancing === n ? '#F0FDF4' : 'white',
                      color: mdAdvancing === n ? '#166534' : '#374151',
                    }}
                  >
                    {n} {n === 1 ? 'jugador' : 'jugadores'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Estado de grupos ── */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Estado de grupos
              </label>
              {rrStatus.groups?.map((g: any) => (
                <div key={g.groupLabel} style={{
                  border: `1px solid ${g.complete ? '#86EFAC' : '#FDE68A'}`,
                  borderRadius: '8px', padding: '12px', marginBottom: '8px',
                  backgroundColor: g.complete ? '#F0FDF4' : '#FFFBEB',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '600', color: '#1B3A1B' }}>Grupo {g.groupLabel}</span>
                    <span style={{ fontSize: '12px', color: g.complete ? '#15803D' : '#92400E' }}>
                      {g.complete ? '✓ Completo' : `${g.finished}/${g.total} partidos`}
                    </span>
                  </div>
                  <table style={{ width: '100%', fontSize: '12px' }}>
                    <tbody>
                      {(g.standings || g.standings)?.map((p: any, idx: number) => (
                        <tr key={p.playerId} style={{ opacity: idx < mdAdvancing ? 1 : 0.5 }}>
                          <td style={{ padding: '3px 6px', fontWeight: '600', color: '#374151' }}>
                            {idx + 1}.
                          </td>
                          <td style={{ padding: '3px 6px', color: '#1B3A1B', fontWeight: idx < mdAdvancing ? '600' : '400' }}>
                            {p.playerName || p.name}
                            {idx < mdAdvancing && <span style={{ marginLeft: '6px', color: '#15803D', fontSize: '11px' }}>✓ Avanza</span>}
                          </td>
                          <td style={{ padding: '3px 6px', color: '#6B7280' }}>{p.wins}V / {p.losses}D</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {!rrStatus.allComplete && (
              <div style={{ backgroundColor: '#FEF9C3', border: '1px solid #FDE047', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#92400E', marginBottom: '16px' }}>
                ⚠️ Hay grupos con partidos pendientes. El Main Draw se generará con los resultados actuales.
              </div>
            )}

            {generateMainDrawMutation.isError && (
              <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#DC2626', marginBottom: '16px' }}>
                ❌ Error al generar. Verifica que todos los grupos tengan resultados.
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowMainDrawModal(false)}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => generateMainDrawMutation.mutate()}
                disabled={generateMainDrawMutation.isPending}
                style={{
                  flex: 2, padding: '12px', borderRadius: '8px', border: 'none',
                  backgroundColor: '#2D6A2D', color: 'white', cursor: 'pointer',
                  fontSize: '14px', fontWeight: '700',
                  opacity: generateMainDrawMutation.isPending ? 0.5 : 1,
                }}
              >
                {generateMainDrawMutation.isPending ? 'Generando...' : '🏆 Confirmar y Generar Main Draw'}
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

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Reprogramar partido suspendido                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <EditScheduleModal
        isOpen={rescheduleModal.open}
        match={rescheduleModal.match ? (() => {
          const m = rescheduleModal.match;
          const court = (courts as any[]).find((c: any) => c.id === m.courtId);
          const d = m.scheduledAt ? new Date(m.scheduledAt) : null;
          return {
            matchId:  m.id,
            player1:  m.player1Name || 'Por definir',
            player2:  m.player2Name || 'Por definir',
            round:    m.round,
            category: m.category,
            time:     d ? d.toTimeString().slice(0, 5) : '',
            date:     d ? d.toISOString().slice(0, 10) : '',
            court:    court?.name || '—',
            courtId:  m.courtId || '',
            sede:     court?.sede || '—',
            duration: `${m.estimatedDuration || 90}`,
          };
        })() : null}
        courts={(courts as any[]).map((c: any) => ({ id: c.id, name: c.name, sede: c.sede, surface: c.surface }))}
        onConfirm={(matchId, data) => rescheduleMatchMutation.mutate({ matchId, data })}
        onCancel={() => setRescheduleModal({ open: false })}
      />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Reprogramar TODOS los partidos suspendidos                 */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {bulkRescheduleModal && (() => {
        const suspended = (bracketMatches as any[]).filter((m: any) => m.status === 'suspended');
        const ROUND_LABELS: Record<string,string> = { RR:'RR', R16:'R16', QF:'Cuartos', SF:'Semifinal', F:'Final' };
        const handleBulkConfirm = async () => {
          if (!bulkDate) return;
          setBulkLoading(true);
          try {
            let cursor = bulkStartTime
              ? bulkStartTime.split(':').reduce((h, m, i) => i === 0 ? +h * 60 : +h + +m, 0 as any) as number
              : null;
            for (const m of suspended) {
              const dur = m.estimatedDuration || 90;
              let scheduledAt: string;
              if (cursor !== null) {
                const hh = String(Math.floor(cursor / 60)).padStart(2, '0');
                const mm = String(cursor % 60).padStart(2, '0');
                scheduledAt = `${bulkDate}T${hh}:${mm}:00`;
                cursor += dur;
              } else {
                const origTime = m.scheduledAt
                  ? new Date(m.scheduledAt).toTimeString().slice(0, 5)
                  : '09:00';
                scheduledAt = `${bulkDate}T${origTime}:00`;
              }
              await matchesApi.rescheduleMatch(m.id, {
                scheduledAt,
                courtId: bulkCourtId || m.courtId || undefined,
                estimatedDuration: dur,
              });
            }
            setBulkRescheduleModal(false);
            refetchBracket();
            queryClient.invalidateQueries({ queryKey: ['matches', id] });
          } finally {
            setBulkLoading(false);
          }
        };

        return (
          <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', backgroundColor:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)' }}
            onClick={() => setBulkRescheduleModal(false)}>
            <div style={{ backgroundColor:'white', borderRadius:'18px', boxShadow:'0 30px 70px rgba(0,0,0,0.25)', width:'100%', maxWidth:'560px', margin:'0 16px', overflow:'hidden', maxHeight:'90vh', display:'flex', flexDirection:'column' }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ background:'linear-gradient(135deg,#1B3A1B,#2D6A2D)', padding:'20px 24px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <span style={{ fontSize:'26px' }}>📅</span>
                  <div>
                    <h2 style={{ color:'white', fontSize:'17px', fontWeight:'700', margin:0 }}>Reprogramar partidos suspendidos</h2>
                    <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'12px', margin:0 }}>{suspended.length} partidos suspendidos</p>
                  </div>
                </div>
              </div>

              <div style={{ padding:'20px 24px', overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:'16px' }}>

                {/* Lista de partidos */}
                <div>
                  <p style={{ fontSize:'12px', fontWeight:'600', color:'#4B5563', marginBottom:'8px' }}>Partidos a reprogramar:</p>
                  <div style={{ border:'1px solid #E5E7EB', borderRadius:'8px', overflow:'hidden' }}>
                    {suspended.map((m: any, i: number) => (
                      <div key={m.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', backgroundColor: i%2===0 ? 'white' : '#FAFAFA', borderBottom: i < suspended.length-1 ? '1px solid #F3F4F6' : 'none', fontSize:'12px' }}>
                        <div>
                          <span style={{ fontWeight:'600', color:'#1F2937' }}>{m.player1Name || '—'} vs {m.player2Name || '—'}</span>
                          <span style={{ color:'#9CA3AF', marginLeft:'8px' }}>{ROUND_LABELS[m.round] ?? m.round} · {m.category}</span>
                        </div>
                        <span style={{ color:'#F97316', fontSize:'11px', fontWeight:'600' }}>
                          {m.scheduledAt ? new Date(m.scheduledAt).toLocaleString('es-CO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : 'Sin hora'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Nueva fecha */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div>
                    <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#4B5563', marginBottom:'6px' }}>
                      📅 Nueva fecha <span style={{ color:'#EF4444' }}>*</span>
                    </label>
                    <input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)}
                      style={{ width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #D1D5DB', fontSize:'13px', boxSizing:'border-box' as any }} />
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#4B5563', marginBottom:'6px' }}>
                      ⏰ Hora de inicio <span style={{ color:'#9CA3AF', fontWeight:'400' }}>(opcional)</span>
                    </label>
                    <input type="time" value={bulkStartTime} onChange={e => setBulkStartTime(e.target.value)}
                      style={{ width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #D1D5DB', fontSize:'13px', boxSizing:'border-box' as any }} />
                  </div>
                </div>

                {/* Cancha */}
                <div>
                  <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#4B5563', marginBottom:'6px' }}>🏟️ Cancha <span style={{ color:'#9CA3AF', fontWeight:'400' }}>(opcional — mantiene la cancha original si no se elige)</span></label>
                  <select value={bulkCourtId} onChange={e => setBulkCourtId(e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #D1D5DB', fontSize:'13px', boxSizing:'border-box' as any }}>
                    <option value="">Mantener cancha original de cada partido</option>
                    {(courts as any[]).map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name} — {c.sede}</option>
                    ))}
                  </select>
                </div>

                <p style={{ fontSize:'11px', color:'#6B7280', margin:0 }}>
                  {bulkStartTime
                    ? `El primer partido inicia a las ${bulkStartTime}. Los siguientes se programan consecutivamente según la duración de cada partido.`
                    : 'Sin hora de inicio: cada partido conserva su hora original pero con la nueva fecha.'}
                </p>

                {/* Botones */}
                <div style={{ display:'flex', gap:'10px' }}>
                  <button onClick={() => setBulkRescheduleModal(false)} disabled={bulkLoading}
                    style={{ flex:1, padding:'11px', borderRadius:'10px', border:'1.5px solid #E5E7EB', backgroundColor:'white', color:'#374151', fontWeight:'600', fontSize:'14px', cursor:'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={handleBulkConfirm} disabled={!bulkDate || bulkLoading}
                    style={{ flex:2, padding:'11px', borderRadius:'10px', border:'none', background: !bulkDate ? '#D1D5DB' : 'linear-gradient(135deg,#1D4ED8,#1E40AF)', color:'white', fontWeight:'700', fontSize:'14px', cursor: !bulkDate ? 'not-allowed' : 'pointer', boxShadow: bulkDate ? '0 4px 14px rgba(29,78,216,0.3)' : 'none' }}>
                    {bulkLoading ? '⏳ Reprogramando...' : `✓ Reprogramar ${suspended.length} partidos`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Admin cambia forma de pago de una inscripción              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* Modal: Unificar categorías */}
      {showMergeModal && (
        <CategoryMergeModal
          tournamentId={id!}
          categories={normalizeCategories(tournament?.categories?.length > 0 ? tournament.categories : CATEGORIES)}
          onClose={() => setShowMergeModal(false)}
        />
      )}

      {/* Tab: Alternos */}
      {activeTab === 'alternos' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <AlternateManager
            tournamentId={id!}
            isAdmin={isAdmin}
            categories={normalizeCategories(tournament?.categories?.length > 0 ? tournament.categories : CATEGORIES)}
          />
        </div>
      )}

      <CambiarPagoModal
        isOpen={cambiarPagoModal.open}
        enrollment={cambiarPagoModal.enrollment}
        onConfirm={handleCambiarPago}
        onCancel={() => setCambiarPagoModal({ open: false, enrollment: null })}
        isLoading={cambiarPagoLoading}
      />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Cambiar categoría de inscripción (singles)                 */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {changeCatModal.open && changeCatModal.enrollment && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setChangeCatModal({ open: false, enrollment: null, newCat: '' })}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '380px', maxWidth: '95vw' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#1B3A1B', marginBottom: '6px' }}>Cambiar categoría</h3>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>
              Jugador: <strong style={{ color: '#1B3A1B' }}>{changeCatModal.enrollment.playerName}</strong>
            </p>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Nueva categoría</label>
            <select
              value={changeCatModal.newCat}
              onChange={e => setChangeCatModal({ ...changeCatModal, newCat: e.target.value })}
              style={{ width: '100%', border: '1.5px solid #D1D5DB', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', marginBottom: '12px' }}
            >
              {normalizeCategories(tournament?.categories?.length > 0 ? tournament.categories : CATEGORIES).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {changeCatError && (
              <p style={{ fontSize: '12px', color: '#DC2626', backgroundColor: '#FEF2F2', padding: '8px', borderRadius: '6px', marginBottom: '12px' }}>⚠️ {changeCatError}</p>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setChangeCatModal({ open: false, enrollment: null, newCat: '' }); setChangeCatError(''); }}
                style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '1.5px solid #E5E7EB', background: 'white', cursor: 'pointer', fontWeight: '600', fontSize: '13px', color: '#374151' }}>
                Cancelar
              </button>
              <button
                disabled={changeCatLoading || changeCatModal.newCat === changeCatModal.enrollment.category}
                onClick={async () => {
                  setChangeCatLoading(true); setChangeCatError('');
                  try {
                    await api.patch(`/enrollments/${changeCatModal.enrollment.id}/change-category`, { newCategory: changeCatModal.newCat });
                    queryClient.invalidateQueries({ queryKey: ['enrollments', id] });
                    setChangeCatModal({ open: false, enrollment: null, newCat: '' });
                  } catch (err: any) {
                    setChangeCatError(err?.response?.data?.message || 'Error al cambiar la categoría.');
                  } finally {
                    setChangeCatLoading(false);
                  }
                }}
                style={{ flex: 2, padding: '9px', borderRadius: '8px', border: 'none', background: changeCatLoading || changeCatModal.newCat === changeCatModal.enrollment.category ? '#D1D5DB' : 'linear-gradient(135deg, #C2410C, #9A3412)', color: 'white', cursor: changeCatLoading || changeCatModal.newCat === changeCatModal.enrollment.category ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '13px' }}>
                {changeCatLoading ? 'Guardando...' : 'Confirmar cambio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Renombrar categoría del torneo                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {renameCatModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setRenameCatModal({ open: false, oldName: '', newName: '' })}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '380px', maxWidth: '95vw' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#1B3A1B', marginBottom: '6px' }}>Renombrar categoría</h3>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>
              Nombre actual: <strong style={{ color: '#1D4ED8' }}>{renameCatModal.oldName}</strong>
            </p>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Nuevo nombre</label>
            <input
              autoFocus
              value={renameCatModal.newName}
              onChange={e => setRenameCatModal({ ...renameCatModal, newName: e.target.value.toUpperCase() })}
              style={{ width: '100%', border: '1.5px solid #D1D5DB', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', marginBottom: '12px', boxSizing: 'border-box' }}
              placeholder="Ej: TERCERA M"
            />
            <p style={{ fontSize: '11px', color: '#6B7280', marginBottom: '12px' }}>
              Esto actualizará el nombre en todas las inscripciones de esta categoría.
            </p>
            {renameCatError && (
              <p style={{ fontSize: '12px', color: '#DC2626', backgroundColor: '#FEF2F2', padding: '8px', borderRadius: '6px', marginBottom: '12px' }}>⚠️ {renameCatError}</p>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setRenameCatModal({ open: false, oldName: '', newName: '' }); setRenameCatError(''); }}
                style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '1.5px solid #E5E7EB', background: 'white', cursor: 'pointer', fontWeight: '600', fontSize: '13px', color: '#374151' }}>
                Cancelar
              </button>
              <button
                disabled={renameCatLoading || !renameCatModal.newName.trim() || renameCatModal.newName.trim() === renameCatModal.oldName}
                onClick={async () => {
                  setRenameCatLoading(true); setRenameCatError('');
                  try {
                    await api.patch(`/tournaments/${id}/rename-category`, { oldName: renameCatModal.oldName, newName: renameCatModal.newName.trim() });
                    queryClient.invalidateQueries({ queryKey: ['tournament', id] });
                    queryClient.invalidateQueries({ queryKey: ['enrollments', id] });
                    setRenameCatModal({ open: false, oldName: '', newName: '' });
                  } catch (err: any) {
                    setRenameCatError(err?.response?.data?.message || 'Error al renombrar la categoría.');
                  } finally {
                    setRenameCatLoading(false);
                  }
                }}
                style={{ flex: 2, padding: '9px', borderRadius: '8px', border: 'none', background: renameCatLoading || !renameCatModal.newName.trim() || renameCatModal.newName.trim() === renameCatModal.oldName ? '#D1D5DB' : 'linear-gradient(135deg, #1D4ED8, #1E40AF)', color: 'white', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}>
                {renameCatLoading ? 'Guardando...' : 'Guardar nombre'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Editar grupos Round Robin                                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {editRRModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setEditRRModal({ open: false, category: '' })}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '600px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1B3A1B', margin: 0 }}>✏️ Editar grupos RR</h3>
                <p style={{ fontSize: '12px', color: '#6B7280', margin: '4px 0 0' }}>{editRRModal.category}</p>
              </div>
              <button onClick={() => setEditRRModal({ open: false, category: '' })}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF' }}>×</button>
            </div>

            <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '16px', backgroundColor: '#FEF3C7', padding: '8px 12px', borderRadius: '6px' }}>
              ⚠️ Reasignar jugadores borrará los resultados RR existentes. Los partidos del Main Draw no se modifican.
            </p>

            {/* Grupos */}
            {Object.entries(editRRGroups).sort().map(([groupLabel, playerIds]) => (
              <div key={groupLabel} style={{ marginBottom: '20px' }}>
                <div style={{ backgroundColor: '#1B3A1B', color: 'white', borderRadius: '8px 8px 0 0', padding: '8px 14px', fontWeight: '700', fontSize: '13px' }}>
                  Grupo {groupLabel}
                  <span style={{ opacity: 0.6, fontWeight: '400', marginLeft: '8px' }}>{playerIds.length} jugadores</span>
                </div>
                <div style={{ border: '1px solid #E5E7EB', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                  {playerIds.map(pid => (
                    <div key={pid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #F3F4F6' }}>
                      <span style={{ fontSize: '13px', color: '#1F2937' }}>{editRRNames[pid] || pid}</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {/* Mover a otro grupo */}
                        {Object.keys(editRRGroups).sort().filter(g => g !== groupLabel).map(targetGroup => (
                          <button key={targetGroup}
                            onClick={() => {
                              setEditRRGroups(prev => {
                                const next = { ...prev };
                                next[groupLabel] = next[groupLabel].filter(p => p !== pid);
                                next[targetGroup] = [...next[targetGroup], pid];
                                return next;
                              });
                            }}
                            style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid #3B82F6', backgroundColor: '#EFF6FF', color: '#1D4ED8', cursor: 'pointer', fontWeight: '600' }}
                          >
                            → {targetGroup}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {playerIds.length === 0 && (
                    <div style={{ padding: '12px 14px', color: '#9CA3AF', fontSize: '12px', fontStyle: 'italic' }}>Grupo vacío</div>
                  )}
                </div>
              </div>
            ))}

            {/* Acciones */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => setEditRRModal({ open: false, category: '' })}
                style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: 'white', color: '#374151', cursor: 'pointer', fontWeight: '600' }}>
                Cancelar
              </button>
              <button
                disabled={editRRGroupsMutation.isPending || Object.values(editRRGroups).some(g => g.length < 2)}
                onClick={() => editRRGroupsMutation.mutate({ category: editRRModal.category, groups: editRRGroups })}
                style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: editRRGroupsMutation.isPending ? '#9CA3AF' : '#1B3A1B', color: 'white', cursor: editRRGroupsMutation.isPending ? 'not-allowed' : 'pointer', fontWeight: '600' }}
              >
                {editRRGroupsMutation.isPending ? 'Guardando...' : '💾 Guardar grupos'}
              </button>
            </div>
            {editRRGroupsMutation.isError && (
              <p style={{ color: '#EF4444', fontSize: '12px', marginTop: '8px', textAlign: 'right' }}>
                Error al guardar. Verifica que cada grupo tenga al menos 2 jugadores.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Editar resultado de partido                                */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {editMatch && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setEditMatch(null)}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '420px', maxWidth: '95vw' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #1D4ED8, #1E40AF)', borderRadius: '10px', padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>✏️</span>
              <div>
                <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '700', margin: 0 }}>Editar Resultado</h3>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', margin: 0 }}>
                  {editMatch.round} · {editMatch.category}
                </p>
              </div>
            </div>

            {/* Jugadores */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#F0FDF4', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '4px' }}>Jugador 1</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1B3A1B' }}>{editMatch.player1Name || '—'}</div>
              </div>
              <span style={{ color: '#9CA3AF', fontWeight: '700' }}>vs</span>
              <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#F0FDF4', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '4px' }}>Jugador 2</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1B3A1B' }}>{editMatch.player2Name || '—'}</div>
              </div>
            </div>

            {/* Sets */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>Sets</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '8px' }}>
                <input type="number" min={0} max={3} value={editSets1}
                  onChange={e => setEditSets1(e.target.value)}
                  style={{ border: '2px solid #D1D5DB', borderRadius: '8px', padding: '10px', fontSize: '20px', fontWeight: '700', textAlign: 'center' }} />
                <span style={{ color: '#9CA3AF', fontWeight: '700' }}>—</span>
                <input type="number" min={0} max={3} value={editSets2}
                  onChange={e => setEditSets2(e.target.value)}
                  style={{ border: '2px solid #D1D5DB', borderRadius: '8px', padding: '10px', fontSize: '20px', fontWeight: '700', textAlign: 'center' }} />
              </div>
            </div>

            {/* Games */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>Games totales</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '8px' }}>
                <input type="number" min={0} value={editGames1}
                  onChange={e => setEditGames1(e.target.value)}
                  style={{ border: '2px solid #D1D5DB', borderRadius: '8px', padding: '10px', fontSize: '20px', fontWeight: '700', textAlign: 'center' }} />
                <span style={{ color: '#9CA3AF', fontWeight: '700' }}>—</span>
                <input type="number" min={0} value={editGames2}
                  onChange={e => setEditGames2(e.target.value)}
                  style={{ border: '2px solid #D1D5DB', borderRadius: '8px', padding: '10px', fontSize: '20px', fontWeight: '700', textAlign: 'center' }} />
              </div>
            </div>

            {/* Ganador */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>Ganador</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { id: editMatch.player1Id, name: editMatch.player1Name, label: 'Jugador 1' },
                  { id: editMatch.player2Id, name: editMatch.player2Name, label: 'Jugador 2' },
                ].map(p => {
                  const isWinner = editMatch.winnerId === p.id;
                  return (
                    <button key={p.id}
                      onClick={() => setEditMatch({ ...editMatch, winnerId: p.id })}
                      style={{
                        padding: '10px', borderRadius: '8px', cursor: 'pointer',
                        border: isWinner ? '2px solid #16A34A' : '2px solid #E5E7EB',
                        backgroundColor: isWinner ? '#F0FDF4' : 'white',
                        color: isWinner ? '#166534' : '#374151',
                        fontWeight: '600', fontSize: '12px',
                      }}
                    >
                      {isWinner ? '🏆 ' : ''}{p.label}<br />
                      <span style={{ fontWeight: '400', fontSize: '11px' }}>{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setEditMatch(null)}
                style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    await api.patch(`/matches/${editMatch.id}/score`, {
                      matchId: editMatch.id,
                      sets1: Number(editSets1),
                      sets2: Number(editSets2),
                      games1: Number(editGames1),
                      games2: Number(editGames2),
                      points1: '0', points2: '0',
                      winnerId: editMatch.winnerId,
                    });
                    queryClient.invalidateQueries({ queryKey: ['matches', id] });
                    setEditMatch(null);
                  } catch {
                    alert('Error al guardar el resultado');
                  }
                }}
                style={{
                  flex: 2, padding: '11px', borderRadius: '8px', border: 'none',
                  backgroundColor: '#1D4ED8', color: 'white',
                  cursor: 'pointer', fontSize: '14px', fontWeight: '700',
                }}
              >
                💾 Guardar resultado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Preparar Rondas Siguientes                                */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {prepRondasModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setPrepRondasModal(false)}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '400px', maxWidth: '95vw' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#1B3A1B', marginBottom: '6px' }}>📋 Preparar Rondas Siguientes</h3>
            <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '18px' }}>
              Crea los partidos placeholder de Semifinal/Final para categorías de grupo único, así puedes pre-asignarles horario antes de que se determinen los jugadores.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '5px' }}>Categoría</label>
                <select
                  value={prepRondasCat}
                  onChange={e => setPrepRondasCat(e.target.value)}
                  style={{ width: '100%', border: '1.5px solid #D1D5DB', borderRadius: '8px', padding: '8px 10px', fontSize: '13px' }}
                >
                  <option value="">— Selecciona —</option>
                  {[...new Set((bracketMatches as any[]).map((m: any) => m.category).filter(Boolean))].sort().map((c: string) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '5px' }}>Jugadores que avanzan al main draw</label>
                <input
                  type="number" min={2} max={16}
                  value={prepRondasAdv}
                  onChange={e => setPrepRondasAdv(Number(e.target.value))}
                  style={{ width: '100%', border: '1.5px solid #D1D5DB', borderRadius: '8px', padding: '8px 10px', fontSize: '13px' }}
                />
              </div>

              {prepRondasMsg && <p style={{ fontSize: '12px', color: '#15803D', backgroundColor: '#F0FDF4', padding: '10px', borderRadius: '8px' }}>✅ {prepRondasMsg}</p>}
              {prepRondasErr && <p style={{ fontSize: '12px', color: '#DC2626', backgroundColor: '#FEF2F2', padding: '10px', borderRadius: '8px' }}>❌ {prepRondasErr}</p>}

              <button
                disabled={!prepRondasCat || prepRondasAdv < 2}
                onClick={async () => {
                  try {
                    setPrepRondasErr('');
                    setPrepRondasMsg('');
                    const res = await api.post(`/tournaments/${id}/draw/create-placeholders`, {
                      category: prepRondasCat,
                      advancingCount: prepRondasAdv,
                    });
                    setPrepRondasMsg(res.data.message);
                    queryClient.invalidateQueries({ queryKey: ['matches', id] });
                  } catch (err: any) {
                    setPrepRondasErr(err?.response?.data?.message || 'Error al crear placeholders');
                  }
                }}
                style={{ backgroundColor: '#7C3AED', color: 'white', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', opacity: (!prepRondasCat || prepRondasAdv < 2) ? 0.5 : 1 }}
              >
                Crear partidos placeholder
              </button>
            </div>

            <button onClick={() => setPrepRondasModal(false)}
              style={{ marginTop: '14px', width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', color: '#6B7280' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Selección tipo de exportación PDF del bracket             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showExportBracketModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setShowExportBracketModal(false)}
        >
          <div
            style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '380px', maxWidth: '95vw' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1B3A1B', marginBottom: '6px' }}>
              📄 Exportar PDF
            </h3>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>
              ¿Qué deseas exportar?
            </p>

            {/* Modalidad: Todos / Singles / Dobles */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
              {(['all', 'singles', 'doubles'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setExportModality(m)}
                  style={{
                    flex: 1, padding: '7px 4px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                    border: exportModality === m ? '2px solid #2D6A2D' : '1.5px solid #D1D5DB',
                    backgroundColor: exportModality === m ? '#F0FDF4' : 'white',
                    color: exportModality === m ? '#2D6A2D' : '#6B7280',
                  }}
                >
                  {m === 'all' ? 'Todos' : m === 'singles' ? '🎾 Singles' : '🤝 Dobles'}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { mode: 'both',     icon: '🎾', label: 'Todo el cuadro',   desc: 'Round Robin + Main Draw' },
                { mode: 'rr',       icon: '📊', label: 'Solo Round Robin', desc: 'Grupos y posiciones' },
                { mode: 'maindraw', icon: '🏆', label: 'Solo Main Draw',   desc: 'Cuadro de eliminación' },
              ].map(({ mode, icon, label, desc }) => (
                <button
                  key={mode}
                  onClick={() => {
                    exportBracketPdf({
                      tournamentName: tournament?.name || 'Torneo',
                      matches: bracketMatches as any[],
                      mode: mode as any,
                      modality: exportModality,
                    });
                    setShowExportBracketModal(false);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '14px 16px', borderRadius: '10px', border: '2px solid #E5E7EB',
                    backgroundColor: 'white', cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2D6A2D'; (e.currentTarget as HTMLElement).style.backgroundColor = '#F0FDF4'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; (e.currentTarget as HTMLElement).style.backgroundColor = 'white'; }}
                >
                  <span style={{ fontSize: '24px' }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#1B3A1B' }}>{label}</div>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>{desc}</div>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowExportBracketModal(false)}
              style={{ marginTop: '16px', width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px', color: '#6B7280' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────
const lbl: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' };
const sel: React.CSSProperties = { width: '100%', border: '1.5px solid #D1D5DB', borderRadius: '8px', padding: '9px 12px', fontSize: '13px' };