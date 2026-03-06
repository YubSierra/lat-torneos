import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { tournamentsApi } from '../api/tournaments.api';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'elimination', circuitLine: 'departamental',
    inscriptionValue: 80000, stageNumber: 1,
    registrationStart: '', registrationEnd: '',
    eventStart: '', eventEnd: '',
    // Dobles
    hasDoubles: false,
    doublesValue: 50000,
    doublesIncludedForSingles: false,
    doublesAdditionalValue: 0,
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
                  {t.hasDoubles && (
                    <span style={{
                      backgroundColor: '#EDE9FE', color: '#6D28D9',
                      padding: '2px 8px', borderRadius: '999px',
                      fontSize: '11px', fontWeight: '600',
                      display: 'inline-block', marginBottom: '12px',
                    }}>
                      🤝 Dobles disponibles
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                    <button
                      onClick={() => navigate(`/tournaments/${t.id}`)}
                      className="flex items-center gap-1 text-xs text-lat-green hover:text-lat-dark transition-colors"
                    >
                      Ver detalle →
                    </button>
                    {isAdmin && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(`¿Eliminar "${t.name}"? Se borrarán todos los partidos, inscripciones y programación.`)) return;
                          try {
                            await api.delete(`/tournaments/${t.id}`);
                            queryClient.invalidateQueries({ queryKey: ['tournaments'] });
                          } catch {
                            alert('Error al eliminar el torneo');
                          }
                        }}
                        style={{
                          backgroundColor: '#FEF2F2', color: '#DC2626',
                          border: '1px solid #FECACA', borderRadius: '6px',
                          padding: '4px 10px', fontSize: '11px',
                          cursor: 'pointer', fontWeight: '500',
                        }}
                      >
                        🗑 Eliminar
                      </button>
                    )}
                  </div>
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

              {/* ── SECCIÓN DOBLES ── */}
              <div style={{
                border: '1px solid #E5E7EB', borderRadius: '10px',
                padding: '16px', backgroundColor: '#F9FAFB',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <p style={{ fontWeight: '600', color: '#1B3A1B', fontSize: '14px' }}>
                      🎾 Modalidad de Dobles
                    </p>
                    <p style={{ fontSize: '12px', color: '#6B7280' }}>
                      Habilita si el torneo incluye dobles
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, hasDoubles: !form.hasDoubles })}
                    style={{
                      width: '44px', height: '24px', borderRadius: '999px',
                      border: 'none', cursor: 'pointer', position: 'relative',
                      backgroundColor: form.hasDoubles ? '#2D6A2D' : '#D1D5DB',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: '3px',
                      left: form.hasDoubles ? '22px' : '3px',
                      width: '18px', height: '18px',
                      borderRadius: '50%', backgroundColor: 'white',
                      transition: 'left 0.2s', display: 'block',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>

                {form.hasDoubles && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Valor inscripción dobles */}
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                        Valor inscripción dobles (por pareja)
                      </label>
                      <input
                        type="number"
                        value={form.doublesValue}
                        onChange={e => setForm({ ...form, doublesValue: Number(e.target.value) })}
                        style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' as any }}
                        placeholder="50000"
                      />
                    </div>

                    {/* ¿Dobles incluido para singles? */}
                    <div style={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>
                            Dobles incluido para jugadores de singles
                          </p>
                          <p style={{ fontSize: '11px', color: '#6B7280' }}>
                            Si está activo, los jugadores de singles no pagan dobles adicional
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, doublesIncludedForSingles: !form.doublesIncludedForSingles })}
                          style={{
                            width: '44px', height: '24px', borderRadius: '999px',
                            border: 'none', cursor: 'pointer', position: 'relative',
                            backgroundColor: form.doublesIncludedForSingles ? '#2D6A2D' : '#D1D5DB',
                            transition: 'background-color 0.2s', flexShrink: 0,
                          }}
                        >
                          <span style={{
                            position: 'absolute', top: '3px',
                            left: form.doublesIncludedForSingles ? '22px' : '3px',
                            width: '18px', height: '18px', borderRadius: '50%',
                            backgroundColor: 'white', transition: 'left 0.2s',
                            display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }} />
                        </button>
                      </div>

                      {/* Si NO está incluido, mostrar valor adicional */}
                      {!form.doublesIncludedForSingles && (
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                            Valor adicional para jugadores de singles que quieran jugar dobles
                          </label>
                          <input
                            type="number"
                            value={form.doublesAdditionalValue}
                            onChange={e => setForm({ ...form, doublesAdditionalValue: Number(e.target.value) })}
                            style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' as any }}
                            placeholder="0 = incluido gratis"
                          />
                        </div>
                      )}
                    </div>

                    {/* Resumen */}
                    <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#15803D' }}>
                      💡 Solo dobles: <strong>${form.doublesValue.toLocaleString('es-CO')} COP</strong> por pareja
                      {form.doublesIncludedForSingles
                        ? ' · Singles: incluido gratis'
                        : form.doublesAdditionalValue > 0
                          ? ` · Singles: +$${form.doublesAdditionalValue.toLocaleString('es-CO')} COP adicional`
                          : ' · Singles: gratis'
                      }
                    </div>
                  </div>
                )}
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