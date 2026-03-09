// frontend/src/pages/Players.tsx  ← REEMPLAZA COMPLETO
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, UserCheck, UserX, Trophy, Activity,
  Phone, Mail, FileText, Calendar, X, ChevronRight, Shield,
} from 'lucide-react';
import api from '../api/axios';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

// ── Helpers ──────────────────────────────────────────────────────────────────
const ROLE_LABEL: Record<string, string> = {
  super_admin: '⭐ Super Admin',
  admin:       '🛠 Admin',
  referee:     '🎖 Árbitro',
  player:      '🎾 Jugador',
  club_admin:  '🏟 Club Admin',
};
const ROLE_COLOR: Record<string, { bg: string; color: string }> = {
  super_admin: { bg: '#FEF3C7', color: '#92400E' },
  admin:       { bg: '#DBEAFE', color: '#1D4ED8' },
  referee:     { bg: '#EDE9FE', color: '#6D28D9' },
  player:      { bg: '#DCFCE7', color: '#15803D' },
  club_admin:  { bg: '#FCE7F3', color: '#9D174D' },
};
const ENROLLMENT_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  approved: { label: '✓ Aprobado',  bg: '#DCFCE7', color: '#15803D' },
  pending:  { label: '⏳ Pendiente', bg: '#FEF9C3', color: '#92400E' },
  reserved: { label: '📋 Reservado', bg: '#FED7AA', color: '#9A3412' },
  rejected: { label: '✗ Rechazado', bg: '#FEE2E2', color: '#DC2626' },
};

