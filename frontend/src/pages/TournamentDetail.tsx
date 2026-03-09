// frontend/src/pages/TournamentDetail.tsx  ← REEMPLAZA COMPLETO
import { useState, useEffect } from 'react';
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
import CambiarPagoModal      from '../components/CambiarPagoModal';

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
  const [selectedCategory,  setSelectedCategory]  = useState('');
  const [drawType,          setDrawType]          = useState('elimination');
  const [drawModality,      setDrawModality]      = useState<'singles' | 'doubles'>('singles');
  const [advancingPerGroup, setAdvancingPerGroup] = useState(1);
  const [roundGameFormats,  setRoundGameFormats]  = useState<Record<string, GameFormat>>({ default: { ...DEFAULT_FORMAT } });
  const [expandedRound,     setExpandedRound]     = useState<string | null>(null);
  const [includeReserved,   setIncludeReserved]   = useState(false); // ← draw con reservados

  // ── Import CSV ────────────────────────────────────────────────────────
  const [importing,         setImporting]         = useState(false);
  const [importResult,      setImportResult]       = useState<any>(null);
  const [csvPaymentMethod,  setCsvPaymentMethod]   = useState('manual'); // ← forma de pago CSV

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

  // ── Modal cambiar forma de pago ───────────────────────────────────────
  const [cambiarPagoModal, setCambiarPagoModal] = useState<{ open: boolean; enrollment: any | null }>({ open: false, enrollment: null });
  const [cambiarPagoLoading, setCambiarPagoLoading] = useState(false);

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
      tournamentsApi.generateDraw(id!, selectedCategory, drawType, advancingPerGroup, drawModality, roundGameFormats, includeReserved),
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
                        const headers = 'nombres,apellidos,email,telefono,docNumber,birthDate,gender,category,modality,seeding,ranking,adminNotes\n';
                        const example = 'Juan,García,juan@email.com,3001234567,12345678,1990-05-15,M,TERCERA,singles,1,100,\n';
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
                  {(enrollments as any[]).map((e: any, i: number) => {
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

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Admin cambia forma de pago de una inscripción              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <CambiarPagoModal
        isOpen={cambiarPagoModal.open}
        enrollment={cambiarPagoModal.enrollment}
        onConfirm={handleCambiarPago}
        onCancel={() => setCambiarPagoModal({ open: false, enrollment: null })}
        isLoading={cambiarPagoLoading}
      />
    </div>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────
const lbl: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' };
const sel: React.CSSProperties = { width: '100%', border: '1.5px solid #D1D5DB', borderRadius: '8px', padding: '9px 12px', fontSize: '13px' };