// frontend/src/components/Sidebar.tsx
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Trophy, Calendar,
  BarChart2, MapPin, Users, LogOut, Play, CreditCard, UserCheck, Menu, X,
} from 'lucide-react';

export default function Sidebar() {
  const { logout, role } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin   = role === 'admin' || role === 'super_admin';
  const isReferee = role === 'referee';
  const isPlayer  = role === 'player';

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
    <>
      {/* Botón hamburger — solo en móvil */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 flex items-center justify-center rounded-lg"
        style={{ backgroundColor: '#1B3A1B', width: '40px', height: '40px', border: 'none', cursor: 'pointer' }}
        aria-label="Abrir menú"
      >
        <Menu size={20} color="white" />
      </button>

      {/* Overlay backdrop — solo en móvil cuando está abierto */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Panel del Sidebar */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-50 flex flex-col transition-transform duration-200',
          'lg:static lg:translate-x-0 lg:z-auto',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{ backgroundColor: '#1B3A1B', width: '220px', flexShrink: 0 }}
      >
        {/* Botón cerrar — solo en móvil */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden absolute top-3 right-3"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          aria-label="Cerrar menú"
        >
          <X size={20} color="white" />
        </button>

        {/* Logo */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #2D6A2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/logo.png" alt="Matchlungo Ace" style={{ width: '140px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </div>

        {/* Navegación */}
        <nav style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
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
    </>
  );
}
