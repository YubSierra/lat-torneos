import { useState } from 'react';

export interface GameFormat {
  sets: number;
  gamesPerSet: number;
  withAd: boolean;
  tiebreakAtDeuce: boolean;
  tiebreakPoints: number;
  finalSetTiebreak: boolean;
  finalSetPoints: number;
}

export const DEFAULT_FORMAT: GameFormat = {
  sets: 3,
  gamesPerSet: 6,
  withAd: true,
  tiebreakAtDeuce: true,
  tiebreakPoints: 7,
  finalSetTiebreak: true,
  finalSetPoints: 10,
};

export function formatDescription(f: GameFormat): string {
  const sets = f.sets === 1 ? '1 set' : `${f.sets} sets`;
  const games = `${f.gamesPerSet} games`;
  const deuce = f.withAd ? 'con Ad' : 'sin Ad';
  const tiebreak = f.tiebreakAtDeuce ? `TB a ${f.tiebreakPoints}` : `game decisivo`;
  const final = f.sets > 1
    ? f.finalSetTiebreak ? `MTB a ${f.finalSetPoints}` : 'set decisivo'
    : '';
  return `${sets} × ${games} · ${deuce} · Empate: ${tiebreak}${final ? ` · Final: ${final}` : ''}`;
}

interface Props {
  value: GameFormat;
  onChange: (f: GameFormat) => void;
  label?: string;
}

export default function GameFormatConfig({ value, onChange, label }: Props) {
  const set = (key: keyof GameFormat, val: any) => onChange({ ...value, [key]: val });

  const btnStyle = (active: boolean) => ({
    padding: '6px 14px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '13px',
    backgroundColor: active ? '#2D6A2D' : '#F3F4F6',
    color: active ? 'white' : '#374151',
  });

  return (
    <div
      style={{
        border: '1px solid #E5E7EB',
        borderRadius: '10px',
        padding: '14px',
        backgroundColor: '#F9FAFB',
      }}
    >
      {label && (
        <p style={{ fontSize: '13px', fontWeight: '700', color: '#1B3A1B', marginBottom: '12px' }}>
          {label}
        </p>
      )}

      {/* Sets */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>
          Cantidad de sets
        </label>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[1, 2, 3, 5].map(n => (
            <button key={n} style={btnStyle(value.sets === n) as any} onClick={() => set('sets', n)}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Games por set */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>
          Games por set
        </label>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[4, 6, 8].map(n => (
            <button key={n} style={btnStyle(value.gamesPerSet === n) as any} onClick={() => set('gamesPerSet', n)}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Ad o Sin Ad */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>
          Ventaja (Ad)
        </label>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button style={btnStyle(value.withAd) as any} onClick={() => set('withAd', true)}>
            Con Ad
          </button>
          <button style={btnStyle(!value.withAd) as any} onClick={() => set('withAd', false)}>
            Sin Ad
          </button>
        </div>
      </div>

      {/* Empate en games */}
      <div
        style={{
          marginBottom: '12px',
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '10px',
          border: '1px solid #E5E7EB',
        }}
      >
        <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>
          Empate en games (ej. {value.gamesPerSet}-{value.gamesPerSet})
        </label>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <button
            style={btnStyle(value.tiebreakAtDeuce) as any}
            onClick={() => set('tiebreakAtDeuce', true)}
          >
            Tiebreak
          </button>
          <button
            style={btnStyle(!value.tiebreakAtDeuce) as any}
            onClick={() => set('tiebreakAtDeuce', false)}
          >
            Game decisivo
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
                  style={btnStyle(value.tiebreakPoints === n) as any}
                  onClick={() => set('tiebreakPoints', n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Empate en sets */}
      {value.sets > 1 && (
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '10px',
            border: '1px solid #E5E7EB',
          }}
        >
          <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>
            Empate en sets ({Math.floor(value.sets / 2)}-{Math.floor(value.sets / 2)})
          </label>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            <button
              style={btnStyle(value.finalSetTiebreak) as any}
              onClick={() => set('finalSetTiebreak', true)}
            >
              Match Tiebreak
            </button>
            <button
              style={btnStyle(!value.finalSetTiebreak) as any}
              onClick={() => set('finalSetTiebreak', false)}
            >
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
                    style={btnStyle(value.finalSetPoints === n) as any}
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

      {/* Preview */}
      <div
        style={{
          marginTop: '10px',
          backgroundColor: '#F0FDF4',
          borderRadius: '6px',
          padding: '8px 10px',
          fontSize: '11px',
          color: '#15803D',
        }}
      >
        📋 {formatDescription(value)}
      </div>
    </div>
  );
}
