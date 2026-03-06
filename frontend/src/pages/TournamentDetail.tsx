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
import GameFormatConfig, { type GameFormat, DEFAULT_FORMAT, formatDescription } from '../components/GameFormatConfig';
import { exportBracketPdf } from '../utils/exportBracketPdf';

const CATEGORIES = ['INTERMEDIA', 'SEGUNDA', 'TERCERA', 'CUARTA', 'QUINTA'];

const ROUND_LABELS: Record<string, string> = {
  R64: 'R64', R32: 'R32', R16: 'R16',
  QF: 'Cuartos', SF: 'Semifinal', F: 'Final',
  RR: 'Round Robin', RR_A: 'Grupo A', RR_B: 'Grupo B',
};

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'info' | 'enrollments' | 'matches' | 'draw' | 'bracket'>('info');
  const [selectedCategory, setSelectedCategory] = useState('TERCERA');
  const [drawType, setDrawType] = useState('elimination');
  const [drawModality, setDrawModality] = useState<'singles' | 'doubles'>('singles');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [advancingPerGroup, setAdvancingPerGroup] = useState(1);
  const [roundGameFormats, setRoundGameFormats] = useState<Record<string, GameFormat>>({
    default: { ...DEFAULT_FORMAT },
  });
  const [expandedRound, setExpandedRound] = useState<string | null>(null);
  const [rrStatus, setRrStatus] = useState<any>(null);
  const [showMainDrawModal, setShowMainDrawModal] = useState(false);
  const [mdCategory, setMdCategory] = useState('');
  const [mdAdvancing, setMdAdvancing] = useState(1);

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

  const { data: bracketMatches = [] } = useQuery({
    queryKey: ['matches', id],
    queryFn: () => matchesApi.getByTournament(id!),
    enabled: !!id,
  });

  const drawMutation = useMutation({
    mutationFn: () => tournamentsApi.generateDraw(id!, selectedCategory, drawType, advancingPerGroup, drawModality, roundGameFormats),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', id] });
      setActiveTab('matches');
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
      queryClient.invalidateQueries({ queryKey: ['matches', id] });
      setShowMainDrawModal(false);
    },
  });

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('token');
      const res = await fetch(
        `http://localhost:3000/enrollments/import-csv/${id}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );
      const data = await res.json();
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ['enrollments', id] });
    } catch (err) {
      setImportResult({ message: 'Error al importar', errors: ['Error de conexión'] });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const csv = [
      'nombres,apellidos,telefono,email,direccion,docNumber,birthDate,gender,category,modality,seeding,ranking',
      'Juan,García,3001234567,juan@email.com,Calle 10 #20-30,12345678,1990-05-15,M,TERCERA,singles,1,125',
      ',,,maria@email.com,,,,,TERCERA,singles,,',
      ',,,,,87654321,,,TERCERA,singles,2,98',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'plantilla_inscripciones.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-lat-bg">
        <Sidebar />
        <main className="flex-1 p-8">
          <p className="text-gray-400 text-center py-8">Cargando torneo...</p>
        </main>
      </div>
    );
  }

  if (!tournament) return null;

  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-lat-dark">{tournament.name}</h1>
              <p className="text-gray-500 mt-1">{tournament.circuitLine} · {tournament.type}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                tournament.status === 'active'    ? 'bg-green-100 text-green-700' :
                tournament.status === 'open'      ? 'bg-blue-100 text-blue-700'  :
                tournament.status === 'completed' ? 'bg-gray-100 text-gray-600'  :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {tournament.status}
              </span>
              {isAdmin && (
                <select
                  onChange={e => updateStatusMutation.mutate(e.target.value)}
                  defaultValue=""
                  className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green"
                >
                  <option value="" disabled>Cambiar estado...</option>
                  <option value="draft">Draft</option>
                  <option value="open">Abrir inscripciones</option>
                  <option value="closed">Cerrar inscripciones</option>
                  <option value="active">Activar torneo</option>
                  <option value="completed">Completado</option>
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-white rounded-lg p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-lat-green">
                ${Number(tournament.inscriptionValue).toLocaleString('es-CO')}
              </p>
              <p className="text-gray-500 text-xs mt-1">Inscripción</p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-lat-dark">{tournament.minPlayers}</p>
              <p className="text-gray-500 text-xs mt-1">Mín. jugadores</p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center shadow-sm">
              <p className="text-sm font-bold text-lat-dark">{tournament.registrationStart}</p>
              <p className="text-gray-500 text-xs mt-1">Inicio inscripciones</p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center shadow-sm">
              <p className="text-sm font-bold text-lat-dark">{tournament.eventStart}</p>
              <p className="text-gray-500 text-xs mt-1">Inicio torneo</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
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

        {/* Tab: Info */}
        {activeTab === 'info' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-lat-dark mb-4">Configuración del Torneo</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Tipo:</span> <span className="font-medium ml-2">{tournament.type}</span></div>
              <div><span className="text-gray-500">Circuito:</span> <span className="font-medium ml-2">{tournament.circuitLine}</span></div>
              <div><span className="text-gray-500">Etapa:</span> <span className="font-medium ml-2">{tournament.stageNumber || '—'}</span></div>
              <div><span className="text-gray-500">Estado:</span> <span className="font-medium ml-2">{tournament.status}</span></div>
              <div><span className="text-gray-500">Inicio inscripciones:</span> <span className="font-medium ml-2">{tournament.registrationStart}</span></div>
              <div><span className="text-gray-500">Cierre inscripciones:</span> <span className="font-medium ml-2">{tournament.registrationEnd}</span></div>
              <div><span className="text-gray-500">Inicio torneo:</span> <span className="font-medium ml-2">{tournament.eventStart}</span></div>
              <div><span className="text-gray-500">Fin torneo:</span> <span className="font-medium ml-2">{tournament.eventEnd}</span></div>
            </div>
          </div>
        )}

        {/* Tab: Inscritos */}
        {activeTab === 'enrollments' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 className="text-lg font-bold text-lat-dark">
                Jugadores Inscritos ({enrollments.length})
              </h2>
              {isAdmin && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button
                    onClick={handleDownloadTemplate}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      backgroundColor: '#F3F4F6', color: '#374151',
                      padding: '8px 14px', borderRadius: '8px',
                      border: '1px solid #D1D5DB', cursor: 'pointer', fontSize: '13px',
                    }}
                  >
                    📥 Descargar Plantilla
                  </button>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    backgroundColor: '#1D4ED8', color: 'white',
                    padding: '8px 14px', borderRadius: '8px',
                    cursor: 'pointer', fontSize: '13px', fontWeight: '500',
                  }}>
                    📤 {importing ? 'Importando...' : 'Importar CSV'}
                    <input
                      type="file" accept=".csv"
                      onChange={handleImportCsv}
                      style={{ display: 'none' }}
                      disabled={importing}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Resultado importación */}
            {importResult && (
              <div style={{
                backgroundColor: importResult.enrolled > 0 ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${importResult.enrolled > 0 ? '#86EFAC' : '#FECACA'}`,
                borderRadius: '10px', padding: '14px', marginBottom: '16px',
              }}>
                <p style={{ fontWeight: '600', color: '#1B3A1B', marginBottom: '8px' }}>
                  {importResult.message}
                </p>
                <div style={{ display: 'flex', gap: '16px', fontSize: '13px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#15803D' }}>✅ Inscritos: {importResult.enrolled}</span>
                  <span style={{ color: '#1D4ED8' }}>👤 Usuarios nuevos: {importResult.created}</span>
                  <span style={{ color: '#92400E' }}>🔄 Ya existían: {importResult.existing}</span>
                  <span style={{ color: '#DC2626' }}>⚠️ Omitidos: {importResult.skipped}</span>
                </div>
                {importResult.errors?.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <p style={{ fontSize: '12px', color: '#DC2626', fontWeight: '500' }}>Errores:</p>
                    {importResult.errors.map((err: string, i: number) => (
                      <p key={i} style={{ fontSize: '12px', color: '#DC2626' }}>• {err}</p>
                    ))}
                  </div>
                )}
                <button onClick={() => setImportResult(null)} style={{
                  marginTop: '8px', fontSize: '12px', color: '#6B7280',
                  background: 'none', border: 'none', cursor: 'pointer',
                }}>
                  Cerrar
                </button>
              </div>
            )}

            {enrollments.length === 0 ? (
              <p className="text-gray-400 text-center py-8">
                No hay inscritos aún. Importa un CSV o inscribe manualmente.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Jugador</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Categoría</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Modalidad</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Siembra</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Pago</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Estado</th>
                    {isAdmin && <th className="text-left py-3 px-4 text-gray-500 font-medium">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e: any, i: number) => (
                    <tr key={e.id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                      <td className="py-3 px-4 font-medium text-lat-dark text-xs">
                        {e.playerName || e.playerId}
                      </td>
                      <td className="py-3 px-4">
                        <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                          {e.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs">{e.modality}</td>
                      <td className="py-3 px-4 text-gray-600">{e.seeding || '—'}</td>
                      <td className="py-3 px-4">
                        <span style={{
                          padding: '2px 8px', borderRadius: '999px', fontSize: '11px',
                          backgroundColor: e.paymentId === 'MANUAL' ? '#FEF3C7' : '#DCFCE7',
                          color: e.paymentId === 'MANUAL' ? '#92400E' : '#15803D',
                        }}>
                          {e.paymentId === 'MANUAL' ? '💵 Manual' : '💳 Online'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span style={{
                          padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '500',
                          backgroundColor: e.status === 'approved' ? '#DCFCE7' : e.status === 'pending' ? '#FEF9C3' : '#FEE2E2',
                          color: e.status === 'approved' ? '#15803D' : e.status === 'pending' ? '#92400E' : '#DC2626',
                        }}>
                          {e.status === 'approved' ? '✓ Aprobado' : e.status === 'pending' ? '⏳ Pendiente' : '✗ Rechazado'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4">
                          <button
                            onClick={async () => {
                              if (!confirm(`¿Eliminar inscripción de ${e.playerName}?`)) return;
                              try {
                                await api.delete(`/enrollments/${e.id}`);
                                queryClient.invalidateQueries({ queryKey: ['enrollments', id] });
                              } catch {
                                alert('Error al eliminar inscripción');
                              }
                            }}
                            style={{
                              backgroundColor: '#FEF2F2', color: '#DC2626',
                              border: '1px solid #FECACA', borderRadius: '6px',
                              padding: '3px 8px', fontSize: '11px', cursor: 'pointer',
                            }}
                          >
                            🗑
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab: Partidos */}
        {activeTab === 'matches' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-lat-dark mb-4">Partidos ({matches.length})</h2>
            {matches.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No hay partidos generados. Ve a "Generar Draw" primero.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Ronda</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Categoría</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Jugador 1</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">vs</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Jugador 2</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Estado</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m: any, i: number) => (
                    <tr key={m.id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                      <td className="py-3 px-4">
                        <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', backgroundColor: '#F3E8FF', color: '#6B21A8' }}>
                          {ROUND_LABELS[m.round] || m.round}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                          {m.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-lat-dark text-xs">{m.player1Name || 'BYE'}</td>
                      <td className="py-3 px-4 text-gray-400 text-center">vs</td>
                      <td className="py-3 px-4 font-medium text-lat-dark text-xs">{m.player2Name || 'BYE'}</td>
                      <td className="py-3 px-4">
                        <span style={{
                          padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '500',
                          backgroundColor: m.status === 'live' ? '#FEE2E2' : m.status === 'completed' ? '#F3F4F6' : m.status === 'wo' ? '#FEF3C7' : '#FEF9C3',
                          color: m.status === 'live' ? '#DC2626' : m.status === 'completed' ? '#4B5563' : m.status === 'wo' ? '#92400E' : '#92400E',
                        }}>
                          {m.status === 'live' ? '🔴 En vivo' : m.status === 'completed' ? '✓ Terminado' : m.status === 'wo' ? 'W.O.' : '⏳ Pendiente'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {m.scheduledAt ? new Date(m.scheduledAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab: Generar Draw */}
        {activeTab === 'draw' && isAdmin && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-lat-dark mb-6">Generar Draw / Cuadro</h2>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sistema de juego</label>
                <select
                  value={drawType}
                  onChange={e => setDrawType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green"
                >
                  <option value="elimination">Eliminación Directa</option>
                  <option value="round_robin">Round Robin</option>
                  <option value="master">Torneo Máster LAT</option>
                </select>
              </div>
              {tournament?.hasDoubles && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['singles', 'doubles'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDrawModality(m)}
                        style={{
                          flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                          cursor: 'pointer', fontWeight: '600', fontSize: '13px',
                          backgroundColor: drawModality === m ? '#2D6A2D' : '#F3F4F6',
                          color: drawModality === m ? 'white' : '#374151',
                        }}
                      >
                        {m === 'singles' ? '🎾 Singles' : '🤝 Dobles'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sistema de juego por ronda */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sistema de juego por ronda
                </label>

                {/* Formato por defecto */}
                <div style={{ marginBottom: '8px' }}>
                  <button
                    onClick={() => setExpandedRound(expandedRound === 'default' ? null : 'default')}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #D1D5DB',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    <span style={{ fontWeight: '600', color: '#1B3A1B' }}>
                      Todas las rondas (por defecto)
                    </span>
                    <span style={{ fontSize: '11px', color: '#6B7280' }}>
                      {formatDescription(roundGameFormats['default'] || DEFAULT_FORMAT)}
                    </span>
                  </button>
                  {expandedRound === 'default' && (
                    <div style={{ marginTop: '6px' }}>
                      <GameFormatConfig
                        value={roundGameFormats['default'] || DEFAULT_FORMAT}
                        onChange={f => setRoundGameFormats({ ...roundGameFormats, default: f })}
                      />
                    </div>
                  )}
                </div>

                {/* Formato por ronda específica */}
                {['R64', 'R32', 'R16', 'QF', 'SF', 'F', 'RR'].map(round => (
                  <div key={round} style={{ marginBottom: '6px' }}>
                    <button
                      onClick={() => setExpandedRound(expandedRound === round ? null : round)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: `1px solid ${roundGameFormats[round] ? '#86EFAC' : '#E5E7EB'}`,
                        backgroundColor: roundGameFormats[round] ? '#F0FDF4' : '#F9FAFB',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      <span style={{ fontWeight: '500', color: '#374151' }}>
                        {round === 'RR'
                          ? 'Round Robin'
                          : round === 'QF'
                          ? 'Cuartos'
                          : round === 'SF'
                          ? 'Semifinal'
                          : round === 'F'
                          ? 'Final'
                          : round}
                        {roundGameFormats[round] ? ' ✓' : ' (usa por defecto)'}
                      </span>
                      {roundGameFormats[round] && (
                        <span style={{ fontSize: '10px', color: '#6B7280' }}>
                          {formatDescription(roundGameFormats[round])}
                        </span>
                      )}
                    </button>
                    {expandedRound === round && (
                      <div style={{ marginTop: '6px' }}>
                        <GameFormatConfig
                          value={
                            roundGameFormats[round] || roundGameFormats['default'] || DEFAULT_FORMAT
                          }
                          onChange={f => setRoundGameFormats({ ...roundGameFormats, [round]: f })}
                          label={`Configurar ${round}`}
                        />
                        {roundGameFormats[round] && (
                          <button
                            onClick={() => {
                              const updated = { ...roundGameFormats };
                              delete updated[round];
                              setRoundGameFormats(updated);
                            }}
                            style={{
                              marginTop: '4px',
                              fontSize: '11px',
                              color: '#DC2626',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            ✕ Usar formato por defecto para esta ronda
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ backgroundColor: '#FEFCE8', border: '1px solid #FDE047', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#92400E' }}>
                💡 Art. 23 LAT: Si hay menos de 8 jugadores, se usará Round Robin automáticamente. Los BYEs se asignan a las siembras más altas.
              </div>
              {drawType === 'round_robin' && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                    Jugadores que pasan al Main Draw por grupo
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2].map(n => (
                      <button
                        key={n}
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
                    Grupos de 3-4 jugadores · El ganador{advancingPerGroup === 2 ? ' y subcampeón' : ''} de cada grupo pasa al Main Draw
                  </p>
                </div>
              )}
              <button
                onClick={() => drawMutation.mutate()}
                disabled={drawMutation.isPending}
                style={{
                  width: '100%', backgroundColor: '#2D6A2D', color: 'white',
                  padding: '12px', borderRadius: '8px', border: 'none',
                  cursor: 'pointer', fontSize: '15px', fontWeight: '600',
                  opacity: drawMutation.isPending ? 0.5 : 1,
                }}
              >
                {drawMutation.isPending ? 'Generando...' : '🎾 Generar Draw'}
              </button>
              {drawMutation.isSuccess && (
                <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#15803D' }}>
                  ✅ Draw generado exitosamente. Ve a la pestaña "Partidos" para verlo.
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

        {/* Tab: Cuadro / Main Draw */}
        {activeTab === 'bracket' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 className="text-lg font-bold text-lat-dark">Cuadro de Llaves</h2>
              <button
                onClick={() => exportBracketPdf({ tournamentName: tournament?.name || 'Torneo', matches: bracketMatches })}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  backgroundColor: '#1D4ED8', color: 'white',
                  padding: '8px 16px', borderRadius: '8px',
                  border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                }}
              >
                📄 Exportar PDF
              </button>
              {isAdmin && (
                <button
                  onClick={async () => {
                    // Verificar si hay RR completo
                    const categories = [...new Set((bracketMatches as any[]).map((m: any) => m.category))];
                    const rrCats = categories.filter(c =>
                      (bracketMatches as any[]).some((m: any) => m.category === c && m.round === 'RR')
                    );
                    if (rrCats.length > 0) {
                      setMdCategory(rrCats[0]);
                      const res = await api.get(`/matches/tournament/${id}/rr-status/${rrCats[0]}`);
                      setRrStatus(res.data);
                      setShowMainDrawModal(true);
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    backgroundColor: '#2D6A2D', color: 'white',
                    padding: '8px 16px', borderRadius: '8px',
                    border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                  }}
                >
                  🏆 Generar Main Draw
                </button>
              )}
            </div>

            {bracketMatches.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No hay partidos generados aún.</p>
            ) : (
              (() => {
                const ROUND_ORDER = ['RR','RR_A','RR_B','R64','R32','R16','QF','SF','F','SF_M','F_M'];
                const ROUND_LABELS_MAP: Record<string,string> = {
                  RR:'Round Robin', RR_A:'Grupo A', RR_B:'Grupo B',
                  R64:'Ronda 64', R32:'Ronda 32', R16:'Ronda 16',
                  QF:'Cuartos de Final', SF:'Semifinal', F:'Final',
                  SF_M:'SF Máster', F_M:'Final Máster',
                };

                // Agrupar por categoría → ronda
                const byCategory: Record<string, Record<string, any[]>> = {};
                (bracketMatches as any[]).forEach((m: any) => {
                  if (!byCategory[m.category]) byCategory[m.category] = {};
                  if (!byCategory[m.category][m.round]) byCategory[m.category][m.round] = [];
                  byCategory[m.category][m.round].push(m);
                });

                return Object.entries(byCategory).map(([category, rounds]) => {
                  const hasRR   = Object.keys(rounds).some(r => r.startsWith('RR'));
                  const hasElim = Object.keys(rounds).some(r => !r.startsWith('RR'));

                  return (
                    <div key={category} style={{ marginBottom: '40px' }}>
                      {/* Header categoría */}
                      <div style={{
                        backgroundColor: '#1B3A1B', color: 'white',
                        borderRadius: '8px', padding: '10px 16px', marginBottom: '20px',
                      }}>
                        <span style={{ fontWeight: '700', fontSize: '15px' }}>🎾 {category}</span>
                      </div>

                      {/* ── FASE DE GRUPOS (RR) ── */}
                      {hasRR && (
                        <div style={{ marginBottom: '24px' }}>
                          <p style={{ fontSize: '13px', fontWeight: '700', color: '#6B7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Fase de Grupos
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                            {ROUND_ORDER.filter(r => r.startsWith('RR') && rounds[r]).map(round => {
                              // Agrupar por groupLabel
                              const byGroup: Record<string, any[]> = {};
                              rounds[round].forEach((m: any) => {
                                const g = m.groupLabel || 'A';
                                if (!byGroup[g]) byGroup[g] = [];
                                byGroup[g].push(m);
                              });

                              return Object.entries(byGroup).sort().map(([group, gMatches]) => {
                                // Obtener jugadores únicos del grupo con sus posiciones
                                const playerSet = new Map<string, { name: string; seeding: number | null; wins: number; losses: number }>();
                                gMatches.forEach((m: any) => {
                                  if (m.player1Id && !playerSet.has(m.player1Id)) {
                                    playerSet.set(m.player1Id, { name: m.player1Name || 'BYE', seeding: m.seeding1, wins: 0, losses: 0 });
                                  }
                                  if (m.player2Id && !playerSet.has(m.player2Id)) {
                                    playerSet.set(m.player2Id, { name: m.player2Name || 'BYE', seeding: m.seeding2, wins: 0, losses: 0 });
                                  }
                                  // Contar victorias
                                  if (m.winnerId) {
                                    const w = playerSet.get(m.winnerId);
                                    const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
                                    const l = playerSet.get(loserId);
                                    if (w) w.wins++;
                                    if (l) l.losses++;
                                  }
                                });

                                const players = [...playerSet.entries()].sort((a, b) => b[1].wins - a[1].wins);
                                const total = gMatches.length;
                                const played = gMatches.filter((m: any) => m.status === 'completed' || m.status === 'wo').length;

                                return (
                                  <div key={`${round}_${group}`} style={{
                                    border: '1px solid #E5E7EB', borderRadius: '10px',
                                    overflow: 'hidden', minWidth: '220px', flex: '0 0 auto',
                                  }}>
                                    {/* Header grupo */}
                                    <div style={{
                                      backgroundColor: '#F0FDF4', borderBottom: '1px solid #86EFAC',
                                      padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    }}>
                                      <span style={{ fontWeight: '700', color: '#15803D', fontSize: '13px' }}>
                                        Grupo {group}
                                      </span>
                                      <span style={{ fontSize: '11px', color: '#6B7280' }}>
                                        {played}/{total} partidos
                                      </span>
                                    </div>

                                    {/* Tabla de posiciones */}
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#F9FAFB' }}>
                                          <th style={{ padding: '6px 10px', fontSize: '10px', color: '#6B7280', fontWeight: '500', textAlign: 'left' }}>Pos</th>
                                          <th style={{ padding: '6px 10px', fontSize: '10px', color: '#6B7280', fontWeight: '500', textAlign: 'left' }}>Jugador</th>
                                          <th style={{ padding: '6px 8px', fontSize: '10px', color: '#6B7280', fontWeight: '500', textAlign: 'center' }}>V</th>
                                          <th style={{ padding: '6px 8px', fontSize: '10px', color: '#6B7280', fontWeight: '500', textAlign: 'center' }}>D</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {players.map(([pid, p], idx) => (
                                          <tr key={pid} style={{
                                            borderTop: '1px solid #F3F4F6',
                                            backgroundColor: idx === 0 && played === total ? '#F0FDF4' : 'white',
                                          }}>
                                            <td style={{ padding: '8px 10px', fontSize: '13px', fontWeight: '700', color: '#1B3A1B' }}>
                                              {idx + 1}
                                              {idx === 0 && played === total && <span style={{ marginLeft: '2px', color: '#15803D' }}>✓</span>}
                                            </td>
                                            <td style={{ padding: '8px 10px', fontSize: '12px', color: '#374151' }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {p.seeding && (
                                                  <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', borderRadius: '999px', padding: '1px 4px', fontSize: '9px', fontWeight: '700' }}>
                                                    [{p.seeding}]
                                                  </span>
                                                )}
                                                <span style={{ fontWeight: idx === 0 ? '600' : '400' }}>{p.name}</span>
                                              </div>
                                            </td>
                                            <td style={{ padding: '8px', fontSize: '12px', fontWeight: '700', color: '#15803D', textAlign: 'center' }}>{p.wins}</td>
                                            <td style={{ padding: '8px', fontSize: '12px', color: '#DC2626', textAlign: 'center' }}>{p.losses}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>

                                    {/* Partidos del grupo */}
                                    <div style={{ borderTop: '1px solid #E5E7EB', padding: '8px' }}>
                                      {gMatches.map((m: any) => (
                                        <div key={m.id} style={{
                                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                          padding: '4px 6px', borderRadius: '4px', marginBottom: '2px',
                                          backgroundColor: m.status === 'completed' ? '#F0FDF4' : '#F9FAFB',
                                          fontSize: '11px',
                                        }}>
                                          <span style={{ color: m.winnerId === m.player1Id ? '#15803D' : '#374151', fontWeight: m.winnerId === m.player1Id ? '600' : '400' }}>
                                            {m.player1Name || 'BYE'}
                                          </span>
                                          <span style={{ color: '#9CA3AF', margin: '0 4px' }}>vs</span>
                                          <span style={{ color: m.winnerId === m.player2Id ? '#15803D' : '#374151', fontWeight: m.winnerId === m.player2Id ? '600' : '400' }}>
                                            {m.player2Name || 'BYE'}
                                          </span>
                                          <span style={{ marginLeft: '6px', color: m.status === 'completed' ? '#15803D' : '#9CA3AF', fontSize: '10px' }}>
                                            {m.status === 'completed' ? '✓' : m.status === 'live' ? '🔴' : '⏳'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              });
                            })}
                          </div>
                        </div>
                      )}

                      {/* ── CUADRO DE ELIMINACIÓN ── */}
                      {hasElim && (
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: '700', color: '#6B7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {hasRR ? 'Main Draw — Eliminación Directa' : 'Cuadro de Eliminación'}
                          </p>
                          <div style={{ display: 'flex', gap: '0', overflowX: 'auto', paddingBottom: '8px' }}>
                            {ROUND_ORDER.filter(r => !r.startsWith('RR') && rounds[r]).map((round) => (
                              <div key={round} style={{ minWidth: '180px', flex: '0 0 180px' }}>
                                {/* Header ronda */}
                                <div style={{
                                  backgroundColor: '#1B3A1B', color: 'white',
                                  borderRadius: '6px', padding: '6px 10px',
                                  marginBottom: '8px', marginRight: '8px', textAlign: 'center',
                                }}>
                                  <span style={{ fontSize: '12px', fontWeight: '700' }}>
                                    {ROUND_LABELS_MAP[round] || round}
                                  </span>
                                  <span style={{ fontSize: '10px', opacity: 0.7, marginLeft: '4px' }}>
                                    ({rounds[round].length})
                                  </span>
                                </div>

                                {/* Partidos — solo posición + nombre */}
                                {rounds[round].map((m: any, idx: number) => (
                                  <div key={m.id} style={{
                                    border: `2px solid ${m.status === 'completed' ? '#86EFAC' : m.status === 'live' ? '#FCA5A5' : '#E5E7EB'}`,
                                    borderRadius: '8px', marginBottom: '8px', marginRight: '8px',
                                    overflow: 'hidden', backgroundColor: 'white',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                  }}>
                                    {/* Posición en el cuadro */}
                                    <div style={{
                                      backgroundColor: '#F9FAFB', borderBottom: '1px solid #F3F4F6',
                                      padding: '2px 8px', display: 'flex', justifyContent: 'space-between',
                                    }}>
                                      <span style={{ fontSize: '9px', color: '#9CA3AF' }}>#{idx * 2 + 1} — #{idx * 2 + 2}</span>
                                      {m.scheduledAt && (
                                        <span style={{ fontSize: '9px', color: '#6B7280' }}>
                                          {new Date(m.scheduledAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      )}
                                    </div>

                                    {/* Jugador 1 */}
                                    <div style={{
                                      padding: '7px 10px',
                                      backgroundColor: m.winnerId === m.player1Id ? '#F0FDF4' : 'white',
                                      borderBottom: '1px solid #F3F4F6',
                                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        {m.seeding1 && (
                                          <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', borderRadius: '999px', padding: '1px 4px', fontSize: '9px', fontWeight: '700' }}>
                                            [{m.seeding1}]
                                          </span>
                                        )}
                                        <span style={{
                                          fontSize: '12px',
                                          fontWeight: m.winnerId === m.player1Id ? '700' : '400',
                                          color: m.player1Id ? '#1B3A1B' : '#9CA3AF',
                                        }}>
                                          {m.player1Name || 'BYE'}
                                        </span>
                                      </div>
                                      {m.winnerId === m.player1Id && <span style={{ color: '#15803D', fontSize: '11px' }}>✓</span>}
                                    </div>

                                    {/* Jugador 2 */}
                                    <div style={{
                                      padding: '7px 10px',
                                      backgroundColor: m.winnerId === m.player2Id ? '#F0FDF4' : 'white',
                                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        {m.seeding2 && (
                                          <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', borderRadius: '999px', padding: '1px 4px', fontSize: '9px', fontWeight: '700' }}>
                                            [{m.seeding2}]
                                          </span>
                                        )}
                                        <span style={{
                                          fontSize: '12px',
                                          fontWeight: m.winnerId === m.player2Id ? '700' : '400',
                                          color: m.player2Id ? '#1B3A1B' : '#9CA3AF',
                                        }}>
                                          {m.player2Name || 'BYE'}
                                        </span>
                                      </div>
                                      {m.winnerId === m.player2Id && <span style={{ color: '#15803D', fontSize: '11px' }}>✓</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()
            )}

            {showMainDrawModal && rrStatus && (
              <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '500px', maxWidth: '95vw' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1B3A1B', marginBottom: '4px' }}>
                    Generar Main Draw
                  </h3>
                  <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
                    Categoría: <strong>{mdCategory}</strong>
                  </p>

                  {/* Estado de grupos */}
                  <div style={{ marginBottom: '20px' }}>
                    {rrStatus.groups.map((g: any) => (
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
                            {g.standings.map((p: any, idx: number) => (
                              <tr key={p.playerId} style={{ opacity: idx < mdAdvancing ? 1 : 0.5 }}>
                                <td style={{ padding: '2px 4px', fontWeight: '700', color: '#1B3A1B' }}>{p.position}</td>
                                <td style={{ padding: '2px 4px', color: '#374151' }}>
                                  {idx < mdAdvancing && <span style={{ marginRight: '4px', color: '#15803D' }}>→</span>}
                                  {p.playerName}
                                </td>
                                <td style={{ padding: '2px 8px', color: '#15803D', fontWeight: '600' }}>{p.wins}V</td>
                                <td style={{ padding: '2px 4px', color: '#DC2626' }}>{p.losses}D</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>

                  {/* Jugadores por grupo */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                      Jugadores que pasan al Main Draw por grupo
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {[1, 2].map(n => (
                        <button
                          key={n}
                          onClick={() => setMdAdvancing(n)}
                          style={{
                            flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                            cursor: 'pointer', fontWeight: '600', fontSize: '14px',
                            backgroundColor: mdAdvancing === n ? '#2D6A2D' : '#F3F4F6',
                            color: mdAdvancing === n ? 'white' : '#374151',
                          }}
                        >
                          {n} {n === 1 ? 'jugador' : 'jugadores'}
                        </button>
                      ))}
                    </div>
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
          </div>
        )}
      </main>
    </div>
  );
}