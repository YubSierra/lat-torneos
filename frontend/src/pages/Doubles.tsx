// frontend/src/pages/Doubles.tsx
// ─── REEMPLAZA EL ARCHIVO COMPLETO ───────────────────────────────────────────
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, UserPlus } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { tournamentsApi } from '../api/tournaments.api';

// ── Helper de color de pago ───────────────────────────────────────────────────
const payColor = (status: string) => {
  if (status === 'approved') return { bg: '#F0FDF4', color: '#15803D', label: '✓ Pagado' };
  if (status === 'manual')   return { bg: '#EFF6FF', color: '#1D4ED8', label: '💵 Manual' };
  return { bg: '#FEF9C3', color: '#92400E', label: '⏳ Pendiente' };
};

const DEFAULT_CATEGORIES = ['PRIMERA','SEGUNDA','INTERMEDIA','TERCERA','CUARTA','QUINTA','SEXTA'];

// ─────────────────────────────────────────────────────────────────────────────
export default function Doubles() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // ── Estado principal ──────────────────────────────────────────────────────
  const [selectedTournament, setSelectedTournament] = useState('');
  const [showCreateModal,    setShowCreateModal]    = useState(false);
  const [showPairModal,      setShowPairModal]      = useState(false);
  const [selectedTeam,       setSelectedTeam]       = useState<any>(null);
  const [newTeam, setNewTeam] = useState({ player1Id: '', player2Id: '', teamName: '' });
  const [pairPlayerId, setPairPlayerId] = useState('');

  // ── Estado formulario nuevo jugador (dobles sin singles) ─────────────────
  const [showNewPlayerForm, setShowNewPlayerForm] = useState(false);
  const [createError, setCreateError] = useState('');
  const [search1, setSearch1] = useState('');
  const [search2, setSearch2] = useState('');
  const [open1, setOpen1] = useState(false);
  const [open2, setOpen2] = useState(false);

  // Editar pareja
  const [showEditModal,  setShowEditModal]  = useState(false);
  const [editTeam,       setEditTeam]       = useState<any>(null);
  const [editData,       setEditData]       = useState({ player1Id: '', player2Id: '', teamName: '' });
  const [editSearch1,    setEditSearch1]    = useState('');
  const [editSearch2,    setEditSearch2]    = useState('');
  const [editOpen1,      setEditOpen1]      = useState(false);
  const [editOpen2,      setEditOpen2]      = useState(false);
  const [editError,      setEditError]      = useState('');

  // Confirmar eliminación
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState<any>(null);
  const [newPlayer, setNewPlayer] = useState({
    nombres: '', apellidos: '', email: '',
    telefono: '', docNumber: '', category: 'TERCERA',
  });

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: tournaments = [] } = useQuery({
    queryKey: ['tournaments'],
    queryFn: tournamentsApi.getAll,
  });

  const tournament = (tournaments as any[]).find((t: any) => t.id === selectedTournament);

  // Categorías del torneo seleccionado, o fallback a las por defecto
  const tournamentCategories: string[] =
    tournament?.categories?.length
      ? tournament.categories.map((c: any) => c.name)
      : DEFAULT_CATEGORIES;

  const { data: teams = [], refetch: refetchTeams } = useQuery({
    queryKey: ['doubles-teams', selectedTournament],
    queryFn: async () => {
      const res = await api.get(`/doubles/tournament/${selectedTournament}`);
      return res.data;
    },
    enabled: !!selectedTournament,
  });

  const { data: unpaired = [] } = useQuery({
    queryKey: ['doubles-unpaired', selectedTournament],
    queryFn: async () => {
      const res = await api.get(`/doubles/tournament/${selectedTournament}/unpaired`);
      return res.data;
    },
    enabled: !!selectedTournament,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/doubles/tournament/${selectedTournament}/team`, newTeam);
      return res.data;
    },
    onSuccess: () => {
      refetchTeams();
      queryClient.invalidateQueries({ queryKey: ['doubles-unpaired', selectedTournament] });
      setShowCreateModal(false);
      setCreateError('');
      setNewTeam({ player1Id: '', player2Id: '', teamName: '' });
    },
    onError: (err: any) => {
      setCreateError(err?.response?.data?.message || 'Error al crear la pareja.');
    },
  });

  const pairMutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch(`/doubles/team/${selectedTeam.id}/pair`, { player2Id: pairPlayerId });
      return res.data;
    },
    onSuccess: () => {
      refetchTeams();
      queryClient.invalidateQueries({ queryKey: ['doubles-unpaired', selectedTournament] });
      setShowPairModal(false);
      setPairPlayerId('');
    },
  });

  // Eliminar pareja
  const deleteMutation = useMutation({
    mutationFn: async (teamId: string) => {
      await api.delete(`/doubles/team/${teamId}`);
    },
    onSuccess: () => {
      refetchTeams();
      queryClient.invalidateQueries({ queryKey: ['doubles-unpaired', selectedTournament] });
      setConfirmDeleteTeam(null);
    },
  });

  // Editar pareja
  const editMutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch(`/doubles/team/${editTeam.id}`, editData);
      return res.data;
    },
    onSuccess: () => {
      refetchTeams();
      queryClient.invalidateQueries({ queryKey: ['doubles-unpaired', selectedTournament] });
      setShowEditModal(false);
      setEditTeam(null);
      setEditError('');
    },
    onError: (err: any) => {
      setEditError(err?.response?.data?.message || 'Error al guardar los cambios.');
    },
  });

  // Cambiar categoría de pareja
  const changeCatMutation = useMutation({
    mutationFn: async ({ teamId, newCategory }: { teamId: string; newCategory: string }) => {
      const res = await api.patch(`/doubles/team/${teamId}/change-category`, { newCategory });
      return res.data;
    },
    onSuccess: () => {
      refetchTeams();
      setEditTeam(null);
      setShowEditModal(false);
    },
    onError: (err: any) => {
      setEditError(err?.response?.data?.message || 'Error al cambiar la categoría.');
    },
  });

  // Aprobar pago del jugador 1
  const approveP1Mutation = useMutation({
    mutationFn: async (teamId: string) => {
      const res = await api.patch(`/doubles/team/${teamId}/approve-payment/1`);
      return res.data;
    },
    onSuccess: () => refetchTeams(),
  });

  // Aprobar pago del jugador 2
  const approveP2Mutation = useMutation({
    mutationFn: async (teamId: string) => {
      const res = await api.patch(`/doubles/team/${teamId}/approve-payment/2`);
      return res.data;
    },
    onSuccess: () => refetchTeams(),
  });

  // Inscribir jugador solo-dobles
  const createPlayerMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(
        `/enrollments/enroll-single/${selectedTournament}`,
        { ...newPlayer, modality: 'doubles' },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doubles-unpaired', selectedTournament] });
      setShowNewPlayerForm(false);
      setNewPlayer({ nombres: '', apellidos: '', email: '', telefono: '', docNumber: '', category: 'TERCERA' });
    },
  });

  // ── Helpers de precios ────────────────────────────────────────────────────
  const playerOnlyValue  = Number((tournament as any)?.doublesPlayerValue || tournament?.doublesValue || 0);
  const singlesExtraValue = Number(tournament?.doublesAdditionalValue || 0);
  const singlesIncluded   = tournament?.doublesIncludedForSingles;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />
      <main className="flex-1 p-8">

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 className="text-2xl font-bold text-lat-dark">Dobles</h1>
            <p style={{ color: '#6B7280', fontSize: '14px' }}>Gestión de parejas · cobro individual por jugador</p>
          </div>
          {selectedTournament && tournament?.hasDoubles && isAdmin && (
            <button
              onClick={() => { setShowCreateModal(true); setCreateError(''); setSearch1(''); setSearch2(''); setOpen1(false); setOpen2(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                backgroundColor: '#2D6A2D', color: 'white',
                padding: '10px 18px', borderRadius: '8px',
                border: 'none', cursor: 'pointer', fontWeight: '600',
              }}
            >
              <Plus size={16} /> Nueva Pareja
            </button>
          )}
        </div>

        {/* ── Selector torneo ── */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
            Selecciona el torneo
          </label>
          <select
            value={selectedTournament}
            onChange={e => {
              setSelectedTournament(e.target.value);
              setNewPlayer(p => ({ ...p, category: '' }));
            }}
            style={{ border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', minWidth: '300px' }}
          >
            <option value="">Seleccionar torneo...</option>
            {(tournaments as any[]).map((t: any) => (
              <option key={t.id} value={t.id}>{t.name} {t.hasDoubles ? '🤝' : ''}</option>
            ))}
          </select>

          {selectedTournament && !tournament?.hasDoubles && (
            <p style={{ marginTop: '10px', fontSize: '13px', color: '#DC2626', backgroundColor: '#FEF2F2', padding: '8px 12px', borderRadius: '8px', border: '1px solid #FECACA' }}>
              ❌ Este torneo no tiene modalidad de dobles habilitada.
            </p>
          )}

          {/* ── Info precios por jugador ── */}
          {selectedTournament && tournament?.hasDoubles && (
            <div style={{ marginTop: '14px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Estructura de cobro por jugador
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ backgroundColor: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: '8px', padding: '10px 14px', fontSize: '13px' }}>
                  <span style={{ display: 'block', fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Solo dobles (sin singles)</span>
                  <strong style={{ color: '#C2410C', fontSize: '15px' }}>
                    ${playerOnlyValue.toLocaleString('es-CO')} COP
                  </strong>
                  <span style={{ color: '#9CA3AF', fontSize: '11px' }}> / jugador</span>
                </div>
                <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '10px 14px', fontSize: '13px' }}>
                  <span style={{ display: 'block', fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Jugador de singles + dobles</span>
                  <strong style={{ color: '#15803D', fontSize: '15px' }}>
                    {singlesIncluded ? 'Gratis' : `$${singlesExtraValue.toLocaleString('es-CO')} COP`}
                  </strong>
                  <span style={{ color: '#9CA3AF', fontSize: '11px' }}> / jugador</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Tabla de parejas ── */}
        {selectedTournament && tournament?.hasDoubles && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1B3A1B' }}>
                Parejas registradas ({(teams as any[]).length})
              </h2>
            </div>

            {(teams as any[]).length === 0 ? (
              <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '24px' }}>
                No hay parejas registradas aún.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F9FAFB' }}>
                      <th style={th}>Pareja</th>
                      <th style={th}>Cat.</th>
                      <th style={th}>Jugador 1</th>
                      <th style={th}>Pago J1</th>
                      <th style={th}>Jugador 2</th>
                      <th style={th}>Pago J2</th>
                      <th style={th}>Total</th>
                      <th style={th}>Estado</th>
                      {isAdmin && <th style={th}>Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(teams as any[]).map((team: any, i: number) => {
                      const p1Pay = payColor(team.player1PaymentStatus || 'pending');
                      const p2Pay = payColor(team.player2PaymentStatus || 'pending');
                      const p1Amount = Number(team.player1AmountCharged || 0);
                      const p2Amount = Number(team.player2AmountCharged || 0);
                      const total   = Number(team.amountCharged || 0);

                      return (
                        <tr key={team.id} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: i % 2 === 0 ? 'white' : '#F9FAFB' }}>

                          {/* Nombre pareja */}
                          <td style={td}>
                            <span style={{ fontWeight: '600', color: '#1B3A1B' }}>
                              {team.teamName || `Pareja ${i + 1}`}
                            </span>
                          </td>

                          {/* Categoría */}
                          <td style={td}>
                            <span style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600' }}>
                              {team.category}
                            </span>
                          </td>

                          {/* Jugador 1 */}
                          <td style={td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              {team.player1Name}
                              {team.player1HasSingles
                                ? <span title="Juega singles" style={badgeS}>S</span>
                                : <span title="Solo dobles" style={badgeD}>D</span>
                              }
                            </div>
                            {p1Amount > 0 && (
                              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                                ${p1Amount.toLocaleString('es-CO')} COP
                              </div>
                            )}
                          </td>

                          {/* Estado pago jugador 1 */}
                          <td style={td}>
                            <span style={{ backgroundColor: p1Pay.bg, color: p1Pay.color, padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                              {p1Pay.label}
                            </span>
                            {isAdmin && team.player1PaymentStatus === 'pending' && p1Amount > 0 && (
                              <button
                                onClick={() => approveP1Mutation.mutate(team.id)}
                                disabled={approveP1Mutation.isPending}
                                style={{ ...approveBtn, marginTop: '4px', display: 'block' }}
                              >
                                💵 Confirmar
                              </button>
                            )}
                          </td>

                          {/* Jugador 2 */}
                          <td style={td}>
                            {team.player2Id ? (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  {team.player2Name}
                                  {team.player2HasSingles
                                    ? <span title="Juega singles" style={badgeS}>S</span>
                                    : <span title="Solo dobles" style={badgeD}>D</span>
                                  }
                                </div>
                                {p2Amount > 0 && (
                                  <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                                    ${p2Amount.toLocaleString('es-CO')} COP
                                  </div>
                                )}
                              </>
                            ) : (
                              <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '12px' }}>Sin compañero</span>
                            )}
                          </td>

                          {/* Estado pago jugador 2 */}
                          <td style={td}>
                            {team.player2Id ? (
                              <>
                                <span style={{ backgroundColor: p2Pay.bg, color: p2Pay.color, padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                  {p2Pay.label}
                                </span>
                                {isAdmin && team.player2PaymentStatus === 'pending' && p2Amount > 0 && (
                                  <button
                                    onClick={() => approveP2Mutation.mutate(team.id)}
                                    disabled={approveP2Mutation.isPending}
                                    style={{ ...approveBtn, marginTop: '4px', display: 'block' }}
                                  >
                                    💵 Confirmar
                                  </button>
                                )}
                              </>
                            ) : <span style={{ color: '#D1D5DB' }}>—</span>}
                          </td>

                          {/* Total */}
                          <td style={td}>
                            <span style={{ fontWeight: '700', color: total === 0 ? '#15803D' : '#1B3A1B' }}>
                              {total === 0 ? 'Gratis' : `$${total.toLocaleString('es-CO')}`}
                            </span>
                          </td>

                          {/* Estado pareja */}
                          <td style={td}>
                            <span style={{
                              backgroundColor: team.status === 'approved' ? '#F0FDF4' : '#FEF9C3',
                              color: team.status === 'approved' ? '#15803D' : '#92400E',
                              padding: '3px 8px', borderRadius: '999px',
                              fontSize: '11px', fontWeight: '600',
                            }}>
                              {team.status === 'approved' ? '✓ Confirmada' : '⏳ Pendiente'}
                            </span>
                          </td>

                          {/* Acciones */}
                          {isAdmin && (
                            <td style={{ ...td, whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                {!team.player2Id && (
                                  <button
                                    onClick={() => { setSelectedTeam(team); setShowPairModal(true); }}
                                    style={{ backgroundColor: '#2D6A2D', color: 'white', padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                                  >
                                    Emparejar
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setEditTeam(team);
                                    setEditData({ player1Id: team.player1Id, player2Id: team.player2Id || '', teamName: team.teamName || '' });
                                    setEditSearch1(''); setEditSearch2('');
                                    setEditOpen1(false); setEditOpen2(false);
                                    setEditError('');
                                    setShowEditModal(true);
                                  }}
                                  style={{ backgroundColor: '#1D4ED8', color: 'white', padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteTeam(team)}
                                  style={{ backgroundColor: '#DC2626', color: 'white', padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                                >
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Jugadores sin compañero ── */}
        {selectedTournament && tournament?.hasDoubles && (unpaired as any[]).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#92400E' }}>
                ⚠️ Jugadores sin compañero ({(unpaired as any[]).length})
              </h2>
              {isAdmin && (
                <button
                  onClick={() => {
                    if (!showNewPlayerForm) {
                      setNewPlayer(p => ({ ...p, category: tournamentCategories[0] || '' }));
                    }
                    setShowNewPlayerForm(!showNewPlayerForm);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    backgroundColor: '#F0FDF4', color: '#15803D',
                    border: '1px solid #86EFAC', borderRadius: '8px',
                    padding: '7px 13px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                  }}
                >
                  <UserPlus size={14} />
                  Inscribir jugador solo-dobles
                </button>
              )}
            </div>

            {/* Mini-formulario nuevo jugador solo-dobles */}
            {showNewPlayerForm && (
              <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                <p style={{ fontSize: '12px', fontWeight: '700', color: '#15803D', marginBottom: '10px' }}>
                  Inscribir jugador que solo juega dobles
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
                  {[
                    { key: 'nombres',   label: 'Nombres' },
                    { key: 'apellidos', label: 'Apellidos' },
                    { key: 'email',     label: 'Email *' },
                    { key: 'telefono',  label: 'Teléfono' },
                    { key: 'docNumber', label: 'Documento' },
                  ].map(({ key, label }) => (
                    <input
                      key={key}
                      placeholder={label}
                      value={(newPlayer as any)[key]}
                      onChange={e => setNewPlayer({ ...newPlayer, [key]: e.target.value })}
                      style={{ border: '1px solid #D1D5DB', borderRadius: '6px', padding: '6px 10px', fontSize: '12px' }}
                    />
                  ))}
                  <select
                    value={newPlayer.category}
                    onChange={e => setNewPlayer({ ...newPlayer, category: e.target.value })}
                    style={{ border: '1px solid #D1D5DB', borderRadius: '6px', padding: '6px 10px', fontSize: '12px' }}
                  >
                    {tournamentCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setShowNewPlayerForm(false)}
                    style={{ flex: 1, padding: '7px', borderRadius: '7px', border: '1px solid #D1D5DB', background: 'white', color: '#374151', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => createPlayerMutation.mutate()}
                    disabled={!newPlayer.email || createPlayerMutation.isPending}
                    style={{ flex: 2, padding: '7px', borderRadius: '7px', border: 'none', background: '#2D6A2D', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    {createPlayerMutation.isPending ? 'Inscribiendo...' : '+ Inscribir'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(unpaired as any[]).map((p: any) => (
                <div key={p.id} style={{ border: '1px solid #FDE68A', backgroundColor: '#FFFBEB', borderRadius: '8px', padding: '8px 14px', fontSize: '13px' }}>
                  <span style={{ fontWeight: '500', color: '#1B3A1B' }}>{p.name}</span>
                  <span style={{ marginLeft: '8px', color: '#6B7280', fontSize: '11px' }}>{p.category}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* MODAL: NUEVA PAREJA                                            */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {showCreateModal && (
          <div style={overlay} onClick={() => { setShowCreateModal(false); setOpen1(false); setOpen2(false); }}>
            <div style={modal} onClick={e => e.stopPropagation()}>
              <h3 style={modalTitle}>Nueva Pareja de Dobles</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={lbl}>Nombre de la pareja (opcional)</label>
                  <input value={newTeam.teamName} onChange={e => setNewTeam({ ...newTeam, teamName: e.target.value })}
                    style={inp} placeholder="Ej: Los Invencibles" />
                </div>
                {/* Jugador 1 — buscador */}
                <div style={{ position: 'relative' }}>
                  <label style={lbl}>Jugador 1 <span style={{ color: '#EF4444' }}>*</span></label>
                  {newTeam.player1Id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1.5px solid #2D6A2D', borderRadius: '8px', padding: '8px 12px', backgroundColor: '#F0FDF4' }}>
                      <span style={{ flex: 1, fontSize: '13px', color: '#1B3A1B', fontWeight: '500' }}>
                        {(unpaired as any[]).find(p => p.id === newTeam.player1Id)?.name} —{' '}
                        <span style={{ color: '#6B7280', fontWeight: 400 }}>{(unpaired as any[]).find(p => p.id === newTeam.player1Id)?.category}</span>
                      </span>
                      <button onClick={() => { setNewTeam({ ...newTeam, player1Id: '' }); setSearch1(''); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '16px', lineHeight: 1 }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <input
                        autoFocus
                        value={search1}
                        onChange={e => { setSearch1(e.target.value); setOpen1(true); }}
                        onFocus={() => setOpen1(true)}
                        placeholder="Buscar jugador..."
                        style={{ ...inp, marginBottom: 0 }}
                      />
                      {open1 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, backgroundColor: 'white', border: '1.5px solid #D1D5DB', borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                          {(unpaired as any[])
                            .filter(p => p.name.toLowerCase().includes(search1.toLowerCase()) || p.category.toLowerCase().includes(search1.toLowerCase()))
                            .map((p: any) => (
                              <div key={p.id}
                                onMouseDown={() => { setNewTeam({ ...newTeam, player1Id: p.id }); setSearch1(''); setOpen1(false); }}
                                style={{ padding: '9px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #F3F4F6' }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}
                              >
                                <span style={{ fontWeight: '500', color: '#1B3A1B' }}>{p.name}</span>
                                <span style={{ marginLeft: '8px', fontSize: '11px', color: '#6B7280' }}>{p.category}</span>
                              </div>
                            ))}
                          {(unpaired as any[]).filter(p => p.name.toLowerCase().includes(search1.toLowerCase()) || p.category.toLowerCase().includes(search1.toLowerCase())).length === 0 && (
                            <div style={{ padding: '10px 12px', color: '#9CA3AF', fontSize: '13px' }}>Sin resultados</div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Jugador 2 — buscador */}
                <div style={{ position: 'relative' }}>
                  <label style={lbl}>Jugador 2 <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(opcional — puedes emparejarlo después)</span></label>
                  {newTeam.player2Id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1.5px solid #2D6A2D', borderRadius: '8px', padding: '8px 12px', backgroundColor: '#F0FDF4' }}>
                      <span style={{ flex: 1, fontSize: '13px', color: '#1B3A1B', fontWeight: '500' }}>
                        {(unpaired as any[]).find(p => p.id === newTeam.player2Id)?.name} —{' '}
                        <span style={{ color: '#6B7280', fontWeight: 400 }}>{(unpaired as any[]).find(p => p.id === newTeam.player2Id)?.category}</span>
                      </span>
                      <button onClick={() => { setNewTeam({ ...newTeam, player2Id: '' }); setSearch2(''); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '16px', lineHeight: 1 }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <input
                        value={search2}
                        onChange={e => { setSearch2(e.target.value); setOpen2(true); }}
                        onFocus={() => setOpen2(true)}
                        placeholder="Buscar compañero (opcional)..."
                        style={{ ...inp, marginBottom: 0 }}
                      />
                      {open2 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, backgroundColor: 'white', border: '1.5px solid #D1D5DB', borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                          {(unpaired as any[])
                            .filter(p => p.id !== newTeam.player1Id && (p.name.toLowerCase().includes(search2.toLowerCase()) || p.category.toLowerCase().includes(search2.toLowerCase())))
                            .map((p: any) => (
                              <div key={p.id}
                                onMouseDown={() => { setNewTeam({ ...newTeam, player2Id: p.id }); setSearch2(''); setOpen2(false); }}
                                style={{ padding: '9px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #F3F4F6' }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}
                              >
                                <span style={{ fontWeight: '500', color: '#1B3A1B' }}>{p.name}</span>
                                <span style={{ marginLeft: '8px', fontSize: '11px', color: '#6B7280' }}>{p.category}</span>
                              </div>
                            ))}
                          {(unpaired as any[]).filter(p => p.id !== newTeam.player1Id && (p.name.toLowerCase().includes(search2.toLowerCase()) || p.category.toLowerCase().includes(search2.toLowerCase()))).length === 0 && (
                            <div style={{ padding: '10px 12px', color: '#9CA3AF', fontSize: '13px' }}>Sin resultados</div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Preview cobro */}
                {newTeam.player1Id && (
                  <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '12px', fontSize: '12px' }}>
                    <p style={{ fontWeight: '700', color: '#15803D', marginBottom: '6px' }}>💰 Preview cobro individual</p>
                    {(() => {
                      const p1 = (unpaired as any[]).find(p => p.id === newTeam.player1Id);
                      const p2 = (unpaired as any[]).find(p => p.id === newTeam.player2Id);
                      // En unpaired todos son jugadores que ya están inscritos en algo
                      // El cobro exacto lo calcula el backend, aquí mostramos orientativo
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#374151' }}>
                          {p1 && <span>• {p1.name}: ${playerOnlyValue.toLocaleString('es-CO')} COP (aprox.)</span>}
                          {p2 && <span>• {p2.name}: ${playerOnlyValue.toLocaleString('es-CO')} COP (aprox.)</span>}
                          <span style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
                            * El monto exacto depende de si cada jugador está inscrito en singles
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {createMutation.isError && (
                  <p style={{ fontSize: '13px', color: '#DC2626', backgroundColor: '#FEF2F2', padding: '8px 12px', borderRadius: '8px' }}>
                    ⚠️ {createError || 'Error al crear la pareja.'}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
                  <button onClick={() => setShowCreateModal(false)} style={cancelBtnStyle}>Cancelar</button>
                  <button
                    onClick={() => createMutation.mutate()}
                    disabled={!newTeam.player1Id || createMutation.isPending}
                    style={{ ...confirmBtnStyle, opacity: !newTeam.player1Id || createMutation.isPending ? 0.6 : 1 }}
                  >
                    {createMutation.isPending ? 'Creando...' : 'Crear Pareja'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* MODAL: EMPAREJAR                                               */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {showPairModal && selectedTeam && (
          <div style={overlay} onClick={() => setShowPairModal(false)}>
            <div style={modal} onClick={e => e.stopPropagation()}>
              <h3 style={modalTitle}>Asignar Compañero</h3>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>
                Pareja: <strong>{selectedTeam.teamName || 'Sin nombre'}</strong> · {selectedTeam.player1Name}
              </p>
              <div>
                <label style={lbl}>Seleccionar compañero</label>
                <select value={pairPlayerId} onChange={e => setPairPlayerId(e.target.value)} style={inp}>
                  <option value="">Seleccionar jugador...</option>
                  {(unpaired as any[]).filter(p => p.id !== selectedTeam.player1Id).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} — {p.category}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
                <button onClick={() => setShowPairModal(false)} style={cancelBtnStyle}>Cancelar</button>
                <button
                  onClick={() => pairMutation.mutate()}
                  disabled={!pairPlayerId || pairMutation.isPending}
                  style={{ ...confirmBtnStyle, opacity: !pairPlayerId || pairMutation.isPending ? 0.6 : 1 }}
                >
                  {pairMutation.isPending ? 'Guardando...' : 'Confirmar pareja'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* MODAL: EDITAR PAREJA                                           */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {showEditModal && editTeam && (
          <div style={overlay} onClick={() => setShowEditModal(false)}>
            <div style={modal} onClick={e => e.stopPropagation()}>
              <h3 style={modalTitle}>Editar Pareja</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* Nombre */}
                <div>
                  <label style={lbl}>Nombre de la pareja (opcional)</label>
                  <input value={editData.teamName} onChange={e => setEditData({ ...editData, teamName: e.target.value })}
                    style={inp} placeholder="Ej: Los Invencibles" />
                </div>

                {/* Categoría — separado del recálculo de jugadores */}
                <div style={{ backgroundColor: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: '10px', padding: '12px' }}>
                  <label style={{ ...lbl, color: '#C2410C', marginBottom: '8px' }}>Categoría de la pareja</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      value={editTeam?.category || ''}
                      onChange={async e => {
                        const newCat = e.target.value;
                        if (!newCat || newCat === editTeam?.category) return;
                        changeCatMutation.mutate({ teamId: editTeam.id, newCategory: newCat });
                      }}
                      disabled={changeCatMutation.isPending}
                      style={{ ...inp, marginBottom: 0, flex: 1, borderColor: '#FDBA74' }}
                    >
                      {tournamentCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {changeCatMutation.isPending && <span style={{ fontSize: '11px', color: '#C2410C' }}>Guardando...</span>}
                  </div>
                  <p style={{ fontSize: '11px', color: '#92400E', marginTop: '6px', marginBottom: 0 }}>
                    ⚠️ Solo disponible si no hay cuadros generados para esta categoría.
                  </p>
                </div>

                {/* Jugador 1 */}
                <div style={{ position: 'relative' }}>
                  <label style={lbl}>Jugador 1 <span style={{ color: '#EF4444' }}>*</span></label>
                  {editData.player1Id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1.5px solid #2D6A2D', borderRadius: '8px', padding: '8px 12px', backgroundColor: '#F0FDF4' }}>
                      <span style={{ flex: 1, fontSize: '13px', color: '#1B3A1B', fontWeight: '500' }}>
                        {[...(unpaired as any[]), { id: editTeam.player1Id, name: editTeam.player1Name, category: editTeam.category }, { id: editTeam.player2Id, name: editTeam.player2Name, category: editTeam.category }]
                          .find(p => p?.id === editData.player1Id)?.name}
                      </span>
                      <button onClick={() => { setEditData({ ...editData, player1Id: '' }); setEditSearch1(''); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '16px', lineHeight: 1 }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <input autoFocus value={editSearch1}
                        onChange={e => { setEditSearch1(e.target.value); setEditOpen1(true); }}
                        onFocus={() => setEditOpen1(true)}
                        placeholder="Buscar jugador..." style={{ ...inp, marginBottom: 0 }} />
                      {editOpen1 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, backgroundColor: 'white', border: '1.5px solid #D1D5DB', borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: '180px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                          {[...(unpaired as any[]),
                            ...(editTeam.player1Id && !(unpaired as any[]).find((p: any) => p.id === editTeam.player1Id)
                              ? [{ id: editTeam.player1Id, name: editTeam.player1Name, category: editTeam.category }] : []),
                            ...(editTeam.player2Id && !(unpaired as any[]).find((p: any) => p.id === editTeam.player2Id)
                              ? [{ id: editTeam.player2Id, name: editTeam.player2Name, category: editTeam.category }] : []),
                          ]
                            .filter(p => p?.id !== editData.player2Id && (p?.name?.toLowerCase().includes(editSearch1.toLowerCase()) || p?.category?.toLowerCase().includes(editSearch1.toLowerCase())))
                            .map((p: any) => (
                              <div key={p.id} onMouseDown={() => { setEditData({ ...editData, player1Id: p.id }); setEditSearch1(''); setEditOpen1(false); }}
                                style={{ padding: '9px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #F3F4F6' }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}>
                                <span style={{ fontWeight: '500', color: '#1B3A1B' }}>{p.name}</span>
                                <span style={{ marginLeft: '8px', fontSize: '11px', color: '#6B7280' }}>{p.category}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Jugador 2 */}
                <div style={{ position: 'relative' }}>
                  <label style={lbl}>Jugador 2 <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(opcional)</span></label>
                  {editData.player2Id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1.5px solid #2D6A2D', borderRadius: '8px', padding: '8px 12px', backgroundColor: '#F0FDF4' }}>
                      <span style={{ flex: 1, fontSize: '13px', color: '#1B3A1B', fontWeight: '500' }}>
                        {[...(unpaired as any[]), { id: editTeam.player2Id, name: editTeam.player2Name, category: editTeam.category }]
                          .find(p => p?.id === editData.player2Id)?.name}
                      </span>
                      <button onClick={() => { setEditData({ ...editData, player2Id: '' }); setEditSearch2(''); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '16px', lineHeight: 1 }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <input value={editSearch2}
                        onChange={e => { setEditSearch2(e.target.value); setEditOpen2(true); }}
                        onFocus={() => setEditOpen2(true)}
                        placeholder="Buscar compañero (opcional)..." style={{ ...inp, marginBottom: 0 }} />
                      {editOpen2 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, backgroundColor: 'white', border: '1.5px solid #D1D5DB', borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: '180px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                          {[...(unpaired as any[]),
                            ...(editTeam.player2Id && !(unpaired as any[]).find((p: any) => p.id === editTeam.player2Id)
                              ? [{ id: editTeam.player2Id, name: editTeam.player2Name, category: editTeam.category }] : []),
                          ]
                            .filter(p => p?.id !== editData.player1Id && (p?.name?.toLowerCase().includes(editSearch2.toLowerCase()) || p?.category?.toLowerCase().includes(editSearch2.toLowerCase())))
                            .map((p: any) => (
                              <div key={p.id} onMouseDown={() => { setEditData({ ...editData, player2Id: p.id }); setEditSearch2(''); setEditOpen2(false); }}
                                style={{ padding: '9px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #F3F4F6' }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}>
                                <span style={{ fontWeight: '500', color: '#1B3A1B' }}>{p.name}</span>
                                <span style={{ marginLeft: '8px', fontSize: '11px', color: '#6B7280' }}>{p.category}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {editError && (
                  <p style={{ fontSize: '13px', color: '#DC2626', backgroundColor: '#FEF2F2', padding: '8px 12px', borderRadius: '8px' }}>
                    ⚠️ {editError}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
                  <button onClick={() => setShowEditModal(false)} style={cancelBtnStyle}>Cancelar</button>
                  <button
                    onClick={() => editMutation.mutate()}
                    disabled={!editData.player1Id || editMutation.isPending}
                    style={{ ...confirmBtnStyle, opacity: !editData.player1Id || editMutation.isPending ? 0.6 : 1 }}
                  >
                    {editMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* MODAL: CONFIRMAR ELIMINACIÓN                                   */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {confirmDeleteTeam && (
          <div style={overlay} onClick={() => setConfirmDeleteTeam(null)}>
            <div style={{ ...modal, width: '380px' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ ...modalTitle, color: '#DC2626' }}>Eliminar Pareja</h3>
              <p style={{ fontSize: '14px', color: '#374151', marginBottom: '8px' }}>
                ¿Eliminar la pareja <strong>{confirmDeleteTeam.teamName || `${confirmDeleteTeam.player1Name} / ${confirmDeleteTeam.player2Name || 'Sin compañero'}`}</strong>?
              </p>
              <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '20px' }}>
                Esta acción no se puede deshacer. Los jugadores quedarán disponibles para ser emparejados nuevamente.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setConfirmDeleteTeam(null)} style={cancelBtnStyle}>Cancelar</button>
                <button
                  onClick={() => deleteMutation.mutate(confirmDeleteTeam.id)}
                  disabled={deleteMutation.isPending}
                  style={{ flex: 2, padding: '10px', borderRadius: '9px', border: 'none', backgroundColor: '#DC2626', color: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer', opacity: deleteMutation.isPending ? 0.6 : 1 }}
                >
                  {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────
const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', color: '#6B7280', fontWeight: '600', fontSize: '12px' };
const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'top' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' };
const inp: React.CSSProperties = { width: '100%', border: '1.5px solid #D1D5DB', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', boxSizing: 'border-box' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(3px)' };
const modal: React.CSSProperties = { backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '460px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' };
const modalTitle: React.CSSProperties = { fontSize: '18px', fontWeight: '700', color: '#1B3A1B', marginBottom: '20px' };
const cancelBtnStyle: React.CSSProperties = { flex: 1, padding: '10px', borderRadius: '9px', border: '1.5px solid #E5E7EB', backgroundColor: 'white', color: '#374151', fontWeight: '600', fontSize: '14px', cursor: 'pointer' };
const confirmBtnStyle: React.CSSProperties = { flex: 2, padding: '10px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg, #2D6A2D, #1B3A1B)', color: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer' };
const approveBtn: React.CSSProperties = { backgroundColor: '#1D4ED8', color: 'white', padding: '3px 8px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: '600' };
const badgeS: React.CSSProperties = { fontSize: '10px', backgroundColor: '#DCFCE7', color: '#15803D', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' };
const badgeD: React.CSSProperties = { fontSize: '10px', backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' };