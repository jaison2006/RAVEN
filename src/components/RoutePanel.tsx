import type { Route, MissionState } from '../simulation/types';

function statusColor(status: Route['status']): string {
  switch (status) {
    case 'ACTIVE': return '#00d4ff';
    case 'SAFE': return '#00ff8c';
    case 'CAUTION': return '#ffb800';
    case 'HIGH_RISK': return '#ff6b00';
    case 'UNSAFE': return '#ff2d2d';
    case 'ALTERNATIVE': return '#00ff8c';
    default: return '#4a6885';
  }
}

function RiskBar({ value, limit }: { value: number; limit: number }) {
  const barColor = value > limit ? '#ff2d2d' : value > limit * 0.7 ? '#ffb800' : '#00ff8c';
  return (
    <div className="relative h-1 rounded-full bg-[#0a1a30] overflow-visible">
      {/* Limit marker */}
      <div
        className="absolute top-[-2px] w-[1px] h-[8px] bg-[#ffb800]"
        style={{ left: `${limit}%` }}
      />
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, value)}%`, background: barColor }}
      />
    </div>
  );
}

function RouteCard({ route, limit }: { route: Route; limit: number }) {
  const color = statusColor(route.status);
  const isActive = route.status === 'ACTIVE';
  const isUnsafe = route.status === 'UNSAFE';

  return (
    <div
      className={`rounded border p-2.5 transition-all duration-500 ${isUnsafe ? 'animate-risk-flash' : ''}`}
      style={{
        borderColor: `${color}33`,
        background: isActive
          ? 'rgba(0,212,255,0.05)'
          : isUnsafe
          ? 'rgba(255,45,45,0.04)'
          : 'rgba(8,15,30,0.8)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: color, boxShadow: `0 0 5px ${color}` }}
          />
          <span className="font-display text-[9px] font-bold tracking-wider" style={{ color }}>
            {route.label.toUpperCase()}
          </span>
        </div>
        <span
          className="font-mono text-[7px] tracking-widest px-1.5 py-0.5 rounded"
          style={{ color, background: `${color}15`, border: `1px solid ${color}33` }}
        >
          {route.status}
        </span>
      </div>

      {/* Risk bar */}
      <div className="mb-1.5">
        <div className="flex justify-between mb-1">
          <span className="font-mono text-[7px] text-[#4a6885]">RISK SCORE</span>
          <span
            className="font-mono text-[9px] font-bold"
            style={{ color: route.currentRisk > limit ? '#ff2d2d' : '#d4e8ff' }}
          >
            {route.currentRisk}%
          </span>
        </div>
        <RiskBar value={route.currentRisk} limit={limit} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-2">
        {[
          { l: 'DISTANCE', v: `${route.distance} km` },
          { l: 'TERRAIN', v: `${route.terrainRisk}%` },
          { l: 'ENVIRON', v: `${route.environmentalRisk}%` },
          { l: 'SENSOR', v: `${route.sensorConfidence}%` },
        ].map(({ l, v }) => (
          <div key={l} className="flex justify-between">
            <span className="font-mono text-[7px] text-[#4a6885]">{l}</span>
            <span className="font-mono text-[7px] text-[#a0b8d0]">{v}</span>
          </div>
        ))}
      </div>

      {/* Limit warning */}
      {route.currentRisk > limit && (
        <div className="mt-2 flex items-center gap-1 font-mono text-[7px] text-[#ff2d2d]">
          <span>⚠</span>
          <span>EXCEEDS LIMIT ({limit}%) — REJECTED</span>
        </div>
      )}
    </div>
  );
}

interface Props { state: MissionState }

export default function RoutePanel({ state }: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
        <span className="font-display text-[9px] font-bold tracking-widest text-[#00d4ff]">ROUTE ANALYSIS</span>
        <span className="font-mono text-[7px] text-[#4a6885]">LIMIT: {state.missionRiskLimit}%</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {state.routes.map(route => (
          <RouteCard key={route.id} route={route} limit={state.missionRiskLimit} />
        ))}
      </div>

      {/* Terrain Analysis */}
      <div className="border-t p-2" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
        <div className="font-display text-[8px] font-bold tracking-widest text-[#9b6dff] mb-2">TERRAIN ANALYSIS</div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          {[
            { l: 'SLOPE', v: `${state.terrainAnalysis.slope}°` },
            { l: 'ELEVATION', v: `${state.terrainAnalysis.elevation}m` },
            { l: 'STABILITY', v: state.terrainAnalysis.stability, c: state.terrainAnalysis.stability === 'LOW' ? '#ff2d2d' : '#00ff8c' },
            { l: 'LANDSLIDE RISK', v: `${state.terrainAnalysis.landslideRisk}%`, c: state.terrainAnalysis.landslideRisk > 50 ? '#ff2d2d' : '#d4e8ff' },
          ].map(({ l, v, c }) => (
            <div key={l} className="flex justify-between py-0.5">
              <span className="font-mono text-[7px] text-[#4a6885]">{l}</span>
              <span className="font-mono text-[7px] font-bold" style={{ color: c ?? '#a0b8d0' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
