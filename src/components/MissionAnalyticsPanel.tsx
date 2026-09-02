import type { MissionState } from '../simulation/types';

interface Props {
  state: MissionState;
}

export default function MissionAnalyticsPanel({ state }: Props) {
  const { startTime, missionDuration, reroutes, hazardsDetected, riskHistory, routes, activeRouteId } = state;
  const activeRoute = routes.find(r => r.id === activeRouteId);

  const peakRisk = riskHistory.length > 0 ? Math.max(...riskHistory.map(r => r.risk)) : 0;
  const avgRisk = riskHistory.length > 0 ? Math.round(riskHistory.reduce((acc, r) => acc + r.risk, 0) / riskHistory.length) : 0;

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
        <div className="w-1.5 h-1.5 rounded-full bg-[#9b6dff]" style={{ boxShadow: '0 0 5px #9b6dff' }} />
        <span className="font-display text-[9px] font-bold tracking-widest text-[#9b6dff]">MISSION ANALYTICS</span>
      </div>

      {/* Stats Grid */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-1.5">
          {/* Duration */}
          <div className="rounded p-2 border" style={{ borderColor: 'rgba(0,212,255,0.2)', background: 'rgba(0,212,255,0.04)' }}>
            <div className="font-mono text-[6px] text-[#4a6885] mb-0.5">DURATION</div>
            <div className="font-mono text-[9px] font-bold text-[#00d4ff]">{formatTime(missionDuration)}</div>
          </div>

          {/* Distance */}
          <div className="rounded p-2 border" style={{ borderColor: 'rgba(0,ff,140,0.2)', background: 'rgba(0,255,140,0.04)' }}>
            <div className="font-mono text-[6px] text-[#4a6885] mb-0.5">DISTANCE</div>
            <div className="font-mono text-[9px] font-bold text-[#00ff8c]">{activeRoute?.distance?.toFixed(1)}km</div>
          </div>

          {/* Hazards */}
          <div className="rounded p-2 border" style={{ borderColor: 'rgba(255,45,45,0.2)', background: 'rgba(255,45,45,0.04)' }}>
            <div className="font-mono text-[6px] text-[#4a6885] mb-0.5">HAZARDS</div>
            <div className="font-mono text-[9px] font-bold text-[#ff2d2d]">{hazardsDetected}</div>
          </div>

          {/* Reroutes */}
          <div className="rounded p-2 border" style={{ borderColor: 'rgba(155,109,255,0.2)', background: 'rgba(155,109,255,0.04)' }}>
            <div className="font-mono text-[6px] text-[#4a6885] mb-0.5">REROUTES</div>
            <div className="font-mono text-[9px] font-bold text-[#9b6dff]">{reroutes}</div>
          </div>

          {/* Peak Risk */}
          <div className="rounded p-2 border" style={{ borderColor: 'rgba(255,184,0,0.2)', background: 'rgba(255,184,0,0.04)' }}>
            <div className="font-mono text-[6px] text-[#4a6885] mb-0.5">PEAK RISK</div>
            <div className="font-mono text-[9px] font-bold text-[#ffb800]">{peakRisk}%</div>
          </div>

          {/* Avg Risk */}
          <div className="rounded p-2 border" style={{ borderColor: 'rgba(212,232,255,0.2)', background: 'rgba(212,232,255,0.04)' }}>
            <div className="font-mono text-[6px] text-[#4a6885] mb-0.5">AVG RISK</div>
            <div className="font-mono text-[9px] font-bold text-[#d4e8ff]">{avgRisk}%</div>
          </div>
        </div>

        {/* Risk Timeline */}
        {riskHistory.length > 1 && (
          <div className="mt-3 pt-2 border-t" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
            <div className="font-mono text-[7px] text-[#4a6885] tracking-widest mb-1">RISK TIMELINE</div>
            <div className="h-12 flex items-end gap-0.5 bg-[rgba(0,212,255,0.04)] p-1 rounded border" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
              {riskHistory.slice(-30).map((entry, i) => {
                const height = (entry.risk / 100) * 100;
                const color = entry.risk > 50 ? '#ff2d2d' : entry.risk > 35 ? '#ffb800' : '#00ff8c';
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t transition-all"
                    style={{
                      height: `${height}%`,
                      background: color,
                      opacity: 0.7,
                      minHeight: '1px',
                    }}
                    title={`${entry.risk}%`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
