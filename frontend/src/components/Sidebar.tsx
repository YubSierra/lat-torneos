import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Trophy, Calendar,
  BarChart2, CreditCard, Users, LogOut
} from 'lucide-react';

const navItems = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/tournaments', icon: Trophy,           label: 'Torneos'      },
  { to: '/schedule',    icon: Calendar,         label: 'Programación' },
  { to: '/rankings',    icon: BarChart2,        label: 'Escalafón'    },
  { to: '/matches',     icon: CreditCard,       label: 'Partidos'     },
  { to: '/players',     icon: Users,            label: 'Jugadores'    },
];

export default function Sidebar() {
  const { logout, role } = useAuth();

  return (
    <div className="w-64 min-h-screen bg-lat-dark flex flex-col">

      {/* Logo */}
      <div className="p-6 border-b border-green-800">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎾</span>
          <div>
            <p className="text-white font-bold text-sm">LAT</p>
            <p className="text-green-300 text-xs">Sistema de Torneos</p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
                isActive
                  ? 'bg-lat-green text-white'
                  : 'text-green-200 hover:bg-green-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-green-800">
        <p className="text-green-400 text-xs mb-3 px-4">
          Rol: {role}
        </p>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-2 w-full text-green-200 hover:text-white hover:bg-green-800 rounded-lg transition-colors text-sm"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>

    </div>
  );
}