// frontend/src/pages/ResetPassword.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/auth.api';

const EyeIcon = ({ open }: { open: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open ? (
      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
    ) : (
      <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
    )}
  </svg>
);

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword,  setNewPassword]  = useState('');
  const [confirm,      setConfirm]      = useState('');
  const [showPwd,      setShowPwd]      = useState(false);
  const [showConf,     setShowConf]     = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState(false);

  useEffect(() => {
    if (!token) setError('El enlace de recuperación no es válido. Solicita uno nuevo.');
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    if (newPassword !== confirm) { setError('Las contraseñas no coinciden'); return; }

    setLoading(true);
    try {
      await authApi.resetPassword(token, newPassword);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'No se pudo restablecer la contraseña. El enlace puede haber expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#0E1E0E', fontFamily: "'Outfit', system-ui, sans-serif",
      padding: '24px',
    }}>
      <div style={{
        width: '100%', maxWidth: '420px',
        backgroundColor: '#F7F8F6', borderRadius: '20px',
        padding: '36px 32px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Logo / Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img src="/logo.png" alt="LAT Torneos" style={{ width: '120px', objectFit: 'contain', maxHeight: '80px', marginBottom: '12px' }} />
          <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '800', color: '#111', letterSpacing: '-0.02em' }}>
            Nueva contraseña
          </h2>
          <p style={{ margin: 0, color: '#6B7280', fontSize: '14px' }}>
            Ingresa tu nueva contraseña para recuperar el acceso.
          </p>
        </div>

        {success ? (
          <div style={{ backgroundColor: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>✅</div>
            <p style={{ color: '#15803D', fontWeight: '700', fontSize: '16px', margin: '0 0 6px' }}>
              ¡Contraseña restablecida!
            </p>
            <p style={{ color: '#6B7280', fontSize: '13px', margin: 0 }}>
              Redirigiendo al inicio de sesión...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Nueva contraseña */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '5px' }}>
                Nueva contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres" required
                  style={{
                    width: '100%', border: '1.5px solid #E5E7EB', borderRadius: '9px',
                    padding: '10px 44px 10px 13px', fontSize: '13px', backgroundColor: 'white',
                    color: '#111', outline: 'none', fontFamily: 'inherit',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#2D6A2D'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(45,106,45,0.12)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '2px', display: 'flex', alignItems: 'center' }}>
                  <EyeIcon open={showPwd} />
                </button>
              </div>
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '5px' }}>
                Confirmar contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConf ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repite tu contraseña" required
                  style={{
                    width: '100%', border: '1.5px solid #E5E7EB', borderRadius: '9px',
                    padding: '10px 44px 10px 13px', fontSize: '13px', backgroundColor: 'white',
                    color: '#111', outline: 'none', fontFamily: 'inherit',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#2D6A2D'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(45,106,45,0.12)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShowConf(v => !v)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '2px', display: 'flex', alignItems: 'center' }}>
                  <EyeIcon open={showConf} />
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', display: 'flex', gap: '8px' }}>
                <span style={{ flexShrink: 0 }}>⚠️</span>
                <p style={{ margin: 0, color: '#DC2626', fontSize: '13px' }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !token}
              style={{
                width: '100%', padding: '12px',
                background: loading || !token ? '#6B7280' : 'linear-gradient(135deg, #1B3A1B 0%, #2D6A2D 100%)',
                color: 'white', border: 'none', borderRadius: '10px',
                fontSize: '14px', fontWeight: '700', cursor: loading || !token ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: loading || !token ? 'none' : '0 4px 14px rgba(27,58,27,0.3)',
              }}
            >
              {loading ? 'Procesando...' : '🔑 Restablecer contraseña'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => navigate('/login')}
                style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}
              >
                ← Volver al inicio de sesión
              </button>
            </div>
          </form>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: #C4C4C4; }
      `}</style>
    </div>
  );
}
