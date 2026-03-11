// frontend/src/components/DeleteDrawButton.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import api from '../api/axios';

interface DrawSummary {
  hasRR: boolean;
  hasMainDraw: boolean;
  rrCount: number;
  mainCount: number;
  rrCompleted: number;
  mainCompleted: number;
}

interface Props {
  tournamentId: string;
  onDeleted?: () => void;
}

export default function DeleteDrawButton({ tournamentId, onDeleted }: Props) {
  const [open, setOpen]                   = useState(false);
  const [allCategories, setAllCategories] = useState(false);
  const [category, setCategory]           = useState('');
  const [drawType, setDrawType]           = useState<'rr' | 'maindraw' | 'all'>('all');
  const [confirmed, setConfirmed]         = useState(false);
  const queryClient                       = useQueryClient();

  // ── Categorías reales del torneo ──────────────────────────────────────────
  const { data: categories = [], isLoading: loadingCats } = useQuery<string[]>({
    queryKey: ['tournament-categories', tournamentId],
    queryFn: async () => {
      const res = await api.get(`/matches/tournament/${tournamentId}/categories`);
      return res.data;
    },
    enabled: open && !!tournamentId,
    // Cuando carguen las categorías, preseleccionar la primera
    select: (data) => {
      if (data.length > 0 && !category) setCategory(data[0]);
      return data;
    },
  });

  // ── Resumen de UNA categoría ──────────────────────────────────────────────
  const { data: summary, isLoading: loadingSummary } = useQuery<DrawSummary>({
    queryKey: ['draw-summary', tournamentId, category],
    queryFn: async () => {
      const res = await api.get(`/matches/tournament/${tournamentId}/draw-summary`, {
        params: { category },
      });
      return res.data;
    },
    enabled: open && !allCategories && !!category,
  });

  // ── Resumen de TODAS las categorías ──────────────────────────────────────
  const { data: allSummaries, isLoading: loadingAll } = useQuery<Record<string, DrawSummary>>({
    queryKey: ['draw-summary-all', tournamentId, categories],
    queryFn: async () => {
      const results: Record<string, DrawSummary> = {};
      await Promise.all(
        categories.map(async cat => {
          const res = await api.get(`/matches/tournament/${tournamentId}/draw-summary`, {
            params: { category: cat },
          });
          results[cat] = res.data;
        }),
      );
      return results;
    },
    enabled: open && allCategories && categories.length > 0,
  });

  const isLoading = loadingCats || (allCategories ? loadingAll : loadingSummary);

  // Totales para "todas las categorías"
  const allTotals = allSummaries
    ? Object.values(allSummaries).reduce(
        (acc, s) => ({
          rrCount:       acc.rrCount       + s.rrCount,
          mainCount:     acc.mainCount     + s.mainCount,
          rrCompleted:   acc.rrCompleted   + s.rrCompleted,
          mainCompleted: acc.mainCompleted + s.mainCompleted,
          hasRR:         acc.hasRR         || s.hasRR,
          hasMainDraw:   acc.hasMainDraw   || s.hasMainDraw,
        }),
        { rrCount: 0, mainCount: 0, rrCompleted: 0, mainCompleted: 0, hasRR: false, hasMainDraw: false },
      )
    : null;

  const activeSummary   = allCategories ? allTotals : summary;
  const nothingToDelete = !isLoading && activeSummary && !activeSummary.hasRR && !activeSummary.hasMainDraw;
  const noMatches       = !isLoading && categories.length === 0;
  const scopeLabel      = allCategories ? 'TODAS las categorías' : category;

  function getMatchCount() {
    if (!activeSummary) return 0;
    if (drawType === 'rr')       return activeSummary.rrCount;
    if (drawType === 'maindraw') return activeSummary.mainCount;
    return activeSummary.rrCount + activeSummary.mainCount;
  }

  function getCompletedCount() {
    if (!activeSummary) return 0;
    if (drawType === 'rr')       return activeSummary.rrCompleted;
    if (drawType === 'maindraw') return activeSummary.mainCompleted;
    return activeSummary.rrCompleted + activeSummary.mainCompleted;
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (allCategories) {
        let total = 0;
        for (const cat of categories) {
          try {
            const res = await api.delete(`/matches/tournament/${tournamentId}/draw`, {
              params: { category: cat, drawType },
            });
            total += res.data.deleted || 0;
          } catch { /* categoría sin partidos → ignorar */ }
        }
        return { message: `Se eliminaron ${total} partidos en ${categories.length} categorías` };
      } else {
        const res = await api.delete(`/matches/tournament/${tournamentId}/draw`, {
          params: { category, drawType },
        });
        return res.data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['draw-summary'] });
      queryClient.invalidateQueries({ queryKey: ['tournament-categories', tournamentId] });
      onDeleted?.();
      setOpen(false);
      setConfirmed(false);
      alert(`✅ ${data.message}`);
    },
    onError: (e: any) => {
      alert(`❌ ${e?.response?.data?.message ?? 'Error al eliminar'}`);
    },
  });

  function handleOpen() {
    setOpen(true);
    setConfirmed(false);
    setDrawType('all');
    setAllCategories(false);
    setCategory(''); // se preselecciona cuando carguen las categorías
  }

  return (
    <>
      <button
        onClick={handleOpen}
        style={{
          padding: '8px 14px', borderRadius: '7px',
          border: '1.5px solid #FCA5A5', background: '#FEF2F2',
          color: '#DC2626', cursor: 'pointer', fontWeight: 600,
          fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
        }}
      >
        <Trash2 size={14} /> Eliminar Cuadro
      </button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div style={{
            background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '500px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem', borderBottom: '1px solid #E5E7EB',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#FEF2F2', borderRadius: '8px', padding: '6px' }}>
                  <Trash2 size={18} color="#DC2626" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>
                    Eliminar Cuadro
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#6B7280' }}>
                    Selecciona categoría y tipo de cuadro
                  </p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Sin partidos en el torneo */}
              {noMatches && (
                <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                  <p style={{ color: '#16A34A', fontWeight: 600, margin: 0 }}>
                    ✅ No hay cuadros generados en este torneo
                  </p>
                </div>
              )}

              {!noMatches && (
                <>
                  {/* PASO 1 — Categoría */}
                  <div>
                    <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ background: '#DC2626', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>1</span>
                      Categoría
                    </p>

                    {/* Toggle una / todas */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      {[
                        { value: false, label: '📂 Categoría específica' },
                        { value: true,  label: '📁 Todas las categorías' },
                      ].map(opt => (
                        <button
                          key={String(opt.value)}
                          onClick={() => { setAllCategories(opt.value); setConfirmed(false); }}
                          style={{
                            flex: 1, padding: '8px', borderRadius: '7px', border: 'none',
                            fontWeight: 600, fontSize: '12px', cursor: 'pointer',
                            background: allCategories === opt.value ? '#DC2626' : '#F3F4F6',
                            color:      allCategories === opt.value ? '#fff'    : '#374151',
                            transition: 'all 0.15s',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {loadingCats ? (
                      <p style={{ color: '#6B7280', fontSize: '0.85rem' }}>Cargando categorías...</p>
                    ) : !allCategories ? (
                      /* Select con categorías reales del torneo */
                      <select
                        value={category}
                        onChange={e => { setCategory(e.target.value); setConfirmed(false); }}
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: '7px',
                          border: '1.5px solid #D1D5DB', fontSize: '0.875rem',
                          fontWeight: 600, color: '#111827', background: '#fff',
                        }}
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    ) : (
                      /* Resumen de todas las categorías */
                      <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '7px', padding: '8px 12px' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '0.78rem', color: '#7F1D1D', fontWeight: 700 }}>
                          ⚠ Aplica a todas las categorías del torneo:
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {categories.map(cat => (
                            <span key={cat} style={{
                              background: '#fff', border: '1px solid #FECACA',
                              color: '#DC2626', borderRadius: '6px',
                              padding: '2px 8px', fontSize: '0.78rem', fontWeight: 600,
                            }}>
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PASO 2 — Tipo */}
                  <div>
                    <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ background: '#DC2626', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>2</span>
                      ¿Qué eliminar?
                    </p>

                    {isLoading ? (
                      <p style={{ color: '#6B7280', fontSize: '0.85rem' }}>Verificando partidos existentes...</p>
                    ) : nothingToDelete ? (
                      <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                        <p style={{ color: '#16A34A', fontWeight: 600, margin: 0 }}>
                          ✅ No hay cuadros generados para {allCategories ? 'ninguna categoría' : category}
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {([
                          { value: 'rr',       label: 'Round Robin',          count: activeSummary?.rrCount ?? 0,   disabled: !activeSummary?.hasRR       },
                          { value: 'maindraw', label: 'Main Draw',             count: activeSummary?.mainCount ?? 0, disabled: !activeSummary?.hasMainDraw },
                          { value: 'all',      label: 'Todo (RR + Main Draw)', count: (activeSummary?.rrCount ?? 0) + (activeSummary?.mainCount ?? 0), disabled: false },
                        ] as const).map(opt => (
                          <label key={opt.value} style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '10px 14px', borderRadius: '8px',
                            cursor: opt.disabled ? 'not-allowed' : 'pointer',
                            border: `1.5px solid ${drawType === opt.value ? '#DC2626' : '#E5E7EB'}`,
                            background: opt.disabled ? '#F9FAFB' : drawType === opt.value ? '#FEF2F2' : '#fff',
                            opacity: opt.disabled ? 0.45 : 1, transition: 'all 0.15s',
                          }}>
                            <input type="radio" name="drawType" value={opt.value}
                              checked={drawType === opt.value} disabled={opt.disabled}
                              onChange={() => { setDrawType(opt.value); setConfirmed(false); }}
                              style={{ accentColor: '#DC2626' }}
                            />
                            <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem', flex: 1 }}>
                              {opt.label}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#6B7280', background: '#F3F4F6', padding: '2px 8px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                              {opt.count} partidos
                            </span>
                            {opt.disabled && <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>Sin generar</span>}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Advertencias + resumen + checkbox */}
                  {!isLoading && !nothingToDelete && activeSummary && (
                    <>
                      {getCompletedCount() > 0 && (
                        <div style={{ background: '#FFFBEB', border: '1.5px solid #FCD34D', borderRadius: '8px', padding: '12px', display: 'flex', gap: '10px' }}>
                          <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0, marginTop: '1px' }} />
                          <div>
                            <p style={{ margin: 0, fontWeight: 700, color: '#92400E', fontSize: '0.85rem' }}>
                              ⚠ {getCompletedCount()} partido(s) ya terminados se perderán
                            </p>
                            <p style={{ margin: '3px 0 0', color: '#92400E', fontSize: '0.78rem' }}>
                              Los resultados no se pueden recuperar.
                            </p>
                          </div>
                        </div>
                      )}

                      <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', color: '#7F1D1D', lineHeight: 1.5 }}>
                        Se eliminarán <strong>{getMatchCount()} partidos</strong> de{' '}
                        <strong>{drawType === 'rr' ? 'Round Robin' : drawType === 'maindraw' ? 'Main Draw' : 'RR + Main Draw'}</strong>{' '}
                        en <strong>{scopeLabel}</strong>. Acción <strong>irreversible</strong>.
                      </div>

                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
                          style={{ accentColor: '#DC2626', marginTop: '2px', width: '15px', height: '15px', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: '0.825rem', color: '#374151', lineHeight: 1.4 }}>
                          Entiendo que esta acción es <strong>irreversible</strong> y quiero continuar.
                        </span>
                      </label>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {!isLoading && !nothingToDelete && !noMatches && activeSummary && (
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0 }}>
                <button
                  onClick={() => setOpen(false)}
                  style={{ padding: '8px 18px', borderRadius: '6px', border: '1px solid #D1D5DB', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 500 }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={!confirmed || deleteMutation.isPending}
                  style={{
                    padding: '8px 20px', borderRadius: '6px', border: 'none',
                    background: !confirmed || deleteMutation.isPending ? '#FCA5A5' : '#DC2626',
                    color: '#fff', cursor: !confirmed || deleteMutation.isPending ? 'not-allowed' : 'pointer',
                    fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <Trash2 size={14} />
                  {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}