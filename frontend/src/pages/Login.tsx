// frontend/src/pages/Login.tsx  ← REEMPLAZA COMPLETO
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth.api';

// ── Íconos SVG inline (sin dependencia extra) ─────────────────────────────────
const EyeIcon = ({ open }: { open: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </>
    )}
  </svg>
);

// ── Tipos ─────────────────────────────────────────────────────────────────────
type Mode = 'login' | 'register' | 'forgot';

// ── Validaciones ──────────────────────────────────────────────────────────────
const validate = (form: RegisterForm) => {
  const errs: Partial<RegisterForm> = {};
  if (!form.nombres.trim())   errs.nombres   = 'Requerido';
  if (!form.apellidos.trim()) errs.apellidos = 'Requerido';
  if (!form.email.includes('@')) errs.email  = 'Email inválido';
  if (form.password.length < 8)  errs.password = 'Mínimo 8 caracteres';
  if (form.password !== form.confirm) errs.confirm = 'Las contraseñas no coinciden';
  if (!form.docNumber.trim()) errs.docNumber = 'Requerido';
  return errs;
};

interface RegisterForm {
  nombres: string; apellidos: string;
  email: string; password: string; confirm: string;
  docNumber: string; telefono: string;
  birthDate: string; gender: string;
}

const emptyRegister: RegisterForm = {
  nombres: '', apellidos: '', email: '', password: '', confirm: '',
  docNumber: '', telefono: '', birthDate: '', gender: 'M',
};

