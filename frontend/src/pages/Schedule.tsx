import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Calendar, Play } from 'lucide-react';
import { tournamentsApi } from '../api/tournaments.api';
import { courtsApi } from '../api/courts.api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';

const ROUND_LABELS: Record<string, string> = {
  R64: 'Ronda 64', R32: 'Ronda 32', R16: 'Ronda 16',
  QF: 'Cuartos', SF: 'Semifinal', F: 'Final',
  RR: 'Round Robin', RR_A: 'Grupo A', RR_B: 'Grupo B',
  SF_M: 'SF Máster', F_M: 'Final Máster',
};

export default function Schedule() {
  const { isAdmin } = useAuth();
  const [selectedTournament, setSelectedTournament] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const { data: tournaments = [] } = useQuery({
    queryKey: ['tournaments'],
    queryFn: tournamentsApi.getAll,
  });

  const { data: schedule, refetch: refetchSchedule } = useQuery({
    queryKey: ['schedule', selectedTournament],
    queryFn: () => courtsApi.getSchedule(selectedTournament),
    enabled: !!selectedTournament,
  });

  const generateMutation = useMutation({
    mutationFn: () => courtsApi.generateSchedule(selectedTournament, selectedDate),
    onSuccess: () => refetchSchedule(),
  });

  // Aplanar el objeto de programación para mostrarlo en tabla
  const scheduleRows: any[] = [];
  if (schedule) {
    Object.entries(schedule).forEach(([date, courts]: [string, any]) => {
      Object.entries(courts).forEach(([courtId, matches]: [string, any]) => {
        (matches as any[]).forEach((match: any) => {
          scheduleRows.push({ date, courtId, ...match });
        });
      });
    });
  }

  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-lat-dark">Programación</h1>
          <p className="text-gray-500">Programación de partidos por cancha y horario</p>
        </div>

        {/* Controles */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex gap-4 flex-wrap items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Torneo
              </label>
              <select
                value={selectedTournament}
                onChange={e => setSelectedTournament(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green min-w-48"
              >
                <option value="">Seleccionar torneo...</option>
                {tournaments.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {isAdmin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de programación
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green"
                  />
                </div>

                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={!selectedTournament || !selectedDate || generateMutation.isPending}
                  className="flex items-center gap-2 bg-lat-green hover:bg-lat-dark text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Play size={16} />
                  {generateMutation.isPending ? 'Generando...' : 'Generar Automático'}
                </button>
              </>
            )}
          </div>

          {generateMutation.isSuccess && (
            <div className="mt-4 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2 text-sm">
              ✅ Programación generada exitosamente
            </div>
          )}

          {generateMutation.isError && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm">
              ❌ Error al generar programación
            </div>
          )}
        </div>

        {/* Tabla de programación */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-lat-dark mb-4 flex items-center gap-2">
            <Calendar size={20} />
            Partidos Programados
          </h2>

          {!selectedTournament ? (
            <p className="text-gray-400 text-center py-8">
              Selecciona un torneo para ver la programación
            </p>
          ) : scheduleRows.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No hay partidos programados para este torneo
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Fecha</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Hora</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Cancha</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Categoría</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Ronda</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Jugador 1</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Jugador 2</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Estado</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Duración</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleRows.map((row, i) => (
                    <tr key={i}
                      className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                    >
                      <td className="py-3 px-4 text-gray-600">{row.date}</td>
                      <td className="py-3 px-4">
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                          {row.time}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        🎾 {row.courtId}
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
                          {row.category}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-medium">
                          {ROUND_LABELS[row.round] || row.round}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-lat-dark text-xs">
                        {row.player1 || '—'}
                      </td>
                      <td className="py-3 px-4 font-medium text-lat-dark text-xs">
                        {row.player2 || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          row.status === 'live'      ? 'bg-red-100 text-red-600 animate-pulse' :
                          row.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {row.status === 'live'      ? '🔴 En vivo' :
                           row.status === 'completed' ? '✓ Terminado' : '⏳ Pendiente'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {row.duration}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}