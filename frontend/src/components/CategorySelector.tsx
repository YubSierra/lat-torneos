// frontend/src/components/CategorySelector.tsx
// Selector de categorías para el formulario de creación/edición de torneos
// - Muestra categorías LAT predefinidas
// - Permite selección múltiple con toggle
// - Permite crear categorías personalizadas con nombre + descripción opcional
// - Se puede reutilizar en cualquier formulario del proyecto

import { useState } from 'react';
import { Plus, X, Tag, ChevronDown, ChevronUp } from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────────────────
export interface TournamentCategory {
  name: string;
  description?: string;
  isDefault: boolean;
}

interface CategorySelectorProps {
  selected: TournamentCategory[];
  onChange: (categories: TournamentCategory[]) => void;
}

// ── Categorías LAT predefinidas (Art. 9 reglamento) ───────────────────────
const DEFAULT_CATEGORIES: TournamentCategory[] = [
  {
    name: 'INTERMEDIA',
    description: 'Jugadores posición 1–100 del escalafón departamental',
    isDefault: true,
  },
  {
    name: 'SEGUNDA',
    description: 'Jugadores posición 101–200 del escalafón departamental',
    isDefault: true,
  },
  {
    name: 'TERCERA',
    description: 'Jugadores posición 201–400 del escalafón departamental',
    isDefault: true,
  },
  {
    name: 'CUARTA',
    description: 'Jugadores posición 401–700 del escalafón departamental',
    isDefault: true,
  },
  {
    name: 'QUINTA',
    description: 'Jugadores posición 701 en adelante o sin escalafón',
    isDefault: true,
  },
];

