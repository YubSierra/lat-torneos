import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { rankingsApi } from '../api/rankings.api';
import Sidebar from '../components/Sidebar';

const CIRCUIT_LINES = [
  'departamental', 'senior', 'infantil', 'inter_escuelas', 'edades_fct'
];

const CATEGORIES = [
  'INTERMEDIA', 'SEGUNDA', 'TERCERA', 'CUARTA', 'QUINTA'
];

export default function Rankings() {
  const [circuitLine, setCircuitLine] = useState('departamental');
  const [category, setCategory]       = useState('TERCERA');

  const { data: rankings = [], isLoading } = useQuery({
    queryKey: ['rankings', circuitLine, category],
    queryFn: () => rankingsApi.getByCategory(circuitLine, category),
  });

  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-lat-dark">Escalafón</h1>
          <p className="text-gray-500">Puntuación acumulada por temporada</p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Línea de Circuito
              </label>
              <select
                value={circuitLine}
                onChange={(e) => setCircuitLine(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green"
              >
                {CIRCUIT_LINES.map(cl => (
                  <option key={cl} value={cl}>{cl}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-lat-dark mb-4">
            {circuitLine.toUpperCase()} — {category}
          </h2>

          {isLoading ? (
            <p className="text-gray-400 text-center py-8">Cargando...</p>
          ) : rankings.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No hay datos de escalafón para esta categoría
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">#</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Jugador</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Torneos</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Pts Méritos</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Total Puntos</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r: any, i: number) => (
                  <tr key={r.id}
                    className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                  >
                    <td className="py-3 px-4">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-yellow-400 text-white' :
                        i === 1 ? 'bg-gray-300 text-white'   :
                        i === 2 ? 'bg-orange-400 text-white'  :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {r.position}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-lat-dark">
                      {r.playerName || r.playerId}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {r.tournamentsPlayed}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      +{Number(r.meritPoints).toFixed(0)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-lat-green font-bold text-lg">
                        {Number(r.totalPoints).toFixed(0)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}