// ─────────────────────────────────────────────────────────────────────────────
export default function Players() {
  const { isAdmin, role } = useAuth();
  const isReferee = role === 'referee';
  const queryClient = useQueryClient();

  // ── Estado ──────────────────────────────────────────────────────────────
  const [search,        setSearch]        = useState('');
  const [roleFilter,    setRoleFilter]    = useState<string>('all');
  const [statusFilter,  setStatusFilter]  = useState<string>('all');
  const [selected,      setSelected]      = useState<any>(null);
  const [detailTab,     setDetailTab]     = useState<'info' | 'torneos' | 'partidos'>('info');

  // Modal gestión árbitro
  const [refereeModal,  setRefereeModal]  = useState<any>(null); // user object

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
  });

  // Cuando se selecciona un jugador, cargar sus datos extra
  const { data: playerEnrollments = [] } = useQuery({
    queryKey: ['player-enrollments', selected?.id],
    queryFn: async () => {
      const res = await api.get(`/enrollments/player/${selected.id}`);
      return res.data;
    },
    enabled: !!selected?.id,
  });

  const { data: playerStats } = useQuery({
    queryKey: ['player-stats', selected?.id],
    queryFn: async () => {
      const res = await api.get(`/matches/player/${selected.id}/stats`);
      return res.data;
    },
    enabled: !!selected?.id,
  });

  // Torneos donde está inscrito para saber nombres
  const { data: tournaments = [] } = useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const res = await api.get('/tournaments');
      return res.data;
    },
  });

  // Torneos asignados al árbitro seleccionado en el modal
  const { data: refereeAssignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ['referee-assignments', refereeModal?.id],
    queryFn: async () => {
      const res = await api.get(`/users/${refereeModal.id}/assignments`);
      return res.data;
    },
    enabled: !!refereeModal?.id,
  });

  // ── Mutations solo admin ─────────────────────────────────────────────────
  const toggleActiveMutation = useMutation({
    mutationFn: (user: any) => api.patch(`/users/${user.id}`, { isActive: !user.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelected((prev: any) => prev ? { ...prev, isActive: !prev.isActive } : null);
    },
  });

  // Cambiar rol (player ↔ referee)
  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: string }) =>
      api.patch(`/users/${userId}/role`, { role: newRole }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      // Actualizar el modal con el nuevo rol
      setRefereeModal((prev: any) => prev ? { ...prev, role: vars.newRole } : null);
      setSelected((prev: any) => prev ? { ...prev, role: vars.newRole } : null);
    },
  });

  // Asignar torneo a árbitro
  const assignTournamentMutation = useMutation({
    mutationFn: ({ refereeId, tournamentId }: { refereeId: string; tournamentId: string }) =>
      api.post(`/users/${refereeId}/assignments`, { tournamentId }),
    onSuccess: () => refetchAssignments(),
  });

  // Quitar asignación
  const removeAssignmentMutation = useMutation({
    mutationFn: ({ refereeId, tournamentId }: { refereeId: string; tournamentId: string }) =>
      api.delete(`/users/${refereeId}/assignments/${tournamentId}`),
    onSuccess: () => refetchAssignments(),
  });

  // ── Filtrado ─────────────────────────────────────────────────────────────
  const filtered = (users as any[]).filter((u: any) => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || [
      u.nombres, u.apellidos, u.email,
      u.docNumber, u.telefono,
    ].some(f => f?.toLowerCase().includes(q));

    const matchesRole   = roleFilter   === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'active'   &&  u.isActive)
      || (statusFilter === 'inactive' && !u.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const tournamentMap = new Map((tournaments as any[]).map((t: any) => [t.id, t]));

  // Torneos activos del jugador seleccionado
  const activeEnrollments = (playerEnrollments as any[]).filter(
    (e: any) => e.status === 'approved' || e.status === 'pending' || e.status === 'reserved'
  );

  // ── Renders auxiliares ────────────────────────────────────────────────────
  const RoleBadge = ({ role: r }: { role: string }) => {
    const c = ROLE_COLOR[r] || { bg: '#F3F4F6', color: '#374151' };
    return (
      <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', backgroundColor: c.bg, color: c.color }}>
        {ROLE_LABEL[r] || r}
      </span>
    );
  };

  const StatusBadge = ({ active }: { active: boolean }) => (
    <span style={{
      padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600',
      backgroundColor: active ? '#DCFCE7' : '#FEE2E2',
      color: active ? '#15803D' : '#DC2626',
    }}>
      {active ? '● Activo' : '○ Inactivo'}
    </span>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />

      <main style={{ flex: 1, padding: '28px', minWidth: 0 }}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#1B3A1B', margin: 0 }}>
              👤 Jugadores
            </h1>
            <p style={{ color: '#6B7280', fontSize: '13px', marginTop: '3px' }}>
              {(users as any[]).filter((u: any) => u.role === 'player').length} jugadores registrados
            </p>
          </div>
        </div>

        {/* ── Buscador + filtros ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-5">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Buscador */}
            <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
              <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre, email, documento o teléfono..."
                style={{
                  width: '100%', paddingLeft: '34px', padding: '9px 12px 9px 34px',
                  border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '13px',
                  boxSizing: 'border-box', outline: 'none',
                }}
              />
            </div>

            {/* Filtro rol */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {[
                { v: 'all',    label: 'Todos' },
                { v: 'player', label: '🎾 Jugadores' },
                { v: 'referee',label: '🎖 Árbitros'  },
                { v: 'admin',  label: '🛠 Admins'    },
              ].map(({ v, label }) => (
                <button key={v} onClick={() => setRoleFilter(v)}
                  style={{
                    padding: '6px 12px', borderRadius: '6px', fontSize: '12px', border: 'none', cursor: 'pointer',
                    backgroundColor: roleFilter === v ? '#1B3A1B' : '#F3F4F6',
                    color: roleFilter === v ? 'white' : '#374151',
                    fontWeight: roleFilter === v ? '700' : '400',
                  }}
                >{label}</button>
              ))}
            </div>

            {/* Filtro estado */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {[
                { v: 'all',      label: 'Todos'    },
                { v: 'active',   label: '● Activos' },
                { v: 'inactive', label: '○ Inactivos' },
              ].map(({ v, label }) => (
                <button key={v} onClick={() => setStatusFilter(v)}
                  style={{
                    padding: '6px 12px', borderRadius: '6px', fontSize: '12px', border: 'none', cursor: 'pointer',
                    backgroundColor: statusFilter === v ? '#2D6A2D' : '#F3F4F6',
                    color: statusFilter === v ? 'white' : '#374151',
                  }}
                >{label}</button>
              ))}
            </div>
          </div>

          {search && (
            <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '8px', marginBottom: 0 }}>
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{search}"
            </p>
          )}
        </div>

        {/* ── Layout tabla + panel detalle ─────────────────────────────── */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

          {/* ── Tabla ─────────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '700', fontSize: '14px', color: '#1B3A1B' }}>
                Usuarios registrados ({filtered.length})
              </span>
              {selected && (
                <span style={{ fontSize: '12px', color: '#6B7280' }}>
                  Panel abierto: <strong>{selected.nombres} {selected.apellidos}</strong>
                </span>
              )}
            </div>

            {isLoading ? (
              <p style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>Cargando...</p>
            ) : filtered.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>
                No hay resultados para la búsqueda.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F9FAFB' }}>
                      {['Nombre', 'Contacto', 'Documento', 'Rol', 'Estado', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: '#6B7280', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u: any, i: number) => (
                      <tr
                        key={u.id}
                        onClick={() => { setSelected(u); setDetailTab('info'); }}
                        style={{
                          borderTop: '1px solid #F3F4F6',
                          backgroundColor: selected?.id === u.id ? '#F0FDF4' : i % 2 === 0 ? 'white' : '#FAFAFA',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s',
                        }}
                      >
                        {/* Nombre */}
                        <td style={{ padding: '11px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '50%',
                              backgroundColor: u.isActive ? '#DCFCE7' : '#F3F4F6',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '13px', fontWeight: '700', color: '#1B3A1B', flexShrink: 0,
                            }}>
                              {(u.nombres?.[0] || u.email?.[0] || '?').toUpperCase()}
                            </div>
                            <div>
                              <p style={{ margin: 0, fontWeight: '600', color: '#1B3A1B', fontSize: '13px' }}>
                                {u.nombres || '—'} {u.apellidos || ''}
                              </p>
                              <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF' }}>{u.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Contacto */}
                        <td style={{ padding: '11px 16px' }}>
                          {u.telefono
                            ? <span style={{ fontSize: '12px', color: '#374151' }}>📱 {u.telefono}</span>
                            : <span style={{ fontSize: '11px', color: '#D1D5DB' }}>Sin teléfono</span>
                          }
                        </td>

                        {/* Documento */}
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{ fontSize: '12px', color: '#374151', fontFamily: 'monospace' }}>
                            {u.docNumber || '—'}
                          </span>
                        </td>

                        {/* Rol */}
                        <td style={{ padding: '11px 16px' }}>
                          <RoleBadge role={u.role} />
                        </td>

                        {/* Estado */}
                        <td style={{ padding: '11px 16px' }}>
                          <StatusBadge active={u.isActive} />
                        </td>

                        {/* Ver detalle */}
                        <td style={{ padding: '11px 16px' }}>
                          <ChevronRight size={16} color={selected?.id === u.id ? '#2D6A2D' : '#D1D5DB'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Panel detalle ──────────────────────────────────────────── */}
          {selected && (
            <div style={{
              width: '360px', flexShrink: 0,
              backgroundColor: 'white', borderRadius: '12px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
              overflow: 'hidden',
              position: 'sticky', top: '20px',
              maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
            }}>
              {/* Header panel */}
              <div style={{ backgroundColor: '#1B3A1B', padding: '18px 20px', position: 'relative' }}>
                <button
                  onClick={() => setSelected(null)}
                  style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={14} color="white" />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    backgroundColor: '#2D6A2D', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '20px', fontWeight: '800', color: 'white',
                  }}>
                    {(selected.nombres?.[0] || selected.email?.[0] || '?').toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: '800', color: 'white', fontSize: '15px' }}>
                      {selected.nombres || '—'} {selected.apellidos || ''}
                    </p>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <RoleBadge role={selected.role} />
                      <StatusBadge active={selected.isActive} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #F3F4F6' }}>
                {[
                  { id: 'info',     label: '📋 Datos'    },
                  { id: 'torneos',  label: '🏆 Torneos'  },
                  { id: 'partidos', label: '🎾 Partidos'  },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setDetailTab(tab.id as any)}
                    style={{
                      flex: 1, padding: '10px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                      backgroundColor: detailTab === tab.id ? 'white' : '#F9FAFB',
                      color: detailTab === tab.id ? '#1B3A1B' : '#9CA3AF',
                      borderBottom: detailTab === tab.id ? '2px solid #2D6A2D' : '2px solid transparent',
                    }}
                  >{tab.label}</button>
                ))}
              </div>

              {/* ── Tab: Datos personales ──────────────────────────── */}
              {detailTab === 'info' && (
                <div style={{ padding: '18px' }}>
                  {[
                    { icon: Mail,     label: 'Email',       value: selected.email },
                    { icon: Phone,    label: 'Teléfono',    value: selected.telefono || '—' },
                    { icon: FileText, label: 'Documento',   value: selected.docNumber || '—' },
                    { icon: Calendar, label: 'Nacimiento',  value: selected.birthDate ? new Date(selected.birthDate).toLocaleDateString('es-CO') : '—' },
                    { icon: UserCheck,label: 'Género',      value: selected.gender === 'M' ? '👨 Masculino' : selected.gender === 'F' ? '👩 Femenino' : '—' },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: '1px solid #F9FAFB' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={14} color="#2D6A2D" />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '10px', color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                        <p style={{ margin: 0, fontSize: '13px', color: '#1B3A1B', fontWeight: '500' }}>{value}</p>
                      </div>
                    </div>
                  ))}

                  {/* Acciones admin */}
                  {isAdmin && (
                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* Botón árbitro — solo para players y referees */}
                      {(selected.role === 'player' || selected.role === 'referee') && (
                        <button
                          onClick={() => setRefereeModal(selected)}
                          style={{
                            width: '100%', padding: '9px', borderRadius: '8px', border: 'none',
                            cursor: 'pointer', fontSize: '12px', fontWeight: '700',
                            backgroundColor: selected.role === 'referee' ? '#EDE9FE' : '#F0FDF4',
                            color: selected.role === 'referee' ? '#6D28D9' : '#15803D',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          }}
                        >
                          <Shield size={13} />
                          {selected.role === 'referee' ? 'Gestionar árbitro' : 'Asignar como árbitro'}
                        </button>
                      )}

                      {/* Activar / Desactivar */}
                      <button
                        onClick={() => toggleActiveMutation.mutate(selected)}
                        disabled={toggleActiveMutation.isPending}
                        style={{
                          width: '100%', padding: '9px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                          backgroundColor: selected.isActive ? '#FEE2E2' : '#DCFCE7',
                          color: selected.isActive ? '#DC2626' : '#15803D',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        }}
                      >
                        {selected.isActive
                          ? <><UserX size={13} />Desactivar usuario</>
                          : <><UserCheck size={13} />Activar usuario</>}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab: Torneos inscritos ─────────────────────────── */}
              {detailTab === 'torneos' && (
                <div style={{ padding: '18px' }}>
                  {(playerEnrollments as any[]).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF' }}>
                      <Trophy size={32} style={{ marginBottom: '8px', opacity: 0.3 }} />
                      <p style={{ margin: 0, fontSize: '13px' }}>Sin inscripciones</p>
                    </div>
                  ) : (
                    <>
                      {/* Torneos activos */}
                      {activeEnrollments.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <p style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                            📍 Torneos activos
                          </p>
                          {activeEnrollments.map((e: any) => {
                            const t = tournamentMap.get(e.tournamentId);
                            const s = ENROLLMENT_STATUS[e.status] || ENROLLMENT_STATUS.pending;
                            return (
                              <div key={e.id} style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div>
                                    <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: '#1B3A1B' }}>
                                      {t?.name || e.tournamentId.slice(0, 8) + '...'}
                                    </p>
                                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6B7280' }}>
                                      {e.category} · {e.modality || 'singles'}
                                    </p>
                                  </div>
                                  <span style={{ padding: '2px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: '700', backgroundColor: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
                                    {s.label}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Historial */}
                      <p style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                        📜 Historial completo ({(playerEnrollments as any[]).length})
                      </p>
                      {(playerEnrollments as any[]).map((e: any) => {
                        const t = tournamentMap.get(e.tournamentId);
                        const s = ENROLLMENT_STATUS[e.status] || ENROLLMENT_STATUS.pending;
                        return (
                          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F9FAFB' }}>
                            <div>
                              <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                                {t?.name || 'Torneo'}
                              </p>
                              <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF' }}>
                                {e.category} · {new Date(e.enrolledAt).toLocaleDateString('es-CO')}
                              </p>
                            </div>
                            <span style={{ padding: '2px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: '600', backgroundColor: s.bg, color: s.color }}>
                              {s.label}
                            </span>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}

              {/* ── Tab: Estadísticas de partidos ──────────────────── */}
              {detailTab === 'partidos' && (
                <div style={{ padding: '18px' }}>
                  {!playerStats ? (
                    <p style={{ textAlign: 'center', color: '#9CA3AF', padding: '24px 0', fontSize: '13px' }}>Cargando estadísticas...</p>
                  ) : (
                    <>
                      {/* Stats cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                        {[
                          { label: 'Partidos',   value: playerStats.totalMatches ?? 0,             color: '#1D4ED8', bg: '#EFF6FF' },
                          { label: 'Victorias',  value: playerStats.wins          ?? 0,             color: '#15803D', bg: '#F0FDF4' },
                          { label: 'Derrotas',   value: playerStats.losses         ?? 0,             color: '#DC2626', bg: '#FEF2F2' },
                          { label: 'Win Rate',   value: `${Math.round((playerStats.winRate ?? 0) * 100)}%`, color: '#92400E', bg: '#FEF3C7' },
                        ].map(({ label, value, color, bg }) => (
                          <div key={label} style={{ backgroundColor: bg, borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: '22px', fontWeight: '800', color }}>{value}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6B7280', fontWeight: '600' }}>{label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Barra visual win rate */}
                      {(playerStats.totalMatches ?? 0) > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6B7280', marginBottom: '5px' }}>
                            <span>Victorias</span>
                            <span>Derrotas</span>
                          </div>
                          <div style={{ height: '8px', borderRadius: '999px', backgroundColor: '#FEE2E2', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: '999px', backgroundColor: '#2D6A2D',
                              width: `${Math.round((playerStats.winRate ?? 0) * 100)}%`,
                              transition: 'width 0.4s ease',
                            }} />
                          </div>
                        </div>
                      )}

                      {playerStats.totalMatches === 0 && (
                        <div style={{ textAlign: 'center', padding: '16px 0', color: '#9CA3AF' }}>
                          <Activity size={32} style={{ marginBottom: '8px', opacity: 0.3 }} />
                          <p style={{ margin: 0, fontSize: '13px' }}>Sin partidos registrados</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ══ MODAL GESTIÓN ÁRBITRO ════════════════════════════════════ */}
      {refereeModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px',
            width: '100%', maxWidth: '520px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{ backgroundColor: '#1B3A1B', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, color: 'white', fontWeight: '800', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={18} /> Gestión de árbitro
                </h3>
                <p style={{ margin: '3px 0 0', color: '#86EFAC', fontSize: '12px' }}>
                  {refereeModal.nombres} {refereeModal.apellidos}
                </p>
              </div>
              <button
                onClick={() => setRefereeModal(null)}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} color="white" />
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>

              {/* ── Sección 1: Rol ──────────────────────────────────── */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Rol del usuario
                </h4>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[
                    { r: 'player',  label: '🎾 Jugador',  desc: 'Puede inscribirse y ver sus partidos' },
                    { r: 'referee', label: '🎖 Árbitro',   desc: 'Puede gestionar partidos y programación' },
                  ].map(({ r, label, desc }) => (
                    <button
                      key={r}
                      onClick={() => {
                        if (refereeModal.role !== r) {
                          changeRoleMutation.mutate({ userId: refereeModal.id, newRole: r });
                        }
                      }}
                      disabled={changeRoleMutation.isPending}
                      style={{
                        flex: 1, padding: '14px', borderRadius: '10px', cursor: 'pointer',
                        border: refereeModal.role === r ? '2px solid #2D6A2D' : '2px solid #E5E7EB',
                        backgroundColor: refereeModal.role === r ? '#F0FDF4' : 'white',
                        textAlign: 'left', transition: 'all 0.15s',
                      }}
                    >
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: refereeModal.role === r ? '#15803D' : '#374151' }}>
                        {label}
                        {refereeModal.role === r && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#15803D' }}>✓ Activo</span>}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9CA3AF' }}>{desc}</p>
                    </button>
                  ))}
                </div>
                {changeRoleMutation.isPending && (
                  <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '8px', textAlign: 'center' }}>
                    Actualizando rol...
                  </p>
                )}
              </div>

              {/* ── Sección 2: Torneos asignados (solo si es referee) ── */}
              {refereeModal.role === 'referee' && (
                <div>
                  <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Torneos asignados
                  </h4>
                  <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '14px' }}>
                    El árbitro solo verá y podrá gestionar los torneos que le asignes aquí.
                  </p>

                  {(tournaments as any[]).length === 0 ? (
                    <p style={{ color: '#9CA3AF', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
                      No hay torneos creados aún.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(tournaments as any[]).map((t: any) => {
                        const isAssigned = (refereeAssignments as any[]).some(
                          (a: any) => a.tournamentId === t.id
                        );
                        return (
                          <div
                            key={t.id}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '12px 14px', borderRadius: '10px',
                              border: `1.5px solid ${isAssigned ? '#86EFAC' : '#E5E7EB'}`,
                              backgroundColor: isAssigned ? '#F0FDF4' : '#FAFAFA',
                              transition: 'all 0.15s',
                            }}
                          >
                            <div>
                              <p style={{ margin: 0, fontWeight: '600', fontSize: '13px', color: '#1B3A1B' }}>
                                {t.name}
                              </p>
                              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9CA3AF' }}>
                                {t.status} · {t.startDate ? new Date(t.startDate).toLocaleDateString('es-CO') : 'Sin fecha'}
                              </p>
                            </div>

                            <button
                              onClick={() => {
                                isAssigned
                                  ? removeAssignmentMutation.mutate({ refereeId: refereeModal.id, tournamentId: t.id })
                                  : assignTournamentMutation.mutate({ refereeId: refereeModal.id, tournamentId: t.id });
                              }}
                              disabled={assignTournamentMutation.isPending || removeAssignmentMutation.isPending}
                              style={{
                                padding: '6px 14px', borderRadius: '8px', border: 'none',
                                cursor: 'pointer', fontSize: '12px', fontWeight: '700',
                                backgroundColor: isAssigned ? '#FEE2E2' : '#2D6A2D',
                                color: isAssigned ? '#DC2626' : 'white',
                                flexShrink: 0, marginLeft: '10px',
                              }}
                            >
                              {isAssigned ? '✕ Quitar' : '+ Asignar'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Resumen */}
                  {(refereeAssignments as any[]).length > 0 && (
                    <div style={{ marginTop: '14px', padding: '10px 14px', backgroundColor: '#EDE9FE', borderRadius: '8px' }}>
                      <p style={{ margin: 0, fontSize: '12px', color: '#6D28D9', fontWeight: '600' }}>
                        🎖 {refereeModal.nombres} tiene acceso a {(refereeAssignments as any[]).length} torneo{(refereeAssignments as any[]).length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Aviso si aún es jugador */}
              {refereeModal.role === 'player' && (
                <div style={{ padding: '14px', backgroundColor: '#FEF3C7', borderRadius: '10px', fontSize: '13px', color: '#92400E' }}>
                  💡 Selecciona el rol <strong>Árbitro</strong> para poder asignarle torneos.
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #F3F4F6' }}>
              <button
                onClick={() => setRefereeModal(null)}
                style={{ width: '100%', padding: '11px', borderRadius: '8px', border: 'none', backgroundColor: '#1B3A1B', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}
              >
                ✓ Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}