// Colores para las categorías (para darle identidad visual)
const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  INTERMEDIA: { bg: '#FFF7ED', border: '#FDBA74', text: '#C2410C', dot: '#F97316' },
  SEGUNDA:    { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', dot: '#F59E0B' },
  TERCERA:    { bg: '#F0FDF4', border: '#86EFAC', text: '#15803D', dot: '#22C55E' },
  CUARTA:     { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', dot: '#3B82F6' },
  QUINTA:     { bg: '#F5F3FF', border: '#C4B5FD', text: '#6D28D9', dot: '#8B5CF6' },
};

const DEFAULT_COLOR = { bg: '#F9FAFB', border: '#E5E7EB', text: '#374151', dot: '#9CA3AF' };

// ── Componente ─────────────────────────────────────────────────────────────
export default function CategorySelector({ selected, onChange }: CategorySelectorProps) {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName]         = useState('');
  const [customDesc, setCustomDesc]         = useState('');
  const [customError, setCustomError]       = useState('');
  const [expandedDesc, setExpandedDesc]     = useState<string | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const isSelected = (name: string) => selected.some(s => s.name === name);

  const toggleDefault = (cat: TournamentCategory) => {
    if (isSelected(cat.name)) {
      onChange(selected.filter(s => s.name !== cat.name));
    } else {
      onChange([...selected, cat]);
    }
  };

  const removeCategory = (name: string) => {
    onChange(selected.filter(s => s.name !== name));
  };

  const handleAddCustom = () => {
    const trimmed = customName.trim().toUpperCase();
    if (!trimmed) { setCustomError('El nombre es obligatorio'); return; }
    if (trimmed.length < 2) { setCustomError('El nombre debe tener al menos 2 caracteres'); return; }
    if (selected.some(s => s.name === trimmed)) {
      setCustomError('Ya existe una categoría con ese nombre');
      return;
    }
    const newCat: TournamentCategory = {
      name: trimmed,
      description: customDesc.trim() || undefined,
      isDefault: false,
    };
    onChange([...selected, newCat]);
    setCustomName('');
    setCustomDesc('');
    setCustomError('');
    setShowCustomForm(false);
  };

  const colorFor = (name: string) => CATEGORY_COLORS[name] || DEFAULT_COLOR;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Seleccionadas (chips en la parte superior) ── */}
      {selected.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '8px',
          marginBottom: '14px',
        }}>
          {selected.map(cat => {
            const c = colorFor(cat.name);
            return (
              <div
                key={cat.name}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  backgroundColor: c.bg, border: `1.5px solid ${c.border}`,
                  borderRadius: '999px', padding: '4px 10px 4px 8px',
                }}
              >
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  backgroundColor: c.dot, flexShrink: 0,
                }} />
                <span style={{ fontSize: '12px', fontWeight: '600', color: c.text }}>
                  {cat.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeCategory(cat.name)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0', display: 'flex', color: c.text, opacity: 0.6,
                    marginLeft: '2px',
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Categorías predefinidas ── */}
      <div style={{ marginBottom: '12px' }}>
        <p style={{
          fontSize: '11px', fontWeight: '600', color: '#9CA3AF',
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px',
        }}>
          Categorías LAT (reglamento)
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {DEFAULT_CATEGORIES.map(cat => {
            const selected_ = isSelected(cat.name);
            const c = colorFor(cat.name);
            const isExpanded = expandedDesc === cat.name;

            return (
              <div
                key={cat.name}
                style={{
                  borderRadius: '10px', overflow: 'hidden',
                  border: selected_ ? `2px solid ${c.border}` : '1.5px solid #E5E7EB',
                  backgroundColor: selected_ ? c.bg : 'white',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '10px 12px', gap: '10px',
                }}>
                  {/* Checkbox custom */}
                  <button
                    type="button"
                    onClick={() => toggleDefault(cat)}
                    style={{
                      width: '20px', height: '20px', borderRadius: '6px',
                      border: selected_ ? `2px solid ${c.dot}` : '2px solid #D1D5DB',
                      backgroundColor: selected_ ? c.dot : 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
                    }}
                  >
                    {selected_ && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  {/* Nombre y descripción */}
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleDefault(cat)}>
                    <span style={{
                      fontSize: '13px', fontWeight: '700',
                      color: selected_ ? c.text : '#1F2937',
                    }}>
                      {cat.name}
                    </span>
                  </div>

                  {/* Botón expandir descripción */}
                  <button
                    type="button"
                    onClick={() => setExpandedDesc(isExpanded ? null : cat.name)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#9CA3AF', padding: '2px', display: 'flex',
                    }}
                    title="Ver descripción"
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {/* Descripción expandida */}
                {isExpanded && (
                  <div style={{
                    padding: '0 12px 10px 42px',
                    fontSize: '12px', color: '#6B7280', lineHeight: '1.5',
                  }}>
                    {cat.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Categorías custom ya creadas ── */}
      {selected.filter(s => !s.isDefault).length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <p style={{
            fontSize: '11px', fontWeight: '600', color: '#9CA3AF',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px',
          }}>
            Categorías personalizadas
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {selected.filter(s => !s.isDefault).map(cat => (
              <div key={cat.name} style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                border: '1.5px solid #D1D5DB', borderRadius: '10px',
                padding: '10px 12px', backgroundColor: '#FAFAFA',
              }}>
                <Tag size={14} color="#6B7280" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#1F2937' }}>
                    {cat.name}
                  </p>
                  {cat.description && (
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6B7280' }}>
                      {cat.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeCategory(cat.name)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#EF4444', padding: '2px',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Botón / formulario nueva categoría ── */}
      {!showCustomForm ? (
        <button
          type="button"
          onClick={() => setShowCustomForm(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            width: '100%', padding: '10px 14px',
            border: '1.5px dashed #D1D5DB', borderRadius: '10px',
            backgroundColor: 'white', color: '#6B7280',
            cursor: 'pointer', fontSize: '13px', fontWeight: '500',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#2D6A2D';
            (e.currentTarget as HTMLButtonElement).style.color = '#2D6A2D';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#D1D5DB';
            (e.currentTarget as HTMLButtonElement).style.color = '#6B7280';
          }}
        >
          <Plus size={15} />
          Crear categoría personalizada
        </button>
      ) : (
        <div style={{
          border: '1.5px solid #2D6A2D', borderRadius: '12px',
          padding: '14px', backgroundColor: '#F0FDF4',
        }}>
          <p style={{
            fontSize: '12px', fontWeight: '700', color: '#15803D',
            marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            Nueva categoría personalizada
          </p>

          <div style={{ marginBottom: '10px' }}>
            <label style={labelStyle}>
              Nombre de la categoría <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              value={customName}
              onChange={e => { setCustomName(e.target.value.toUpperCase()); setCustomError(''); }}
              placeholder="Ej: OPEN, MASTERS 40, NOVATOS..."
              maxLength={40}
              style={{
                ...inputStyle,
                borderColor: customError ? '#EF4444' : '#D1D5DB',
              }}
            />
            {customError && (
              <p style={{ fontSize: '11px', color: '#EF4444', margin: '4px 0 0' }}>
                ⚠️ {customError}
              </p>
            )}
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>
              Descripción{' '}
              <span style={{ color: '#9CA3AF', fontWeight: '400' }}>(opcional)</span>
            </label>
            <textarea
              value={customDesc}
              onChange={e => setCustomDesc(e.target.value)}
              placeholder="Ej: Para jugadores mayores de 40 años con ranking activo..."
              rows={2}
              style={{ ...inputStyle, resize: 'none', lineHeight: '1.5' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => { setShowCustomForm(false); setCustomName(''); setCustomDesc(''); setCustomError(''); }}
              style={{
                flex: 1, padding: '8px', borderRadius: '8px',
                border: '1.5px solid #D1D5DB', backgroundColor: 'white',
                color: '#374151', fontWeight: '600', fontSize: '13px', cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAddCustom}
              style={{
                flex: 2, padding: '8px', borderRadius: '8px', border: 'none',
                background: 'linear-gradient(135deg, #2D6A2D, #1B3A1B)',
                color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
              }}
            >
              + Agregar categoría
            </button>
          </div>
        </div>
      )}

      {/* ── Mensaje vacío ── */}
      {selected.length === 0 && !showCustomForm && (
        <p style={{
          fontSize: '12px', color: '#F97316',
          marginTop: '8px', textAlign: 'center',
        }}>
          ⚠️ Selecciona al menos una categoría para el torneo
        </p>
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
  width: '100%', padding: '8px 12px',
  borderRadius: '8px', border: '1.5px solid #D1D5DB',
  fontSize: '13px', color: '#111827',
  backgroundColor: 'white', boxSizing: 'border-box',
};
