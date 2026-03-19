import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { rankingsApi } from '../api/rankings.api';
import { circuitLinesApi } from '../api/circuitLines.api';
import type { CircuitLineItem } from '../api/circuitLines.api';
import Sidebar from '../components/Sidebar';

const BASE_CATEGORIES = [
  'INTERMEDIA', 'SEGUNDA', 'TERCERA', 'CUARTA', 'QUINTA', '10 AÑOS',
];

const GENDER_OPTIONS = [
  { value: '',  label: 'Mixto / Sin género' },
  { value: 'M', label: '♂ Masculino' },
  { value: 'F', label: '♀ Femenino' },
];

export default function Rankings() {
  const [circuitLine, setCircuitLine] = useState('departamental');
  const [baseCategory, setBaseCategory] = useState('TERCERA');
  const [gender, setGender] = useState('');

  // Full category name sent to the API
  const category = gender ? `${baseCategory} ${gender}` : baseCategory;

  const { data: circuitLines = [] } = useQuery<CircuitLineItem[]>({
    queryKey: ['circuit-lines'],
    queryFn: circuitLinesApi.getAll,
  });

  const { data: rankings = [], isLoading } = useQuery({
    queryKey: ['rankings', circuitLine, category],
    queryFn: () => rankingsApi.getByCategory(circuitLine, category),
  });

  const circuitLabel = (slug: string) =>
    circuitLines.find(c => c.slug === slug)?.label ?? slug;

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
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>

            {/* Línea de circuito */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Línea de Circuito
              </label>
              <select
                value={circuitLine}
                onChange={e => setCircuitLine(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green"
              >
                {circuitLines.map(cl => (
                  <option key={cl.slug} value={cl.slug}>{cl.label}</option>
                ))}
              </select>
            </div>

            {/* Categoría base */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoría
              </label>
              <select
                value={baseCategory}
                onChange={e => setBaseCategory(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green"
              >
                {BASE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Género */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Género
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {GENDER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGender(opt.value)}
                    style={{
                      padding: '7px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                      fontWeight: gender === opt.value ? 700 : 500,
                      border: gender === opt.value ? '2px solid #2D6A2D' : '1.5px solid #D1D5DB',
                      background: gender === opt.value ? '#F0FDF4' : '#fff',
                      color: gender === opt.value ? '#15803D' : '#374151',
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <h2 className="text-lg font-bold text-lat-dark" style={{ margin: 0 }}>
              {circuitLabel(circuitLine).toUpperCase()} — {category}
            </h2>
            {gender && (
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999,
                background: gender === 'M' ? '#DBEAFE' : '#FCE7F3',
                color: gender === 'M' ? '#1D4ED8' : '#BE185D',
              }}>
                {gender === 'M' ? '♂ Masculino' : '♀ Femenino'}
              </span>
            )}
          </div>

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
                {(rankings as any[]).map((r: any, i: number) => (
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
