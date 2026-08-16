import type { Hazard } from '../simulation/types';

const HAZARD_LABELS: Record<string, string> = {
  LANDSLIDE: 'LANDSLIDE',
  ROAD_BLOCK: 'ROAD BLOCK',
  FIRE: 'FIRE ZONE',
  OBSTACLE: 'OBSTACLE',
  DAMAGED_ROAD: 'DAMAGED ROAD',
};

interface Props {
  hazard: Hazard | undefined;
  visible: boolean;
}

export default function HazardAlert({ hazard, visible }: Props) {
  if (!visible || !hazard) return null;

  return (
    <div
      className="absolute top-4 left-1/2 z-40 animate-fade-up"
      style={{ transform: 'translateX(-50%)' }}
    >
      <div
        className="rounded px-5 py-2.5 flex items-center gap-3 animate-hazard"
        style={{
          background: 'rgba(255,45,45,0.12)',
          border: '1px solid rgba(255,45,45,0.6)',
          boxShadow: '0 0 30px rgba(255,45,45,0.3)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          className="w-2.5 h-2.5 rounded-full bg-[#ff2d2d] animate-pulse-dot"
          style={{ boxShadow: '0 0 8px #ff2d2d' }}
        />
        <div>
          <div className="font-display text-[9px] font-bold tracking-widest text-[#ff2d2d]">
            {HAZARD_LABELS[hazard.type] ?? hazard.type} DETECTED
          </div>
          <div className="font-mono text-[7px] text-[#ff6060]">
            CONFIDENCE: {Math.round(hazard.confidence)}% · SEVERITY: {hazard.severity} · ROUTE: {hazard.routeId}
          </div>
        </div>
        <div className="font-display text-[16px] text-[#ff2d2d] animate-blink">⚠</div>
      </div>
    </div>
  );
}
