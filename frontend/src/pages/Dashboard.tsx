import { useQuery } from '@tanstack/react-query';
import { Trophy, Users, Calendar, TrendingUp } from 'lucide-react';
import { tournamentsApi } from '../api/tournaments.api';
import Sidebar from '../components/Sidebar';

function StatCard({
  icon: Icon, label, value, color
}: {
  icon: any;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <p className="text-gray-500 text-sm">{label}</p>
        <p className="text-2xl font-bold text-lat-dark">{value}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: tournamentsApi.getAll,
  });

  const active = tournaments.filter((t: any) => t.status === 'active').length;
  const open   = tournaments.filter((t: any) => t.status === 'open').length;
  const total  = tournaments.length;

  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-lat-dark">Dashboard</h1>
          <p className="text-gray-500">Matchlungo Ace - Gestor de torneo de Tenis — Temporada {new Date().getFullYear()}</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard icon={Trophy}     label="Total Torneos"     value={total}  color="bg-lat-green" />
          <StatCard icon={Calendar}   label="Torneos Activos"   value={active} color="bg-blue-500"  />
          <StatCard icon={Users}      label="Inscripciones"     value="—"      color="bg-orange-500"/>
          <StatCard icon={TrendingUp} label="Torneos Abiertos"  value={open}   color="bg-purple-500"/>
        </div>

        {/* Lista de torneos recientes */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-lat-dark mb-4">
            Torneos Recientes
          </h2>

          {isLoading ? (
            <p className="text-gray-400 text-center py-8">Cargando...</p>
          ) : tournaments.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No hay torneos creados aún
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Torneo</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Tipo</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Circuito</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Estado</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Inscripción</th>
                  </tr>
                </thead>
                <tbody>
                  {tournaments.map((t: any, i: number) => (
                    <tr key={t.id}
                      className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                    >
                      <td className="py-3 px-4 font-medium text-lat-dark">{t.name}</td>
                      <td className="py-3 px-4 text-gray-600">{t.type}</td>
                      <td className="py-3 px-4 text-gray-600">{t.circuitLine}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          t.status === 'active'    ? 'bg-green-100 text-green-700' :
                          t.status === 'open'      ? 'bg-blue-100 text-blue-700'  :
                          t.status === 'completed' ? 'bg-gray-100 text-gray-600'  :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        ${Number(t.inscriptionValue).toLocaleString('es-CO')}
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