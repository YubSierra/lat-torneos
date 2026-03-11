// ─────────────────────────────────────────────────────────────────────────────
// Schedule.tsx  —  Gestión de Programación de Torneos
// Funcionalidades:
//   1. Configurar canchas + bloques de horario y generar programación automática
//   2. Vista previa antes de publicar (con opción de confirmar o descartar)
//   3. Ver programación existente agrupada por sede/cancha
//   4. Cancelar partido (libera el slot)
//   5. Reprogramar partido (mover a otro slot disponible)
//   6. Asignar partidos PENDING sin horario a slots libres
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Play, Calendar, Eye, CheckCircle,
  XCircle, Clock, RefreshCw, AlertCircle, ChevronDown,
  ChevronUp, X, ArrowRight,
} from 'lucide-react';
import { tournamentsApi } from '../api/tournaments.api';
import { courtsApi }      from '../api/courts.api';
import Sidebar            from '../components/Sidebar';
import { useAuth }        from '../context/AuthContext';
import api                from '../api/axios';

// ─── Constantes ───────────────────────────────────────────────────────────────

const ROUNDS = [
  { key: 'R64',  label: 'Ronda 64'     },
  { key: 'R32',  label: 'Ronda 32'     },
  { key: 'R16',  label: 'Ronda 16'     },
  { key: 'QF',   label: 'Cuartos'      },
  { key: 'SF',   label: 'Semifinal'    },
  { key: 'F',    label: 'Final'        },
  { key: 'RR',   label: 'Round Robin'  },
  { key: 'RR_A', label: 'Grupo A'      },
  { key: 'RR_B', label: 'Grupo B'      },
  { key: 'SF_M', label: 'SF Máster'    },
  { key: 'F_M',  label: 'Final Máster' },
];

