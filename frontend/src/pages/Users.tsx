import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserX, UserCheck } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Users() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
  });

  const filtered = (users as any[]).filter((u: any) => {
    const q = search.toLowerCase();
    return (
      `${u.nombres} ${u.apellidos}`.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.docNumber?.includes(q)
    );
  });

  const handleToggleActive = async (user: any) => {
    if (!confirm(`¿${user.isActive ? 'Desactivar' : 'Activar'} a ${user.nombres} ${user.apellidos}?`)) return;
    try {
      await api.patch(`/users/${user.id}`, { isActive: !user.isActive });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch {
      alert('Error al actualizar jugador');
    }
  };

  const handleDelete = async (user: any) => {
    if (!confirm(`¿ELIMINAR PERMANENTEMENTE a ${user.nombres} ${user.apellidos}?\nEsta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/users/${user.id}/hard`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch {
      alert('Error al eliminar jugador');
    }
  };

  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />
      <main className="flex-1 p-8">
        <div style={{ marginBottom: '24px' }}>
          <h1 className="text-2xl font-bold text-lat-dark">Jugadores</h1>
          <p style={{ color: '#6B7280', fontSize: '14px' }}>
            {(users as any[]).length} jugadores registrados
          </p>
        </div>

        {/* Buscador */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, email o documento..."
              style={{
                width: '100%', paddingLeft: '36px', padding: '8px 12px 8px 36px',
                border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <p style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF' }}>Cargando...</p>
          ) : filtered.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF' }}>No hay jugadores.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F9FAFB' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: '#6B7280', fontWeight: '500' }}>Nombre</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: '#6B7280', fontWeight: '500' }}>Email</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: '#6B7280', fontWeight: '500' }}>Documento</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: '#6B7280', fontWeight: '500' }}>Rol</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: '#6B7280', fontWeight: '500' }}>Estado</th>
                  {isAdmin && <th style={{ textAlign: 'left', padding: '12px 16px', color: '#6B7280', fontWeight: '500' }}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u: any, i: number) => (
                  <tr key={u.id} style={{ borderTop: '1px solid #F3F4F6', backgroundColor: i % 2 === 0 ? 'white' : '#F9FAFB' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '500', color: '#1B3A1B' }}>
                      {u.nombres} {u.apellidos}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6B7280' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px', color: '#6B7280' }}>{u.docNumber || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '500',
                        backgroundColor: u.role === 'admin' ? '#FEF3C7' : u.role === 'referee' ? '#EDE9FE' : '#DBEAFE',
                        color: u.role === 'admin' ? '#92400E' : u.role === 'referee' ? '#6D28D9' : '#1D4ED8',
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '500',
                        backgroundColor: u.isActive ? '#DCFCE7' : '#FEE2E2',
                        color: u.isActive ? '#15803D' : '#DC2626',
                      }}>
                        {u.isActive ? '✓ Activo' : '✗ Inactivo'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleToggleActive(u)}
                            title={u.isActive ? 'Desactivar' : 'Activar'}
                            style={{
                              padding: '4px 10px', borderRadius: '6px', border: 'none',
                              cursor: 'pointer', fontSize: '11px', fontWeight: '500',
                              backgroundColor: u.isActive ? '#FEF9C3' : '#F0FDF4',
                              color: u.isActive ? '#92400E' : '#15803D',
                            }}
                          >
                            {u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            title="Eliminar permanentemente"
                            style={{
                              padding: '4px 10px', borderRadius: '6px', border: '1px solid #FECACA',
                              cursor: 'pointer', fontSize: '11px',
                              backgroundColor: '#FEF2F2', color: '#DC2626',
                            }}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
