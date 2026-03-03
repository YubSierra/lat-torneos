import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Trophy, Calendar,
  BarChart2, MapPin, Users, LogOut, Play
} from 'lucide-react';

const navItems = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/tournaments', icon: Trophy,           label: 'Torneos'      },
  { to: '/schedule',    icon: Calendar,         label: 'Programación' },
  { to: '/rankings',    icon: BarChart2,        label: 'Escalafón'    },
  { to: '/matches',     icon: Play,             label: 'Partidos'     },
  { to: '/courts',      icon: MapPin,           label: 'Canchas'      },
  { to: '/players',     icon: Users,            label: 'Jugadores'    },
];

export default function Sidebar() {
  const { logout, role } = useAuth();

  return (
    <div style={{ backgroundColor: '#1B3A1B', minHeight: '100vh', width: '256px', display: 'flex', flexDirection: 'column' }}>

      {/* Logo */}
      <div style={{ padding: '24px', borderBottom: '1px solid #2D6A2D' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '28px' }}>🎾</span>
          <div>
            <p style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: '14px', margin: 0 }}>LAT</p>
            <p style={{ color: '#86EFAC', fontSize: '12px', margin: 0 }}>Sistema de Torneos</p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav style={{ flex: 1, padding: '16px' }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '4px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500',
              backgroundColor: isActive ? '#2D6A2D' : 'transparent',
              color: isActive ? '#FFFFFF' : '#FFFFFF',
              transition: 'background-color 0.2s',
            })}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              if (!el.classList.contains('active')) {
                el.style.backgroundColor = '#2D5A2D';
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              if (!el.getAttribute('aria-current')) {
                el.style.backgroundColor = 'transparent';
              }
            }}
          >
            <Icon size={18} color="#FFFFFF" />
            <span style={{ color: '#FFFFFF' }}>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px', borderTop: '1px solid #2D6A2D' }}>
        <p style={{ color: '#86EFAC', fontSize: '12px', marginBottom: '8px', paddingLeft: '16px' }}>
          Rol: {role}
        </p>
        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '8px 16px', width: '100%', background: 'none',
            border: 'none', cursor: 'pointer', borderRadius: '8px',
            color: '#FFFFFF', fontSize: '14px', transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2D5A2D';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          }}
        >
          <LogOut size={18} color="#FFFFFF" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
}