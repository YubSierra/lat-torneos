// frontend/src/pages/Landing.tsx  ← REEMPLAZA COMPLETO
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import publicApi from '../api/publicApi';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
interface Tournament {
  id: string;
  name: string;
  status: 'draft' | 'open' | 'closed' | 'active' | 'completed';
  type: string;
  circuitLine: string;
  stageNumber?: number;
  eventStart: string;
  eventEnd: string;
  registrationStart: string;
  registrationEnd: string;
  inscriptionValue: number;
  doublesValue?: number;
  hasDoubles: boolean;
  doublesIncludedForSingles?: boolean;
  minPlayers?: number;
}

const CIRCUIT_LABEL: Record<string, string> = {
  departamental:  'Departamental',
  inter_escuelas: 'Inter Escuelas',
  infantil:       'Infantil',
  senior:         'Sénior',
  edades_fct:     'Edades FCT',
  recreativo:     'Recreativo',
};
const TYPE_LABEL: Record<string, string> = {
  elimination:   'Eliminación Directa',
  round_robin:   'Round Robin',
  master:        'Torneo Máster',
  americano:     'Americano',
  king_of_court: 'King of the Court',
  supertiebreak: 'Supertiebreak',
  box_league:    'Box League',
  ladder:        'Escalera',
  short_set:     'Short Set',
  pro_set:       'Pro Set',
};
const CATEGORIES = ['INTERMEDIA', 'SEGUNDA', 'TERCERA', 'CUARTA', 'QUINTA'];

