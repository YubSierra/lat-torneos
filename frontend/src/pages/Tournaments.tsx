// frontend/src/pages/Tournaments.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Settings2 } from 'lucide-react';
import { tournamentsApi } from '../api/tournaments.api';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { useNavigate } from 'react-router-dom';
import CategorySelector, { type TournamentCategory } from '../components/CategorySelector';
import { circuitLinesApi, type CircuitLineItem } from '../api/circuitLines.api';
import CircuitLineModal from '../components/CircuitLineModal';

const TOURNAMENT_TYPES = [
  { value: 'elimination',   label: 'Eliminación Directa' },
  { value: 'round_robin',   label: 'Round Robin'          },
  { value: 'master',        label: 'Torneo Máster Matchlungo' },
  { value: 'americano',     label: 'Americano'            },
  { value: 'king_of_court', label: 'King of the Court'    },
  { value: 'supertiebreak', label: 'Supertiebreak'        },
  { value: 'box_league',    label: 'Box League'           },
  { value: 'ladder',        label: 'Escalera'             },
  { value: 'short_set',     label: 'Short Set'            },
  { value: 'pro_set',       label: 'Pro Set'              },
];


const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  draft:     { label: 'Borrador',   bg: '#F3F4F6', color: '#6B7280'  },
  open:      { label: 'Abierto',    bg: '#DBEAFE', color: '#1D4ED8'  },
  closed:    { label: 'Cerrado',    bg: '#FEF3C7', color: '#92400E'  },
  active:    { label: 'En curso',   bg: '#DCFCE7', color: '#15803D'  },
  completed: { label: 'Finalizado', bg: '#F3F4F6', color: '#374151'  },
};

