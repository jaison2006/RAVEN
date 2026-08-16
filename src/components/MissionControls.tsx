import { useState } from 'react';
import type { MissionState, HazardType } from '../simulation/types';

interface Props {
  state: MissionState;
  onStart: () => void;
  onHazard: (type: HazardType) => void;
  onReset: () => void;
  onPause: () => void;
  onDemo: () => void;
}

const HAZARD_TYPES: Array<{ id: HazardType; label: string; icon: string; color: string }> = [
  { id: 'LANDSLIDE', label: 'LANDSLIDE', icon: '⛰', color: '#ffb800' },
  { id: 'ROAD_BLOCK', label: 'ROAD BLOCK', icon: '🚧', color: '#ff6b00' },
  { id: 'FIRE', label: 'FIRE ZONE', icon: '🔥', color: '#ff2d2d' },
  { id: 'OBSTACLE', label: 'OBSTACLE', icon: '⬛', color: '#ff4090' },
  { id: 'DAMAGED_ROAD', label: 'DAMAGED RD', icon: '⚠', color: '#ffb800' },
];

function Btn({ label, color, onClick, disabled, glow }: {
  label: string; color: string; onClick: () => void; disabled?: boolean; glow?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded font-display text-[8px] font-bold tracking-widest transition-all duration-200 border"
      style={{
        color: disabled ? '#2a4060' : color,
        borderColor: disabled ? 'rgba(42,64,96,0.4)' : `${color}44`,
        background: disabled ? 'rgba(8,15,30,0.5)' : `${color}12`,
        boxShadow: (!disabled && glow) ? `0 0 10px ${color}40` : 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={e => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = `${color}22`;
      }}
      onMouseLeave={e => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = `${color}12`;
      }}
    >
      {label}
    </button>
  );
}

export default function MissionControls({ state, onStart, onHazard, onReset, onPause, onDemo }: Props) {
  const [selectedHazard, setSelectedHazard] = useState<HazardType>('LANDSLIDE');

  const isMoving = state.phase === 'MOVING' || state.phase === 'RESUMED';
  const isRunning = state.phase !== 'IDLE' && state.phase !== 'COMPLETED';
  const isDone = state.phase === 'COMPLETED';

  return (
    <div
      className="flex items-center gap-4 px-4 py-2 border-t"
      style={{ background: '#050d1c', borderColor: 'rgba(0,212,255,0.15)' }}
    >
      {/* Demo mode */}
      <button
        onClick={onDemo}
        disabled={isRunning}
        className="flex items-center gap-2 px-4 py-2 rounded font-display text-[9px] font-bold tracking-widest transition-all border"
        style={{
          color: isRunning ? '#2a4060' : '#00ff8c',
          borderColor: isRunning ? 'rgba(42,64,96,0.3)' : 'rgba(0,255,140,0.4)',
          background: isRunning ? 'rgba(8,15,30,0.5)' : 'rgba(0,255,140,0.08)',
          boxShadow: isRunning ? 'none' : '0 0 12px rgba(0,255,140,0.2)',
          cursor: isRunning ? 'not-allowed' : 'pointer',
          minWidth: '100px',
        }}
      >
        <span>▶▶</span>
        <span>DEMO MODE</span>
      </button>

      <div className="w-px h-6 bg-[rgba(0,212,255,0.1)]" />

      {/* Mission controls */}
      <div className="flex items-center gap-2">
        <Btn label="▶ START" color="#00d4ff" onClick={onStart} disabled={isRunning || isDone} glow />
        <Btn label="⏸ PAUSE" color="#ffb800" onClick={onPause} disabled={!isRunning} />
        <Btn label="↺ RESET" color="#4a6885" onClick={onReset} />
      </div>

      <div className="w-px h-6 bg-[rgba(0,212,255,0.1)]" />

      {/* Hazard simulation */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[7px] text-[#4a6885] tracking-widest">HAZARD SIM</span>
        <div className="flex gap-1">
          {HAZARD_TYPES.map(h => (
            <button
              key={h.id}
              onClick={() => setSelectedHazard(h.id)}
              className="px-2 py-1 rounded font-mono text-[7px] transition-all border"
              style={{
                color: selectedHazard === h.id ? h.color : '#4a6885',
                borderColor: selectedHazard === h.id ? `${h.color}55` : 'rgba(42,64,96,0.3)',
                background: selectedHazard === h.id ? `${h.color}15` : 'transparent',
                cursor: 'pointer',
              }}
            >
              {h.icon} {h.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => isMoving && onHazard(selectedHazard)}
          disabled={!isMoving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded font-display text-[8px] font-bold tracking-widest transition-all border"
          style={{
            color: !isMoving ? '#2a4060' : '#ff2d2d',
            borderColor: !isMoving ? 'rgba(42,64,96,0.3)' : 'rgba(255,45,45,0.5)',
            background: !isMoving ? 'rgba(8,15,30,0.5)' : 'rgba(255,45,45,0.1)',
            boxShadow: isMoving ? '0 0 12px rgba(255,45,45,0.3)' : 'none',
            cursor: !isMoving ? 'not-allowed' : 'pointer',
          }}
        >
          ⚠ SIMULATE HAZARD
        </button>
      </div>

      {/* Phase indicator */}
      <div className="ml-auto flex items-center gap-2">
        {state.demoPhaseLabel && (
          <div
            className="px-3 py-1 rounded font-mono text-[8px] animate-fade-up"
            style={{
              color: '#00d4ff',
              background: 'rgba(0,212,255,0.08)',
              border: '1px solid rgba(0,212,255,0.2)',
            }}
          >
            {state.demoPhaseLabel}
          </div>
        )}
      </div>
    </div>
  );
}
