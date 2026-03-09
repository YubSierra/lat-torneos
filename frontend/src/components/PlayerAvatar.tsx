// frontend/src/components/PlayerAvatar.tsx  ← ARCHIVO NUEVO
// Componente reutilizable: muestra foto del jugador o la inicial si no tiene

interface PlayerAvatarProps {
  name: string;          // Nombre para mostrar la inicial como fallback
  photoUrl?: string;     // URL de la foto (opcional)
  size?: number;         // Tamaño en px (default 40)
  borderColor?: string;  // Color del borde (default sin borde)
  fontSize?: number;     // Tamaño de la inicial (default automático)
}

export default function PlayerAvatar({
  name,
  photoUrl,
  size = 40,
  borderColor,
  fontSize,
}: PlayerAvatarProps) {
  const initial  = (name?.[0] || '?').toUpperCase();
  const fSize    = fontSize ?? Math.round(size * 0.38);

  const containerStyle: React.CSSProperties = {
    width:        size,
    height:       size,
    borderRadius: '50%',
    flexShrink:   0,
    overflow:     'hidden',
    border:       borderColor ? `2px solid ${borderColor}` : 'none',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
    position:     'relative',
  };

  if (photoUrl) {
    return (
      <div style={containerStyle}>
        <img
          src={photoUrl}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          // Si la imagen falla, mostramos la inicial
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = 'none';
            // Mostrar el div hermano con la inicial
            if (target.nextSibling) {
              (target.nextSibling as HTMLElement).style.display = 'flex';
            }
          }}
        />
        {/* Fallback oculto — se muestra si la imagen falla */}
        <div style={{
          display:         'none',
          position:        'absolute',
          inset:           0,
          alignItems:      'center',
          justifyContent:  'center',
          backgroundColor: '#DCFCE7',
          fontSize:        fSize,
          fontWeight:      '800',
          color:           '#1B3A1B',
        }}>
          {initial}
        </div>
      </div>
    );
  }

  // Sin foto → inicial con color basado en el nombre
  const colors = [
    { bg: '#DCFCE7', color: '#15803D' },
    { bg: '#DBEAFE', color: '#1D4ED8' },
    { bg: '#FEF3C7', color: '#92400E' },
    { bg: '#EDE9FE', color: '#6D28D9' },
    { bg: '#FCE7F3', color: '#9D174D' },
    { bg: '#D1FAE5', color: '#065F46' },
  ];
  // Seleccionar color basado en la primera letra (determinístico)
  const colorIdx = initial.charCodeAt(0) % colors.length;
  const { bg, color } = colors[colorIdx];

  return (
    <div style={{ ...containerStyle, backgroundColor: bg }}>
      <span style={{ fontSize: fSize, fontWeight: '800', color, userSelect: 'none' }}>
        {initial}
      </span>
    </div>
  );
}