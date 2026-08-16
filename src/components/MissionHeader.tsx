import type { MissionState } from '../simulation/types';

interface Props { state: MissionState }

function StatusDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full animate-pulse-dot"
      style={{ background: color, boxShadow: `0 0 6px ${color}` }}
    />
  );
}

function Stat({ label, value, color = '#d4e8ff', mono = true }: {
  label: string; value: string; color?: string; mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] font-mono tracking-widest text-[#4a6885] uppercase">{label}</span>
      <span
        className={`text-[11px] font-semibold tracking-wide ${mono ? 'font-mono' : 'font-display'}`}
        style={{ color, fontFamily: mono ? "'JetBrains Mono'" : "'Orbitron'" }}
      >
        {value}
      </span>
    </div>
  );
}

export default function MissionHeader({ state }: Props) {
  const { phase, progress, activeRouteId, routes, reroutes, hazardsDetected, missionRiskLimit } = state;
  const activeRoute = routes.find(r => r.id === activeRouteId);
  const risk = activeRoute?.currentRisk ?? 0;

  const missionStatus = phase === 'COMPLETED'
    ? 'COMPLETE' : phase === 'HAZARD_DETECTED' || phase === 'RISK_EVALUATION'
    ? 'THREAT' : phase === 'IDLE'
    ? 'STANDBY' : 'ACTIVE';

  const statusColor = missionStatus === 'COMPLETE' ? '#00ff8c'
    : missionStatus === 'THREAT' ? '#ff2d2d'
    : missionStatus === 'ACTIVE' ? '#00d4ff'
    : '#4a6885';

  const riskColor = risk > 50 ? '#ff2d2d' : risk > 35 ? '#ffb800' : '#00ff8c';

  return (
    <header
      className="relative flex items-center gap-0 border-b z-30 overflow-hidden"
      style={{ background: '#050d1c', borderColor: 'rgba(0,212,255,0.18)', height: '52px' }}
    >
      {/* Left: Logo */}
      <div
        className="flex items-center gap-3 px-4 h-full border-r"
        style={{ borderColor: 'rgba(0,212,255,0.15)', minWidth: '200px' }}
      >
        <div className="relative">
          <div
            className="w-7 h-7 flex items-center justify-center rounded"
            style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.35)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <polygon points="8,1 15,14 1,14" stroke="#00d4ff" strokeWidth="1.2" fill="rgba(0,212,255,0.15)" />
              <circle cx="8" cy="10" r="1.8" fill="#00d4ff" />
            </svg>
          </div>
        </div>
        <div>
          <div className="font-display text-[11px] font-bold tracking-[0.2em] text-[#00d4ff]">RAVEN-RX</div>
          <div className="font-mono text-[7px] text-[#2a5070] tracking-widest">AUTONOMOUS NAVIGATION</div>
        </div>
      </div>

      {/* Mission badge */}
      <div
        className="flex items-center gap-2 px-4 h-full border-r"
        style={{ borderColor: 'rgba(0,212,255,0.1)' }}
      >
        <StatusDot color={statusColor} />
        <div>
          <div className="font-mono text-[8px] text-[#4a6885] tracking-widest">MISSION</div>
          <div className="font-display text-[10px] font-bold tracking-wide" style={{ color: statusColor }}>
            {missionStatus}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 px-5 h-full flex-1">
        <Stat label="SOURCE" value="BASE-01" color="#00d4ff" />
        <Stat label="DESTINATION" value="ZONE-07" color="#00ff8c" />
        <Stat label="VEHICLE" value="NODE-01" />
        <div className="flex flex-col gap-0.5 min-w-[90px]">
          <span className="text-[8px] font-mono tracking-widest text-[#4a6885] uppercase">PROGRESS</span>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-[#0a1a30] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#004466,#00d4ff)' }}
              />
            </div>
            <span className="font-mono text-[10px] text-[#00d4ff]">{progress}%</span>
          </div>
        </div>
        <Stat label="ACTIVE ROUTE" value={activeRouteId} color="#00d4ff" />
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] font-mono tracking-widest text-[#4a6885] uppercase">RISK</span>
          <span className="font-mono text-[11px] font-semibold" style={{ color: riskColor }}>
            {risk}%
          </span>
        </div>
        <Stat label="RISK LIMIT" value={`${missionRiskLimit}%`} color="#ffb800" />
        <Stat label="REROUTES" value={String(reroutes)} />
        <Stat label="HAZARDS" value={String(hazardsDetected)} color={hazardsDetected > 0 ? '#ff2d2d' : '#4a6885'} />
      </div>

      {/* Network status */}
      <div
        className="flex items-center gap-2 px-4 h-full border-l"
        style={{ borderColor: 'rgba(0,212,255,0.1)' }}
      >
        <StatusDot color="#00ff8c" />
        <div>
          <div className="font-mono text-[8px] text-[#4a6885] tracking-widest">NETWORK</div>
          <div className="font-mono text-[10px] font-semibold text-[#00ff8c]">MESH · 5 NODES</div>
        </div>
      </div>

      {/* Phase label */}
      {state.demoPhaseLabel && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent, #00d4ff, transparent)', opacity: 0.6 }}
        />
      )}
    </header>
  );
}
