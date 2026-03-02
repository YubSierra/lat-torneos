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

export default function Courts() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '', surface: 'clay', location: ''
  });

  const { data: courts = [], isLoading } = useQuery({
    queryKey: ['courts'],
    queryFn: courtsApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: courtsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courts'] });
      setShowModal(false);
      setForm({ name: '', surface: 'clay', location: '' });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
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
            <h1 className="text-2xl font-bold text-lat-dark">Canchas</h1>
            <p className="text-gray-500">Gestión de canchas y disponibilidad</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-lat-green hover:bg-lat-dark text-white px-4 py-2 rounded-lg transition-colors"
            >
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
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 bg-lat-green text-white px-4 py-2 rounded-lg hover:bg-lat-dark transition-colors"
              >
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
                {/* Icono superficie */}
                <div className="text-4xl mb-3">
                  {court.surface === 'clay'  ? '🟤' :
                   court.surface === 'hard'  ? '🔵' : '🟢'}
                </div>

                {/* Nombre */}
                <h3 className="font-bold text-lat-dark text-lg mb-1">
                  {court.name}
                </h3>

                {/* Superficie */}
                <p className="text-gray-500 text-sm mb-2">
                  {SURFACES.find(s => s.value === court.surface)?.label}
                </p>

                {/* Ubicación */}
                {court.location && (
                  <p className="text-gray-400 text-xs mb-3">
                    📍 {court.location}
                  </p>
                )}

                {/* Estado */}
                <div className="flex items-center justify-between mt-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    court.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'
                  }`}>
                    {court.isActive ? '✓ Disponible' : '✗ No disponible'}
                  </span>

                  {isAdmin && (
                    <button className="text-gray-400 hover:text-lat-green transition-colors">
                      <Edit size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal crear cancha */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md">
            <h2 className="text-xl font-bold text-lat-dark mb-6">
              Agregar Cancha
            </h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la cancha
                </label>
                <input
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green"
                  placeholder="Cancha 1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Superficie
                </label>
                <select
                  value={form.surface}
                  onChange={e => setForm({...form, surface: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green"
                >
                  {SURFACES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ubicación (opcional)
                </label>
                <input
                  value={form.location}
                  onChange={e => setForm({...form, location: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lat-green"
                  placeholder="Club de Tenis Medellín"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 bg-lat-green text-white py-2 rounded-lg hover:bg-lat-dark transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}