// ─────────────────────────────────────────────────────────────────────────────
export default function Tournaments() {
  const { isAdmin }   = useAuth();
  const navigate      = useNavigate();
  const queryClient   = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showCircuitModal, setShowCircuitModal] = useState(false);
  const [clubFilter, setClubFilter] = useState('');

  // Estado del formulario
  const [form, setForm] = useState({
    name: '', club: '', type: 'elimination', circuitLine: 'departamental',
    inscriptionValue: 80000, stageNumber: 1,
    registrationStart: '', registrationEnd: '',
    eventStart: '', eventEnd: '',
    hasDoubles: false,
    doublesPlayerValue: 50000,
    doublesIncludedForSingles: false,
    doublesAdditionalValue: 0,
    refereeName: '', refereePhone: '',
    directorName: '', directorPhone: '',
  });

  // Estado de categorías por separado para mayor claridad
  const [categories, setCategories] = useState<TournamentCategory[]>([]);

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: tournamentsApi.getAll,
  });

  const { data: circuitLines = [] } = useQuery<CircuitLineItem[]>({
    queryKey: ['circuit-lines'],
    queryFn: circuitLinesApi.getAll,
  });

  const circuitLabel = (slug: string) =>
    circuitLines.find(c => c.slug === slug)?.label ?? slug;

  const createMutation = useMutation({
    mutationFn: tournamentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setShowModal(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setForm({
      name: '', club: '', type: 'elimination', circuitLine: 'departamental',
      inscriptionValue: 80000, stageNumber: 1,
      registrationStart: '', registrationEnd: '',
      eventStart: '', eventEnd: '',
      hasDoubles: false, doublesPlayerValue: 50000,
      doublesIncludedForSingles: false, doublesAdditionalValue: 0,
      refereeName: '', refereePhone: '',
      directorName: '', directorPhone: '',
    });
    setCategories([]);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (categories.length === 0) {
      alert('Debes seleccionar al menos una categoría para el torneo');
      return;
    }
    // Enviamos todo junto, incluyendo las categorías
    createMutation.mutate({ ...form, categories } as any);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-lat-dark">Torneos</h1>
            <p className="text-gray-500">Gestión de torneos y circuitos Matchlungo Ace</p>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowCircuitModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8,
                  border: '1.5px solid #C7D2FE', background: '#EEF2FF',
                  color: '#4338CA', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                <Settings2 size={16} />
                Líneas de circuito
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-lat-green hover:bg-lat-dark text-gren px-4 py-2 rounded-lg transition-colors"
              >
                <Plus size={18} />
                Nuevo Torneo
              </button>
            </div>
          )}
        </div>

        {/* Filtro por club */}
        {!isLoading && (tournaments as any[]).length > 0 && (() => {
          const clubs = Array.from(new Set((tournaments as any[]).map((t: any) => t.club).filter(Boolean))) as string[];
          return clubs.length > 0 ? (
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Club:</label>
              <select
                value={clubFilter}
                onChange={e => setClubFilter(e.target.value)}
                style={{
                  padding: '7px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB',
                  fontSize: '13px', color: '#111827', backgroundColor: 'white', cursor: 'pointer',
                }}
              >
                <option value="">Todos los clubes</option>
                {clubs.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {clubFilter && (
                <button
                  onClick={() => setClubFilter('')}
                  style={{ fontSize: '12px', color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  ✕ Limpiar
                </button>
              )}
            </div>
          ) : null;
        })()}

        {/* Lista torneos */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {isLoading ? (
            <p className="text-gray-400 text-center py-8">Cargando...</p>
          ) : (tournaments as any[]).length === 0 ? (
            <p className="text-gray-400 text-center py-8">No hay torneos creados aún</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(tournaments as any[]).filter((t: any) => !clubFilter || t.club === clubFilter).map((t: any) => {
                const statusInfo = STATUS_LABELS[t.status] || STATUS_LABELS.draft;
                return (
                  <div
                    key={t.id}
                    className="border border-gray-100 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(`/tournaments/${t.id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-bold text-lat-dark text-sm leading-tight pr-2">{t.name}</h3>
                      <span style={{
                        padding: '2px 8px', borderRadius: '999px', whiteSpace: 'nowrap',
                        fontSize: '11px', fontWeight: '600',
                        backgroundColor: statusInfo.bg, color: statusInfo.color,
                      }}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 mb-1">
                      {TOURNAMENT_TYPES.find(tt => tt.value === t.type)?.label || t.type}
                      {' · '}
                      {circuitLabel(t.circuitLine)}
                    </p>
                    {t.club && (
                      <p style={{ fontSize: '11px', color: '#4338CA', fontWeight: '600', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        🏛️ {t.club}
                      </p>
                    )}

                    {/* Categorías del torneo */}
                    {t.categories && t.categories.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '8px 0' }}>
                        {t.categories.map((cat: TournamentCategory) => (
                          <span
                            key={cat.name}
                            style={{
                              padding: '1px 7px', borderRadius: '999px',
                              fontSize: '10px', fontWeight: '600',
                              backgroundColor: '#F0FDF4', color: '#15803D',
                              border: '1px solid #86EFAC',
                            }}
                          >
                            {cat.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(t.eventStart).toLocaleDateString('es-CO')} →{' '}
                      {new Date(t.eventEnd).toLocaleDateString('es-CO')}
                    </p>
                    <p className="text-xs font-semibold text-lat-green mt-1">
                      ${Number(t.inscriptionValue).toLocaleString('es-CO')} COP
                    </p>

                    {isAdmin && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/tournaments/${t.id}`)}
                          style={{
                            flex: 1, padding: '5px 0', borderRadius: '6px',
                            backgroundColor: '#F0FDF4', color: '#15803D',
                            border: '1px solid #86EFAC', fontSize: '11px',
                            fontWeight: '600', cursor: 'pointer',
                          }}
                        >
                          Ver detalle
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`¿Eliminar "${t.name}"?\nSe borrarán todos los partidos, inscripciones y programación.`)) return;
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* MODAL CREAR TORNEO                                              */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {showCircuitModal && (
        <CircuitLineModal onClose={() => setShowCircuitModal(false)} />
      )}

      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50, backdropFilter: 'blur(3px)',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white', borderRadius: '18px',
              width: '100%', maxWidth: '560px',
              maxHeight: '92vh', overflowY: 'auto',
              boxShadow: '0 30px 70px rgba(0,0,0,0.25)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div style={{
              background: 'linear-gradient(135deg, #1B3A1B, #2D6A2D)',
              padding: '22px 28px', borderRadius: '18px 18px 0 0',
            }}>
              <h2 style={{ color: 'g', fontSize: '18px', fontWeight: '700', margin: 0 }}>
                🎾 Crear Nuevo Torneo
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '4px 0 0' }}>
                Completa los datos y selecciona las categorías
              </p>
            </div>

            <form onSubmit={handleCreate} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* Nombre */}
              <div>
                <label style={labelStyle}>Nombre del torneo</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  style={inputStyle}
                  placeholder="Etapa 1 — Circuito Departamental 2025"
                  required
                />
              </div>

              {/* Club */}
              <div>
                <label style={labelStyle}>🏛️ Club organizador</label>
                <input
                  value={form.club}
                  onChange={e => setForm({ ...form, club: e.target.value })}
                  style={inputStyle}
                  placeholder="Ej: Club Campestre, Club El Rodeo..."
                />
              </div>

              {/* Tipo + Línea de circuito */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Tipo de torneo</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle}>
                    {TOURNAMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Línea de circuito</label>
                  <select value={form.circuitLine} onChange={e => setForm({ ...form, circuitLine: e.target.value })} style={inputStyle}>
                    {circuitLines.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Etapa + Valor inscripción */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Etapa #</label>
                  <input type="number" min={1} value={form.stageNumber}
                    onChange={e => setForm({ ...form, stageNumber: Number(e.target.value) })}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Valor inscripción (COP)</label>
                  <input type="number" min={0} value={form.inscriptionValue}
                    onChange={e => setForm({ ...form, inscriptionValue: Number(e.target.value) })}
                    style={inputStyle} />
                </div>
              </div>

              {/* Fechas inscripción */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Inicio inscripciones</label>
                  <input type="date" value={form.registrationStart}
                    onChange={e => setForm({ ...form, registrationStart: e.target.value })}
                    style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>Cierre inscripciones</label>
                  <input type="date" value={form.registrationEnd}
                    onChange={e => setForm({ ...form, registrationEnd: e.target.value })}
                    style={inputStyle} required />
                </div>
              </div>

              {/* Fechas evento */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Inicio torneo</label>
                  <input type="date" value={form.eventStart}
                    onChange={e => setForm({ ...form, eventStart: e.target.value })}
                    style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>Fin torneo</label>
                  <input type="date" value={form.eventEnd}
                    onChange={e => setForm({ ...form, eventEnd: e.target.value })}
                    style={inputStyle} required />
                </div>
              </div>

              {/* ── ÁRBITRO ── */}
              <div style={{ border: '1.5px solid #E5E7EB', borderRadius: '12px', padding: '16px', backgroundColor: '#FAFAFA' }}>
                <p style={{ fontWeight: '700', color: '#1B3A1B', fontSize: '14px', margin: '0 0 12px' }}>
                  🧑‍⚖️ Árbitro (Referee)
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Nombre</label>
                    <input
                      value={form.refereeName}
                      onChange={e => setForm({ ...form, refereeName: e.target.value })}
                      style={inputStyle}
                      placeholder="Nombre completo del árbitro"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Teléfono / Contacto</label>
                    <input
                      value={form.refereePhone}
                      onChange={e => setForm({ ...form, refereePhone: e.target.value })}
                      style={inputStyle}
                      placeholder="+57 300 000 0000"
                    />
                  </div>
                </div>
              </div>

              {/* ── DIRECTOR ── */}
              <div style={{ border: '1.5px solid #E5E7EB', borderRadius: '12px', padding: '16px', backgroundColor: '#FAFAFA' }}>
                <p style={{ fontWeight: '700', color: '#1B3A1B', fontSize: '14px', margin: '0 0 12px' }}>
                  👔 Director del torneo
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Nombre</label>
                    <input
                      value={form.directorName}
                      onChange={e => setForm({ ...form, directorName: e.target.value })}
                      style={inputStyle}
                      placeholder="Nombre del director"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Teléfono / Contacto</label>
                    <input
                      value={form.directorPhone}
                      onChange={e => setForm({ ...form, directorPhone: e.target.value })}
                      style={inputStyle}
                      placeholder="+57 300 000 0000"
                    />
                  </div>
                </div>
              </div>

              {/* ── CATEGORÍAS ── */}
              <div style={{
                border: '1.5px solid #E5E7EB', borderRadius: '12px',
                padding: '16px', backgroundColor: '#FAFAFA',
              }}>
                <div style={{ marginBottom: '14px' }}>
                  <p style={{ fontWeight: '700', color: '#1B3A1B', fontSize: '14px', margin: 0 }}>
                    🏷️ Categorías del torneo
                  </p>
                  <p style={{ fontSize: '12px', color: '#6B7280', margin: '3px 0 0' }}>
                    Selecciona las categorías o crea personalizadas
                  </p>
                </div>
                <CategorySelector
                  selected={categories}
                  onChange={setCategories}
                  circuitLine={circuitLines.find(c => c.slug === form.circuitLine) ?? null}
                />
              </div>

              {/* ── DOBLES ── */}
              <div style={{
                border: '1px solid #E5E7EB', borderRadius: '10px',
                padding: '16px', backgroundColor: '#F9FAFB',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <p style={{ fontWeight: '600', color: '#1B3A1B', fontSize: '14px', margin: 0 }}>
                      🤝 Modalidad de Dobles
                    </p>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: '2px 0 0' }}>
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
                      transition: 'background-color 0.2s', flexShrink: 0,
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: '3px',
                      left: form.hasDoubles ? '22px' : '3px',
                      width: '18px', height: '18px',
                      backgroundColor: 'white', borderRadius: '50%',
                      transition: 'left 0.2s', display: 'block',
                    }} />
                  </button>
                </div>

                {form.hasDoubles && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={labelStyle}>
                        💰 Valor por jugador que SOLO juega dobles
                        <span style={{ display: 'block', fontSize: '11px', color: '#6B7280', fontWeight: '400', marginTop: '1px' }}>
                          Aplica para jugadores que no están inscritos en singles
                        </span>
                      </label>
                      <input type="number" min={0} value={form.doublesPlayerValue}
                        onChange={e => setForm({ ...form, doublesPlayerValue: Number(e.target.value) })}
                        style={inputStyle} placeholder="50000" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input type="checkbox" id="doublesIncluded"
                        checked={form.doublesIncludedForSingles}
                        onChange={e => setForm({ ...form, doublesIncludedForSingles: e.target.checked })}
                        style={{ width: '16px', height: '16px', accentColor: '#2D6A2D' }} />
                      <label htmlFor="doublesIncluded" style={{ fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
                        Dobles gratis para jugadores de singles
                      </label>
                    </div>
                    {!form.doublesIncludedForSingles && (
                      <div>
                        <label style={labelStyle}>Valor adicional para jugadores de singles</label>
                        <input type="number" min={0} value={form.doublesAdditionalValue}
                          onChange={e => setForm({ ...form, doublesAdditionalValue: Number(e.target.value) })}
                          style={inputStyle} placeholder="0 = incluido gratis" />
                      </div>
                    )}
                    <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#15803D' }}>
                      💡 <strong>Resumen de cobro:</strong><br />
                      • Jugador solo-dobles: <strong>${(form.doublesPlayerValue || 0).toLocaleString('es-CO')} COP</strong><br />
                      • Jugador singles + dobles: <strong>
                        {form.doublesIncludedForSingles
                          ? 'Incluido gratis'
                          : `$${form.doublesAdditionalValue.toLocaleString('es-CO')} COP adicional`}
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Error */}
              {createMutation.isError && (
                <div style={{
                  backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
                  borderRadius: '8px', padding: '10px 14px',
                }}>
                  <p style={{ color: '#DC2626', fontSize: '13px', margin: 0 }}>
                    ⚠️ Error al crear el torneo. Verifica los datos e intenta de nuevo.
                  </p>
                </div>
              )}

              {/* Botones */}
              <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  style={{
                    flex: 1, padding: '11px', borderRadius: '10px',
                    border: '1.5px solid #E5E7EB', backgroundColor: 'white',
                    color: '#374151', fontWeight: '600', fontSize: '14px', cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || categories.length === 0}
                  style={{
                    flex: 2, padding: '11px', borderRadius: '10px', border: 'none',
                    background: categories.length > 0
                      ? 'linear-gradient(135deg, #2D6A2D, #1B3A1B)'
                      : '#D1D5DB',
                    color: 'white', fontWeight: '700', fontSize: '14px',
                    cursor: categories.length > 0 && !createMutation.isPending ? 'pointer' : 'not-allowed',
                    boxShadow: categories.length > 0 ? '0 4px 14px rgba(27,58,27,0.3)' : 'none',
                    opacity: createMutation.isPending ? 0.7 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  {createMutation.isPending
                    ? 'Creando...'
                    : categories.length === 0
                      ? 'Selecciona categorías para continuar'
                      : `Crear Torneo (${categories.length} categoría${categories.length !== 1 ? 's' : ''})`
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px',
  fontWeight: '600', color: '#374151', marginBottom: '5px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  borderRadius: '8px', border: '1.5px solid #D1D5DB',
  fontSize: '13px', color: '#111827',
  backgroundColor: 'white', boxSizing: 'border-box',
};