// ═════════════════════════════════════════════════════════════════════════════
export default function Login() {
  const navigate  = useNavigate();
  const { login } = useAuth();

  const [mode, setMode]         = useState<Mode>('login');
  const [animating, setAnimating] = useState(false);

  // Login state
  const [loginEmail,    setLoginEmail]    = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPwd,  setShowLoginPwd]  = useState(false);
  const [loginError,    setLoginError]    = useState('');
  const [loginLoading,  setLoginLoading]  = useState(false);

  // Forgot password state
  const [forgotEmail,   setForgotEmail]   = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError,   setForgotError]   = useState('');
  const [forgotSent,    setForgotSent]    = useState(false);

  // Register state
  const [form,       setForm]       = useState<RegisterForm>(emptyRegister);
  const [fieldErrs,  setFieldErrs]  = useState<Partial<RegisterForm>>({});
  const [showPwd,    setShowPwd]    = useState(false);
  const [showConf,   setShowConf]   = useState(false);
  const [regError,   setRegError]   = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Animación de transición
  const switchMode = (next: Mode) => {
    if (next === mode || animating) return;
    setAnimating(true);
    setTimeout(() => { setMode(next); setAnimating(false); }, 260);
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const data = await authApi.login(loginEmail, loginPassword);
      login(data.access_token, data.role);
      navigate('/dashboard');
    } catch (err: any) {
      setLoginError(err.response?.data?.message || 'Credenciales inválidas');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Registro ──────────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setFieldErrs(errs); return; }
    setFieldErrs({});
    setRegLoading(true);
    try {
      await authApi.registerPlayer({
        email:     form.email,
        password:  form.password,
        nombres:   form.nombres,
        apellidos: form.apellidos,
        telefono:  form.telefono,
        docNumber: form.docNumber,
        birthDate: form.birthDate,
        gender:    form.gender,
      });
      setRegSuccess('¡Registro exitoso! Ahora puedes iniciar sesión.');
      setForm(emptyRegister);
      setTimeout(() => switchMode('login'), 2200);
    } catch (err: any) {
      setRegError(err.response?.data?.message || 'No se pudo registrar. Intenta de nuevo.');
    } finally {
      setRegLoading(false);
    }
  };

  const setField = (k: keyof RegisterForm, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setFieldErrs(e => ({ ...e, [k]: undefined }));
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: "'Outfit', 'DM Sans', system-ui, sans-serif",
      backgroundColor: '#0E1E0E',
    }}>

      {/* ── Panel izquierdo — branding ───────────────────────────────────── */}
      <div style={{
        width: '44%', flexShrink: 0,
        background: 'linear-gradient(160deg, #0A1A0A 0%, #183018 50%, #1E4A1E 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 40px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decoración de fondo */}
        <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '320px', height: '320px', borderRadius: '50%', border: '60px solid rgba(74,222,128,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-40px', left: '-60px', width: '220px', height: '220px', borderRadius: '50%', border: '40px solid rgba(74,222,128,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', left: '5%', width: '90%', height: '1px', backgroundColor: 'rgba(74,222,128,0.06)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ marginBottom: '32px', filter: 'drop-shadow(0 0 30px rgba(74,222,128,0.25))' }}>
            <img src="/logo.png" alt="Matchlungo Ace" style={{ width: '180px', objectFit: 'contain', maxHeight: '120px' }} />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', margin: '0 0 48px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Gestor de Torneos de Tenis
          </p>

          {/* Stats decorativos */}
          {[
            { n: 'Torneos', v: '12+' },
            { n: 'Jugadores', v: '500+' },
            { n: 'Partidos', v: '2.4K+' },
          ].map(({ n, v }) => (
            <div key={n} style={{ display: 'inline-block', margin: '0 12px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: '#86EFAC', letterSpacing: '-0.03em' }}>{v}</p>
              <p style={{ margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{n}</p>
            </div>
          ))}

          {/* Línea decorativa */}
          <div style={{ margin: '40px auto 0', width: '48px', height: '3px', borderRadius: '999px', background: 'linear-gradient(90deg, #4ADE80, #86EFAC)' }} />
        </div>

        {/* Link a página pública */}
        <a href="/torneo" style={{
          position: 'absolute', bottom: '28px',
          color: 'rgba(255,255,255,0.3)', fontSize: '12px', textDecoration: 'none',
          letterSpacing: '0.05em',
          transition: 'color 0.2s',
        }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
        >
          🌐 Ver marcadores públicos →
        </a>
      </div>

      {/* ── Panel derecho — formularios ──────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#F7F8F6',
        padding: '32px 24px',
        overflowY: 'auto',
      }}>
        <div style={{
          width: '100%', maxWidth: '420px',
          opacity: animating ? 0 : 1,
          transform: animating ? 'translateY(10px)' : 'translateY(0)',
          transition: 'opacity 0.26s ease, transform 0.26s ease',
        }}>

          {/* Tabs Login / Registro — ocultar en modo forgot */}
          {mode !== 'forgot' && (
            <div style={{
              display: 'flex', marginBottom: '28px',
              backgroundColor: '#EAEBE8', borderRadius: '12px', padding: '4px',
            }}>
              {(['login', 'register'] as Mode[]).map(m => (
                <button key={m} onClick={() => switchMode(m)} style={{
                  flex: 1, padding: '10px',
                  border: 'none', borderRadius: '9px', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: '14px', fontWeight: '700',
                  transition: 'all 0.2s ease',
                  backgroundColor: mode === m ? 'white' : 'transparent',
                  color: mode === m ? '#1B3A1B' : '#9CA3AF',
                  boxShadow: mode === m ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                }}>
                  {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                </button>
              ))}
            </div>
          )}

          {/* ══════ FORMULARIO LOGIN ══════ */}
          {mode === 'login' && (
            <>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '800', color: '#111', letterSpacing: '-0.02em' }}>
                  Bienvenido de nuevo
                </h2>
                <p style={{ margin: 0, color: '#6B7280', fontSize: '14px' }}>
                  Ingresa a tu cuenta Matchlungo Ace
                </p>
              </div>

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <Field label="Correo electrónico">
                  <input
                    type="email" value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="tu@email.com" required
                    style={inputStyle()}
                    onFocus={focusStyle} onBlur={blurStyle}
                  />
                </Field>

                <Field label="Contraseña">
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showLoginPwd ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="••••••••" required
                      style={{ ...inputStyle(), paddingRight: '44px' }}
                      onFocus={focusStyle} onBlur={blurStyle}
                    />
                    <button type="button" onClick={() => setShowLoginPwd(v => !v)} style={eyeBtnStyle()}>
                      <EyeIcon open={showLoginPwd} />
                    </button>
                  </div>
                </Field>

                {loginError && <ErrorBox msg={loginError} />}

                <button type="submit" disabled={loginLoading} style={submitBtnStyle(loginLoading)}>
                  {loginLoading ? <Spinner /> : 'Iniciar sesión'}
                </button>

                <div style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => { setForgotEmail(''); setForgotError(''); setForgotSent(false); switchMode('forgot'); }}
                    style={{ background: 'none', border: 'none', color: '#6B7280', fontWeight: '500', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', textDecoration: 'underline' }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              </form>

              <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#9CA3AF' }}>
                ¿No tienes cuenta?{' '}
                <button onClick={() => switchMode('register')} style={{ background: 'none', border: 'none', color: '#2D6A2D', fontWeight: '700', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>
                  Regístrate gratis
                </button>
              </p>
            </>
          )}

          {/* ══════ FORMULARIO REGISTRO ══════ */}
          {mode === 'register' && (
            <>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '800', color: '#111', letterSpacing: '-0.02em' }}>
                  Crear tu cuenta
                </h2>
                <p style={{ margin: 0, color: '#6B7280', fontSize: '13px' }}>
                  Accede a torneos, resultados y rankings de Matchlungo Ace
                </p>
              </div>

              {regSuccess ? (
                <div style={{
                  backgroundColor: '#F0FDF4', border: '1.5px solid #86EFAC',
                  borderRadius: '12px', padding: '24px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎉</div>
                  <p style={{ color: '#15803D', fontWeight: '700', fontSize: '16px', margin: '0 0 6px' }}>
                    ¡Registro exitoso!
                  </p>
                  <p style={{ color: '#6B7280', fontSize: '13px', margin: 0 }}>
                    Redirigiendo al inicio de sesión...
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                  {/* Nombre y Apellidos */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <Field label="Nombres *" error={fieldErrs.nombres}>
                      <input value={form.nombres} onChange={e => setField('nombres', e.target.value)}
                        placeholder="Juan" style={inputStyle(!!fieldErrs.nombres)}
                        onFocus={focusStyle} onBlur={blurStyle} />
                    </Field>
                    <Field label="Apellidos *" error={fieldErrs.apellidos}>
                      <input value={form.apellidos} onChange={e => setField('apellidos', e.target.value)}
                        placeholder="Pérez" style={inputStyle(!!fieldErrs.apellidos)}
                        onFocus={focusStyle} onBlur={blurStyle} />
                    </Field>
                  </div>

                  {/* Email */}
                  <Field label="Correo electrónico *" error={fieldErrs.email}>
                    <input type="email" value={form.email} onChange={e => setField('email', e.target.value)}
                      placeholder="tu@email.com" style={inputStyle(!!fieldErrs.email)}
                      onFocus={focusStyle} onBlur={blurStyle} />
                  </Field>

                  {/* Documento y Teléfono */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <Field label="N° Documento *" error={fieldErrs.docNumber}>
                      <input value={form.docNumber} onChange={e => setField('docNumber', e.target.value)}
                        placeholder="12345678" style={inputStyle(!!fieldErrs.docNumber)}
                        onFocus={focusStyle} onBlur={blurStyle} />
                    </Field>
                    <Field label="Teléfono">
                      <input value={form.telefono} onChange={e => setField('telefono', e.target.value)}
                        placeholder="3001234567" style={inputStyle()}
                        onFocus={focusStyle} onBlur={blurStyle} />
                    </Field>
                  </div>

                  {/* Fecha nacimiento y Género */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <Field label="Fecha de nacimiento">
                      <input type="date" value={form.birthDate} onChange={e => setField('birthDate', e.target.value)}
                        style={inputStyle()} onFocus={focusStyle} onBlur={blurStyle} />
                    </Field>
                    <Field label="Género">
                      <select value={form.gender} onChange={e => setField('gender', e.target.value)}
                        style={{ ...inputStyle(), cursor: 'pointer' }}>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                      </select>
                    </Field>
                  </div>

                  {/* Contraseña */}
                  <Field label="Contraseña *" error={fieldErrs.password}>
                    <div style={{ position: 'relative' }}>
                      <input type={showPwd ? 'text' : 'password'} value={form.password}
                        onChange={e => setField('password', e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        style={{ ...inputStyle(!!fieldErrs.password), paddingRight: '44px' }}
                        onFocus={focusStyle} onBlur={blurStyle} />
                      <button type="button" onClick={() => setShowPwd(v => !v)} style={eyeBtnStyle()}>
                        <EyeIcon open={showPwd} />
                      </button>
                    </div>
                    {/* Barra de fuerza */}
                    {form.password && <PasswordStrength pwd={form.password} />}
                  </Field>

                  <Field label="Confirmar contraseña *" error={fieldErrs.confirm}>
                    <div style={{ position: 'relative' }}>
                      <input type={showConf ? 'text' : 'password'} value={form.confirm}
                        onChange={e => setField('confirm', e.target.value)}
                        placeholder="Repite tu contraseña"
                        style={{ ...inputStyle(!!fieldErrs.confirm), paddingRight: '44px' }}
                        onFocus={focusStyle} onBlur={blurStyle} />
                      <button type="button" onClick={() => setShowConf(v => !v)} style={eyeBtnStyle()}>
                        <EyeIcon open={showConf} />
                      </button>
                    </div>
                  </Field>

                  {regError && <ErrorBox msg={regError} />}

                  {/* Aviso */}
                  <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '0', lineHeight: '1.5' }}>
                    Al registrarte aceptas usar la plataforma únicamente para participar en torneos de Matchlungo Ace. Tu cuenta tendrá rol de jugador.
                  </p>

                  <button type="submit" disabled={regLoading} style={submitBtnStyle(regLoading)}>
                    {regLoading ? <Spinner /> : 'Crear mi cuenta'}
                  </button>
                </form>
              )}

              <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#9CA3AF' }}>
                ¿Ya tienes cuenta?{' '}
                <button onClick={() => switchMode('login')} style={{ background: 'none', border: 'none', color: '#2D6A2D', fontWeight: '700', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>
                  Inicia sesión
                </button>
              </p>
            </>
          )}

          {/* ══════ MODO OLVIDÉ MI CONTRASEÑA ══════ */}
          {mode === 'forgot' && (
            <>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '800', color: '#111', letterSpacing: '-0.02em' }}>
                  Recuperar contraseña
                </h2>
                <p style={{ margin: 0, color: '#6B7280', fontSize: '14px' }}>
                  Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
                </p>
              </div>

              {forgotSent ? (
                <div style={{ backgroundColor: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '40px', marginBottom: '10px' }}>📧</div>
                  <p style={{ color: '#15803D', fontWeight: '700', fontSize: '16px', margin: '0 0 6px' }}>
                    ¡Correo enviado!
                  </p>
                  <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 16px' }}>
                    Si el correo está registrado, recibirás un enlace en los próximos minutos. Revisa tu bandeja de spam.
                  </p>
                  <button
                    onClick={() => switchMode('login')}
                    style={{ background: 'none', border: 'none', color: '#2D6A2D', fontWeight: '700', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit', textDecoration: 'underline' }}
                  >
                    ← Volver al inicio de sesión
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setForgotError('');
                    setForgotLoading(true);
                    try {
                      await authApi.forgotPassword(forgotEmail);
                      setForgotSent(true);
                    } catch {
                      setForgotError('No se pudo enviar el correo. Intenta de nuevo.');
                    } finally {
                      setForgotLoading(false);
                    }
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
                >
                  <Field label="Correo electrónico">
                    <input
                      type="email" value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      placeholder="tu@email.com" required
                      style={inputStyle()}
                      onFocus={focusStyle} onBlur={blurStyle}
                    />
                  </Field>

                  {forgotError && <ErrorBox msg={forgotError} />}

                  <button type="submit" disabled={forgotLoading} style={submitBtnStyle(forgotLoading)}>
                    {forgotLoading ? <Spinner /> : 'Enviar enlace de recuperación'}
                  </button>

                  <div style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      style={{ background: 'none', border: 'none', color: '#6B7280', fontWeight: '500', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}
                    >
                      ← Volver al inicio de sesión
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          <p style={{ textAlign: 'center', marginTop: '28px', color: '#D1D5DB', fontSize: '12px' }}>
            Matchlungo Ace © {new Date().getFullYear()} · Gestor de torneo de Tenis
          </p>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: #C4C4C4; }
        select option { color: #111; }
      `}</style>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Componentes helper pequeños
// ═════════════════════════════════════════════════════════════════════════════

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: error ? '#DC2626' : '#374151', marginBottom: '5px', letterSpacing: '0.02em' }}>
        {label}
      </label>
      {children}
      {error && <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#DC2626' }}>{error}</p>}
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
      <span style={{ flexShrink: 0, marginTop: '1px' }}>⚠️</span>
      <p style={{ margin: 0, color: '#DC2626', fontSize: '13px', lineHeight: '1.4' }}>{msg}</p>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite' }}>
        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" fill="none" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
      Procesando...
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

function PasswordStrength({ pwd }: { pwd: string }) {
  const score =
    (pwd.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(pwd) ? 1 : 0) +
    (/[0-9]/.test(pwd) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(pwd) ? 1 : 0);
  const labels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];
  const colors = ['', '#EF4444', '#F59E0B', '#3B82F6', '#22C55E'];
  return (
    <div style={{ marginTop: '6px' }}>
      <div style={{ display: 'flex', gap: '3px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, height: '3px', borderRadius: '999px', backgroundColor: i <= score ? colors[score] : '#E5E7EB', transition: 'background-color 0.3s' }} />
        ))}
      </div>
      {score > 0 && <p style={{ margin: '3px 0 0', fontSize: '11px', color: colors[score] }}>{labels[score]}</p>}
    </div>
  );
}

// ── Estilos reutilizables ──────────────────────────────────────────────────────
function inputStyle(error = false): React.CSSProperties {
  return {
    width: '100%', border: `1.5px solid ${error ? '#FECACA' : '#E5E7EB'}`,
    borderRadius: '9px', padding: '10px 13px', fontSize: '13px',
    backgroundColor: error ? '#FFF5F5' : 'white', color: '#111',
    outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'inherit',
  };
}
function focusStyle(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#2D6A2D';
  e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(45,106,45,0.12)';
}
function blurStyle(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#E5E7EB';
  e.currentTarget.style.boxShadow   = 'none';
}
function submitBtnStyle(loading: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '12px',
    background: loading ? '#6B7280' : 'linear-gradient(135deg, #1B3A1B 0%, #2D6A2D 100%)',
    color: 'white', border: 'none', borderRadius: '10px',
    fontSize: '14px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', letterSpacing: '0.02em',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    boxShadow: loading ? 'none' : '0 4px 14px rgba(27,58,27,0.3)',
    transition: 'all 0.2s ease',
  };
}
function eyeBtnStyle(): React.CSSProperties {
  return {
    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
    padding: '2px', display: 'flex', alignItems: 'center',
  };
}