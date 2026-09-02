import type { MissionState } from '../simulation/types';

interface Props {
  state: MissionState;
}

export default function TerrainAnalysisPanel({ state }: Props) {
  const { terrainAnalysis, phase } = state;

  const isWarning = phase === 'HAZARD_DETECTED' || phase === 'RISK_EVALUATION';

  const getStabilityColor = (stability: string): string => {
    if (stability === 'CRITICAL' || stability === 'UNSTABLE') return '#ff2d2d';
    if (stability === 'STABLE') return '#00ff8c';
    return '#ffb800';
  };

  const getStabilityIcon = (stability: string): string => {
    if (stability === 'CRITICAL') return '🔴';
    if (stability === 'UNSTABLE') return '🟡';
    return '🟢';
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        background: isWarning ? 'rgba(255,45,45,0.04)' : undefined,
        borderColor: isWarning ? 'rgba(255,45,45,0.25)' : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
        <div className="w-1.5 h-1.5 rounded-full bg-[#ffb800]" style={{ boxShadow: '0 0 5px #ffb800' }} />
        <span className="font-display text-[9px] font-bold tracking-widest text-[#ffb800]">TERRAIN ANALYSIS</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-2.5">
          {/* Elevation */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="font-mono text-[7px] text-[#4a6885]">ELEVATION</span>
              <span className="font-mono text-[8px] font-bold text-[#d4e8ff]">{terrainAnalysis.elevation}m</span>
            </div>
            <div className="h-1.5 rounded bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.2)] overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${Math.min(100, (terrainAnalysis.elevation / 1000) * 100)}%`,
                  background: 'linear-gradient(90deg, #00d4ff, #00d4ffdd)',
                }}
              />
            </div>
          </div>

          {/* Slope */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="font-mono text-[7px] text-[#4a6885]">SLOPE</span>
              <span className="font-mono text-[8px] font-bold text-[#d4e8ff]">{terrainAnalysis.slope}°</span>
            </div>
            <div className="h-1.5 rounded bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.2)] overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${Math.min(100, terrainAnalysis.slope)}%`,
                  background: terrainAnalysis.slope > 30 ? '#ffb800' : '#00d4ff',
                }}
              />
            </div>
          </div>

          {/* Stability */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-[7px] text-[#4a6885]">STABILITY</span>
              <div className="flex items-center gap-1">
                <span>{getStabilityIcon(terrainAnalysis.stability)}</span>
                <span
                  className="font-mono text-[8px] font-bold"
                  style={{ color: getStabilityColor(terrainAnalysis.stability) }}
                >
                  {terrainAnalysis.stability}
                </span>
              </div>
            </div>
          </div>

          {/* Landslide Risk */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="font-mono text-[7px] text-[#4a6885]">LANDSLIDE RISK</span>
              <span
                className="font-mono text-[8px] font-bold"
                style={{
                  color: terrainAnalysis.landslideRisk > 50 ? '#ff2d2d' : terrainAnalysis.landslideRisk > 30 ? '#ffb800' : '#00ff8c',
                }}
              >
                {terrainAnalysis.landslideRisk}%
              </span>
            </div>
            <div className="h-1.5 rounded bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.2)] overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${terrainAnalysis.landslideRisk}%`,
                  background: terrainAnalysis.landslideRisk > 50 ? '#ff2d2d' : terrainAnalysis.landslideRisk > 30 ? '#ffb800' : '#00ff8c',
                }}
              />
            </div>
          </div>

          {/* Surface Condition */}
          <div className="mt-2 p-2 rounded border" style={{ borderColor: 'rgba(255,184,0,0.2)', background: 'rgba(255,184,0,0.03)' }}>
            <span className="font-mono text-[7px] text-[#ffb800]">{terrainAnalysis.slope > 30 || terrainAnalysis.landslideRisk > 60 ? '⚠ WARNING' : '✓ SAFE'}</span>
            <div className="font-mono text-[7px] text-[#a0b8d0] mt-0.5">
              {terrainAnalysis.slope > 30 ? 'High slope — increased stability risk' : 'Surface conditions nominal'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
