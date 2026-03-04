import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, CheckCircle } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { tournamentsApi } from '../api/tournaments.api';

export default function Doubles() {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTournament, setSelectedTournament] = useState('');
  const [showCreateModal, setShowCreateModal]       = useState(false);
  const [showPairModal, setShowPairModal]           = useState(false);
  const [selectedTeam, setSelectedTeam]             = useState<any>(null);
  const [newTeam, setNewTeam]                       = useState({ player1Id: '', player2Id: '', teamName: '' });
  const [pairPlayerId, setPairPlayerId]             = useState('');

  const { data: tournaments = [] } = useQuery({
    queryKey: ['tournaments'],
    queryFn: tournamentsApi.getAll,
  });

  const tournament = (tournaments as any[]).find((t: any) => t.id === selectedTournament);

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

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/doubles/tournament/${selectedTournament}/team`, newTeam);
      return res.data;
    },
    onSuccess: () => {
      refetchTeams();
      queryClient.invalidateQueries({ queryKey: ['doubles-unpaired', selectedTournament] });
      setShowCreateModal(false);
      setNewTeam({ player1Id: '', player2Id: '', teamName: '' });
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

  const approvePaymentMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const res = await api.patch(`/doubles/team/${teamId}/approve-payment`);
      return res.data;
    },
    onSuccess: () => refetchTeams(),
  });

  const statusColor = (status: string) => {
    if (status === 'approved') return { bg: '#F0FDF4', color: '#15803D', label: '✓ Aprobado' };
    if (status === 'manual')   return { bg: '#EFF6FF', color: '#1D4ED8', label: '💵 Manual' };
    return { bg: '#FEF9C3', color: '#92400E', label: '⏳ Pendiente' };
  };

  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />
      <main className="flex-1 p-8">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 className="text-2xl font-bold text-lat-dark">Dobles</h1>
            <p style={{ color: '#6B7280', fontSize: '14px' }}>Gestión de parejas de dobles por torneo</p>
          </div>
          {selectedTournament && tournament?.hasDoubles && isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
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

        {/* Selector torneo */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
            Selecciona el torneo
          </label>
          <select
            value={selectedTournament}
            onChange={e => setSelectedTournament(e.target.value)}
            style={{ border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', minWidth: '300px' }}
          >
            <option value="">Seleccionar torneo...</option>
            {(tournaments as any[]).map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.hasDoubles ? '🤝' : ''}
              </option>
            ))}
          </select>

          {selectedTournament && !tournament?.hasDoubles && (
            <p style={{ marginTop: '10px', fontSize: '13px', color: '#DC2626', backgroundColor: '#FEF2F2', padding: '8px 12px', borderRadius: '8px', border: '1px solid #FECACA' }}>
              ❌ Este torneo no tiene modalidad de dobles habilitada.
            </p>
          )}

          {selectedTournament && tournament?.hasDoubles && (
            <div style={{ marginTop: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '8px 14px', fontSize: '13px' }}>
                <span style={{ color: '#6B7280' }}>Valor dobles: </span>
                <strong style={{ color: '#15803D' }}>
                  ${Number(tournament.doublesValue || 0).toLocaleString('es-CO')} COP
                </strong>
              </div>
              <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '8px 14px', fontSize: '13px' }}>
                <span style={{ color: '#6B7280' }}>Singles: </span>
                <strong style={{ color: '#15803D' }}>
                  {tournament.doublesIncludedForSingles ? 'Incluido' : `+$${Number(tournament.doublesAdditionalValue || 0).toLocaleString('es-CO')} COP`}
                </strong>
              </div>
              <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '8px 14px', fontSize: '13px' }}>
                <span style={{ color: '#6B7280' }}>Parejas registradas: </span>
                <strong style={{ color: '#1D4ED8' }}>{(teams as any[]).length}</strong>
              </div>
              <div style={{ backgroundColor: '#FEF9C3', border: '1px solid #FDE047', borderRadius: '8px', padding: '8px 14px', fontSize: '13px' }}>
                <span style={{ color: '#6B7280' }}>Sin compañero: </span>
                <strong style={{ color: '#92400E' }}>{(unpaired as any[]).length}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Tabla de parejas */}
        {selectedTournament && tournament?.hasDoubles && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1B3A1B', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} /> Parejas Registradas ({(teams as any[]).length})
            </h2>

            {(teams as any[]).length === 0 ? (
              <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '24px' }}>
                No hay parejas registradas aún.
              </p>
            ) : (
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6B7280', fontWeight: '500' }}>Pareja</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6B7280', fontWeight: '500' }}>Categoría</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6B7280', fontWeight: '500' }}>Jugador 1</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6B7280', fontWeight: '500' }}>Jugador 2</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6B7280', fontWeight: '500' }}>Monto</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6B7280', fontWeight: '500' }}>Pago</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6B7280', fontWeight: '500' }}>Estado</th>
                    {isAdmin && <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6B7280', fontWeight: '500' }}>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {(teams as any[]).map((team: any, i: number) => {
                    const pay = statusColor(team.paymentStatus);
                    return (
                      <tr key={team.id} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: i % 2 === 0 ? 'white' : '#F9FAFB' }}>
                        <td style={{ padding: '10px 12px', fontWeight: '600', color: '#1B3A1B' }}>
                          {team.teamName || `Pareja ${i + 1}`}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '2px 8px', borderRadius: '999px', fontSize: '11px' }}>
                            {team.category}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#374151' }}>
                          {team.player1Name}
                          {team.player1HasSingles && (
                            <span style={{ marginLeft: '4px', fontSize: '10px', backgroundColor: '#F0FDF4', color: '#15803D', padding: '1px 4px', borderRadius: '4px' }}>S</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: team.player2Id ? '#374151' : '#9CA3AF' }}>
                          {team.player2Name}
                          {team.player2HasSingles && (
                            <span style={{ marginLeft: '4px', fontSize: '10px', backgroundColor: '#F0FDF4', color: '#15803D', padding: '1px 4px', borderRadius: '4px' }}>S</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '500', color: '#1B3A1B' }}>
                          {team.amountCharged === 0 || team.amountCharged === '0'
                            ? <span style={{ color: '#15803D' }}>Incluido</span>
                            : team.amountFormatted
                          }
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ backgroundColor: pay.bg, color: pay.color, padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '500' }}>
                            {pay.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '500',
                            backgroundColor: team.status === 'approved' ? '#F0FDF4' : '#FEF9C3',
                            color: team.status === 'approved' ? '#15803D' : '#92400E',
                          }}>
                            {team.status === 'approved' ? '✓ Confirmada' : '⏳ Pendiente'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {!team.player2Id && (
                                <button
                                  onClick={() => { setSelectedTeam(team); setShowPairModal(true); }}
                                  style={{
                                    backgroundColor: '#2D6A2D', color: 'white',
                                    padding: '4px 10px', borderRadius: '6px',
                                    border: 'none', cursor: 'pointer', fontSize: '11px',
                                  }}
                                >
                                  Emparejar
                                </button>
                              )}
                              {team.paymentStatus === 'pending' && Number(team.amountCharged) > 0 && (
                                <button
                                  onClick={() => approvePaymentMutation.mutate(team.id)}
                                  style={{
                                    backgroundColor: '#1D4ED8', color: 'white',
                                    padding: '4px 10px', borderRadius: '6px',
                                    border: 'none', cursor: 'pointer', fontSize: '11px',
                                  }}
                                >
                                  💵 Pago manual
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
            )}
          </div>
        )}

        {/* Jugadores sin compañero */}
        {selectedTournament && tournament?.hasDoubles && (unpaired as any[]).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#92400E', marginBottom: '16px' }}>
              ⚠️ Jugadores sin compañero ({(unpaired as any[]).length})
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(unpaired as any[]).map((p: any) => (
                <div key={p.playerId} style={{
                  border: '1px solid #FDE68A', backgroundColor: '#FFFBEB',
                  borderRadius: '8px', padding: '8px 14px', fontSize: '13px',
                }}>
                  <span style={{ fontWeight: '500', color: '#1B3A1B' }}>{p.playerName}</span>
                  <span style={{ marginLeft: '8px', color: '#6B7280', fontSize: '11px' }}>{p.category}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal crear pareja */}
        {showCreateModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '460px', maxWidth: '95vw' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1B3A1B', marginBottom: '20px' }}>
                Nueva Pareja de Dobles
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                    Nombre de la pareja (opcional)
                  </label>
                  <input
                    value={newTeam.teamName}
                    onChange={e => setNewTeam({ ...newTeam, teamName: e.target.value })}
                    style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' as any }}
                    placeholder="Ej: Los Ases"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                    Jugador 1 — seleccionar de inscritos
                  </label>
                  <select
                    value={newTeam.player1Id}
                    onChange={e => setNewTeam({ ...newTeam, player1Id: e.target.value })}
                    style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 12px', fontSize: '14px' }}
                  >
                    <option value="">Seleccionar jugador...</option>
                    {(unpaired as any[]).map((p: any) => (
                      <option key={p.playerId} value={p.playerId}>
                        {p.playerName} — {p.category}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                    Jugador 2 (opcional — se puede emparejar después)
                  </label>
                  <select
                    value={newTeam.player2Id}
                    onChange={e => setNewTeam({ ...newTeam, player2Id: e.target.value })}
                    style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 12px', fontSize: '14px' }}
                  >
                    <option value="">Sin compañero por ahora...</option>
                    {(unpaired as any[])
                      .filter((p: any) => p.playerId !== newTeam.player1Id)
                      .map((p: any) => (
                        <option key={p.playerId} value={p.playerId}>
                          {p.playerName} — {p.category}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Preview monto */}
                {newTeam.player1Id && (
                  <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#15803D' }}>
                    💰 Monto a cobrar calculado automáticamente según configuración del torneo
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={!newTeam.player1Id || createMutation.isPending}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                    backgroundColor: '#2D6A2D', color: 'white', cursor: 'pointer',
                    fontSize: '14px', fontWeight: '600',
                    opacity: !newTeam.player1Id ? 0.5 : 1,
                  }}
                >
                  {createMutation.isPending ? 'Creando...' : 'Crear Pareja'}
                </button>
              </div>

              {createMutation.isError && (
                <p style={{ marginTop: '10px', fontSize: '12px', color: '#DC2626', textAlign: 'center' }}>
                  Error al crear pareja. Verifica que los jugadores no estén ya emparejados.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Modal emparejar */}
        {showPairModal && selectedTeam && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '400px', maxWidth: '95vw' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1B3A1B', marginBottom: '8px' }}>
                Emparejar Jugador
              </h3>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>
                Selecciona el compañero para <strong>{selectedTeam.player1Name}</strong>
              </p>
              <select
                value={pairPlayerId}
                onChange={e => setPairPlayerId(e.target.value)}
                style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', marginBottom: '16px' }}
              >
                <option value="">Seleccionar compañero...</option>
                {(unpaired as any[])
                  .filter((p: any) => p.playerId !== selectedTeam.player1Id)
                  .map((p: any) => (
                    <option key={p.playerId} value={p.playerId}>
                      {p.playerName} — {p.category}
                    </option>
                  ))}
              </select>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowPairModal(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: 'white', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => pairMutation.mutate()}
                  disabled={!pairPlayerId || pairMutation.isPending}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                    backgroundColor: '#2D6A2D', color: 'white', cursor: 'pointer',
                    fontWeight: '600', opacity: !pairPlayerId ? 0.5 : 1,
                  }}
                >
                  {pairMutation.isPending ? 'Emparejando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
