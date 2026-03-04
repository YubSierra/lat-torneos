import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit } from 'lucide-react';
import { courtsApi } from '../api/courts.api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';

const SURFACES = [
  { value: 'clay',  label: '🟤 Arcilla' },
  { value: 'hard',  label: '🔵 Dura'    },
  { value: 'grass', label: '🟢 Pasto'   },
];

const emptyForm = { name: '', surface: 'clay', sede: '', location: '' };

export default function Courts() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingCourt, setEditingCourt] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: courts = [], isLoading } = useQuery({
    queryKey: ['courts'],
    queryFn: courtsApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: courtsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courts'] });
      setShowModal(false);
      setForm(emptyForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => courtsApi.update(editingCourt.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courts'] });
      setShowModal(false);
      setEditingCourt(null);
      setForm(emptyForm);
    },
  });

  const handleEdit = (court: any) => {
    setEditingCourt(court);
    setForm({
      name: court.name,
      surface: court.surface,
      sede: court.sede || '',
      location: court.location || '',
    });
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingCourt(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCourt) {
      updateMutation.mutate(form);
    } else {
      createMutation.mutate(form);
    }
  };
  const deleteMutation = useMutation({
  mutationFn: (id: string) => courtsApi.remove(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['courts'] });
  },
});

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-lat-dark">Canchas</h1>
            <p className="text-gray-500">Gestión de canchas y disponibilidad</p>
          </div>
          {isAdmin && (
            <button onClick={handleCreate} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              backgroundColor: '#2D6A2D', color: 'white',
              padding: '8px 16px', borderRadius: '8px',
              border: 'none', cursor: 'pointer', fontSize: '14px',
              fontWeight: '500',
            }}>
              <Plus size={18} />
              Agregar Cancha
            </button>
          )}
        </div>

        {/* Grid de canchas */}
        {isLoading ? (
          <p className="text-gray-400 text-center py-8">Cargando...</p>
        ) : courts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-4xl mb-4">🎾</p>
            <p className="text-gray-500">No hay canchas registradas</p>
            {isAdmin && (
              <button onClick={handleCreate} style={{
                marginTop: '16px', backgroundColor: '#2D6A2D',
                color: 'white', padding: '8px 16px',
                borderRadius: '8px', border: 'none', cursor: 'pointer',
              }}>
                Agregar primera cancha
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {courts.map((court: any) => (
              <div key={court.id}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="text-4xl mb-3">
                  {court.surface === 'clay'  ? '🟤' :
                   court.surface === 'hard'  ? '🔵' : '🟢'}
                </div>
                <h3 className="font-bold text-lat-dark text-lg mb-1">{court.name}</h3>
                <p className="text-gray-500 text-sm mb-2">
                  {SURFACES.find(s => s.value === court.surface)?.label}
                </p>
                {court.sede && (
                  <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                    🏟️ {court.sede}
                  </p>
                )}
                {court.location && (
                  <p className="text-gray-400 text-xs mb-3">📍 {court.location}</p>
                )}
                <div className="flex items-center justify-between mt-3">
  <span style={{
    padding: '2px 8px', borderRadius: '999px',
    fontSize: '12px', fontWeight: '500',
    backgroundColor: court.isActive ? '#DCFCE7' : '#FEE2E2',
    color: court.isActive ? '#15803D' : '#DC2626',
  }}>
    {court.isActive ? '✓ Disponible' : '✗ No disponible'}
  </span>
  {isAdmin && (
    <div style={{ display: 'flex', gap: '4px' }}>
      <button
        onClick={() => handleEdit(court)}
        style={{
          background: 'none', border: 'none',
          cursor: 'pointer', color: '#2D6A2D',
          display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '12px', padding: '4px 8px',
          borderRadius: '6px',
        }}
      >
        <Edit size={14} />
        Editar
      </button>
      <button
        onClick={() => {
          if (confirm(`¿Eliminar ${court.name}?`)) {
            deleteMutation.mutate(court.id);
          }
        }}
        style={{
          background: 'none', border: 'none',
          cursor: 'pointer', color: '#DC2626',
          display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '12px', padding: '4px 8px',
          borderRadius: '6px',
        }}
      >
        <Edit size={14} />
        Eliminar
      </button>
    </div>
  )}
</div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal crear/editar cancha */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px',
            padding: '32px', width: '100%', maxWidth: '448px',
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1B3A1B', marginBottom: '24px' }}>
              {editingCourt ? 'Editar Cancha' : 'Agregar Cancha'}
            </h2>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  Nombre de la cancha
                </label>
                <input
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  style={{
                    width: '100%', border: '1px solid #D1D5DB',
                    borderRadius: '8px', padding: '8px 12px',
                    fontSize: '14px', boxSizing: 'border-box',
                  }}
                  placeholder="Cancha 1"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  Superficie
                </label>
                <select
                  value={form.surface}
                  onChange={e => setForm({...form, surface: e.target.value})}
                  style={{
                    width: '100%', border: '1px solid #D1D5DB',
                    borderRadius: '8px', padding: '8px 12px', fontSize: '14px',
                  }}
                >
                  {SURFACES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  Sede
                </label>
                <input
                  value={form.sede}
                  onChange={e => setForm({...form, sede: e.target.value})}
                  style={{
                    width: '100%', border: '1px solid #D1D5DB',
                    borderRadius: '8px', padding: '8px 12px',
                    fontSize: '14px', boxSizing: 'border-box' as any,
                  }}
                  placeholder="Sede María Luisa, Sede Estadio..."
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  Ubicación (opcional)
                </label>
                <input
                  value={form.location}
                  onChange={e => setForm({...form, location: e.target.value})}
                  style={{
                    width: '100%', border: '1px solid #D1D5DB',
                    borderRadius: '8px', padding: '8px 12px',
                    fontSize: '14px', boxSizing: 'border-box',
                  }}
                  placeholder="Club de Tenis Medellín"
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
                <button type="button" onClick={() => { setShowModal(false); setEditingCourt(null); }}
                  style={{
                    flex: 1, border: '1px solid #D1D5DB', color: '#4B5563',
                    padding: '8px 16px', borderRadius: '8px', background: 'white',
                    cursor: 'pointer', fontSize: '14px',
                  }}>
                  Cancelar
                </button>
                <button type="submit" disabled={isPending}
                  style={{
                    flex: 1, backgroundColor: '#2D6A2D', color: 'white',
                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                    cursor: 'pointer', fontSize: '14px', fontWeight: '500',
                    opacity: isPending ? 0.5 : 1,
                  }}>
                  {isPending ? 'Guardando...' : editingCourt ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}