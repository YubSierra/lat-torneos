import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye } from 'lucide-react';
import { tournamentsApi } from '../api/tournaments.api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';

const TOURNAMENT_TYPES = [
  { value: 'elimination',   label: 'Eliminación Directa' },
  { value: 'round_robin',   label: 'Round Robin'          },
  { value: 'master',        label: 'Torneo Máster LAT'    },
  { value: 'americano',     label: 'Americano'            },
  { value: 'king_of_court', label: 'King of the Court'    },
  { value: 'supertiebreak', label: 'Supertiebreak'        },
  { value: 'box_league',    label: 'Box League'           },
  { value: 'ladder',        label: 'Escalera'             },
  { value: 'short_set',     label: 'Short Set'            },
  { value: 'pro_set',       label: 'Pro Set'              },
];

const CIRCUIT_LINES = [
  { value: 'departamental',  label: 'Departamental'  },
  { value: 'inter_escuelas', label: 'Inter Escuelas' },
  { value: 'infantil',       label: 'Infantil'       },
  { value: 'senior',         label: 'Senior'         },
  { value: 'edades_fct',     label: 'Edades FCT'     },
  { value: 'recreativo',     label: 'Recreativo'     },
];

export default function Tournaments() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'elimination', circuitLine: 'departamental',
    inscriptionValue: 80000, stageNumber: 1,
    registrationStart: '', registrationEnd: '',
    eventStart: '', eventEnd: '',
  });

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: tournamentsApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: tournamentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setShowModal(false);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-lat-dark">Torneos</h1>
            <p className="text-gray-500">Gestión de torneos y circuitos LAT</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-lat-green hover:bg-lat-dark text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={18} />
              Nuevo Torneo
            </button>
          )}
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {isLoading ? (
            <p className="text-gray-400 text-center py-8">Cargando...</p>
          ) : tournaments.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No hay torneos creados aún
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tournaments.map((t: any) => (
                <div key={t.id}
                  className="border border-gray-100 rounded-xl p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-lat-dark text-sm">{t.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      t.status === 'active'    ? 'bg-green-100 text-green-700' :
                      t.status === 'open'      ? 'bg-blue-100 text-blue-700'  :
                      t.status === 'completed' ? 'bg-gray-100 text-gray-600'  :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mb-1">
                    🏆 {TOURNAMENT_TYPES.find(tt => tt.value === t.type)?.label || t.type}
                  </p>
                  <p className="text-gray-500 text-xs mb-3">
                    📍 {CIRCUIT_LINES.find(cl => cl.value === t.circuitLine)?.label || t.circuitLine}
                  </p>
                  <p className="text-lat-green font-bold text-sm mb-3">
                    ${Number(t.inscriptionValue).toLocaleString('es-CO')} COP
                  </p>
                  <button className="flex items-center gap-1 text-xs text-lat-green hover:text-lat-dark transition-colors">
                    <Eye size={14} />
                    Ver detalles
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal crear torneo */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-lat-dark mb-6">
              Crear Nuevo Torneo
            </h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green"
                  placeholder="Etapa 1 - Circuito Departamental 2025"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={form.type}
                    onChange={e => setForm({...form, type: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green"
                  >
                    {TOURNAMENT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Circuito</label>
                  <select
                    value={form.circuitLine}
                    onChange={e => setForm({...form, circuitLine: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green"
                  >
                    {CIRCUIT_LINES.map(cl => (
                      <option key={cl.value} value={cl.value}>{cl.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor inscripción (COP) — Art. 23: $50.000 - $150.000
                </label>
                <input
                  type="number"
                  value={form.inscriptionValue}
                  onChange={e => setForm({...form, inscriptionValue: Number(e.target.value)})}
                  min={50000} max={150000}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inicio inscripciones</label>
                  <input type="date" value={form.registrationStart}
                    onChange={e => setForm({...form, registrationStart: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cierre inscripciones</label>
                  <input type="date" value={form.registrationEnd}
                    onChange={e => setForm({...form, registrationEnd: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inicio torneo</label>
                  <input type="date" value={form.eventStart}
                    onChange={e => setForm({...form, eventStart: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fin torneo</label>
                  <input type="date" value={form.eventEnd}
                    onChange={e => setForm({...form, eventEnd: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green"
                    required
                  />
                </div>
              </div>

              {createMutation.isError && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm">
                  Error al crear el torneo
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 bg-lat-green text-white py-2 rounded-lg hover:bg-lat-dark transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creando...' : 'Crear Torneo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}