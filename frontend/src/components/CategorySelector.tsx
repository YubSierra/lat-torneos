// frontend/src/components/CategorySelector.tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { circuitLinesApi } from '../api/circuitLines.api';
import type { CircuitLineItem } from '../api/circuitLines.api';

// ── Tipos ──────────────────────────────────────────────────────────────────
export interface TournamentCategory {
  name: string;
  description?: string;
  isDefault: boolean;
}

// Detecta si un nombre de categoría tiene sufijo de rama (" M" / " F")
export function parseCategoryBranch(name: string): { base: string; branch: 'M' | 'F' | null } {
  if (name.endsWith(' M')) return { base: name.slice(0, -2), branch: 'M' };
  if (name.endsWith(' F')) return { base: name.slice(0, -2), branch: 'F' };
  return { base: name, branch: null };
}

interface CategorySelectorProps {
  selected: TournamentCategory[];
  onChange: (categories: TournamentCategory[]) => void;
  /** Pass the currently selected circuit line to enable shared categories */
  circuitLine?: CircuitLineItem | null;
}

// ── Categorías LAT predefinidas (Art. 9 reglamento) ───────────────────────
const DEFAULT_CATEGORIES: TournamentCategory[] = [
  { name: 'INTERMEDIA', description: 'Jugadores posición 1–100 del escalafón departamental',   isDefault: true },
  { name: 'SEGUNDA',    description: 'Jugadores posición 101–200 del escalafón departamental', isDefault: true },
  { name: 'TERCERA',    description: 'Jugadores posición 201–400 del escalafón departamental', isDefault: true },
  { name: 'CUARTA',     description: 'Jugadores posición 401–700 del escalafón departamental', isDefault: true },
  { name: 'QUINTA',     description: 'Jugadores posición 701 en adelante o sin escalafón',     isDefault: true },
  { name: '10 AÑOS',    description: 'Categoría infantil hasta 10 años de edad',               isDefault: true },
];

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  INTERMEDIA: { bg: '#FFF7ED', border: '#FDBA74', text: '#C2410C', dot: '#F97316' },
  SEGUNDA:    { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', dot: '#F59E0B' },
  TERCERA:    { bg: '#F0FDF4', border: '#86EFAC', text: '#15803D', dot: '#22C55E' },
  CUARTA:     { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', dot: '#3B82F6' },
  QUINTA:     { bg: '#F5F3FF', border: '#C4B5FD', text: '#6D28D9', dot: '#8B5CF6' },
  '10 AÑOS':  { bg: '#FDF2F8', border: '#F9A8D4', text: '#9D174D', dot: '#EC4899' },
};

const DEFAULT_COLOR = { bg: '#F9FAFB', border: '#E5E7EB', text: '#374151', dot: '#9CA3AF' };

type GenderMode = 'none' | 'M' | 'F' | 'both';

// ── Componente ─────────────────────────────────────────────────────────────
export default function CategorySelector({ selected, onChange, circuitLine }: CategorySelectorProps) {
  const qc = useQueryClient();
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName]         = useState('');
  const [customDesc, setCustomDesc]         = useState('');
  const [customError, setCustomError]       = useState('');
  const [genderMode, setGenderMode]         = useState<GenderMode>('none');
  const [saveToCircuit, setSaveToCircuit]   = useState(false);
  const [expandedDesc, setExpandedDesc]     = useState<string | null>(null);

  const saveCatMut = useMutation({
    mutationFn: ({ slug, cat }: { slug: string; cat: string }) =>
      circuitLinesApi.addCategory(slug, cat),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['circuit-lines'] }),
  });

  const removeCatMut = useMutation({
    mutationFn: ({ slug, cat }: { slug: string; cat: string }) =>
      circuitLinesApi.removeCategory(slug, cat),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['circuit-lines'] }),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────
  const isSelected = (name: string) => selected.some(s => s.name === name);

  const isSplitSelected = (baseName: string) =>
    isSelected(`${baseName} M`) && isSelected(`${baseName} F`);

  const toggleDefault = (cat: TournamentCategory) => {
    if (isSelected(cat.name)) {
      onChange(selected.filter(s => s.name !== cat.name));
    } else {
      const hasSplit = isSelected(`${cat.name} M`) || isSelected(`${cat.name} F`);
      if (!hasSplit) onChange([...selected, cat]);
    }
  };

  const splitByGender = (cat: TournamentCategory) => {
    const withoutMixed = selected.filter(s => s.name !== cat.name);
    const toAdd: TournamentCategory[] = [];
    if (!isSelected(`${cat.name} M`))
      toAdd.push({ name: `${cat.name} M`, description: `${cat.description || cat.name} — Masculino`, isDefault: cat.isDefault });
    if (!isSelected(`${cat.name} F`))
      toAdd.push({ name: `${cat.name} F`, description: `${cat.description || cat.name} — Femenino`, isDefault: cat.isDefault });
    onChange([...withoutMixed, ...toAdd]);
  };

  const removeCategory = (name: string) => onChange(selected.filter(s => s.name !== name));

  const handleAddCustom = () => {
    const trimmed = customName.trim().toUpperCase();
    if (!trimmed) { setCustomError('El nombre es obligatorio'); return; }
    if (trimmed.length < 2) { setCustomError('Mínimo 2 caracteres'); return; }

    // Build the names to add based on gender mode
    const namesToAdd: string[] =
      genderMode === 'both' ? [`${trimmed} M`, `${trimmed} F`] :
      genderMode === 'M'    ? [`${trimmed} M`] :
      genderMode === 'F'    ? [`${trimmed} F`] :
      [trimmed];

    const alreadyExists = namesToAdd.some(n => selected.some(s => s.name === n));
    if (alreadyExists) { setCustomError('Ya existe una categoría con ese nombre'); return; }

    const newCats: TournamentCategory[] = namesToAdd.map(n => ({
      name: n,
      description: customDesc.trim() || undefined,
      isDefault: false,
    }));

    onChange([...selected, ...newCats]);

    // Save to circuit line if requested
    if (saveToCircuit && circuitLine) {
      namesToAdd.forEach(cat => saveCatMut.mutate({ slug: circuitLine.slug, cat }));
    }

    setCustomName(''); setCustomDesc(''); setCustomError('');
    setGenderMode('none'); setSaveToCircuit(false);
    setShowCustomForm(false);
  };

  const colorFor = (name: string) => {
    const { base } = parseCategoryBranch(name);
    return CATEGORY_COLORS[base] || DEFAULT_COLOR;
  };

  // Circuit line custom categories (excluding LAT defaults)
  const sharedCats: TournamentCategory[] = (circuitLine?.customCategories ?? []).map(n => ({
    name: n,
    isDefault: false,
  }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Chips seleccionadas ── */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {selected.map(cat => {
            const { base, branch } = parseCategoryBranch(cat.name);
            const c = colorFor(cat.name);
            return (
              <div key={cat.name} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                backgroundColor: c.bg, border: `1.5px solid ${c.border}`,
                borderRadius: 999, padding: '4px 10px 4px 8px',
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  backgroundColor: branch === 'M' ? '#3B82F6' : branch === 'F' ? '#EC4899' : c.dot,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: c.text }}>{base}</span>
                {branch && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                    backgroundColor: branch === 'M' ? '#DBEAFE' : '#FCE7F3',
                    color: branch === 'M' ? '#1D4ED8' : '#BE185D',
                  }}>
                    {branch === 'M' ? '♂ M' : '♀ F'}
                  </span>
                )}
                <button type="button" onClick={() => removeCategory(cat.name)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: c.text, opacity: 0.6, marginLeft: 2 }}>
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Categorías predefinidas ── */}
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          Categorías (reglamento)
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {DEFAULT_CATEGORIES.map(cat => {
            const sel = isSelected(cat.name);
            const c = colorFor(cat.name);
            const isExpanded = expandedDesc === cat.name;
            return (
              <div key={cat.name} style={{
                borderRadius: 10, overflow: 'hidden',
                border: sel ? `2px solid ${c.border}` : '1.5px solid #E5E7EB',
                backgroundColor: sel ? c.bg : 'white', transition: 'all 0.15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', gap: 10 }}>
                  <button type="button" onClick={() => toggleDefault(cat)} style={{
                    width: 20, height: 20, borderRadius: 6,
                    border: sel ? `2px solid ${c.dot}` : '2px solid #D1D5DB',
                    backgroundColor: sel ? c.dot : 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
                  }}>
                    {sel && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </button>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleDefault(cat)}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: sel ? c.text : '#1F2937' }}>{cat.name}</span>
                    {isSplitSelected(cat.name) && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: '#6B7280' }}>♂ M + ♀ F</span>
                    )}
                  </div>
                  <button type="button" title="Separar por género" onClick={() => splitByGender(cat)} style={{
                    background: 'none', border: '1px solid #E5E7EB', cursor: 'pointer',
                    borderRadius: 6, padding: '3px 7px', fontSize: 10,
                    color: isSplitSelected(cat.name) ? '#1D4ED8' : '#6B7280',
                    fontWeight: 600, whiteSpace: 'nowrap',
                    backgroundColor: isSplitSelected(cat.name) ? '#DBEAFE' : 'white',
                  }}>♂♀</button>
                  <button type="button" onClick={() => setExpandedDesc(isExpanded ? null : cat.name)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2, display: 'flex',
                  }}>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
                {isExpanded && (
                  <div style={{ padding: '0 12px 10px 42px', fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                    {cat.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Categorías compartidas del circuito ── */}
      {sharedCats.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Categorías de {circuitLine!.label}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sharedCats.map(cat => {
              const { base, branch } = parseCategoryBranch(cat.name);
              const sel = isSelected(cat.name);
              return (
                <div key={cat.name} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  border: sel ? '2px solid #C7D2FE' : '1.5px solid #E5E7EB',
                  borderRadius: 10, padding: '10px 12px',
                  backgroundColor: sel ? '#EEF2FF' : 'white', transition: 'all 0.15s',
                }}>
                  <button type="button" onClick={() => toggleDefault(cat)} style={{
                    width: 20, height: 20, borderRadius: 6,
                    border: sel ? '2px solid #6366F1' : '2px solid #D1D5DB',
                    backgroundColor: sel ? '#6366F1' : 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0,
                  }}>
                    {sel && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </button>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleDefault(cat)}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: sel ? '#4338CA' : '#1F2937' }}>{base}</span>
                    {branch && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, marginLeft: 6, padding: '1px 5px', borderRadius: 4,
                        backgroundColor: branch === 'M' ? '#DBEAFE' : '#FCE7F3',
                        color: branch === 'M' ? '#1D4ED8' : '#BE185D',
                      }}>
                        {branch === 'M' ? '♂ M' : '♀ F'}
                      </span>
                    )}
                  </div>
                  {/* También puede separar por género si no tiene sufijo */}
                  {!branch && (
                    <button type="button" title="Separar por género" onClick={() => splitByGender(cat)} style={{
                      background: 'none', border: '1px solid #E5E7EB', cursor: 'pointer',
                      borderRadius: 6, padding: '3px 7px', fontSize: 10, color: '#6B7280', fontWeight: 600,
                    }}>♂♀</button>
                  )}
                  <button
                    type="button"
                    title="Eliminar del circuito"
                    onClick={() => removeCatMut.mutate({ slug: circuitLine!.slug, cat: cat.name })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 2, display: 'flex', opacity: 0.6 }}
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Categorías custom ya añadidas en este torneo (no guardadas en circuito) ── */}
      {selected.filter(s => !s.isDefault && !sharedCats.some(sc => sc.name === s.name)).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Categorías personalizadas (solo este torneo)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {selected.filter(s => !s.isDefault && !sharedCats.some(sc => sc.name === s.name)).map(cat => {
              const { base, branch } = parseCategoryBranch(cat.name);
              return (
                <div key={cat.name} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  border: '1.5px solid #D1D5DB', borderRadius: 10,
                  padding: '10px 12px', backgroundColor: '#FAFAFA',
                }}>
                  <Tag size={14} color="#6B7280" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1F2937' }}>
                      {base}
                      {branch && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, marginLeft: 6, padding: '1px 5px', borderRadius: 4,
                          backgroundColor: branch === 'M' ? '#DBEAFE' : '#FCE7F3',
                          color: branch === 'M' ? '#1D4ED8' : '#BE185D',
                        }}>
                          {branch === 'M' ? '♂ M' : '♀ F'}
                        </span>
                      )}
                    </p>
                    {cat.description && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7280' }}>{cat.description}</p>}
                  </div>
                  <button type="button" onClick={() => removeCategory(cat.name)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 2 }}>
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Botón / formulario nueva categoría ── */}
      {!showCustomForm ? (
        <button type="button" onClick={() => setShowCustomForm(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', padding: '10px 14px',
          border: '1.5px dashed #D1D5DB', borderRadius: 10,
          backgroundColor: 'white', color: '#6B7280',
          cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
        }}>
          <Plus size={15} /> Crear categoría personalizada
        </button>
      ) : (
        <div style={{ border: '1.5px solid #2D6A2D', borderRadius: 12, padding: 14, backgroundColor: '#F0FDF4' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#15803D', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Nueva categoría personalizada
          </p>

          {/* Nombre */}
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Nombre <span style={{ color: '#EF4444' }}>*</span></label>
            <input
              type="text"
              value={customName}
              onChange={e => { setCustomName(e.target.value.toUpperCase()); setCustomError(''); }}
              placeholder="Ej: OPEN, MASTERS 40, NOVATOS..."
              maxLength={40}
              style={{ ...inputStyle, borderColor: customError ? '#EF4444' : '#D1D5DB' }}
            />
            {customError && <p style={{ fontSize: 11, color: '#EF4444', margin: '4px 0 0' }}>⚠️ {customError}</p>}
          </div>

          {/* Género */}
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Género</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {([
                ['none', 'Sin género'],
                ['M',    '♂ Masculino'],
                ['F',    '♀ Femenino'],
                ['both', '♂♀ Ambos'],
              ] as [GenderMode, string][]).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setGenderMode(val)}
                  style={{
                    padding: '5px 10px', borderRadius: 7, fontSize: 12,
                    cursor: 'pointer', fontWeight: genderMode === val ? 700 : 500,
                    border: genderMode === val ? '2px solid #2D6A2D' : '1.5px solid #D1D5DB',
                    background: genderMode === val ? '#DCFCE7' : '#fff',
                    color: genderMode === val ? '#15803D' : '#374151',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Descripción */}
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Descripción <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(opcional)</span></label>
            <textarea
              value={customDesc}
              onChange={e => setCustomDesc(e.target.value)}
              placeholder="Ej: Para jugadores mayores de 40 años..."
              rows={2}
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
            />
          </div>

          {/* Guardar en circuito */}
          {circuitLine && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
              padding: '8px 10px', borderRadius: 8,
              background: saveToCircuit ? '#EEF2FF' : '#F9FAFB',
              border: `1px solid ${saveToCircuit ? '#C7D2FE' : '#E5E7EB'}`,
            }}>
              <button
                type="button"
                onClick={() => setSaveToCircuit(v => !v)}
                style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                  border: saveToCircuit ? '2px solid #6366F1' : '2px solid #D1D5DB',
                  backgroundColor: saveToCircuit ? '#6366F1' : 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                {saveToCircuit && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </button>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: saveToCircuit ? '#4338CA' : '#374151' }}>
                  Guardar en {circuitLine.label}
                </span>
                <span style={{ fontSize: 11, color: '#6B7280', display: 'block' }}>
                  Disponible para reutilizar en futuros torneos de este circuito
                </span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button"
              onClick={() => { setShowCustomForm(false); setCustomName(''); setCustomDesc(''); setCustomError(''); setGenderMode('none'); setSaveToCircuit(false); }}
              style={{ flex: 1, padding: 8, borderRadius: 8, border: '1.5px solid #D1D5DB', backgroundColor: 'white', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="button" onClick={handleAddCustom}
              style={{ flex: 2, padding: 8, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #2D6A2D, #1B3A1B)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              + Agregar categoría
            </button>
          </div>
        </div>
      )}

      {selected.length === 0 && !showCustomForm && (
        <p style={{ fontSize: 12, color: '#F97316', marginTop: 8, textAlign: 'center' }}>
          ⚠️ Selecciona al menos una categoría para el torneo
        </p>
      )}
    </div>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #D1D5DB',
  fontSize: 13, color: '#111827', backgroundColor: 'white', boxSizing: 'border-box',
};
