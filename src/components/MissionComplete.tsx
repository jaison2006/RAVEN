import type { MissionState } from '../simulation/types';

interface Props {
  state: MissionState;
  onReset: () => void;
}

export default function MissionComplete({ state, onReset }: Props) {
  if (state.phase !== 'COMPLETED') return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(4,12,24,0.85)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="rounded-lg p-8 text-center max-w-md animate-fade-up"
        style={{
          background: 'rgba(8,15,30,0.95)',
          border: '1px solid rgba(0,255,140,0.4)',
          boxShadow: '0 0 40px rgba(0,255,140,0.15), 0 0 80px rgba(0,255,140,0.05)',
        }}
      >
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(0,255,140,0.1)', border: '2px solid rgba(0,255,140,0.4)' }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="12" stroke="#00ff8c" strokeWidth="1.5" opacity="0.5" />
            <path d="M10 16l4 4 8-8" stroke="#00ff8c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="font-display text-[9px] tracking-[0.3em] text-[#4a8070] mb-2">AUTONOMOUS MISSION</div>
        <div className="font-display text-[22px] font-bold text-[#00ff8c] mb-1 tracking-wide">
          ARRIVED
        </div>
        <div className="font-display text-[10px] tracking-widest text-[#00c070] mb-6">
          DESTINATION REACHED
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { l: 'DESTINATION ZONE-07', v: 'ARRIVED' },
            { l: 'HAZARDS DETECTED', v: String(state.hazardsDetected) },
            { l: 'AUTONOMOUS REROUTES', v: String(state.reroutes) },
            { l: 'FINAL RISK SCORE', v: `${state.routes.find(r => r.status === 'ACTIVE')?.currentRisk ?? state.finalRisk}%` },
          ].map(({ l, v }) => (
            <div
              key={l}
              className="rounded p-2.5"
              style={{ background: 'rgba(0,255,140,0.04)', border: '1px solid rgba(0,255,140,0.12)' }}
            >
              <div className="font-mono text-[7px] text-[#4a8070] mb-1">{l}</div>
              <div className="font-mono text-[12px] font-bold text-[#00ff8c]">{v}</div>
            </div>
          ))}
        </div>

        {/* Innovation callout */}
        <div
          className="mb-5 p-3 rounded text-left"
          style={{ background: 'rgba(155,109,255,0.06)', border: '1px solid rgba(155,109,255,0.2)' }}
        >
          <div className="font-mono text-[7px] text-[#9b6dff] mb-2 tracking-widest">RAVEN-RX DEMONSTRATED</div>
          <div className="flex flex-col gap-1">
            {[
              'Risk-aware dynamic rerouting',
              'Multi-factor risk fusion engine',
              'Explainable AI decision logic',
              'Decentralized mesh communication',
            ].map(item => (
              <div key={item} className="flex items-center gap-2 font-mono text-[8px] text-[#a090d0]">
                <span className="text-[#9b6dff]">◈</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onReset}
          className="font-display text-[9px] font-bold tracking-widest px-6 py-2.5 rounded border transition-all"
          style={{
            color: '#00d4ff',
            borderColor: 'rgba(0,212,255,0.4)',
            background: 'rgba(0,212,255,0.08)',
            cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.18)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.08)')}
        >
          ↺ RUN AGAIN
        </button>
      </div>
    </div>
  );
}