const DEFAULT_DURATIONS: Record<string, number> = {
  R64: 75, R32: 75, R16: 75, QF: 90,
  SF: 120, F: 150, RR: 75, RR_A: 75,
  RR_B: 75, SF_M: 120, F_M: 150,
};

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: '⏳ Pendiente', bg: '#FEF9C3', color: '#92400E' },
  live:      { label: '🔴 En vivo',   bg: '#FEE2E2', color: '#DC2626' },
  completed: { label: '✓ Terminado',  bg: '#F3F4F6', color: '#4B5563' },
  cancelled: { label: '✗ Cancelado',  bg: '#FEE2E2', color: '#991B1B' },
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CourtBlock   { start: string; end: string; }
interface CourtConfig  { courtId: string; blocks: CourtBlock[]; }
interface ScheduleRow  {
  matchId: string;
  sede: string;
  court: string;
  courtId: string;
  date: string;
  time: string;
  duration: string;
  round: string;
  category: string;
  groupLabel?: string | null;
  player1: string;
  player2: string;
  status: string;
}
interface UnscheduledMatch {
  id: string;
  round: string;
  category: string;
  player1: string;
  player2: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: Vista Previa
// Muestra la programación generada antes de confirmarla
// ─────────────────────────────────────────────────────────────────────────────
function PreviewModal({
  rows,
  onConfirm,
  onDiscard,
  loading,
}: {
  rows: ScheduleRow[];
  onConfirm: () => void;
  onDiscard: () => void;
  loading: boolean;
}) {
  const grouped = useMemo(() => {
    const map: Record<string, ScheduleRow[]> = {};
    rows.forEach(r => {
      const key = `${r.sede} › ${r.court}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [rows]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '860px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem', borderBottom: '1px solid #E5E7EB',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
              👁 Vista Previa de Programación
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6B7280' }}>
              {rows.length} partido{rows.length !== 1 ? 's' : ''} generados — revisa antes de publicar
            </p>
          </div>
          <button onClick={onDiscard} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '1.5rem', lineHeight: 1 }}>
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '1.5rem', flex: 1 }}>
          {Object.entries(grouped).map(([courtLabel, matches]) => (
            <div key={courtLabel} style={{ marginBottom: '1.5rem' }}>
              <h3 style={{
                margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1D4ED8',
              }}>
                🎾 {courtLabel}
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    {['Hora', 'Duración', 'Ronda', 'Categoría', 'Jugador 1', 'Jugador 2'].map(h => (
                      <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matches.map((r, i) => (
                    <tr key={r.matchId} style={{ background: i % 2 === 0 ? '#fff' : '#F9FAFB' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#1D4ED8', borderBottom: '1px solid #F3F4F6' }}>{r.time}</td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#4B5563', borderBottom: '1px solid #F3F4F6' }}>{r.duration}</td>
                      <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #F3F4F6' }}>
                        <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {ROUNDS.find(ro => ro.key === r.round)?.label ?? r.round}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#374151', borderBottom: '1px solid #F3F4F6' }}>
                        {r.category}{r.groupLabel ? ` · ${r.groupLabel}` : ''}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#111827', borderBottom: '1px solid #F3F4F6' }}>{r.player1}</td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#111827', borderBottom: '1px solid #F3F4F6' }}>{r.player2}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem', borderTop: '1px solid #E5E7EB',
          display: 'flex', justifyContent: 'flex-end', gap: '0.75rem',
        }}>
          <button
            onClick={onDiscard}
            disabled={loading}
            style={{
              padding: '0.625rem 1.25rem', borderRadius: '8px',
              border: '1px solid #D1D5DB', background: '#fff',
              color: '#374151', cursor: 'pointer', fontWeight: 500,
            }}
          >
            ✗ Descartar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '0.625rem 1.25rem', borderRadius: '8px',
              border: 'none', background: loading ? '#93C5FD' : '#1D4ED8',
              color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            <CheckCircle size={16} />
            {loading ? 'Publicando...' : 'Confirmar y Publicar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: Cancelar / Reprogramar partido
// ─────────────────────────────────────────────────────────────────────────────
function CancelRescheduleModal({
  match,
  tournamentId,
  onClose,
  onDone,
}: {
  match: ScheduleRow;
  tournamentId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode]                 = useState<'choose' | 'cancel' | 'reschedule'>('choose');
  const [newDate, setNewDate]           = useState(match.date);
  const [newTime, setNewTime]           = useState(match.time);
  const [newCourtId, setNewCourtId]     = useState(match.courtId);
  const [reason, setReason]             = useState('');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  const { data: courts = [] } = useQuery({ queryKey: ['courts'], queryFn: courtsApi.getAll });

  async function handleCancel() {
    if (!reason.trim()) { setError('Por favor indica el motivo de la cancelación'); return; }
    setLoading(true);
    try {
      await api.patch(`/matches/${match.matchId}/cancel`, { reason });
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al cancelar');
    } finally {
      setLoading(false);
    }
  }

  async function handleReschedule() {
    if (!newDate || !newTime || !newCourtId) { setError('Completa todos los campos'); return; }
    setLoading(true);
    try {
      await api.patch(`/matches/${match.matchId}/assign-slot`, {
        courtId: newCourtId,
        scheduledAt: `${newDate}T${newTime}:00`,
      });
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al reprogramar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '480px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>
              Gestionar Partido
            </h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#6B7280' }}>
              {match.player1} <strong>vs</strong> {match.player2}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Elegir acción */}
          {mode === 'choose' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ margin: '0 0 0.5rem', color: '#374151', fontSize: '0.9rem' }}>
                📅 <strong>{match.date}</strong> · {match.time} · {match.court}
              </p>
              <button
                onClick={() => setMode('reschedule')}
                style={{
                  padding: '0.875rem 1rem', borderRadius: '8px', border: '1.5px solid #1D4ED8',
                  background: '#EFF6FF', color: '#1D4ED8', cursor: 'pointer',
                  fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}
              >
                <RefreshCw size={16} /> Reprogramar partido
              </button>
              <button
                onClick={() => setMode('cancel')}
                style={{
                  padding: '0.875rem 1rem', borderRadius: '8px', border: '1.5px solid #DC2626',
                  background: '#FEF2F2', color: '#DC2626', cursor: 'pointer',
                  fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}
              >
                <XCircle size={16} /> Cancelar partido
              </button>
            </div>
          )}

          {/* Cancelar */}
          {mode === 'cancel' && (
            <div>
              <button onClick={() => { setMode('choose'); setError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                ← Volver
              </button>
              <p style={{ margin: '0 0 0.75rem', color: '#374151', fontWeight: 600 }}>
                ¿Por qué se cancela el partido?
              </p>
              {['Lluvia / Cancha no disponible', 'Acuerdo entre jugadores', 'Fuerza mayor', 'Lesión de jugador', 'Otro'].map(r => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', cursor: 'pointer', borderRadius: '6px', background: reason === r ? '#EFF6FF' : 'transparent' }}>
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
                  <span style={{ fontSize: '0.875rem', color: '#374151' }}>{r}</span>
                </label>
              ))}
              {error && <p style={{ color: '#DC2626', fontSize: '0.8rem', marginTop: '0.5rem' }}>{error}</p>}
            </div>
          )}

          {/* Reprogramar */}
          {mode === 'reschedule' && (
            <div>
              <button onClick={() => { setMode('choose'); setError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                ← Volver
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                    📅 Nueva Fecha
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                    🕐 Nueva Hora
                  </label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                    🎾 Cancha
                  </label>
                  <select
                    value={newCourtId}
                    onChange={e => setNewCourtId(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  >
                    {(courts as any[]).map((c: any) => (
                      <option key={c.id} value={c.id}>{c.sede ? `${c.sede} › ` : ''}{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {error && <p style={{ color: '#DC2626', fontSize: '0.8rem', marginTop: '0.5rem' }}>{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        {mode !== 'choose' && (
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              onClick={onClose}
              disabled={loading}
              style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', color: '#374151' }}
            >
              Cancelar
            </button>
            <button
              onClick={mode === 'cancel' ? handleCancel : handleReschedule}
              disabled={loading}
              style={{
                padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none',
                background: loading ? '#9CA3AF' : mode === 'cancel' ? '#DC2626' : '#1D4ED8',
                color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600,
              }}
            >
              {loading ? 'Guardando...' : mode === 'cancel' ? 'Confirmar Cancelación' : 'Confirmar Reprogramación'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: Asignar partido pendiente a un slot
// ─────────────────────────────────────────────────────────────────────────────
function AssignPendingModal({
  slot,
  tournamentId,
  onClose,
  onDone,
}: {
  slot: ScheduleRow;
  tournamentId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');

  const { data: unscheduled = [], isLoading } = useQuery<UnscheduledMatch[]>({
    queryKey: ['unscheduled', tournamentId],
    queryFn: async () => {
      const res = await api.get(`/matches/tournament/${tournamentId}/unscheduled`);
      return res.data;
    },
    enabled: !!tournamentId,
  });

  async function handleAssign() {
    if (!selectedMatchId) { setError('Selecciona un partido'); return; }
    setLoading(true);
    try {
      await api.patch(`/matches/${selectedMatchId}/assign-slot`, {
        courtId: slot.courtId,
        scheduledAt: `${slot.date}T${slot.time}:00`,
      });
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al asignar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '520px',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>
              ➕ Asignar Partido Pendiente
            </h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#6B7280' }}>
              Slot: {slot.court} · {slot.date} · {slot.time}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <p style={{ color: '#6B7280', textAlign: 'center' }}>Cargando partidos pendientes...</p>
          ) : (unscheduled as UnscheduledMatch[]).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <p style={{ color: '#6B7280' }}>✅ No hay partidos pendientes sin programar</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#374151' }}>
                Selecciona el partido que quieres asignar a este slot:
              </p>
              {(unscheduled as UnscheduledMatch[]).map(m => (
                <label
                  key={m.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer',
                    border: `1.5px solid ${selectedMatchId === m.id ? '#1D4ED8' : '#E5E7EB'}`,
                    background: selectedMatchId === m.id ? '#EFF6FF' : '#fff',
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="radio"
                    name="matchSelect"
                    value={m.id}
                    checked={selectedMatchId === m.id}
                    onChange={() => setSelectedMatchId(m.id)}
                    style={{ accentColor: '#1D4ED8' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem' }}>
                      {m.player1} <ArrowRight size={12} style={{ display: 'inline', verticalAlign: 'middle', color: '#6B7280' }} /> {m.player2}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.125rem' }}>
                      {ROUNDS.find(r => r.key === m.round)?.label ?? m.round} · {m.category}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
          {error && <p style={{ color: '#DC2626', fontSize: '0.8rem', marginTop: '0.75rem' }}>{error}</p>}
        </div>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', color: '#374151' }}>
            Cancelar
          </button>
          <button
            onClick={handleAssign}
            disabled={loading || !selectedMatchId}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none',
              background: loading || !selectedMatchId ? '#93C5FD' : '#1D4ED8',
              color: '#fff', cursor: loading || !selectedMatchId ? 'not-allowed' : 'pointer', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            <CheckCircle size={15} />
            {loading ? 'Asignando...' : 'Asignar partido'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function Schedule() {
  const { isAdmin }   = useAuth();
  const queryClient   = useQueryClient();

  // ── Estado del formulario de configuración ─────────────────────────────────
  const [selectedTournament, setSelectedTournament] = useState('');
  const [selectedDate, setSelectedDate]             = useState('');
  const [courtConfigs, setCourtConfigs]             = useState<CourtConfig[]>([]);
  const [roundDurations, setRoundDurations]         = useState<Record<string, number>>(DEFAULT_DURATIONS);
  const [showDurations, setShowDurations]           = useState(false);

  // ── Estado de la vista previa ──────────────────────────────────────────────
  const [previewRows, setPreviewRows]       = useState<ScheduleRow[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Estado de modales ──────────────────────────────────────────────────────
  const [managingMatch, setManagingMatch]   = useState<ScheduleRow | null>(null);
  const [assigningSlot, setAssigningSlot]   = useState<ScheduleRow | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: tournaments = [] } = useQuery({
    queryKey: ['tournaments'],
    queryFn: tournamentsApi.getAll,
  });

  const { data: courts = [] } = useQuery({
    queryKey: ['courts'],
    queryFn: courtsApi.getAll,
  });

// DESPUÉS — aplana la respuesta sin importar si es array o objeto anidado:
  const { data: existingSchedule, refetch: refetchSchedule } = useQuery({
    queryKey: ['schedule', selectedTournament],
    queryFn: async () => {
      const res = await api.get(`/tournaments/${selectedTournament}/schedule`);
      const raw = res.data;

      // Si ya es array plano, úsalo directo
      if (Array.isArray(raw)) return raw as ScheduleRow[];

      // Si es objeto anidado { fecha: { sede: { cancha: [rows] } } }, aplánalo
      const flat: ScheduleRow[] = [];
      Object.values(raw).forEach((byDate: any) => {
        if (Array.isArray(byDate)) { flat.push(...byDate); return; }
        Object.values(byDate).forEach((bySede: any) => {
          if (Array.isArray(bySede)) { flat.push(...bySede); return; }
          Object.values(bySede).forEach((rows: any) => {
            if (Array.isArray(rows)) flat.push(...rows);
          });
        });
      });
      return flat;
    },
    enabled: !!selectedTournament,
  });

  // ── Canchas agrupadas por sede ─────────────────────────────────────────────
  const courtsBySede = useMemo(() => {
    const map: Record<string, any[]> = {};
    (courts as any[]).forEach((c: any) => {
      const sede = c.sede || 'Sin Sede';
      if (!map[sede]) map[sede] = [];
      map[sede].push(c);
    });
    return map;
  }, [courts]);

  // ── Programación existente agrupada por sede/cancha ───────────────────────
  const scheduleGrouped = useMemo(() => {
    if (!existingSchedule) return {};
    const map: Record<string, ScheduleRow[]> = {};
    existingSchedule.forEach(r => {
      const key = `${r.sede || 'Sin Sede'} › ${r.court}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [existingSchedule]);

  // ── Helpers de configuración de canchas ───────────────────────────────────
  function toggleCourt(courtId: string) {
    setCourtConfigs(prev => {
      const exists = prev.find(c => c.courtId === courtId);
      if (exists) return prev.filter(c => c.courtId !== courtId);
      return [...prev, { courtId, blocks: [{ start: '08:00', end: '18:00' }] }];
    });
  }

  function addBlock(courtId: string) {
    setCourtConfigs(prev => prev.map(c =>
      c.courtId === courtId ? { ...c, blocks: [...c.blocks, { start: '08:00', end: '18:00' }] } : c
    ));
  }

  function removeBlock(courtId: string, idx: number) {
    setCourtConfigs(prev => prev.map(c =>
      c.courtId === courtId ? { ...c, blocks: c.blocks.filter((_, i) => i !== idx) } : c
    ));
  }

  function updateBlock(courtId: string, idx: number, field: 'start' | 'end', value: string) {
    setCourtConfigs(prev => prev.map(c =>
      c.courtId === courtId ? {
        ...c,
        blocks: c.blocks.map((b, i) => i === idx ? { ...b, [field]: value } : b),
      } : c
    ));
  }

  // ── Generar Vista Previa (NO publica aún) ──────────────────────────────────
  async function handlePreview() {
    if (!selectedTournament || !selectedDate || courtConfigs.length === 0) {
      alert('Selecciona torneo, fecha y al menos una cancha con horario');
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await api.post(`/tournaments/${selectedTournament}/schedule/preview`, {
        date: selectedDate,
        courts: courtConfigs,
        roundDurations,
      });
      setPreviewRows(res.data.schedule ?? res.data);
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Error al generar vista previa');
    } finally {
      setPreviewLoading(false);
    }
  }

  // ── Confirmar y publicar programación ─────────────────────────────────────
  async function handleConfirmPublish() {
    if (!previewRows) return;
    setPreviewLoading(true);
    try {
      await api.post(`/tournaments/${selectedTournament}/schedule`, {
        date: selectedDate,
        courts: courtConfigs,
        roundDurations,
      });
      setPreviewRows(null);
      queryClient.invalidateQueries({ queryKey: ['schedule', selectedTournament] });
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Error al publicar la programación');
    } finally {
      setPreviewLoading(false);
    }
  }

  // ── Contadores ────────────────────────────────────────────────────────────
  const totalRows      = existingSchedule?.length ?? 0;
  const pendingCount   = existingSchedule?.filter(r => r.status === 'pending').length ?? 0;
  const cancelledCount = existingSchedule?.filter(r => r.status === 'cancelled').length ?? 0;
  const completedCount = existingSchedule?.filter(r => r.status === 'completed').length ?? 0;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F9FAFB' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>

        {/* ── Título ── */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
            🗓 Gestión de Programación
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: '#6B7280', fontSize: '0.9rem' }}>
            Configura canchas, genera la programación del día y administra los partidos
          </p>
        </div>

        {/* ── Selector de torneo ── */}
        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.35rem' }}>
              Torneo
            </label>
            <select
              value={selectedTournament}
              onChange={e => setSelectedTournament(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.875rem' }}
            >
              <option value="">— Selecciona un torneo —</option>
              {(tournaments as any[]).map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.35rem' }}>
              Fecha de programación
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.875rem', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {selectedTournament && (
          <>
            {/* ── Configuración de canchas ── */}
            <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem', border: '1px solid #E5E7EB' }}>
              <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: '#374151' }}>
                🎾 Selección de Canchas y Horarios
              </h2>

              {Object.entries(courtsBySede).map(([sede, sedeCourts]) => (
                <div key={sede} style={{ marginBottom: '1rem' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>
                    📍 {sede}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {sedeCourts.map((court: any) => {
                      const cfg = courtConfigs.find(c => c.courtId === court.id);
                      const isActive = !!cfg;
                      return (
                        <div key={court.id} style={{
                          border: `1.5px solid ${isActive ? '#1D4ED8' : '#E5E7EB'}`,
                          borderRadius: '8px',
                          background: isActive ? '#EFF6FF' : '#F9FAFB',
                          padding: '0.75rem 1rem',
                          transition: 'all 0.2s',
                        }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={isActive}
                              onChange={() => toggleCourt(court.id)}
                              style={{ accentColor: '#1D4ED8', width: '16px', height: '16px' }}
                            />
                            <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem' }}>
                              {court.name}
                            </span>
                            {court.surface && (
                              <span style={{ fontSize: '0.75rem', color: '#6B7280', background: '#F3F4F6', padding: '0.125rem 0.5rem', borderRadius: '9999px' }}>
                                {court.surface}
                              </span>
                            )}
                          </label>

                          {/* Bloques de horario */}
                          {isActive && cfg && (
                            <div style={{ marginTop: '0.75rem', paddingLeft: '1.75rem' }}>
                              {cfg.blocks.map((block, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                                  <Clock size={14} style={{ color: '#6B7280' }} />
                                  <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>Bloque {idx + 1}:</span>
                                  <input
                                    type="time"
                                    value={block.start}
                                    onChange={e => updateBlock(court.id, idx, 'start', e.target.value)}
                                    style={{ padding: '0.25rem 0.5rem', border: '1px solid #D1D5DB', borderRadius: '4px', fontSize: '0.825rem' }}
                                  />
                                  <span style={{ color: '#6B7280', fontSize: '0.8rem' }}>→</span>
                                  <input
                                    type="time"
                                    value={block.end}
                                    onChange={e => updateBlock(court.id, idx, 'end', e.target.value)}
                                    style={{ padding: '0.25rem 0.5rem', border: '1px solid #D1D5DB', borderRadius: '4px', fontSize: '0.825rem' }}
                                  />
                                  {cfg.blocks.length > 1 && (
                                    <button onClick={() => removeBlock(court.id, idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: '0.1rem' }}>
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button
                                onClick={() => addBlock(court.id)}
                                style={{ fontSize: '0.8rem', color: '#1D4ED8', background: 'none', border: '1px dashed #93C5FD', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                <Plus size={12} /> Añadir bloque
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Duraciones por ronda (colapsable) ── */}
            <div style={{ background: '#fff', borderRadius: '10px', marginBottom: '1.5rem', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
              <button
                onClick={() => setShowDurations(s => !s)}
                style={{ width: '100%', padding: '1rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700, color: '#374151', fontSize: '0.95rem' }}
              >
                <span>⏱ Duración por Ronda (minutos)</span>
                {showDurations ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {showDurations && (
                <div style={{ padding: '0 1.25rem 1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                  {ROUNDS.map(r => (
                    <div key={r.key}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: '0.25rem' }}>
                        {r.label}
                      </label>
                      <input
                        type="number"
                        min={30}
                        max={300}
                        step={15}
                        value={roundDurations[r.key] ?? 90}
                        onChange={e => setRoundDurations(prev => ({ ...prev, [r.key]: parseInt(e.target.value) || 90 }))}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Botón Generar Vista Previa ── */}
            {isAdmin && (
              <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={handlePreview}
                  disabled={previewLoading || courtConfigs.length === 0 || !selectedDate}
                  style={{
                    padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none',
                    background: previewLoading || courtConfigs.length === 0 || !selectedDate ? '#93C5FD' : '#1D4ED8',
                    color: '#fff',
                    cursor: previewLoading || courtConfigs.length === 0 || !selectedDate ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: '0.95rem',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    boxShadow: '0 2px 8px rgba(29,78,216,0.25)',
                  }}
                >
                  <Eye size={18} />
                  {previewLoading ? 'Calculando...' : 'Vista Previa'}
                </button>
                {courtConfigs.length === 0 && (
                  <span style={{ fontSize: '0.825rem', color: '#D97706', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertCircle size={14} /> Selecciona al menos una cancha
                  </span>
                )}
                {!selectedDate && courtConfigs.length > 0 && (
                  <span style={{ fontSize: '0.825rem', color: '#D97706', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertCircle size={14} /> Selecciona una fecha
                  </span>
                )}
              </div>
            )}

            {/* ── Programación existente ── */}
            {existingSchedule && existingSchedule.length > 0 && (
              <div>
                {/* Resumen */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Total', value: totalRows, color: '#374151', bg: '#F3F4F6' },
                    { label: 'Pendientes', value: pendingCount, color: '#92400E', bg: '#FEF9C3' },
                    { label: 'Cancelados', value: cancelledCount, color: '#991B1B', bg: '#FEE2E2' },
                    { label: 'Terminados', value: completedCount, color: '#065F46', bg: '#D1FAE5' },
                  ].map(s => (
                    <div key={s.label} style={{ background: s.bg, borderRadius: '8px', padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: s.color }}>{s.value}</span>
                      <span style={{ fontSize: '0.75rem', color: s.color, fontWeight: 600 }}>{s.label}</span>
                    </div>
                  ))}
                </div>

                <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: '#374151' }}>
                  📋 Programación Actual
                </h2>

                {Object.entries(scheduleGrouped).map(([courtLabel, rows]) => (
                  <div key={courtLabel} style={{ marginBottom: '1.5rem', background: '#fff', borderRadius: '10px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                    {/* Header de cancha */}
                    <div style={{ background: '#1D4ED8', padding: '0.625rem 1rem' }}>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.875rem' }}>🎾 {courtLabel}</span>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.855rem' }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                          {['Hora', 'Duración', 'Ronda', 'Categoría', 'Jugador 1', 'Jugador 2', 'Estado', isAdmin ? 'Acciones' : ''].filter(Boolean).map(h => (
                            <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => {
                          const statusStyle = STATUS_LABEL[row.status] ?? STATUS_LABEL.pending;
                          const isCancelled = row.status === 'cancelled';
                          return (
                            <tr key={row.matchId} style={{ background: i % 2 === 0 ? '#fff' : '#F9FAFB', opacity: isCancelled ? 0.65 : 1 }}>
                              <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: '#1D4ED8', borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }}>{row.time}</td>
                              <td style={{ padding: '0.6rem 0.75rem', color: '#4B5563', borderBottom: '1px solid #F3F4F6' }}>{row.duration}</td>
                              <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #F3F4F6' }}>
                                <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '0.1rem 0.45rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                                  {ROUNDS.find(r => r.key === row.round)?.label ?? row.round}
                                </span>
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', color: '#374151', borderBottom: '1px solid #F3F4F6' }}>
                                {row.category}{row.groupLabel ? ` · ${row.groupLabel}` : ''}
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', color: '#111827', borderBottom: '1px solid #F3F4F6' }}>
                                {isCancelled ? <s>{row.player1}</s> : row.player1}
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', color: '#111827', borderBottom: '1px solid #F3F4F6' }}>
                                {isCancelled ? <s>{row.player2}</s> : row.player2}
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #F3F4F6' }}>
                                <span style={{
                                  padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem',
                                  background: statusStyle.bg, color: statusStyle.color, fontWeight: 600, whiteSpace: 'nowrap',
                                }}>
                                  {statusStyle.label}
                                </span>
                              </td>
                              {isAdmin && (
                                <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #F3F4F6' }}>
                                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    {/* Cancelar o Reprogramar */}
                                    {!isCancelled && row.status !== 'completed' && (
                                      <button
                                        onClick={() => setManagingMatch(row)}
                                        style={{
                                          padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderRadius: '5px',
                                          border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer',
                                          color: '#374151', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap',
                                        }}
                                      >
                                        <RefreshCw size={11} /> Gestionar
                                      </button>
                                    )}
                                    {/* Asignar partido pendiente a slot cancelado */}
                                    {isCancelled && (
                                      <button
                                        onClick={() => setAssigningSlot(row)}
                                        style={{
                                          padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderRadius: '5px',
                                          border: '1px solid #1D4ED8', background: '#EFF6FF', cursor: 'pointer',
                                          color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap',
                                        }}
                                      >
                                        <Plus size={11} /> Asignar partido
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}

            {existingSchedule && existingSchedule.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                <Calendar size={40} style={{ color: '#D1D5DB', margin: '0 auto 0.75rem' }} />
                <p style={{ color: '#6B7280', fontSize: '0.95rem' }}>
                  No hay programación para este torneo todavía.<br />
                  <strong>Selecciona una fecha y canchas</strong>, luego genera la vista previa.
                </p>
              </div>
            )}
          </>
        )}

        {!selectedTournament && (
          <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
            <Calendar size={48} style={{ color: '#D1D5DB', margin: '0 auto 1rem' }} />
            <p style={{ color: '#6B7280' }}>Selecciona un torneo para empezar</p>
          </div>
        )}
      </main>

      {/* ── Modal: Vista Previa ── */}
      {previewRows && (
        <PreviewModal
          rows={previewRows}
          onConfirm={handleConfirmPublish}
          onDiscard={() => setPreviewRows(null)}
          loading={previewLoading}
        />
      )}

      {/* ── Modal: Cancelar / Reprogramar ── */}
      {managingMatch && (
        <CancelRescheduleModal
          match={managingMatch}
          tournamentId={selectedTournament}
          onClose={() => setManagingMatch(null)}
          onDone={() => {
            setManagingMatch(null);
            queryClient.invalidateQueries({ queryKey: ['schedule', selectedTournament] });
          }}
        />
      )}

      {/* ── Modal: Asignar Pendiente ── */}
      {assigningSlot && (
        <AssignPendingModal
          slot={assigningSlot}
          tournamentId={selectedTournament}
          onClose={() => setAssigningSlot(null)}
          onDone={() => {
            setAssigningSlot(null);
            queryClient.invalidateQueries({ queryKey: ['schedule', selectedTournament] });
          }}
        />
      )}
    </div>
  );
}