// frontend/src/components/Sidebar.tsx  ← REEMPLAZA COMPLETO
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Trophy, Calendar,
  BarChart2, MapPin, Users, LogOut, Play, CreditCard, UserCheck,
} from 'lucide-react';

export default function Sidebar() {
  const { logout, role } = useAuth();

  const isAdmin   = role === 'admin' || role === 'super_admin';
  const isReferee = role === 'referee';
  const isPlayer  = role === 'player';

  // ── Items según rol ───────────────────────────────────────────────────
  const navItems = [
    { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard',    show: true          },
    { to: '/tournaments', icon: Trophy,           label: 'Torneos',      show: true          },
    { to: '/matches',     icon: Play,             label: 'Partidos',     show: true          },
    { to: '/rankings',    icon: BarChart2,        label: 'Escalafón',    show: true          },

    // Solo jugadores: ver sus pagos pendientes
    { to: '/mis-pagos',   icon: CreditCard,       label: '💳 Mis Pagos', show: isPlayer      },

    // Admin y referee
    { to: '/schedule',    icon: Calendar,         label: 'Programación', show: isAdmin || isReferee },
    { to: '/doubles',     icon: Users,            label: 'Dobles',       show: isAdmin || isReferee },
    { to: '/courts',      icon: MapPin,           label: 'Canchas',      show: isAdmin               },
    { to: '/players',     icon: UserCheck,        label: 'Jugadores',    show: isAdmin || isReferee },
    { to: '/users',       icon: Users,            label: 'Usuarios',     show: isAdmin               },
  ].filter(item => item.show);

  return (
    <div style={{ backgroundColor: '#1B3A1B', minHeight: '100vh', width: '220px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

      {/* Logo */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid #2D6A2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src="/logo.png" alt="Matchlungo Ace" style={{ width: '140px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
      </div>

      {/* Navegación */}
      <nav style={{ flex: 1, padding: '12px' }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 14px', borderRadius: '8px', marginBottom: '3px',
              textDecoration: 'none', fontSize: '13px', fontWeight: '500',
              backgroundColor: isActive ? '#2D6A2D' : 'transparent',
              color: '#FFFFFF', transition: 'background-color 0.15s',
            })}
          >
            <Icon size={17} color="#FFFFFF" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '14px', borderTop: '1px solid #2D6A2D' }}>
        <p style={{ color: '#86EFAC', fontSize: '11px', marginBottom: '6px', paddingLeft: '14px' }}>
          Rol: <strong>{role}</strong>
        </p>
        <button
          onClick={logout}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px', color: '#FFFFFF', fontSize: '13px' }}
        >
          <LogOut size={16} color="#FFFFFF" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}