// ─────────────────────────────────────────────────────────────────────────────
// Countdown hook
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Estilos globales
// ─────────────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&family=DM+Serif+Display:ital@0;1&display=swap');
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }

  @keyframes fadeUp   { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
  @keyframes pulseDot { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.7);opacity:.4} }
  @keyframes courtDraw{ from{stroke-dashoffset:2000} to{stroke-dashoffset:0} }
  @keyframes float    { 0%,100%{transform:translateY(0) rotate(0deg)} 33%{transform:translateY(-12px) rotate(2deg)} 66%{transform:translateY(-5px) rotate(-1deg)} }
  @keyframes ticker   { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
  @keyframes glowPulse{ 0%,100%{box-shadow:0 0 20px rgba(45,106,45,.35)} 50%{box-shadow:0 0 42px rgba(45,106,45,.7),0 0 80px rgba(76,175,80,.2)} }
  @keyframes modalIn  { from{opacity:0;transform:scale(.94) translateY(20px)} to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes overlayIn{ from{opacity:0} to{opacity:1} }
  @keyframes slideUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin     { to{transform:rotate(360deg)} }

  .l-card {
    transition: transform .26s cubic-bezier(.34,1.56,.64,1), box-shadow .26s ease, border-color .2s;
  }
  .l-card:hover {
    transform: translateY(-7px) scale(1.012);
    box-shadow: 0 28px 52px rgba(0,0,0,.5);
    border-color: rgba(139,195,74,.55) !important;
  }
  .past-row { transition: background .15s; cursor: pointer; }
  .past-row:hover { background: rgba(139,195,74,.07) !important; }
  .nav-link { color:rgba(255,255,255,.6); text-decoration:none; font-size:14px; font-weight:500; transition:color .2s; }
  .nav-link:hover { color:white; }
  .ticker-track { display:flex; white-space:nowrap; animation:ticker 36s linear infinite; }
  input:focus, select:focus { outline: none; border-color: #4CAF50 !important; box-shadow: 0 0 0 3px rgba(76,175,80,.15); }
  .tab-btn { border:none; cursor:pointer; font-weight:700; font-size:13px; transition:all .18s; border-radius:10px; padding:9px 18px; font-family:inherit; }
  .spinner { width:20px; height:20px; border:2.5px solid rgba(255,255,255,.25); border-top-color:white; border-radius:50%; animation:spin .7s linear infinite; display:inline-block; }
`;

// ═════════════════════════════════════════════════════════════════════════════
// LANDING PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function Landing() {
  const navigate  = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  // ── Fetch torneos públicos ────────────────────────────────────────────────
  const {
    data: allTournaments = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<Tournament[]>({
    queryKey: ['landing-tournaments'],
    queryFn: async () => {
      // Llama a /tournaments/public (sin draft)
      // Si falla (endpoint no existe), fallback a /tournaments y filtra
      try {
        const res = await publicApi.get('/tournaments/public');
        return res.data;
      } catch {
        const res = await publicApi.get('/tournaments');
        return (res.data as Tournament[]).filter(t => t.status !== 'draft');
      }
    },
    retry: 2,
    staleTime: 30_000,
  });

  const active   = allTournaments.filter(t => t.status === 'active');
  const open     = allTournaments.filter(t => t.status === 'open' || t.status === 'closed');
  const past     = allTournaments.filter(t => t.status === 'completed');

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div style={{ fontFamily: "'Outfit', sans-serif", backgroundColor: '#0D1F0D', minHeight: '100vh', overflowX: 'hidden' }}>

        {/* ── NAVBAR ─────────────────────────────────────────────────────── */}
        <nav style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 clamp(20px, 4vw, 48px)', height: '64px',
          backgroundColor: scrollY > 60 ? 'rgba(8,15,8,.97)' : 'transparent',
          backdropFilter: scrollY > 60 ? 'blur(18px)' : 'none',
          borderBottom: scrollY > 60 ? '1px solid rgba(45,106,45,.3)' : 'none',
          transition: 'all .35s ease',
        }}>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'9px', padding:0 }}
          >
            <span style={{ fontSize: '22px' }}>🎾</span>
            <span style={{ fontSize: '15px', fontWeight: '900', color: 'white', letterSpacing: '-.02em' }}>
              LAT <span style={{ color: '#8BC34A', fontWeight: '300' }}>Torneos</span>
            </span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(14px, 2.5vw, 28px)' }}>
            <a href="#activos"  className="nav-link">En Curso</a>
            <a href="#proximos" className="nav-link">Próximos</a>
            <a href="#pasados"  className="nav-link">Historial</a>
            <button
              onClick={() => navigate('/login')}
              style={{
                backgroundColor: '#2D6A2D', color: 'white',
                padding: '8px 18px', borderRadius: '9px',
                border: '1px solid rgba(139,195,74,.3)',
                cursor: 'pointer', fontSize: '13px', fontWeight: '700',
                fontFamily: 'inherit',
              }}
            >
              Ingresar →
            </button>
          </div>
        </nav>

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <section style={{
          position: 'relative', minHeight: '100vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          background: 'radial-gradient(ellipse 80% 65% at 50% 35%, #0F2D0F 0%, #0D1F0D 55%, #070E07 100%)',
        }}>
          {/* SVG Court */}
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .1,
              transform: `translateY(${scrollY * .28}px)` }}
            viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice"
          >
            {['M100 150 L1100 150 L1100 650 L100 650 Z','M600 150 L600 650','M100 400 L1100 400',
              'M280 250 L920 250 L920 550 L280 550 Z','M600 250 L600 550',
              'M0 400 L100 400','M1100 400 L1200 400'].map((d, i) => (
              <path key={i} d={d} fill="none" stroke="#8BC34A" strokeWidth="1.5"
                strokeDasharray="2000" strokeDashoffset="2000"
                style={{ animation: `courtDraw 2.2s ease forwards`, animationDelay: `${i*.14}s` }}
              />
            ))}
            {Array.from({length:13}, (_, r) => Array.from({length:9}, (_, c) => (
              <circle key={`${r}-${c}`} cx={r*100+50} cy={c*100+50} r="1" fill="#4CAF50" opacity=".35" />
            )))}
          </svg>

          {/* Pelotas flotantes */}
          {[{x:'7%',y:'18%',s:26,d:'0s',t:'6.5s'},{x:'87%',y:'14%',s:18,d:'1.1s',t:'7.2s'},
            {x:'91%',y:'68%',s:22,d:'.6s',t:'8s'},{x:'4%',y:'73%',s:16,d:'2s',t:'5.5s'},
            {x:'48%',y:'8%',s:14,d:'1.7s',t:'9s'}].map((b,i) => (
            <div key={i} style={{
              position:'absolute', left:b.x, top:b.y, width:b.s, height:b.s,
              borderRadius:'50%', backgroundColor:'#8BC34A',
              animation:`float ${b.t} ease-in-out infinite`, animationDelay:b.d,
              opacity:.2, boxShadow:'0 0 14px rgba(139,195,74,.4)',
            }}/>
          ))}

          {/* Contenido hero */}
          <div style={{ textAlign:'center', padding:'0 20px', position:'relative', zIndex:2, maxWidth:'840px' }}>
            {active.length > 0 && (
              <div style={{
                display:'inline-flex', alignItems:'center', gap:'8px',
                backgroundColor:'rgba(220,38,38,.15)', border:'1px solid rgba(220,38,38,.4)',
                borderRadius:'999px', padding:'6px 16px', marginBottom:'28px',
                animation:'fadeIn .6s ease forwards',
              }}>
                <span style={{ width:8, height:8, borderRadius:'50%', backgroundColor:'#EF4444',
                  animation:'pulseDot 1.3s ease-in-out infinite', display:'inline-block' }}/>
                <span style={{ fontSize:'12px', fontWeight:'800', color:'#FCA5A5', letterSpacing:'.08em' }}>
                  {active.length} TORNEO{active.length>1?'S':''} EN CURSO
                </span>
              </div>
            )}

            <h1 style={{
              fontSize:'clamp(42px,7.5vw,92px)', fontWeight:'900', lineHeight:'.93',
              color:'white', margin:'0 0 22px', letterSpacing:'-.03em',
              fontFamily:"'DM Serif Display', serif",
              animation:'fadeUp .8s ease forwards', opacity:0, animationDelay:'.15s',
            }}>
              Liga Antioqueña<br/>
              <span style={{
                background:'linear-gradient(135deg, #8BC34A 0%, #4CAF50 50%, #2D6A2D 100%)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
              }}>de Tenis</span>
            </h1>

            <p style={{
              fontSize:'clamp(14px,1.8vw,18px)', color:'rgba(255,255,255,.5)',
              fontWeight:'300', lineHeight:'1.65', margin:'0 0 42px',
              animation:'fadeUp .8s ease forwards', opacity:0, animationDelay:'.3s',
            }}>
              El circuito oficial de tenis de Antioquia — torneos departamentales,<br/>
              escalafón en tiempo real y marcadores en vivo.
            </p>

            {isError && (
              <div style={{
                marginBottom:'24px', padding:'14px 20px', borderRadius:'12px',
                backgroundColor:'rgba(220,38,38,.1)', border:'1px solid rgba(220,38,38,.3)',
                animation:'fadeUp .5s ease forwards',
              }}>
                <p style={{ margin:'0 0 10px', color:'#FCA5A5', fontSize:'14px', fontWeight:'600' }}>
                  ⚠️ No se pudo conectar al servidor. ¿Está el backend corriendo en localhost:3000?
                </p>
                <button
                  onClick={() => refetch()}
                  style={{ backgroundColor:'rgba(220,38,38,.2)', color:'#FCA5A5', border:'1px solid rgba(220,38,38,.4)',
                    borderRadius:'8px', padding:'7px 16px', cursor:'pointer', fontSize:'13px', fontWeight:'700', fontFamily:'inherit' }}
                >
                  🔄 Reintentar
                </button>
              </div>
            )}

            <div style={{
              display:'flex', gap:'14px', justifyContent:'center', flexWrap:'wrap',
              animation:'fadeUp .8s ease forwards', opacity:0, animationDelay:'.45s',
            }}>
              <a href="#activos" style={{
                display:'inline-flex', alignItems:'center', gap:'8px',
                background:'linear-gradient(135deg, #1B3A1B 0%, #4CAF50 100%)',
                color:'white', padding:'14px 30px', borderRadius:'12px',
                textDecoration:'none', fontSize:'15px', fontWeight:'700',
                boxShadow:'0 8px 30px rgba(45,106,45,.5)',
                animation:'glowPulse 3s ease-in-out infinite',
              }}>🎾 Ver torneos activos</a>
              <a href="#proximos" style={{
                display:'inline-flex', alignItems:'center', gap:'8px',
                backgroundColor:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.18)',
                color:'white', padding:'14px 30px', borderRadius:'12px',
                textDecoration:'none', fontSize:'15px', fontWeight:'600',
              }}>📅 Inscribirme</a>
            </div>
          </div>

          {/* Stats strip */}
          <div style={{
            position:'absolute', bottom:0, left:0, right:0,
            backgroundColor:'rgba(0,0,0,.5)', backdropFilter:'blur(12px)',
            borderTop:'1px solid rgba(139,195,74,.18)',
            display:'flex', justifyContent:'center',
            animation:'fadeIn 1s ease forwards', opacity:0, animationDelay:'1s',
          }}>
            <div style={{ display:'flex', maxWidth:900, width:'100%' }}>
              {[
                { v: isLoading ? '…' : active.length,   l:'En curso',    e:'🔴' },
                { v: isLoading ? '…' : open.length,     l:'Abiertos',    e:'✅' },
                { v: isLoading ? '…' : past.length,     l:'Finalizados', e:'🏆' },
                { v: isLoading ? '…' : allTournaments.length, l:'Total', e:'📊' },
              ].map((s,i) => (
                <div key={i} style={{
                  flex:1, padding:'18px 8px', textAlign:'center',
                  borderRight: i<3 ? '1px solid rgba(255,255,255,.06)' : 'none',
                }}>
                  <p style={{ margin:0, fontSize:'22px', fontWeight:'900', color:'#8BC34A', lineHeight:1 }}>
                    {s.e} {s.v}
                  </p>
                  <p style={{ margin:'4px 0 0', fontSize:'10px', color:'rgba(255,255,255,.4)',
                    fontWeight:'600', textTransform:'uppercase', letterSpacing:'.09em' }}>{s.l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Scroll cue */}
          <div style={{
            position:'absolute', bottom:'88px', left:'50%', transform:'translateX(-50%)',
            display:'flex', flexDirection:'column', alignItems:'center', gap:'6px',
            animation:'fadeIn 1.2s ease forwards', opacity:0, animationDelay:'1.4s',
          }}>
            <span style={{ fontSize:'9px', color:'rgba(255,255,255,.25)', letterSpacing:'.15em', textTransform:'uppercase' }}>Scroll</span>
            <div style={{ width:1, height:38, background:'linear-gradient(to bottom, rgba(139,195,74,.55), transparent)' }}/>
          </div>
        </section>

        {/* ── TICKER ─────────────────────────────────────────────────────── */}
        {allTournaments.length > 0 && (
          <div style={{
            backgroundColor:'#1B3A1B', overflow:'hidden',
            borderTop:'1px solid rgba(139,195,74,.25)', borderBottom:'1px solid rgba(139,195,74,.25)',
            padding:'11px 0',
          }}>
            <div className="ticker-track">
              {[...allTournaments,...allTournaments].map((t,i) => (
                <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:'8px',
                  padding:'0 36px', fontSize:'13px', fontWeight:'600', color:'rgba(255,255,255,.8)' }}>
                  <span style={{ color:'#8BC34A' }}>●</span>
                  {t.name}
                  <span style={{ color:'rgba(255,255,255,.3)', fontSize:'11px' }}>{t.eventStart}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── TORNEOS ACTIVOS ─────────────────────────────────────────────── */}
        <section id="activos" style={{ padding:'90px clamp(16px,4vw,48px)', backgroundColor:'#0D1F0D' }}>
          <div style={{ maxWidth:1180, margin:'0 auto' }}>
            <SectionHeader eyebrow="🔴 EN CURSO" title="Torneos activos" subtitle="Partidos en tiempo real" />
            {isLoading ? <SkeletonCards/> : active.length === 0
              ? <EmptyState msg="No hay torneos en curso en este momento."/>
              : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:'18px' }}>
                  {active.map((t,i) => (
                    <ActiveCard key={t.id} t={t} delay={i*.08}
                      onClick={() => navigate(`/torneo/${t.id}`)} />
                  ))}
                </div>
            }
          </div>
        </section>

        {/* ── TORNEOS PRÓXIMOS / ABIERTOS ──────────────────────────────────── */}
        <section id="proximos" style={{ padding:'90px clamp(16px,4vw,48px)', backgroundColor:'#0A1A0A' }}>
          <div style={{ maxWidth:1180, margin:'0 auto' }}>
            <SectionHeader eyebrow="📅 PRÓXIMOS" title="Inscripciones abiertas" subtitle="Regístrate antes de que cierren los cupos" />
            {isLoading ? <SkeletonCards/> : open.length === 0
              ? <EmptyState msg="No hay torneos con inscripciones abiertas."/>
              : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:'18px' }}>
                  {open.map((t,i) => (
                    <UpcomingCard key={t.id} t={t} delay={i*.08}
                      onDetails={() => setSelectedTournament(t)} />
                  ))}
                </div>
            }
          </div>
        </section>

        {/* ── HISTORIAL ──────────────────────────────────────────────────── */}
        <section id="pasados" style={{ padding:'90px clamp(16px,4vw,48px)', backgroundColor:'#0D1F0D' }}>
          <div style={{ maxWidth:1180, margin:'0 auto' }}>
            <SectionHeader eyebrow="🏆 HISTORIAL" title="Torneos finalizados" subtitle="Resultados y estadísticas"/>
            {isLoading ? null : past.length === 0
              ? <EmptyState msg="Aún no hay torneos finalizados."/>
              : <div style={{ border:'1px solid rgba(255,255,255,.07)', borderRadius:'18px', overflow:'hidden' }}>
                  <div style={{
                    display:'grid', gridTemplateColumns:'1fr 160px 180px 110px 70px',
                    padding:'12px 22px', backgroundColor:'rgba(27,58,27,.65)',
                    borderBottom:'1px solid rgba(255,255,255,.07)',
                  }}>
                    {['Torneo','Circuito','Fechas','Modalidad',''].map((h,i) => (
                      <span key={i} style={{ fontSize:'10px', fontWeight:'700', color:'rgba(255,255,255,.3)',
                        textTransform:'uppercase', letterSpacing:'.1em' }}>{h}</span>
                    ))}
                  </div>
                  {past.map((t,i) => (
                    <PastRow key={t.id} t={t} index={i}
                      onClick={() => navigate(`/torneo/${t.id}`)} />
                  ))}
                </div>
            }
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <footer style={{ backgroundColor:'#070E07', borderTop:'1px solid rgba(139,195,74,.12)', padding:'44px clamp(16px,4vw,48px)' }}>
          <div style={{ maxWidth:1180, margin:'0 auto', display:'flex', alignItems:'center',
            justifyContent:'space-between', flexWrap:'wrap', gap:'18px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ fontSize:'26px' }}>🎾</span>
              <div>
                <p style={{ margin:0, fontSize:'14px', fontWeight:'800', color:'white' }}>Liga Antioqueña de Tenis</p>
                <p style={{ margin:'2px 0 0', fontSize:'11px', color:'rgba(255,255,255,.3)' }}>
                  Sistema oficial de torneos · {new Date().getFullYear()}
                </p>
              </div>
            </div>
            <div style={{ display:'flex', gap:'18px', flexWrap:'wrap' }}>
              {[{h:'/login',l:'Panel admin'},{h:'#activos',l:'Torneos activos'},{h:'#proximos',l:'Inscribirme'}].map(l => (
                <a key={l.h} href={l.h}
                  style={{ color:'rgba(255,255,255,.4)', fontSize:'13px', textDecoration:'none', fontWeight:'500', transition:'color .2s' }}
                  onMouseEnter={e=>(e.currentTarget.style.color='#8BC34A')}
                  onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,.4)')}
                >{l.l}</a>
              ))}
            </div>
          </div>
        </footer>

      </div>

      {/* ── MODAL DETALLE + REGISTRO ──────────────────────────────────── */}
      {selectedTournament && (
        <TournamentModal
          t={selectedTournament}
          onClose={() => setSelectedTournament(null)}
          onViewPublic={() => { setSelectedTournament(null); navigate(`/torneo/${selectedTournament.id}`); }}
        />
      )}
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MODAL: detalle del torneo + formulario de registro
// ═════════════════════════════════════════════════════════════════════════════
function TournamentModal({ t, onClose, onViewPublic }: {
  t: Tournament; onClose: () => void; onViewPublic: () => void;
}) {
  const [tab, setTab] = useState<'info'|'register'>('info');
  const [form, setForm] = useState({
    nombres: '', apellidos: '', email: '',
    telefono: '', docNumber: '', category: CATEGORIES[2],
  });
  const [success, setSuccess] = useState(false);

  // Cierre con Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const registerMutation = useMutation({
    mutationFn: () =>
      publicApi.post(`/enrollments/public/${t.id}`, form).then(r => r.data),
    onSuccess: () => setSuccess(true),
  });

  const isOpen = t.status === 'open';

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:'fixed', inset:0, zIndex:500,
        backgroundColor:'rgba(0,0,0,.78)', backdropFilter:'blur(8px)',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:'16px', animation:'overlayIn .25s ease',
      }}
    >
      <div style={{
        backgroundColor:'#0F2010', border:'1px solid rgba(45,106,45,.45)',
        borderRadius:'22px', width:'100%', maxWidth:'560px',
        maxHeight:'90vh', overflowY:'auto',
        animation:'modalIn .28s cubic-bezier(.34,1.56,.64,1)',
        boxShadow:'0 32px 80px rgba(0,0,0,.6)',
      }}>
        {/* Barra top coloreada */}
        <div style={{ height:4, background:'linear-gradient(90deg,#1B3A1B,#8BC34A,#4CAF50)', borderRadius:'22px 22px 0 0' }}/>

        {/* Header modal */}
        <div style={{ padding:'22px 26px 16px', borderBottom:'1px solid rgba(255,255,255,.07)' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <span style={{
                  fontSize:'10px', fontWeight:'800', letterSpacing:'.09em',
                  padding:'3px 10px', borderRadius:'999px',
                  backgroundColor: isOpen ? 'rgba(139,195,74,.12)' : 'rgba(255,255,255,.07)',
                  color: isOpen ? '#8BC34A' : 'rgba(255,255,255,.5)',
                  border: `1px solid ${isOpen ? 'rgba(139,195,74,.3)' : 'rgba(255,255,255,.15)'}`,
                }}>
                  {isOpen ? '✅ INSCRIPCIONES ABIERTAS' : '🔒 INSCRIPCIONES CERRADAS'}
                </span>
              </div>
              <h2 style={{ margin:0, fontSize:'20px', fontWeight:'900', color:'white', lineHeight:1.2, letterSpacing:'-.01em' }}>
                {t.name}
              </h2>
              <p style={{ margin:'6px 0 0', fontSize:'13px', color:'rgba(255,255,255,.45)' }}>
                {CIRCUIT_LABEL[t.circuitLine] || t.circuitLine} · {TYPE_LABEL[t.type] || t.type}
                {t.stageNumber ? ` · Etapa ${t.stageNumber}` : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{ background:'rgba(255,255,255,.07)', border:'none', borderRadius:'8px',
                width:34, height:34, cursor:'pointer', fontSize:'16px', color:'rgba(255,255,255,.6)',
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
            >✕</button>
          </div>

          {/* Tabs info / registro */}
          <div style={{ display:'flex', gap:6, marginTop:16 }}>
            {(['info','register'] as const).map(k => (
              <button key={k} className="tab-btn"
                onClick={() => setTab(k)}
                style={{
                  backgroundColor: tab===k ? '#2D6A2D' : 'rgba(255,255,255,.06)',
                  color: tab===k ? 'white' : 'rgba(255,255,255,.5)',
                  boxShadow: tab===k ? '0 3px 12px rgba(45,106,45,.4)' : 'none',
                }}
              >
                {k==='info' ? '📋 Detalles' : '📝 Inscribirme'}
              </button>
            ))}
          </div>
        </div>

        {/* ── TAB INFO ──────────────────────────────────────────────────── */}
        {tab === 'info' && (
          <div style={{ padding:'22px 26px', animation:'slideUp .2s ease' }}>
            {/* Fechas */}
            <InfoSection title="📅 Fechas">
              <InfoRow label="Inicio torneo"         value={t.eventStart} />
              <InfoRow label="Fin torneo"            value={t.eventEnd} />
              <InfoRow label="Cierre inscripciones"  value={t.registrationEnd} />
            </InfoSection>

            {/* Precios */}
            <InfoSection title="💰 Inscripción">
              <div style={{ display:'flex', gap:12 }}>
                <PricePill label="Singles" value={`$${Number(t.inscriptionValue||0).toLocaleString('es-CO')} COP`} primary />
                {t.hasDoubles && (
                  <PricePill
                    label="Dobles"
                    value={t.doublesIncludedForSingles ? 'Incluido' : `$${Number(t.doublesValue||0).toLocaleString('es-CO')} COP`}
                  />
                )}
              </div>
            </InfoSection>

            {/* Categorías */}
            <InfoSection title="🏅 Categorías">
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {CATEGORIES.map(c => (
                  <span key={c} style={{
                    fontSize:'12px', fontWeight:'700', padding:'4px 12px', borderRadius:'8px',
                    backgroundColor:'rgba(139,195,74,.1)', border:'1px solid rgba(139,195,74,.2)',
                    color:'#8BC34A',
                  }}>{c}</span>
                ))}
              </div>
            </InfoSection>

            {/* Formato */}
            <InfoSection title="🎾 Modalidades">
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <Tag>Singles</Tag>
                {t.hasDoubles && <Tag blue>Dobles</Tag>}
              </div>
              {t.minPlayers && (
                <p style={{ margin:'10px 0 0', fontSize:'12px', color:'rgba(255,255,255,.4)' }}>
                  Mínimo {t.minPlayers} jugadores por categoría
                </p>
              )}
            </InfoSection>

            {/* Countdown si está abierto */}
            {isOpen && <CountdownBlock targetDate={t.registrationEnd} />}

            {/* Botones */}
            <div style={{ display:'flex', gap:10, marginTop:22 }}>
              <button
                onClick={onViewPublic}
                style={{ flex:1, padding:'11px', borderRadius:'11px',
                  border:'1px solid rgba(255,255,255,.15)', backgroundColor:'rgba(255,255,255,.06)',
                  color:'white', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}
              >
                👁 Ver página completa
              </button>
              {isOpen && (
                <button
                  onClick={() => setTab('register')}
                  style={{
                    flex:2, padding:'11px', borderRadius:'11px', border:'none',
                    background:'linear-gradient(135deg, #1B3A1B 0%, #4CAF50 100%)',
                    color:'white', fontSize:'14px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit',
                    boxShadow:'0 4px 18px rgba(45,106,45,.45)',
                  }}
                >
                  📝 Inscribirme ahora →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── TAB REGISTRO ──────────────────────────────────────────────── */}
        {tab === 'register' && (
          <div style={{ padding:'22px 26px', animation:'slideUp .2s ease' }}>

            {success ? (
              /* ── Éxito ── */
              <div style={{ textAlign:'center', padding:'32px 0' }}>
                <div style={{ fontSize:'52px', marginBottom:'14px',
                  animation:'fadeUp .5s ease forwards' }}>✅</div>
                <h3 style={{ margin:'0 0 10px', color:'#8BC34A', fontSize:'20px', fontWeight:'900' }}>
                  ¡Pre-inscripción exitosa!
                </h3>
                <p style={{ color:'rgba(255,255,255,.6)', fontSize:'14px', lineHeight:1.6, margin:'0 0 20px' }}>
                  Tu solicitud fue recibida. Un administrador confirmará tu inscripción
                  y recibirás las instrucciones de pago por correo.
                </p>
                <div style={{ backgroundColor:'rgba(139,195,74,.08)', border:'1px solid rgba(139,195,74,.25)',
                  borderRadius:'12px', padding:'14px', marginBottom:'20px' }}>
                  <p style={{ margin:0, fontSize:'13px', color:'rgba(255,255,255,.7)', lineHeight:1.5 }}>
                    🔑 Tu contraseña temporal para el portal es:<br/>
                    <strong style={{ color:'#8BC34A', fontFamily:'monospace', fontSize:'15px' }}>
                      {`${form.apellidos.slice(0,4).toLowerCase()}${(form.docNumber||'0000').slice(-4)}`}
                    </strong>
                    <br/>
                    <span style={{ fontSize:'11px', color:'rgba(255,255,255,.4)' }}>
                      Cámbiala cuando ingreses al sistema por primera vez.
                    </span>
                  </p>
                </div>
                <button
                  onClick={onClose}
                  style={{ padding:'11px 28px', borderRadius:'11px', border:'none',
                    backgroundColor:'#2D6A2D', color:'white', fontSize:'14px',
                    fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}
                >
                  Cerrar
                </button>
              </div>
            ) : (
              /* ── Formulario ── */
              <>
                {!isOpen && (
                  <div style={{ backgroundColor:'rgba(220,38,38,.1)', border:'1px solid rgba(220,38,38,.3)',
                    borderRadius:'10px', padding:'12px 14px', marginBottom:'20px' }}>
                    <p style={{ margin:0, fontSize:'13px', color:'#FCA5A5', fontWeight:'600' }}>
                      ⚠️ Las inscripciones para este torneo están cerradas.
                    </p>
                  </div>
                )}

                <p style={{ margin:'0 0 20px', fontSize:'13px', color:'rgba(255,255,255,.5)', lineHeight:1.5 }}>
                  Completa el formulario. Se creará tu cuenta automáticamente si no tienes una.
                </p>

                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                  {/* Nombres + Apellidos */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                    <Field label="Nombres *" value={form.nombres}
                      onChange={v => setForm(f=>({...f,nombres:v}))} placeholder="Juan" />
                    <Field label="Apellidos *" value={form.apellidos}
                      onChange={v => setForm(f=>({...f,apellidos:v}))} placeholder="García" />
                  </div>
                  {/* Email */}
                  <Field label="Correo electrónico *" value={form.email}
                    onChange={v => setForm(f=>({...f,email:v}))} placeholder="juan@email.com" type="email"/>
                  {/* Teléfono + Cédula */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                    <Field label="Teléfono" value={form.telefono}
                      onChange={v => setForm(f=>({...f,telefono:v}))} placeholder="300 000 0000" />
                    <Field label="Cédula" value={form.docNumber}
                      onChange={v => setForm(f=>({...f,docNumber:v}))} placeholder="12345678" />
                  </div>
                  {/* Categoría */}
                  <div>
                    <label style={{ display:'block', fontSize:'12px', fontWeight:'700',
                      color:'rgba(255,255,255,.55)', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.06em' }}>
                      Categoría *
                    </label>
                    <select
                      value={form.category}
                      onChange={e => setForm(f=>({...f,category:e.target.value}))}
                      style={{
                        width:'100%', backgroundColor:'rgba(255,255,255,.06)',
                        border:'1.5px solid rgba(255,255,255,.15)', borderRadius:'10px',
                        padding:'10px 14px', color:'white', fontSize:'14px', cursor:'pointer',
                        fontFamily:'inherit',
                      }}
                    >
                      {CATEGORIES.map(c => <option key={c} value={c} style={{ backgroundColor:'#0F2010' }}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {/* Error */}
                {registerMutation.isError && (
                  <div style={{ marginTop:'14px', padding:'11px 14px', borderRadius:'10px',
                    backgroundColor:'rgba(220,38,38,.1)', border:'1px solid rgba(220,38,38,.3)' }}>
                    <p style={{ margin:0, fontSize:'13px', color:'#FCA5A5' }}>
                      ❌ {(registerMutation.error as any)?.response?.data?.message || 'Error al registrar. Intenta de nuevo.'}
                    </p>
                  </div>
                )}

                {/* Botón submit */}
                <button
                  disabled={!isOpen || registerMutation.isPending || !form.nombres || !form.apellidos || !form.email}
                  onClick={() => registerMutation.mutate()}
                  style={{
                    marginTop:'20px', width:'100%', padding:'14px',
                    borderRadius:'12px', border:'none', cursor: isOpen && form.nombres && form.apellidos && form.email ? 'pointer' : 'not-allowed',
                    background: isOpen && form.nombres ? 'linear-gradient(135deg, #1B3A1B 0%, #4CAF50 100%)' : 'rgba(255,255,255,.08)',
                    color: isOpen && form.nombres ? 'white' : 'rgba(255,255,255,.3)',
                    fontSize:'15px', fontWeight:'800', fontFamily:'inherit',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:'10px',
                    boxShadow: isOpen && form.nombres ? '0 6px 24px rgba(45,106,45,.45)' : 'none',
                    transition:'all .2s',
                  }}
                >
                  {registerMutation.isPending
                    ? <><span className="spinner"/>Registrando...</>
                    : '🎾 Confirmar pre-inscripción'}
                </button>

                <p style={{ margin:'12px 0 0', fontSize:'11px', color:'rgba(255,255,255,.3)', textAlign:'center', lineHeight:1.5 }}>
                  Al inscribirte aceptas las bases del torneo. La inscripción se confirma al recibir el pago.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTES
// ═════════════════════════════════════════════════════════════════════════════

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom:46 }}>
      <p style={{ margin:'0 0 9px', fontSize:'10px', fontWeight:'800', letterSpacing:'.15em',
        textTransform:'uppercase', color:'#8BC34A' }}>{eyebrow}</p>
      <h2 style={{ margin:'0 0 9px', fontSize:'clamp(26px,4vw,42px)', fontWeight:'900',
        fontFamily:"'DM Serif Display',serif", letterSpacing:'-.02em', lineHeight:1, color:'white' }}>
        {title}
      </h2>
      <p style={{ margin:0, fontSize:'14px', color:'rgba(255,255,255,.4)', fontWeight:'300' }}>{subtitle}</p>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:'18px' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ height:220, borderRadius:'18px', backgroundColor:'rgba(255,255,255,.04)',
          animation:`pulseDot 1.4s ease-in-out infinite`, animationDelay:`${i*.2}s` }}/>
      ))}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div style={{ textAlign:'center', padding:'64px 20px',
      border:'1px dashed rgba(255,255,255,.1)', borderRadius:'18px' }}>
      <p style={{ fontSize:'36px', margin:'0 0 12px' }}>🎾</p>
      <p style={{ color:'rgba(255,255,255,.3)', fontSize:'14px', margin:0 }}>{msg}</p>
    </div>
  );
}

function ActiveCard({ t, delay, onClick }: { t: Tournament; delay: number; onClick: () => void }) {
  return (
    <div className="l-card" onClick={onClick} style={{
      borderRadius:'18px', cursor:'pointer', overflow:'hidden',
      background:'linear-gradient(140deg, rgba(27,58,27,.9) 0%, rgba(10,20,10,.97) 100%)',
      border:'1px solid rgba(45,106,45,.35)',
      animation:'fadeUp .6s ease forwards', animationDelay:`${delay}s`, opacity:0,
      boxShadow:'0 6px 28px rgba(0,0,0,.4)',
    }}>
      <div style={{ height:3, background:'linear-gradient(90deg,#1B3A1B,#8BC34A,#4CAF50)' }}/>
      <div style={{ padding:'20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6,
            backgroundColor:'rgba(220,38,38,.15)', border:'1px solid rgba(220,38,38,.3)',
            borderRadius:'999px', padding:'4px 10px' }}>
            <span style={{ width:7, height:7, borderRadius:'50%', backgroundColor:'#EF4444',
              animation:'pulseDot 1.2s ease-in-out infinite', display:'inline-block' }}/>
            <span style={{ fontSize:'10px', fontWeight:'800', color:'#FCA5A5', letterSpacing:'.08em' }}>EN VIVO</span>
          </div>
          <span style={{ fontSize:'10px', color:'rgba(255,255,255,.35)', fontWeight:'600',
            backgroundColor:'rgba(255,255,255,.06)', padding:'3px 9px', borderRadius:'6px' }}>
            {CIRCUIT_LABEL[t.circuitLine] || t.circuitLine}
          </span>
        </div>
        <h3 style={{ margin:'0 0 6px', fontSize:'17px', fontWeight:'800', color:'white', lineHeight:1.2 }}>{t.name}</h3>
        <p style={{ margin:'0 0 16px', fontSize:'12px', color:'rgba(255,255,255,.4)' }}>
          {TYPE_LABEL[t.type] || t.type}{t.stageNumber ? ` · Etapa ${t.stageNumber}` : ''}
          {t.hasDoubles ? ' · 🤝 Dobles' : ''}
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
          {[['Inicio',t.eventStart],['Fin',t.eventEnd]].map(([l,v]) => (
            <div key={l as string} style={{ backgroundColor:'rgba(139,195,74,.07)',
              border:'1px solid rgba(139,195,74,.18)', borderRadius:'9px', padding:'9px 11px' }}>
              <p style={{ margin:0, fontSize:'9px', color:'rgba(255,255,255,.3)', textTransform:'uppercase', letterSpacing:'.08em' }}>{l}</p>
              <p style={{ margin:'2px 0 0', fontSize:'12px', fontWeight:'700', color:'white' }}>{v}</p>
            </div>
          ))}
        </div>
        <button style={{ width:'100%', padding:'11px', borderRadius:'11px', border:'none',
          background:'linear-gradient(135deg,#1B3A1B 0%,#4CAF50 100%)',
          color:'white', fontSize:'13px', fontWeight:'700', cursor:'pointer',
          fontFamily:'inherit' }}>
          🔴 Ver marcadores en vivo →
        </button>
      </div>
    </div>
  );
}

function UpcomingCard({ t, delay, onDetails }: { t: Tournament; delay: number; onDetails: () => void }) {
  const countdown = useCountdown(t.registrationEnd || t.eventStart);
  const isOpen    = t.status === 'open';

  return (
    <div className="l-card" style={{
      borderRadius:'18px', overflow:'hidden',
      backgroundColor:'rgba(255,255,255,.025)',
      border:`1px solid ${isOpen ? 'rgba(139,195,74,.32)' : 'rgba(255,255,255,.1)'}`,
      animation:'fadeUp .6s ease forwards', animationDelay:`${delay}s`, opacity:0,
    }}>
      <div style={{ height:3, background: isOpen ? 'linear-gradient(90deg,#1B3A1B,#8BC34A)' : 'rgba(255,255,255,.1)' }}/>
      <div style={{ padding:'20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <span style={{
            fontSize:'10px', fontWeight:'800', letterSpacing:'.08em', padding:'4px 10px',
            borderRadius:'999px',
            backgroundColor: isOpen ? 'rgba(139,195,74,.1)' : 'rgba(255,255,255,.07)',
            color: isOpen ? '#8BC34A' : 'rgba(255,255,255,.4)',
            border: `1px solid ${isOpen ? 'rgba(139,195,74,.28)' : 'rgba(255,255,255,.12)'}`,
          }}>
            {isOpen ? '✅ ABIERTO' : '🔒 CERRADO'}
          </span>
          <span style={{ fontSize:'10px', color:'rgba(255,255,255,.3)', fontWeight:'600' }}>
            {CIRCUIT_LABEL[t.circuitLine] || t.circuitLine}
          </span>
        </div>

        <h3 style={{ margin:'0 0 5px', fontSize:'17px', fontWeight:'800', color:'white', lineHeight:1.2 }}>{t.name}</h3>
        <p style={{ margin:'0 0 14px', fontSize:'12px', color:'rgba(255,255,255,.4)' }}>
          {TYPE_LABEL[t.type] || t.type}{t.stageNumber ? ` · Etapa ${t.stageNumber}` : ''}
        </p>

        {/* Countdown sólo si está abierto */}
        {isOpen && (
          <div style={{ marginBottom:14 }}>
            <p style={{ margin:'0 0 7px', fontSize:'9px', color:'rgba(255,255,255,.3)',
              textTransform:'uppercase', letterSpacing:'.1em' }}>⏱ Cierre en:</p>
            <div style={{ display:'flex', gap:5 }}>
              {[{v:countdown.d,l:'d'},{v:countdown.h,l:'h'},{v:countdown.m,l:'m'},{v:countdown.s,l:'s'}].map(({v,l}) => (
                <div key={l} style={{ flex:1, backgroundColor:'rgba(139,195,74,.08)',
                  border:'1px solid rgba(139,195,74,.18)', borderRadius:'9px', padding:'7px 4px', textAlign:'center' }}>
                  <p style={{ margin:0, fontSize:'18px', fontWeight:'900', color:'#8BC34A',
                    lineHeight:1, fontVariantNumeric:'tabular-nums' }}>
                    {String(v).padStart(2,'0')}
                  </p>
                  <p style={{ margin:'2px 0 0', fontSize:'8px', color:'rgba(255,255,255,.3)',
                    textTransform:'uppercase', letterSpacing:'.1em' }}>{l}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div>
            <p style={{ margin:0, fontSize:'9px', color:'rgba(255,255,255,.3)', textTransform:'uppercase', letterSpacing:'.08em' }}>Inscripción</p>
            <p style={{ margin:'2px 0 0', fontSize:'16px', fontWeight:'900', color:'#8BC34A' }}>
              ${Number(t.inscriptionValue||0).toLocaleString('es-CO')}
              <span style={{ fontSize:'10px', color:'rgba(255,255,255,.3)', fontWeight:'400', marginLeft:3 }}>COP</span>
            </p>
          </div>
          <div style={{ textAlign:'right' }}>
            <p style={{ margin:0, fontSize:'9px', color:'rgba(255,255,255,.3)', textTransform:'uppercase', letterSpacing:'.08em' }}>Evento</p>
            <p style={{ margin:'2px 0 0', fontSize:'12px', fontWeight:'700', color:'rgba(255,255,255,.65)' }}>{t.eventStart}</p>
          </div>
        </div>

        {t.hasDoubles && (
          <div style={{ marginBottom:12 }}>
            <span style={{ fontSize:'10px', fontWeight:'700', backgroundColor:'rgba(139,195,74,.1)',
              color:'#8BC34A', border:'1px solid rgba(139,195,74,.2)', padding:'3px 9px', borderRadius:'999px' }}>
              🤝 Dobles disponibles
            </span>
          </div>
        )}

        {/* Botón principal */}
        <button
          onClick={onDetails}
          style={{
            width:'100%', padding:'12px', borderRadius:'11px', border:'none',
            background: isOpen
              ? 'linear-gradient(135deg, #1B3A1B 0%, #4CAF50 100%)'
              : 'rgba(255,255,255,.07)',
            color: isOpen ? 'white' : 'rgba(255,255,255,.5)',
            fontSize:'13px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit',
            boxShadow: isOpen ? '0 4px 18px rgba(45,106,45,.4)' : 'none',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          }}
        >
          {isOpen ? '📝 Ver detalles e inscribirme →' : '👁 Ver detalles'}
        </button>
      </div>
    </div>
  );
}

function PastRow({ t, index, onClick }: { t: Tournament; index: number; onClick: () => void }) {
  return (
    <div className="past-row" onClick={onClick} style={{
      display:'grid', gridTemplateColumns:'1fr 160px 180px 110px 70px',
      padding:'14px 22px', alignItems:'center',
      backgroundColor: index%2===0 ? 'rgba(255,255,255,.015)' : 'transparent',
      borderBottom:'1px solid rgba(255,255,255,.04)',
      animation:'fadeUp .45s ease forwards', animationDelay:`${index*.05}s`, opacity:0,
    }}>
      <div>
        <p style={{ margin:0, fontSize:'13px', fontWeight:'700', color:'rgba(255,255,255,.82)', lineHeight:1.2 }}>{t.name}</p>
        <p style={{ margin:'3px 0 0', fontSize:'10px', color:'rgba(255,255,255,.28)' }}>
          {TYPE_LABEL[t.type]||t.type}{t.stageNumber ? ` · Etapa ${t.stageNumber}` : ''}
        </p>
      </div>
      <span style={{ fontSize:'11px', color:'rgba(255,255,255,.4)', fontWeight:'500' }}>
        {CIRCUIT_LABEL[t.circuitLine]||t.circuitLine}
      </span>
      <span style={{ fontSize:'11px', color:'rgba(255,255,255,.35)' }}>
        {t.eventStart} → {t.eventEnd}
      </span>
      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
        <Tag small>Singles</Tag>
        {t.hasDoubles && <Tag blue small>Dobles</Tag>}
      </div>
      <span style={{ fontSize:'12px', color:'#8BC34A', fontWeight:'700', textAlign:'right' }}>Ver →</span>
    </div>
  );
}

function CountdownBlock({ targetDate }: { targetDate: string }) {
  const c = useCountdown(targetDate);
  return (
    <div style={{ marginBottom:18 }}>
      <p style={{ margin:'0 0 9px', fontSize:'11px', fontWeight:'700', color:'rgba(255,255,255,.4)',
        textTransform:'uppercase', letterSpacing:'.09em' }}>⏱ Cierre de inscripciones en:</p>
      <div style={{ display:'flex', gap:8 }}>
        {[{v:c.d,l:'días'},{v:c.h,l:'horas'},{v:c.m,l:'min'},{v:c.s,l:'seg'}].map(({v,l}) => (
          <div key={l} style={{ flex:1, textAlign:'center', backgroundColor:'rgba(139,195,74,.08)',
            border:'1px solid rgba(139,195,74,.2)', borderRadius:'11px', padding:'10px 6px' }}>
            <p style={{ margin:0, fontSize:'22px', fontWeight:'900', color:'#8BC34A',
              lineHeight:1, fontVariantNumeric:'tabular-nums' }}>
              {String(v).padStart(2,'0')}
            </p>
            <p style={{ margin:'3px 0 0', fontSize:'9px', color:'rgba(255,255,255,.3)',
              textTransform:'uppercase', letterSpacing:'.09em' }}>{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:20 }}>
      <p style={{ margin:'0 0 11px', fontSize:'11px', fontWeight:'800', color:'rgba(255,255,255,.4)',
        textTransform:'uppercase', letterSpacing:'.1em' }}>{title}</p>
      {children}
    </div>
  );
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
      <span style={{ fontSize:'13px', color:'rgba(255,255,255,.4)', fontWeight:'500' }}>{label}</span>
      <span style={{ fontSize:'13px', color:'white', fontWeight:'700' }}>{value || '—'}</span>
    </div>
  );
}
function PricePill({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <div style={{ flex:1, textAlign:'center', padding:'12px',
      backgroundColor: primary ? 'rgba(139,195,74,.1)' : 'rgba(255,255,255,.05)',
      border: `1px solid ${primary ? 'rgba(139,195,74,.3)' : 'rgba(255,255,255,.1)'}`,
      borderRadius:'12px' }}>
      <p style={{ margin:'0 0 4px', fontSize:'10px', color:'rgba(255,255,255,.4)', textTransform:'uppercase', letterSpacing:'.08em' }}>{label}</p>
      <p style={{ margin:0, fontSize:'16px', fontWeight:'900', color: primary ? '#8BC34A' : 'rgba(255,255,255,.7)' }}>{value}</p>
    </div>
  );
}
function Tag({ children, blue, small }: { children: React.ReactNode; blue?: boolean; small?: boolean }) {
  return (
    <span style={{
      fontSize: small ? '9px' : '11px', fontWeight:'700',
      padding: small ? '2px 7px' : '4px 11px', borderRadius:'7px',
      backgroundColor: blue ? 'rgba(29,78,216,.2)' : 'rgba(27,58,27,.8)',
      color: blue ? '#93C5FD' : '#8BC34A',
      border: `1px solid ${blue ? 'rgba(29,78,216,.3)' : 'rgba(139,195,74,.2)'}`,
    }}>{children}</span>
  );
}
function Field({ label, value, onChange, placeholder, type='text' }: {
  label: string; value: string; onChange: (v:string)=>void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label style={{ display:'block', fontSize:'12px', fontWeight:'700',
        color:'rgba(255,255,255,.55)', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.06em' }}>
        {label}
      </label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width:'100%', backgroundColor:'rgba(255,255,255,.06)',
          border:'1.5px solid rgba(255,255,255,.15)', borderRadius:'10px',
          padding:'10px 14px', color:'white', fontSize:'14px',
          fontFamily:'inherit', transition:'border-color .2s',
        }}
      />
    </div>
  );
}