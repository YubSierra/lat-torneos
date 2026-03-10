// frontend/src/pages/Landing.tsx  ← ARCHIVO NUEVO
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Tournament {
  id: string;
  name: string;
  status: 'draft' | 'open' | 'closed' | 'active' | 'completed';
  type: string;
  circuitLine: string;
  eventStart: string;
  eventEnd: string;
  registrationEnd: string;
  inscriptionValue: number;
  hasDoubles: boolean;
  stageNumber?: number;
  minPlayers?: number;
}

const CIRCUIT_LABEL: Record<string, string> = {
  departamental: 'Departamental', inter_escuelas: 'Inter-Escuelas',
  infantil: 'Infantil', senior: 'Sénior', edades_fct: 'Edades FCT', recreativo: 'Recreativo',
};
const TYPE_LABEL: Record<string, string> = {
  elimination: 'Eliminación Directa', round_robin: 'Round Robin',
  master: 'Torneo Máster', americano: 'Americano',
};

// ── Countdown hook ─────────────────────────────────────────────────────────
function useCountdown(targetDate: string) {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setTime({ d: 0, h: 0, m: 0, s: 0 }); return; }
      setTime({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return time;
}

// ── CSS global (keyframes) ─────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&family=DM+Serif+Display:ital@0;1&display=swap');

  * { box-sizing: border-box; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; } to { opacity: 1; }
  }
  @keyframes pulse-dot {
    0%, 100% { transform: scale(1); opacity: 1; }
    50%       { transform: scale(1.6); opacity: 0.4; }
  }
  @keyframes court-draw {
    from { stroke-dashoffset: 2000; }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    33%       { transform: translateY(-12px) rotate(2deg); }
    66%       { transform: translateY(-6px) rotate(-1deg); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes slide-right {
    from { transform: translateX(-100%); opacity: 0; }
    to   { transform: translateX(0); opacity: 1; }
  }
  @keyframes ticker {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes glow-pulse {
    0%, 100% { box-shadow: 0 0 20px rgba(45,106,45,0.3); }
    50%       { box-shadow: 0 0 40px rgba(45,106,45,0.7), 0 0 80px rgba(76,175,80,0.2); }
  }
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes count-up {
    from { transform: translateY(20px); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }

  .landing-card {
    transition: transform 0.28s cubic-bezier(.34,1.56,.64,1), box-shadow 0.28s ease;
  }
  .landing-card:hover {
    transform: translateY(-6px) scale(1.015);
    box-shadow: 0 24px 48px rgba(27,58,27,0.18);
  }
  .past-row {
    transition: background 0.18s ease;
  }
  .past-row:hover {
    background: rgba(45,106,45,0.06) !important;
  }
  .nav-link {
    transition: color 0.2s;
    color: rgba(255,255,255,0.7);
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
  }
  .nav-link:hover { color: white; }

  .ticker-wrap { overflow: hidden; }
  .ticker-track {
    display: flex;
    white-space: nowrap;
    animation: ticker 32s linear infinite;
  }
`;

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function Landing() {
  const navigate  = useNavigate();
  const heroRef   = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const { data: allTournaments = [], isLoading } = useQuery<Tournament[]>({
    queryKey: ['landing-tournaments'],
    queryFn: () => api.get('/tournaments/public').then(r => r.data),
  });

  const active    = allTournaments.filter(t => t.status === 'active');
  const open      = allTournaments.filter(t => t.status === 'open' || t.status === 'closed');
  const upcoming  = [...active, ...open];
  const past      = allTournaments.filter(t => t.status === 'completed');

  const goToTournament = (id: string) => navigate(`/torneo/${id}`);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />

      <div style={{ fontFamily: "'Outfit', sans-serif", backgroundColor: '#0D1F0D', minHeight: '100vh', overflowX: 'hidden' }}>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* NAVBAR                                                             */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <nav style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 40px', height: '64px',
          backgroundColor: scrollY > 60 ? 'rgba(13,31,13,0.95)' : 'transparent',
          backdropFilter: scrollY > 60 ? 'blur(20px)' : 'none',
          borderBottom: scrollY > 60 ? '1px solid rgba(45,106,45,0.3)' : 'none',
          transition: 'all 0.4s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>🎾</span>
            <span style={{ fontSize: '15px', fontWeight: '800', color: 'white', letterSpacing: '-0.02em' }}>
              LAT <span style={{ color: '#8BC34A', fontWeight: '300' }}>Torneos</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            <a href="#activos" className="nav-link">En Curso</a>
            <a href="#proximos" className="nav-link">Próximos</a>
            <a href="#pasados" className="nav-link">Resultados</a>
            <a
              href="/login"
              style={{
                backgroundColor: '#2D6A2D', color: 'white', padding: '8px 18px',
                borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '700',
                border: '1px solid rgba(139,195,74,0.3)',
              }}
            >
              Iniciar sesión
            </a>
          </div>
        </nav>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* HERO                                                               */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section ref={heroRef} style={{
          position: 'relative', minHeight: '100vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          background: 'radial-gradient(ellipse 80% 70% at 50% 40%, #0F2D0F 0%, #0D1F0D 50%, #080F08 100%)',
        }}>
          {/* Animated court SVG */}
          <svg
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              opacity: 0.12,
              transform: `translateY(${scrollY * 0.3}px)`,
            }}
            viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice"
          >
            {/* Court lines */}
            {[
              'M 100 150 L 1100 150 L 1100 650 L 100 650 Z',
              'M 600 150 L 600 650',
              'M 100 400 L 1100 400',
              'M 280 250 L 920 250 L 920 550 L 280 550 Z',
              'M 600 250 L 600 550',
              'M 0 400 L 100 400', 'M 1100 400 L 1200 400',
              'M 580 395 L 620 395 L 620 405 L 580 405 Z',
            ].map((d, i) => (
              <path
                key={i} d={d} fill="none" stroke="#8BC34A" strokeWidth="2"
                strokeDasharray="2000" strokeDashoffset="2000"
                style={{
                  animation: `court-draw 2.4s ease forwards`,
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
            {/* Grid dots */}
            {Array.from({ length: 12 }).map((_, r) =>
              Array.from({ length: 8 }).map((_, c) => (
                <circle
                  key={`${r}-${c}`} cx={r * 100 + 50} cy={c * 100 + 50} r="1"
                  fill="#4CAF50" opacity="0.4"
                />
              ))
            )}
          </svg>

          {/* Floating tennis balls decoration */}
          {[
            { x: '8%',  y: '20%', size: 28, delay: '0s',   dur: '6s'  },
            { x: '88%', y: '15%', size: 20, delay: '1.2s', dur: '7s'  },
            { x: '92%', y: '70%', size: 24, delay: '0.6s', dur: '8s'  },
            { x: '4%',  y: '75%', size: 18, delay: '2s',   dur: '5.5s'},
            { x: '50%', y: '10%', size: 16, delay: '1.8s', dur: '9s'  },
          ].map((b, i) => (
            <div key={i} style={{
              position: 'absolute', left: b.x, top: b.y,
              width: b.size, height: b.size, borderRadius: '50%',
              backgroundColor: '#8BC34A',
              animation: `float ${b.dur} ease-in-out infinite`,
              animationDelay: b.delay,
              opacity: 0.25,
              boxShadow: '0 0 12px rgba(139,195,74,0.4)',
            }} />
          ))}

          {/* Hero content */}
          <div style={{ textAlign: 'center', padding: '0 20px', position: 'relative', zIndex: 2, maxWidth: '820px' }}>
            {/* Live badge */}
            {active.length > 0 && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                backgroundColor: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)',
                borderRadius: '999px', padding: '6px 16px', marginBottom: '28px',
                animation: 'fadeIn 0.6s ease forwards', opacity: 0,
              }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444',
                  animation: 'pulse-dot 1.4s ease-in-out infinite',
                  display: 'inline-block',
                }} />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#FCA5A5', letterSpacing: '0.08em' }}>
                  {active.length} TORNEO{active.length > 1 ? 'S' : ''} EN VIVO
                </span>
              </div>
            )}

            {/* Title */}
            <h1 style={{
              fontSize: 'clamp(42px, 7vw, 88px)', fontWeight: '900', lineHeight: '0.95',
              color: 'white', margin: '0 0 20px', letterSpacing: '-0.03em',
              fontFamily: "'DM Serif Display', serif",
              animation: 'fadeUp 0.8s ease forwards', opacity: 0,
              animationDelay: '0.2s',
            }}>
              Liga Antioqueña<br />
              <span style={{
                background: 'linear-gradient(135deg, #8BC34A 0%, #4CAF50 50%, #2D6A2D 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                de Tenis
              </span>
            </h1>

            <p style={{
              fontSize: 'clamp(15px, 2vw, 19px)', color: 'rgba(255,255,255,0.55)',
              fontWeight: '300', lineHeight: '1.6', margin: '0 0 40px',
              animation: 'fadeUp 0.8s ease forwards', opacity: 0, animationDelay: '0.4s',
            }}>
              El circuito oficial de tenis de Antioquia. Torneos departamentales,<br />
              escalafón en tiempo real y marcadores en vivo.
            </p>

            {/* CTA buttons */}
            <div style={{
              display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap',
              animation: 'fadeUp 0.8s ease forwards', opacity: 0, animationDelay: '0.6s',
            }}>
              <a href="#activos" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: 'linear-gradient(135deg, #2D6A2D 0%, #4CAF50 100%)',
                color: 'white', padding: '14px 30px', borderRadius: '12px',
                textDecoration: 'none', fontSize: '15px', fontWeight: '700',
                boxShadow: '0 8px 32px rgba(45,106,45,0.5)',
                animation: 'glow-pulse 3s ease-in-out infinite',
              }}>
                🎾 Ver torneos activos
              </a>
              <a href="#proximos" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
                color: 'white', padding: '14px 30px', borderRadius: '12px',
                textDecoration: 'none', fontSize: '15px', fontWeight: '600',
              }}>
                📅 Próximos torneos
              </a>
            </div>
          </div>

          {/* Stats strip */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
            borderTop: '1px solid rgba(139,195,74,0.2)',
            display: 'flex', justifyContent: 'center',
            animation: 'fadeIn 1s ease forwards', opacity: 0, animationDelay: '1s',
          }}>
            <div style={{ display: 'flex', maxWidth: '900px', width: '100%' }}>
              {[
                { val: active.length,   label: 'En curso',    icon: '🔴' },
                { val: open.length,     label: 'Abiertos',    icon: '✅' },
                { val: past.length,     label: 'Completados', icon: '🏆' },
                { val: allTournaments.length, label: 'Total torneos', icon: '📊' },
              ].map((s, i) => (
                <div key={i} style={{
                  flex: 1, padding: '18px 12px', textAlign: 'center',
                  borderRight: i < 3 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                }}>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: '#8BC34A', lineHeight: 1 }}>
                    {s.icon} {s.val}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Scroll indicator */}
          <div style={{
            position: 'absolute', bottom: '90px', left: '50%', transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
            animation: 'fadeIn 1s ease forwards', opacity: 0, animationDelay: '1.4s',
          }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Scroll</span>
            <div style={{ width: '1px', height: '40px', background: 'linear-gradient(to bottom, rgba(139,195,74,0.6), transparent)' }} />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TICKER                                                             */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {allTournaments.length > 0 && (
          <div style={{
            backgroundColor: '#1B3A1B', borderTop: '1px solid rgba(139,195,74,0.3)',
            borderBottom: '1px solid rgba(139,195,74,0.3)', padding: '12px 0',
            overflow: 'hidden',
          }}>
            <div className="ticker-wrap">
              <div className="ticker-track">
                {[...allTournaments, ...allTournaments].map((t, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0 40px', fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.8)' }}>
                    <span style={{ color: '#8BC34A' }}>●</span>
                    {t.name}
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{t.eventStart}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TORNEOS ACTIVOS                                                    */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section id="activos" style={{ padding: '100px 40px', backgroundColor: '#0D1F0D' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <SectionHeader
              eyebrow="🔴 EN CURSO"
              title="Torneos activos"
              subtitle="Sigue los partidos en tiempo real"
              light
            />

            {isLoading ? (
              <LoadingCards count={3} dark />
            ) : active.length === 0 ? (
              <EmptyState dark message="No hay torneos en curso en este momento." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                {active.map((t, i) => (
                  <ActiveCard key={t.id} t={t} index={i} onClick={() => goToTournament(t.id)} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* PRÓXIMOS / ABIERTOS                                                */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section id="proximos" style={{ padding: '100px 40px', backgroundColor: '#0A1A0A' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <SectionHeader
              eyebrow="📅 PRÓXIMOS"
              title="Inscripciones abiertas"
              subtitle="Regístrate antes de que cierren los cupos"
              light
            />

            {isLoading ? (
              <LoadingCards count={3} dark />
            ) : open.length === 0 ? (
              <EmptyState dark message="No hay torneos con inscripciones abiertas." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                {open.map((t, i) => (
                  <UpcomingCard key={t.id} t={t} index={i} onClick={() => goToTournament(t.id)} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TORNEOS PASADOS                                                    */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section id="pasados" style={{ padding: '100px 40px', backgroundColor: '#0D1F0D' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <SectionHeader
              eyebrow="🏆 HISTORIAL"
              title="Torneos completados"
              subtitle="Revisa resultados y estadísticas"
              light
            />

            {isLoading ? (
              <div style={{ height: '200px' }} />
            ) : past.length === 0 ? (
              <EmptyState dark message="Aún no hay torneos completados." />
            ) : (
              <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', overflow: 'hidden' }}>
                {/* Table header */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 180px 160px 120px 80px',
                  padding: '14px 24px',
                  backgroundColor: 'rgba(27,58,27,0.6)',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                }}>
                  {['Torneo', 'Circuito', 'Fechas', 'Modalidad', ''].map((h, i) => (
                    <span key={i} style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {h}
                    </span>
                  ))}
                </div>
                {past.map((t, i) => (
                  <PastRow key={t.id} t={t} index={i} onClick={() => goToTournament(t.id)} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* FOOTER                                                             */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <footer style={{
          backgroundColor: '#080F08', borderTop: '1px solid rgba(139,195,74,0.15)',
          padding: '48px 40px',
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '28px' }}>🎾</span>
              <div>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'white' }}>
                  Liga Antioqueña de Tenis
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                  Sistema oficial de torneos · {new Date().getFullYear()}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {[
                { href: '/login',   label: 'Ingresar al sistema' },
                { href: '#activos', label: 'Torneos activos' },
                { href: '#proximos',label: 'Próximos torneos' },
              ].map(l => (
                <a key={l.href} href={l.href} style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', textDecoration: 'none', fontWeight: '500' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#8BC34A')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═════════════════════════════════════════════════════════════════════════════

// ── Section Header ─────────────────────────────────────────────────────────
function SectionHeader({ eyebrow, title, subtitle, light }: {
  eyebrow: string; title: string; subtitle: string; light?: boolean;
}) {
  return (
    <div style={{ marginBottom: '52px' }}>
      <p style={{
        margin: '0 0 10px', fontSize: '11px', fontWeight: '800', letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: light ? '#8BC34A' : '#2D6A2D',
      }}>
        {eyebrow}
      </p>
      <h2 style={{
        margin: '0 0 10px', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: '900',
        fontFamily: "'DM Serif Display', serif", letterSpacing: '-0.02em', lineHeight: 1,
        color: light ? 'white' : '#1B3A1B',
      }}>
        {title}
      </h2>
      <p style={{ margin: 0, fontSize: '15px', color: light ? 'rgba(255,255,255,0.45)' : '#6B7280', fontWeight: '300' }}>
        {subtitle}
      </p>
    </div>
  );
}

// ── Loading skeleton cards ─────────────────────────────────────────────────
function LoadingCards({ count, dark }: { count: number; dark?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          height: '240px', borderRadius: '20px',
          backgroundColor: dark ? 'rgba(255,255,255,0.04)' : '#F0F0F0',
          animation: 'pulse-dot 1.5s ease-in-out infinite',
          animationDelay: `${i * 0.15}s`,
        }} />
      ))}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState({ dark, message }: { dark?: boolean; message: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '72px 20px',
      border: `1px dashed ${dark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'}`,
      borderRadius: '20px',
    }}>
      <p style={{ fontSize: '40px', marginBottom: '12px' }}>🎾</p>
      <p style={{ color: dark ? 'rgba(255,255,255,0.3)' : '#9CA3AF', fontSize: '14px', margin: 0 }}>
        {message}
      </p>
    </div>
  );
}

// ── Active Tournament Card ─────────────────────────────────────────────────
function ActiveCard({ t, index, onClick }: { t: Tournament; index: number; onClick: () => void }) {
  return (
    <div
      className="landing-card"
      onClick={onClick}
      style={{
        borderRadius: '20px', cursor: 'pointer', overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(27,58,27,0.9) 0%, rgba(13,31,13,0.95) 100%)',
        border: '1px solid rgba(45,106,45,0.4)',
        animation: `fadeUp 0.6s ease forwards`,
        animationDelay: `${index * 0.1}s`,
        opacity: 0,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Top accent bar */}
      <div style={{ height: '3px', background: 'linear-gradient(90deg, #2D6A2D, #8BC34A, #4CAF50)' }} />

      <div style={{ padding: '24px' }}>
        {/* Live badge + circuit */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', backgroundColor: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '999px', padding: '4px 12px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#EF4444', display: 'inline-block', animation: 'pulse-dot 1.2s ease-in-out infinite' }} />
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#FCA5A5', letterSpacing: '0.08em' }}>EN VIVO</span>
          </div>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: '500', backgroundColor: 'rgba(255,255,255,0.06)', padding: '3px 10px', borderRadius: '6px' }}>
            {CIRCUIT_LABEL[t.circuitLine] || t.circuitLine}
          </span>
        </div>

        {/* Name */}
        <h3 style={{ margin: '0 0 8px', fontSize: '19px', fontWeight: '800', color: 'white', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
          {t.name}
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontWeight: '400' }}>
          {TYPE_LABEL[t.type] || t.type}
          {t.stageNumber ? ` · Etapa ${t.stageNumber}` : ''}
          {t.hasDoubles ? ' · 🤝 Dobles' : ''}
        </p>

        {/* Dates */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <div style={{ flex: 1, backgroundColor: 'rgba(139,195,74,0.08)', border: '1px solid rgba(139,195,74,0.2)', borderRadius: '10px', padding: '10px' }}>
            <p style={{ margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Inicio</p>
            <p style={{ margin: '3px 0 0', fontSize: '13px', fontWeight: '700', color: 'white' }}>{t.eventStart}</p>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '18px' }}>→</span>
          <div style={{ flex: 1, backgroundColor: 'rgba(139,195,74,0.08)', border: '1px solid rgba(139,195,74,0.2)', borderRadius: '10px', padding: '10px' }}>
            <p style={{ margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fin</p>
            <p style={{ margin: '3px 0 0', fontSize: '13px', fontWeight: '700', color: 'white' }}>{t.eventEnd}</p>
          </div>
        </div>

        {/* CTA */}
        <button style={{
          width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
          background: 'linear-gradient(135deg, #2D6A2D 0%, #4CAF50 100%)',
          color: 'white', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          letterSpacing: '-0.01em',
        }}>
          🔴 Ver marcadores en vivo →
        </button>
      </div>
    </div>
  );
}

// ── Upcoming / Open Card ───────────────────────────────────────────────────
function UpcomingCard({ t, index, onClick }: { t: Tournament; index: number; onClick: () => void }) {
  const countdown = useCountdown(t.status === 'open' ? t.registrationEnd : t.eventStart);
  const isOpen   = t.status === 'open';

  return (
    <div
      className="landing-card"
      onClick={onClick}
      style={{
        borderRadius: '20px', cursor: 'pointer', overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: `1px solid ${isOpen ? 'rgba(139,195,74,0.35)' : 'rgba(255,255,255,0.1)'}`,
        animation: 'fadeUp 0.6s ease forwards',
        animationDelay: `${index * 0.1}s`,
        opacity: 0,
      }}
    >
      <div style={{ height: '3px', background: isOpen ? 'linear-gradient(90deg, #1B3A1B, #8BC34A)' : 'rgba(255,255,255,0.15)' }} />

      <div style={{ padding: '24px' }}>
        {/* Status + circuit */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span style={{
            fontSize: '11px', fontWeight: '800', letterSpacing: '0.08em',
            padding: '4px 12px', borderRadius: '999px',
            backgroundColor: isOpen ? 'rgba(139,195,74,0.12)' : 'rgba(255,255,255,0.07)',
            color: isOpen ? '#8BC34A' : 'rgba(255,255,255,0.45)',
            border: `1px solid ${isOpen ? 'rgba(139,195,74,0.3)' : 'rgba(255,255,255,0.12)'}`,
          }}>
            {isOpen ? '✅ ABIERTO' : '🔒 CERRADO'}
          </span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: '500' }}>
            {CIRCUIT_LABEL[t.circuitLine] || t.circuitLine}
          </span>
        </div>

        {/* Name */}
        <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: '800', color: 'white', lineHeight: 1.2 }}>
          {t.name}
        </h3>
        <p style={{ margin: '0 0 18px', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
          {TYPE_LABEL[t.type] || t.type}
          {t.stageNumber ? ` · Etapa ${t.stageNumber}` : ''}
        </p>

        {/* Countdown */}
        {isOpen && (
          <div style={{ marginBottom: '18px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              ⏱ Cierre de inscripciones en:
            </p>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { val: countdown.d, label: 'd' },
                { val: countdown.h, label: 'h' },
                { val: countdown.m, label: 'm' },
                { val: countdown.s, label: 's' },
              ].map(({ val, label }) => (
                <div key={label} style={{
                  flex: 1, backgroundColor: 'rgba(139,195,74,0.1)', border: '1px solid rgba(139,195,74,0.2)',
                  borderRadius: '10px', padding: '8px 4px', textAlign: 'center',
                }}>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#8BC34A', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {String(val).padStart(2, '0')}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '9px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Price + dates */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <p style={{ margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Inscripción</p>
            <p style={{ margin: '2px 0 0', fontSize: '17px', fontWeight: '900', color: '#8BC34A' }}>
              ${Number(t.inscriptionValue || 0).toLocaleString('es-CO')}
              <span style={{ fontSize: '11px', fontWeight: '400', color: 'rgba(255,255,255,0.3)', marginLeft: '3px' }}>COP</span>
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Evento</p>
            <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>
              {t.eventStart}
            </p>
          </div>
        </div>

        {t.hasDoubles && (
          <div style={{ marginBottom: '16px', display: 'flex', gap: '6px' }}>
            <span style={{ fontSize: '11px', backgroundColor: 'rgba(139,195,74,0.1)', color: '#8BC34A', border: '1px solid rgba(139,195,74,0.2)', padding: '3px 10px', borderRadius: '999px', fontWeight: '600' }}>
              🤝 Dobles disponibles
            </span>
          </div>
        )}

        <button style={{
          width: '100%', padding: '11px', borderRadius: '11px', border: '1px solid rgba(255,255,255,0.15)',
          backgroundColor: 'rgba(255,255,255,0.06)', color: 'white',
          fontSize: '13px', fontWeight: '700', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
        }}>
          {isOpen ? '📋 Ver detalles e inscribirse' : '👁 Ver torneo'} →
        </button>
      </div>
    </div>
  );
}

// ── Past Tournament Row ────────────────────────────────────────────────────
function PastRow({ t, index, onClick }: { t: Tournament; index: number; onClick: () => void }) {
  return (
    <div
      className="past-row"
      onClick={onClick}
      style={{
        display: 'grid', gridTemplateColumns: '1fr 180px 160px 120px 80px',
        padding: '16px 24px', cursor: 'pointer',
        backgroundColor: index % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        animation: 'fadeUp 0.5s ease forwards',
        animationDelay: `${index * 0.06}s`,
        opacity: 0,
        alignItems: 'center',
      }}
    >
      {/* Nombre */}
      <div>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'rgba(255,255,255,0.85)', lineHeight: 1.2 }}>
          {t.name}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
          {TYPE_LABEL[t.type] || t.type}
          {t.stageNumber ? ` · Etapa ${t.stageNumber}` : ''}
        </p>
      </div>

      {/* Circuito */}
      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontWeight: '500' }}>
        {CIRCUIT_LABEL[t.circuitLine] || t.circuitLine}
      </span>

      {/* Fechas */}
      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
        {t.eventStart} → {t.eventEnd}
      </span>

      {/* Modalidad */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10px', fontWeight: '700', backgroundColor: 'rgba(27,58,27,0.8)', color: '#8BC34A', padding: '2px 8px', borderRadius: '5px' }}>
          Singles
        </span>
        {t.hasDoubles && (
          <span style={{ fontSize: '10px', fontWeight: '700', backgroundColor: 'rgba(29,78,216,0.2)', color: '#93C5FD', padding: '2px 8px', borderRadius: '5px' }}>
            Dobles
          </span>
        )}
      </div>

      {/* CTA */}
      <span style={{ fontSize: '12px', color: '#8BC34A', fontWeight: '700', textAlign: 'right' }}>
        Ver →
      </span>
    </div>
  );
}