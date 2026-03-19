import { useState } from 'react';

export interface GameFormat {
  sets: number;
  gamesPerSet: number;
  withAd: boolean;
  tiebreakAtDeuce: boolean;
  tiebreakPoints: number;
  finalSetTiebreak: boolean;
  finalSetPoints: number;
  // Modo por puntos (categorías infantiles)
  playByPoints?: boolean;
  pointsPerSet?: number;
}

export const DEFAULT_FORMAT: GameFormat = {
  sets: 3,
  gamesPerSet: 6,
  withAd: true,
  tiebreakAtDeuce: true,
  tiebreakPoints: 7,
  finalSetTiebreak: true,
  finalSetPoints: 10,
  playByPoints: false,
  pointsPerSet: 11,
};

export function formatDescription(f: GameFormat): string {
  if (f.playByPoints) {
    const sets  = f.sets === 1 ? '1 set' : `${f.sets} sets`;
    const pts   = `${f.pointsPerSet ?? 11} puntos`;
    const deuce = f.withAd ? 'con ventaja' : 'sin ventaja';
    const tie   = f.tiebreakAtDeuce
      ? `TB a ${f.tiebreakPoints}`
      : 'muerte súbita';
    const final = f.sets > 1
      ? f.finalSetTiebreak
        ? ` · Final: MTB a ${f.finalSetPoints}`
        : ' · Final: set decisivo'
      : '';
    return `${sets} × ${pts} · ${deuce} · Empate: ${tie}${final}`;
  }

  const sets     = f.sets === 1 ? '1 set' : `${f.sets} sets`;
  const games    = `${f.gamesPerSet} games`;
  const deuce    = f.withAd ? 'con Ad' : 'sin Ad';
  const tiebreak = f.tiebreakAtDeuce
    ? `TB a ${f.tiebreakPoints}`
    : 'game decisivo';
  const final = f.sets > 1
    ? f.finalSetTiebreak
      ? ` · Final: MTB a ${f.finalSetPoints}`
      : ' · Final: set decisivo'
    : '';
  return `${sets} × ${games} · ${deuce} · Empate: ${tiebreak}${final}`;
}

interface Props {
  value: GameFormat;
  onChange: (f: GameFormat) => void;
  label?: string;
}

