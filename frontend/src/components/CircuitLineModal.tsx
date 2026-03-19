import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { circuitLinesApi } from '../api/circuitLines.api';
import type { CircuitLineItem, CircuitRankingPoints } from '../api/circuitLines.api';

const DEFAULT_POINTS: CircuitRankingPoints = {
  rrWinPoints: 2,
  singles:  { champion: 50, F: 35, SF: 25, QF: 18, R16: 10, R32: 6, R64: 2 },
  doubles:  { champion: 12, F:  8, SF:  6, QF:  4, R16:  2, R32:  0, R64: 0 },
  master:   { champion: 100, F_M: 70, SF_M: 50 },
  merit:    { seed1: 8, seed2: 6, seeds34: 4, seeds58: 2 },
};

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

// ── Points editor subcomponent ───────────────────────────────────────────────
function PointsEditor({ pts, onChange }: { pts: CircuitRankingPoints; onChange: (p: CircuitRankingPoints) => void }) {
  const [open, setOpen] = useState(false);

  function setField(section: string, key: string, value: number) {
    const next = deepClone(pts);
    if (section === 'root') {
      (next as any)[key] = value;
    } else {
      (next as any)[section][key] = value;
    }
    onChange(next);
  }

  const cell = (section: string, key: string) => (
    <input
      type="number"
      min={0}
      value={(section === 'root' ? (pts as any)[key] : (pts as any)[section][key]) ?? 0}
      onChange={e => setField(section, key, Number(e.target.value))}
      style={{
        width: 56, padding: '3px 6px', border: '1px solid #D1D5DB',
        borderRadius: 4, fontSize: 13, textAlign: 'right',
      }}
    />
  );

  return (
    <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden', marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', background: '#F9FAFB', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: '#374151',
        }}
      >
        Sistema de puntos (clic para editar)
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* RR */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#6B7280', width: 180 }}>Puntos por victoria RR</span>
            {cell('root', 'rrWinPoints')}
          </div>

          {/* Rondas */}
          {([
            ['Sencillos', 'singles', ['champion','F','SF','QF','R16','R32','R64']],
            ['Dobles',    'doubles', ['champion','F','SF','QF','R16','R32','R64']],
          ] as [string, string, string[]][]).map(([title, section, keys]) => (
            <div key={section}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{title}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {keys.map(k => (
                  <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {k === 'champion' ? 'Campeón' : k}
                    </span>
                    {cell(section, k)}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Master */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Máster</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {(['champion','F_M','SF_M'] as const).map(k => (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {k === 'champion' ? 'Campeón' : k}
                  </span>
                  {cell('master', k)}
                </div>
              ))}
            </div>
          </div>

          {/* Merit bonuses */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Bonos de méritos (Art. 8)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {([
                ['seed1',   'Siembra 1'],
                ['seed2',   'Siembra 2'],
                ['seeds34', 'Siembras 3-4'],
                ['seeds58', 'Siembras 5-8'],
              ] as [string, string][]).map(([k, label]) => (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</span>
                  {cell('merit', k)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Form state ───────────────────────────────────────────────────────────────
interface FormState {
  slug: string;
  label: string;
  hasRanking: boolean;
  rankingPoints: CircuitRankingPoints;
}

function blankForm(): FormState {
  return { slug: '', label: '', hasRanking: true, rankingPoints: deepClone(DEFAULT_POINTS) };
}

// ── Main modal ───────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
}

export default function CircuitLineModal({ onClose }: Props) {
  const qc = useQueryClient();
  const { data: lines = [] } = useQuery<CircuitLineItem[]>({
    queryKey: ['circuit-lines'],
    queryFn: circuitLinesApi.getAll,
  });

  const [editing, setEditing] = useState<CircuitLineItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm());
  const [error, setError] = useState('');

  const createMut = useMutation({
    mutationFn: () => circuitLinesApi.create({
      slug: form.slug,
      label: form.label,
      rankingPoints: form.hasRanking ? form.rankingPoints : null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['circuit-lines'] }); setCreating(false); setForm(blankForm()); setError(''); },
    onError: (e: any) => setError(e?.response?.data?.message || 'Error al crear'),
  });

  const updateMut = useMutation({
    mutationFn: () => circuitLinesApi.update(editing!.id, {
      label: form.label,
      rankingPoints: form.hasRanking ? form.rankingPoints : null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['circuit-lines'] }); setEditing(null); setError(''); },
    onError: (e: any) => setError(e?.response?.data?.message || 'Error al guardar'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => circuitLinesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['circuit-lines'] }),
    onError: (e: any) => alert(e?.response?.data?.message || 'Error al eliminar'),
  });

  function startEdit(line: CircuitLineItem) {
    setEditing(line);
    setCreating(false);
    setForm({
      slug: line.slug,
      label: line.label,
      hasRanking: line.rankingPoints !== null,
      rankingPoints: deepClone(line.rankingPoints ?? DEFAULT_POINTS),
    });
    setError('');
  }

  function startCreate() {
    setCreating(true);
    setEditing(null);
    setForm(blankForm());
    setError('');
  }

  function handleLabelChange(label: string) {
    setForm(f => ({
      ...f,
      label,
      slug: editing ? f.slug : slugify(label),
    }));
  }

  const isSubmitting = createMut.isPending || updateMut.isPending;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: '100%', maxWidth: 680,
        maxHeight: '90vh', overflow: 'auto', padding: 28, position: 'relative',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
            Líneas de Circuito
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {lines.map(line => (
            <div key={line.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8,
              background: editing?.id === line.id ? '#EFF6FF' : '#F9FAFB',
            }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{line.label}</span>
                <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 8 }}>{line.slug}</span>
                {line.isDefault && (
                  <span style={{
                    fontSize: 11, background: '#DBEAFE', color: '#1D4ED8',
                    borderRadius: 4, padding: '1px 6px', marginLeft: 6,
                  }}>
                    LAT
                  </span>
                )}
                {line.rankingPoints === null && (
                  <span style={{
                    fontSize: 11, background: '#FEF3C7', color: '#92400E',
                    borderRadius: 4, padding: '1px 6px', marginLeft: 6,
                  }}>
                    Sin ranking
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => startEdit(line)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1' }}
                  title="Editar puntos"
                >
                  <Pencil size={15} />
                </button>
                {!line.isDefault && (
                  <button
                    onClick={() => { if (confirm(`¿Eliminar "${line.label}"?`)) deleteMut.mutate(line.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}
                    title="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Create / Edit form */}
        {(creating || editing) && (
          <div style={{
            border: '1px solid #C7D2FE', borderRadius: 8, padding: 16,
            background: '#F5F3FF', marginBottom: 12,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#4338CA', marginBottom: 10 }}>
              {editing ? `Editar: ${editing.label}` : 'Nueva línea de circuito'}
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: '#6B7280', display: 'block', marginBottom: 3 }}>
                  Nombre
                </label>
                <input
                  value={form.label}
                  onChange={e => handleLabelChange(e.target.value)}
                  placeholder="Ej: Copa Ciudad"
                  style={{
                    width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB',
                    borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
                  }}
                />
              </div>
              {!editing && (
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: '#6B7280', display: 'block', marginBottom: 3 }}>
                    Slug (identificador)
                  </label>
                  <input
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                    placeholder="copa_ciudad"
                    style={{
                      width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB',
                      borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Toggle ranking */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', borderRadius: 8, marginTop: 4,
              background: form.hasRanking ? '#F0FDF4' : '#FEF3C7',
              border: `1px solid ${form.hasRanking ? '#86EFAC' : '#FCD34D'}`,
            }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: form.hasRanking ? '#15803D' : '#92400E' }}>
                  {form.hasRanking ? 'Con sistema de ranking' : 'Sin sistema de ranking'}
                </span>
                <span style={{ fontSize: 11, color: '#6B7280', display: 'block', marginTop: 1 }}>
                  {form.hasRanking
                    ? 'Los torneos de este circuito acumulan puntos en el escalafón'
                    : 'Los torneos de este circuito no generan puntos de ranking'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, hasRanking: !f.hasRanking }))}
                style={{
                  width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer',
                  position: 'relative', flexShrink: 0,
                  background: form.hasRanking ? '#22C55E' : '#D1D5DB',
                  transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3,
                  left: form.hasRanking ? 22 : 3,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s', display: 'block',
                }} />
              </button>
            </div>

            {form.hasRanking && (
              <PointsEditor
                pts={form.rankingPoints}
                onChange={rankingPoints => setForm(f => ({ ...f, rankingPoints }))}
              />
            )}

            {error && (
              <div style={{ color: '#EF4444', fontSize: 12, marginTop: 8 }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setCreating(false); setEditing(null); setError(''); }}
                style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontSize: 13 }}
              >
                Cancelar
              </button>
              <button
                disabled={isSubmitting || !form.label.trim() || (!editing && !form.slug.trim())}
                onClick={() => editing ? updateMut.mutate() : createMut.mutate()}
                style={{
                  padding: '7px 16px', borderRadius: 6, border: 'none',
                  background: isSubmitting ? '#A5B4FC' : '#4F46E5',
                  color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                {isSubmitting ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear'}
              </button>
            </div>
          </div>
        )}

        {/* Add button */}
        {!creating && !editing && (
          <button
            onClick={startCreate}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              border: '2px dashed #C7D2FE', background: '#F5F3FF',
              color: '#4338CA', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              width: '100%', justifyContent: 'center',
            }}
          >
            <Plus size={16} /> Nueva línea de circuito
          </button>
        )}
      </div>
    </div>
  );
}
