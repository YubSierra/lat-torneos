import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import api from '../api/axios';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

export default function Players() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', role: 'player',
    fullName: '', docNumber: '', birthDate: '',
    gender: 'M', clubId: '',
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/auth/register', {
        email: data.email,
        password: data.password,
        role: data.role,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowModal(false);
      setForm({
        email: '', password: '', role: 'player',
        fullName: '', docNumber: '', birthDate: '',
        gender: 'M', clubId: '',
      });
    },
  });

  const filtered = users.filter((u: any) =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-lat-dark">Jugadores</h1>
            <p className="text-gray-500">Gestión de usuarios y jugadores</p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowModal(true)} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              backgroundColor: '#2D6A2D', color: 'white',
              padding: '8px 16px', borderRadius: '8px',
              border: 'none', cursor: 'pointer', fontSize: '14px',
              fontWeight: '500',
            }}>
              <Plus size={18} />
              Nuevo Jugador
            </button>
          )}
        </div>

        {/* Buscador */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{
              position: 'absolute', left: '12px', top: '50%',
              transform: 'translateY(-50%)', color: '#9CA3AF',
            }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por correo..."
              style={{
                width: '100%', border: '1px solid #D1D5DB',
                borderRadius: '8px', padding: '8px 12px 8px 36px',
                fontSize: '14px', boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-lat-dark mb-4">
            Usuarios registrados ({filtered.length})
          </h2>

          {isLoading ? (
            <p className="text-gray-400 text-center py-8">Cargando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No hay usuarios registrados
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Email</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Rol</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Estado</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u: any, i: number) => (
                    <tr key={u.id}
                      className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                    >
                      <td className="py-3 px-4 font-medium text-lat-dark">
                        {u.email}
                      </td>
                      <td className="py-3 px-4">
                        <span style={{
                          padding: '2px 8px', borderRadius: '999px',
                          fontSize: '12px', fontWeight: '500',
                          backgroundColor:
                            u.role === 'super_admin' ? '#FEF3C7' :
                            u.role === 'admin'       ? '#DBEAFE' :
                            u.role === 'referee'     ? '#F3E8FF' :
                            '#DCFCE7',
                          color:
                            u.role === 'super_admin' ? '#92400E' :
                            u.role === 'admin'       ? '#1D4ED8' :
                            u.role === 'referee'     ? '#6B21A8' :
                            '#15803D',
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span style={{
                          padding: '2px 8px', borderRadius: '999px',
                          fontSize: '12px', fontWeight: '500',
                          backgroundColor: u.isActive ? '#DCFCE7' : '#FEE2E2',
                          color: u.isActive ? '#15803D' : '#DC2626',
                        }}>
                          {u.isActive ? '✓ Activo' : '✗ Inactivo'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {new Date(u.createdAt).toLocaleDateString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal crear jugador */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px',
            padding: '32px', width: '100%', maxWidth: '448px',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1B3A1B', marginBottom: '24px' }}>
              Crear Nuevo Jugador
            </h2>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})}
                  style={{
                    width: '100%', border: '1px solid #D1D5DB',
                    borderRadius: '8px', padding: '8px 12px',
                    fontSize: '14px', boxSizing: 'border-box',
                  }}
                  placeholder="jugador@email.com"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  Contraseña temporal
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  style={{
                    width: '100%', border: '1px solid #D1D5DB',
                    borderRadius: '8px', padding: '8px 12px',
                    fontSize: '14px', boxSizing: 'border-box',
                  }}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  Rol
                </label>
                <select
                  value={form.role}
                  onChange={e => setForm({...form, role: e.target.value})}
                  style={{
                    width: '100%', border: '1px solid #D1D5DB',
                    borderRadius: '8px', padding: '8px 12px', fontSize: '14px',
                  }}
                >
                  <option value="player">Jugador</option>
                  <option value="referee">Árbitro</option>
                  <option value="admin">Administrador</option>
                  <option value="club_admin">Admin Club</option>
                </select>
              </div>

              {createMutation.isError && (
                <div style={{
                  backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
                  color: '#DC2626', borderRadius: '8px', padding: '8px 16px',
                  fontSize: '14px',
                }}>
                  Error al crear el usuario
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{
                    flex: 1, border: '1px solid #D1D5DB', color: '#4B5563',
                    padding: '8px 16px', borderRadius: '8px', background: 'white',
                    cursor: 'pointer', fontSize: '14px',
                  }}>
                  Cancelar
                </button>
                <button type="submit" disabled={createMutation.isPending}
                  style={{
                    flex: 1, backgroundColor: '#2D6A2D', color: 'white',
                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                    cursor: 'pointer', fontSize: '14px', fontWeight: '500',
                    opacity: createMutation.isPending ? 0.5 : 1,
                  }}>
                  {createMutation.isPending ? 'Creando...' : 'Crear Jugador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}