export default function GameFormatConfig({ value, onChange, label }: Props) {
  const [customPoints, setCustomPoints] = useState('');

  const set = (key: keyof GameFormat, val: any) =>
    onChange({ ...value, [key]: val });

  const togglePlayByPoints = (byPoints: boolean) => {
    onChange({
      ...value,
      playByPoints: byPoints,
      // Defaults razonables al cambiar de modo
      pointsPerSet: byPoints ? (value.pointsPerSet ?? 11) : value.pointsPerSet,
    });
  };

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '13px',
    backgroundColor: active ? '#2D6A2D' : '#F3F4F6',
    color: active ? 'white' : '#374151',
  });

  const byPoints = !!value.playByPoints;

  return (
    <div style={{
      border: '1px solid #E5E7EB',
      borderRadius: '10px',
      padding: '14px',
      backgroundColor: '#F9FAFB',
    }}>
      {label && (
        <p style={{ fontSize: '13px', fontWeight: '700', color: '#1B3A1B', marginBottom: '12px' }}>
          {label}
        </p>
      )}

      {/* ── Modo de juego ─────────────────────────────────────────── */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>
          Modo de juego
        </label>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button style={btnStyle(!byPoints)} onClick={() => togglePlayByPoints(false)}>
            🎾 Por games
          </button>
          <button
            style={{
              ...btnStyle(byPoints),
              backgroundColor: byPoints ? '#7C3AED' : '#F3F4F6',
              color: byPoints ? 'white' : '#374151',
            }}
            onClick={() => togglePlayByPoints(true)}
          >
            🔢 Por puntos
          </button>
        </div>
        {byPoints && (
          <p style={{ fontSize: '11px', color: '#7C3AED', marginTop: '4px', fontWeight: 500 }}>
            Modo infantil: se juegan puntos directos en lugar de games
          </p>
        )}
      </div>

      {/* ── Sets ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>
          Cantidad de sets
        </label>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[1, 2, 3, 5].map(n => (
            <button key={n} style={btnStyle(value.sets === n)} onClick={() => set('sets', n)}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* ── Games por set  ó  Puntos por set ─────────────────────── */}
      {!byPoints ? (
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>
            Games por set
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[4, 6, 8].map(n => (
              <button key={n} style={btnStyle(value.gamesPerSet === n)} onClick={() => set('gamesPerSet', n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>
            Puntos por set
          </label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {[7, 11, 15, 21, 25].map(n => (
              <button
                key={n}
                style={{
                  ...btnStyle(value.pointsPerSet === n && !customPoints),
                  backgroundColor: value.pointsPerSet === n && !customPoints ? '#7C3AED' : '#F3F4F6',
                  color: value.pointsPerSet === n && !customPoints ? 'white' : '#374151',
                }}
                onClick={() => { setCustomPoints(''); set('pointsPerSet', n); }}
              >
                {n}
              </button>
            ))}
            {/* Input personalizado */}
            <input
              type="number"
              min={3}
              max={100}
              placeholder="Otro"
              value={customPoints}
              onChange={e => {
                setCustomPoints(e.target.value);
                const n = parseInt(e.target.value);
                if (!isNaN(n) && n > 0) set('pointsPerSet', n);
              }}
              style={{
                width: '64px',
                padding: '5px 8px',
                borderRadius: '6px',
                border: `1.5px solid ${customPoints ? '#7C3AED' : '#D1D5DB'}`,
                fontSize: '13px',
                fontWeight: 600,
                textAlign: 'center',
                color: '#374151',
              }}
            />
          </div>
          <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
            El jugador que primero alcance {value.pointsPerSet ?? 11} puntos gana el set
          </p>
        </div>
      )}

      {/* ── Ventaja (Ad) ─────────────────────────────────────────── */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>
          {byPoints ? 'Ventaja en puntos' : 'Ventaja (Ad)'}
        </label>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button style={btnStyle(value.withAd)} onClick={() => set('withAd', true)}>
            Con ventaja
          </button>
          <button style={btnStyle(!value.withAd)} onClick={() => set('withAd', false)}>
            Sin ventaja
          </button>
        </div>
      </div>

      {/* ── Empate en games/puntos ───────────────────────────────── */}
      <div style={{
        marginBottom: '12px',
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '10px',
        border: '1px solid #E5E7EB',
      }}>
        <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>
          {byPoints
            ? `Empate en puntos (${value.pointsPerSet ?? 11 - 1}-${value.pointsPerSet ?? 11 - 1})`
            : `Empate en games (${value.gamesPerSet}-${value.gamesPerSet})`}
        </label>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <button style={btnStyle(value.tiebreakAtDeuce)} onClick={() => set('tiebreakAtDeuce', true)}>
            Tiebreak
          </button>
          <button style={btnStyle(!value.tiebreakAtDeuce)} onClick={() => set('tiebreakAtDeuce', false)}>
            {byPoints ? 'Muerte súbita' : 'Game decisivo'}
          </button>
        </div>
        {value.tiebreakAtDeuce && (
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>
              Puntos del tiebreak (diferencia de 2)
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[5, 7, 10, 12].map(n => (
                <button
                  key={n}
                  style={btnStyle(value.tiebreakPoints === n)}
                  onClick={() => set('tiebreakPoints', n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Empate en sets ───────────────────────────────────────── */}
      {value.sets > 1 && (
        <div style={{
          marginBottom: '12px',
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '10px',
          border: '1px solid #E5E7EB',
        }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>
            Empate en sets ({Math.floor(value.sets / 2)}-{Math.floor(value.sets / 2)})
          </label>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            <button style={btnStyle(value.finalSetTiebreak)} onClick={() => set('finalSetTiebreak', true)}>
              Match Tiebreak
            </button>
            <button style={btnStyle(!value.finalSetTiebreak)} onClick={() => set('finalSetTiebreak', false)}>
              Set decisivo
            </button>
          </div>
          {value.finalSetTiebreak && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>
                Puntos del Match Tiebreak (diferencia de 2)
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[5, 7, 10, 12].map(n => (
                  <button
                    key={n}
                    style={btnStyle(value.finalSetPoints === n)}
                    onClick={() => set('finalSetPoints', n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Preview ──────────────────────────────────────────────── */}
      <div style={{
        marginTop: '6px',
        backgroundColor: byPoints ? '#F5F3FF' : '#F0FDF4',
        borderRadius: '6px',
        padding: '8px 10px',
        fontSize: '11px',
        color: byPoints ? '#6D28D9' : '#15803D',
      }}>
        📋 {formatDescription(value)}
      </div>
    </div>
  );
}
