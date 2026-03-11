// ─────────────────────────────────────────────────────────────────────────────
// DeleteDrawButton.tsx
// Botón con modal de confirmación para eliminar Round Robin o Main Draw
//
// USO en TournamentDetail.tsx:
//   import DeleteDrawButton from '../components/DeleteDrawButton';
//
//   // Dentro del tab 'draw', al lado del botón "Generar Draw":
//   <DeleteDrawButton
//     tournamentId={id!}
//     category={selectedCategory}
//     onDeleted={() => {
//       queryClient.invalidateQueries({ queryKey: ['matches', id] });
//       queryClient.invalidateQueries({ queryKey: ['draw-summary', id, selectedCategory] });
//     }}
//   />
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, AlertTriangle, X, ChevronDown } from 'lucide-react';
import api from '../api/axios';

interface DrawSummary {
  hasRR:         boolean;
  hasMainDraw:   boolean;
  rrCount:       number;
  mainCount:     number;
  rrCompleted:   number;
  mainCompleted: number;
}

interface Props {
  tournamentId: string;
  category: string;
  onDeleted?: () => void;
}

export default function DeleteDrawButton({ tournamentId, category, onDeleted }: Props) {
  const [open, setOpen]           = useState(false);
  const [drawType, setDrawType]   = useState<'rr' | 'maindraw' | 'all'>('rr');
  const [confirmed, setConfirmed] = useState(false);
  const queryClient               = useQueryClient();

  // ── Consultar resumen del draw actual ──────────────────────────────────────
  const { data: summary, isLoading: loadingSummary } = useQuery<DrawSummary>({
    queryKey: ['draw-summary', tournamentId, category],
    queryFn: async () => {
      const res = await api.get(`/matches/tournament/${tournamentId}/draw-summary`, {
        params: { category },
      });
      return res.data;
    },
    enabled: !!tournamentId && !!category && open,
  });

  // ── Mutación de eliminación ────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete(`/matches/tournament/${tournamentId}/draw`, {
        params: { category, drawType },
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['draw-summary', tournamentId, category] });
      onDeleted?.();
      setOpen(false);
      setConfirmed(false);
      alert(`✅ ${data.message}`);
    },
    onError: (e: any) => {
      alert(`❌ ${e?.response?.data?.message ?? 'Error al eliminar el draw'}`);
    },
  });

  // ── Si no hay nada para eliminar, no mostrar el botón ─────────────────────
  // (solo verificamos después de que se haya cargado una vez)
  const nothingToDelete = summary && !summary.hasRR && !summary.hasMainDraw;

  // ── Helpers UI ────────────────────────────────────────────────────────────
  function getDrawTypeLabel(type: 'rr' | 'maindraw' | 'all') {
    if (type === 'rr')       return 'Round Robin';
    if (type === 'maindraw') return 'Main Draw (Eliminación)';
    return 'Cuadro Completo (RR + Main Draw)';
  }

  function getMatchCount() {
    if (!summary) return 0;
    if (drawType === 'rr')       return summary.rrCount;
    if (drawType === 'maindraw') return summary.mainCount;
    return summary.rrCount + summary.mainCount;
  }

  function getCompletedCount() {
    if (!summary) return 0;
    if (drawType === 'rr')       return summary.rrCompleted;
    if (drawType === 'maindraw') return summary.mainCompleted;
    return summary.rrCompleted + summary.mainCompleted;
  }

  const hasWarning = getCompletedCount() > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Botón disparador ── */}
      <button
        onClick={() => { setOpen(true); setConfirmed(false); }}
        title="Eliminar cuadro generado"
        style={{
          padding: '0.5rem 1rem',
          borderRadius: '7px',
          border: '1.5px solid #FCA5A5',
          background: '#FEF2F2',
          color: '#DC2626',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = '#FEE2E2';
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#F87171';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = '#FEF2F2';
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#FCA5A5';
        }}
      >
        <Trash2 size={14} />
        Eliminar Cuadro
      </button>

      {/* ── Modal de confirmación ── */}
      {open && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }}>
          <div style={{
            background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '460px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>

            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem', borderBottom: '1px solid #E5E7EB',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{ background: '#FEF2F2', borderRadius: '8px', padding: '0.4rem' }}>
                  <Trash2 size={18} color="#DC2626" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>
                    Eliminar Cuadro
                  </h2>
                  <p style={{ margin: '0.1rem 0 0', fontSize: '0.78rem', color: '#6B7280' }}>
                    Categoría: <strong>{category}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setOpen(false); setConfirmed(false); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '1.5rem' }}>
              {loadingSummary ? (
                <p style={{ color: '#6B7280', textAlign: 'center', padding: '1rem 0' }}>
                  Cargando información del draw...
                </p>
              ) : nothingToDelete ? (
                <div style={{
                  background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px',
                  padding: '1rem', textAlign: 'center',
                }}>
                  <p style={{ color: '#16A34A', fontWeight: 600, margin: 0 }}>
                    ✅ No hay cuadros generados para eliminar en esta categoría
                  </p>
                </div>
              ) : (
                <>
                  {/* Selector de tipo */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.5rem' }}>
                      ¿Qué deseas eliminar?
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {([
                        { value: 'rr',       label: 'Round Robin',                     count: summary?.rrCount ?? 0,   disabled: !summary?.hasRR       },
                        { value: 'maindraw', label: 'Main Draw (Eliminación Directa)', count: summary?.mainCount ?? 0, disabled: !summary?.hasMainDraw },
                        { value: 'all',      label: 'Cuadro Completo (todo)',           count: (summary?.rrCount ?? 0) + (summary?.mainCount ?? 0), disabled: false },
                      ] as const).map(opt => (
                        <label
                          key={opt.value}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.65rem 0.875rem', borderRadius: '8px', cursor: opt.disabled ? 'not-allowed' : 'pointer',
                            border: `1.5px solid ${drawType === opt.value ? '#DC2626' : '#E5E7EB'}`,
                            background: opt.disabled ? '#F9FAFB' : drawType === opt.value ? '#FEF2F2' : '#fff',
                            opacity: opt.disabled ? 0.45 : 1,
                            transition: 'all 0.15s',
                          }}
                        >
                          <input
                            type="radio"
                            name="drawType"
                            value={opt.value}
                            checked={drawType === opt.value}
                            disabled={opt.disabled}
                            onChange={() => { setDrawType(opt.value); setConfirmed(false); }}
                            style={{ accentColor: '#DC2626' }}
                          />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem' }}>
                              {opt.label}
                            </span>
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#6B7280', background: '#F3F4F6', padding: '0.1rem 0.4rem', borderRadius: '9999px' }}>
                              {opt.count} partido{opt.count !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {opt.disabled && (
                            <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>No generado</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Advertencia si hay partidos completados */}
                  {hasWarning && (
                    <div style={{
                      background: '#FFFBEB', border: '1.5px solid #FCD34D', borderRadius: '8px',
                      padding: '0.875rem', marginBottom: '1rem', display: 'flex', gap: '0.625rem', alignItems: 'flex-start',
                    }}>
                      <AlertTriangle size={16} color="#D97706" style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, color: '#92400E', fontSize: '0.85rem' }}>
                          ¡Atención! {getCompletedCount()} partido{getCompletedCount() !== 1 ? 's' : ''} ya terminado{getCompletedCount() !== 1 ? 's' : ''}
                        </p>
                        <p style={{ margin: '0.2rem 0 0', color: '#92400E', fontSize: '0.78rem' }}>
                          Se perderán los resultados y el escalafón no se recalculará automáticamente.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Resumen de lo que se eliminará */}
                  <div style={{
                    background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px',
                    padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#7F1D1D',
                  }}>
                    Se eliminarán permanentemente <strong>{getMatchCount()} partidos</strong> del{' '}
                    <strong>{getDrawTypeLabel(drawType)}</strong> para la categoría{' '}
                    <strong>{category}</strong>. Esta acción no se puede deshacer.
                  </div>

                  {/* Checkbox de confirmación */}
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={e => setConfirmed(e.target.checked)}
                      style={{ accentColor: '#DC2626', marginTop: '0.15rem', width: '15px', height: '15px', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: '0.825rem', color: '#374151', lineHeight: 1.4 }}>
                      Entiendo que esta acción es <strong>irreversible</strong> y que se eliminarán todos los partidos del {getDrawTypeLabel(drawType).toLowerCase()}.
                    </span>
                  </label>
                </>
              )}
            </div>

            {/* Footer */}
            {!nothingToDelete && !loadingSummary && (
              <div style={{
                padding: '1rem 1.5rem', borderTop: '1px solid #E5E7EB',
                display: 'flex', justifyContent: 'flex-end', gap: '0.75rem',
              }}>
                <button
                  onClick={() => { setOpen(false); setConfirmed(false); }}
                  style={{
                    padding: '0.5rem 1.1rem', borderRadius: '6px',
                    border: '1px solid #D1D5DB', background: '#fff',
                    color: '#374151', cursor: 'pointer', fontWeight: 500,
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={!confirmed || deleteMutation.isPending}
                  style={{
                    padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none',
                    background: !confirmed || deleteMutation.isPending ? '#FCA5A5' : '#DC2626',
                    color: '#fff',
                    cursor: !confirmed || deleteMutation.isPending ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    transition: 'background 0.15s',
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