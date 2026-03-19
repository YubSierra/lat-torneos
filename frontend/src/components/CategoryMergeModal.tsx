// Permite al admin unificar dos categorías cuando una tiene muy pocos inscritos.
// Mueve todas las inscripciones (singles) o parejas (dobles) de la categoría origen → destino.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitMerge, AlertTriangle, X } from 'lucide-react';
import { tournamentsApi } from '../api/tournaments.api';
import api from '../api/axios';
import { parseCategoryBranch } from './CategorySelector';

interface Props {
  tournamentId: string;
  categories: string[];
  onClose: () => void;
}

export default function CategoryMergeModal({ tournamentId, categories, onClose }: Props) {
  const queryClient = useQueryClient();
  const [modality, setModality] = useState<'singles' | 'doubles'>('singles');
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');
  const [done, setDone] = useState<{ moved: number; from: string; to: string } | null>(null);

  // Conteo de inscritos singles por categoría
  const { data: singlesCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ['cat-counts-singles', tournamentId],
    queryFn: async () => {
      const res = await api.get(`/enrollments/tournament/${tournamentId}`);
      const enrollments: any[] = res.data || [];
      const map: Record<string, number> = {};
      for (const e of enrollments) {
        if (e.status === 'approved' || e.status === 'reserved') {
          map[e.category] = (map[e.category] || 0) + 1;
        }
      }
      return map;
    },
    enabled: !!tournamentId,
  });

  // Conteo de parejas de dobles por categoría
  const { data: doublesCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ['cat-counts-doubles', tournamentId],
    queryFn: async () => {
      const res = await api.get(`/doubles/tournament/${tournamentId}`);
      const teams: any[] = res.data || [];
      const map: Record<string, number> = {};
      for (const t of teams) {
        map[t.category] = (map[t.category] || 0) + 1;
      }
      return map;
    },
    enabled: !!tournamentId,
  });

  const counts = modality === 'singles' ? singlesCounts : doublesCounts;

  const mergeMutation = useMutation({
    mutationFn: () =>
      modality === 'singles'
        ? tournamentsApi.mergeCategories(tournamentId, from, to)
        : api.post(`/doubles/tournament/${tournamentId}/merge-categories`, { from, to }).then(r => r.data),
    onSuccess: (data: any) => {
      setDone(data);
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['enrollments', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['cat-counts-singles', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['cat-counts-doubles', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['doubles-teams', tournamentId] });
    },
  });

  const canMerge = from && to && from !== to;

  function catLabel(name: string) {
    const { base, branch } = parseCategoryBranch(name);
    const count = counts[name] ?? 0;
    const unit = modality === 'doubles' ? 'pareja(s)' : 'inscrito(s)';
    return `${base}${branch ? ` ${branch === 'M' ? '♂ Masculino' : '♀ Femenino'}` : ''} (${count} ${unit})`;
  }

  // Al cambiar modalidad, limpiar selección
  function switchModality(m: 'singles' | 'doubles') {
    setModality(m);
    setFrom('');
    setTo('');
    setDone(null);
    mergeMutation.reset();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 70, padding: '16px',
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '18px', padding: '28px',
        width: '100%', maxWidth: '480px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <GitMerge size={20} color="#1B3A1B" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#1B3A1B' }}>
              Unificar categorías
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
            <X size={18} />
          </button>
        </div>

        {/* Toggle Singles / Dobles */}
        <div style={{ display: 'flex', backgroundColor: '#F3F4F6', borderRadius: '10px', padding: '3px', marginBottom: '20px' }}>
          {(['singles', 'doubles'] as const).map(m => (
            <button
              key={m}
              onClick={() => switchModality(m)}
              style={{
                flex: 1, padding: '7px', borderRadius: '8px', border: 'none',
                cursor: 'pointer', fontSize: '13px', fontWeight: '700',
                backgroundColor: modality === m ? 'white' : 'transparent',
                color: modality === m ? '#1B3A1B' : '#6B7280',
                boxShadow: modality === m ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {m === 'singles' ? '🎾 Singles' : '🤝 Dobles'}
            </button>
          ))}
        </div>

        {done ? (
          /* Resultado */
          <div>
            <div style={{ backgroundColor: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#15803D' }}>
                ✅ {done.moved} {modality === 'doubles' ? 'pareja(s)' : 'inscripción(es)'} movida(s) de<br />
                <strong>"{done.from}"</strong> → <strong>"{done.to}"</strong>
              </p>
              {modality === 'singles' && (
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#166534' }}>
                  La categoría "{done.from}" fue eliminada del torneo.
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                width: '100%', padding: '11px', borderRadius: '9px', border: 'none',
                background: 'linear-gradient(135deg, #1B3A1B 0%, #2D6A2D 100%)',
                color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
              {modality === 'singles'
                ? 'Mueve todos los inscritos de una categoría a otra. La categoría origen será eliminada. Solo es posible si aún no se generó el cuadro para esa categoría.'
                : 'Mueve todas las parejas de dobles de una categoría a otra. Solo es posible si aún no se generaron cuadros de dobles para esa categoría.'}
            </p>

            {/* Selector origen */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '5px' }}>
                Categoría a eliminar (origen)
              </label>
              <select
                value={from}
                onChange={e => setFrom(e.target.value)}
                style={{ width: '100%', border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', outline: 'none' }}
              >
                <option value="">Selecciona una categoría...</option>
                {categories.filter(c => c !== to).map(c => (
                  <option key={c} value={c}>{catLabel(c)}</option>
                ))}
              </select>
            </div>

            {/* Selector destino */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '5px' }}>
                Categoría destino (permanece)
              </label>
              <select
                value={to}
                onChange={e => setTo(e.target.value)}
                style={{ width: '100%', border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', outline: 'none' }}
              >
                <option value="">Selecciona una categoría...</option>
                {categories.filter(c => c !== from).map(c => (
                  <option key={c} value={c}>{catLabel(c)}</option>
                ))}
              </select>
            </div>

            {/* Preview / advertencia */}
            {canMerge && (
              <div style={{ backgroundColor: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: '10px', padding: '12px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <AlertTriangle size={14} color="#92400E" style={{ marginTop: '1px', flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: '12px', color: '#92400E', fontWeight: '600' }}>
                    Se moverán <strong>{counts[from] ?? 0}</strong> {modality === 'doubles' ? 'pareja(s)' : 'inscrito(s)'} de "<strong>{from}</strong>" a "<strong>{to}</strong>".
                    Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {mergeMutation.isError && (
              <div style={{ backgroundColor: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#DC2626', fontWeight: '600' }}>
                  ❌ {(mergeMutation.error as any)?.response?.data?.message || 'Error al unificar categorías'}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={onClose}
                style={{ flex: 1, padding: '11px', borderRadius: '9px', border: '1.5px solid #E5E7EB', background: 'white', cursor: 'pointer', fontWeight: '600', fontSize: '13px', color: '#6B7280' }}
              >
                Cancelar
              </button>
              <button
                disabled={!canMerge || mergeMutation.isPending}
                onClick={() => mergeMutation.mutate()}
                style={{
                  flex: 2, padding: '11px', borderRadius: '9px', border: 'none',
                  background: canMerge
                    ? 'linear-gradient(135deg, #1B3A1B 0%, #2D6A2D 100%)'
                    : '#E5E7EB',
                  color: canMerge ? 'white' : '#9CA3AF',
                  fontWeight: '700', fontSize: '13px',
                  cursor: canMerge ? 'pointer' : 'not-allowed',
                }}
              >
                {mergeMutation.isPending ? 'Unificando...' : 'Unificar categorías'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
