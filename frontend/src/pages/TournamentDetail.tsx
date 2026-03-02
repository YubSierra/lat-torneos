import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Trophy, Calendar, Settings } from 'lucide-react';
import { tournamentsApi } from '../api/tournaments.api';
import { enrollmentsApi } from '../api/enrollments.api';
import { matchesApi } from '../api/matches.api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';

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
  const [activeTab, setActiveTab] = useState<'info' | 'enrollments' | 'matches' | 'draw'>('info');
  const [selectedCategory, setSelectedCategory] = useState('TERCERA');
  const [drawType, setDrawType] = useState('elimination');

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

  const drawMutation = useMutation({
    mutationFn: () => tournamentsApi.generateDraw(id!, selectedCategory, drawType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', id] });
      setActiveTab('matches');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => tournamentsApi.update(id!, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournament', id] }),
  });

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
              <p className="text-gray-500 mt-1">
                {tournament.circuitLine} · {tournament.type}
              </p>
            </div>

            {/* Estado + acciones admin */}
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

          {/* Info rápida */}
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
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'bg-lat-green text-white'
                  : 'text-gray-600 hover:bg-gray-50'
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
            <h2 className="text-lg font-bold text-lat-dark mb-4">
              Configuración del Torneo
            </h2>
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
            <h2 className="text-lg font-bold text-lat-dark mb-4">
              Jugadores Inscritos ({enrollments.length})
            </h2>
            {enrollments.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No hay inscritos aún</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Jugador</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Categoría</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Modalidad</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Siembra</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e: any, i: number) => (
                    <tr key={e.id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                      <td className="py-3 px-4 font-medium text-lat-dark">{e.playerId}</td>
                      <td className="py-3 px-4">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">{e.category}</span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{e.modality}</td>
                      <td className="py-3 px-4 text-gray-600">{e.seeding || '—'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          e.status === 'approved' ? 'bg-green-100 text-green-700' :
                          e.status === 'pending'  ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-600'
                        }`}>
                          {e.status}
                        </span>
                      </td>
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
            <h2 className="text-lg font-bold text-lat-dark mb-4">
              Partidos ({matches.length})
            </h2>
            {matches.length === 0 ? (
              <p className="text-gray-400 text-center py-8">
                No hay partidos generados. Ve a "Generar Draw" primero.
              </p>
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
                        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-medium">
                          {ROUND_LABELS[m.round] || m.round}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">{m.category}</span>
                      </td>
                      <td className="py-3 px-4 font-medium text-lat-dark text-xs">{m.player1Id || 'BYE'}</td>
                      <td className="py-3 px-4 text-gray-400 text-center">vs</td>
                      <td className="py-3 px-4 font-medium text-lat-dark text-xs">{m.player2Id || 'BYE'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          m.status === 'live'      ? 'bg-red-100 text-red-600' :
                          m.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                          m.status === 'wo'        ? 'bg-orange-100 text-orange-600' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {m.status === 'live'      ? '🔴 En vivo' :
                           m.status === 'completed' ? '✓ Terminado' :
                           m.status === 'wo'        ? 'W.O.' : '⏳ Pendiente'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {m.scheduledAt
                          ? new Date(m.scheduledAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
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
            <h2 className="text-lg font-bold text-lat-dark mb-6">
              Generar Draw / Cuadro
            </h2>

            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sistema de juego
                </label>
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

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
                💡 Art. 23 LAT: Si hay menos de 8 jugadores, se usará Round Robin automáticamente.
                Los BYEs se asignan a las siembras más altas.
              </div>

              <button
                onClick={() => drawMutation.mutate()}
                disabled={drawMutation.isPending}
                className="w-full bg-lat-green hover:bg-lat-dark text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {drawMutation.isPending ? 'Generando...' : '🎾 Generar Draw'}
              </button>

              {drawMutation.isSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm">
                  ✅ Draw generado exitosamente. Ve a la pestaña "Partidos" para verlo.
                </div>
              )}

              {drawMutation.isError && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 text-sm">
                  ❌ Error al generar draw. Verifica que haya mínimo 6 jugadores inscritos.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}