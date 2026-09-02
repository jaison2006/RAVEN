import type { MissionState } from '../simulation/types';

interface Props {
  state: MissionState;
}

export default function SensorFusionPanel({ state }: Props) {
  const { sensorFusion } = state;

  const sensors = [
    { name: 'CAMERA', value: sensorFusion.camera, icon: '📷', color: '#00d4ff' },
    { name: 'GPS', value: sensorFusion.gps, icon: '🛰', color: '#00ff8c' },
    { name: 'IMU', value: sensorFusion.imu, icon: '🧭', color: '#9b6dff' },
    { name: 'TERRAIN', value: sensorFusion.terrain, icon: '🌍', color: '#ffb800' },
    { name: 'MESH', value: sensorFusion.mesh, icon: '📡', color: '#ff6b9d' },
  ];

  const getConfidenceColor = (value: number): string => {
    if (value >= 90) return '#00ff8c';
    if (value >= 75) return '#ffb800';
    return '#ff2d2d';
  };

  const getConfidenceStatus = (value: number): string => {
    if (value >= 90) return 'EXCELLENT';
    if (value >= 75) return 'GOOD';
    if (value >= 50) return 'FAIR';
    return 'POOR';
  };

  return (
    <div className="flex flex-col h-full overflow-hidden gap-2 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00d4ff]" style={{ boxShadow: '0 0 5px #00d4ff' }} />
          <span className="font-display text-[9px] font-bold tracking-widest text-[#00d4ff]">SENSOR FUSION</span>
        </div>
        <span className="font-mono text-[8px] text-[#4a6885]">5 ACTIVE</span>
      </div>

      {/* Individual sensors */}
      <div className="flex flex-col gap-1.5">
        {sensors.map(({ name, value, icon, color }) => (
          <div key={name} className="flex items-center gap-2">
            <span className="text-[10px] w-2">{icon}</span>
            <span className="font-mono text-[7px] text-[#4a6885] w-12">{name}</span>
            <div className="flex-1 h-2 rounded bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.2)] overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${value}%`,
                  background: `linear-gradient(90deg, ${color}, ${color}dd)`,
                  boxShadow: `0 0 6px ${color}40`,
                }}
              />
            </div>
            <span className="font-mono text-[8px] font-bold w-8 text-right" style={{ color }}>
              {value}%
            </span>
          </div>
        ))}
      </div>

      {/* Overall confidence */}
      <div className="mt-2 pt-2 border-t border-[rgba(0,212,255,0.1)]">
        <div className="flex justify-between items-center mb-1">
          <span className="font-mono text-[7px] text-[#4a6885] tracking-widest">OVERALL CONFIDENCE</span>
          <span
            className="font-mono text-[9px] font-bold"
            style={{ color: getConfidenceColor(sensorFusion.camera) }}
          >
            {Math.round((sensorFusion.camera + sensorFusion.gps + sensorFusion.imu + sensorFusion.terrain + sensorFusion.mesh) / 5)}%
          </span>
        </div>
        <div className="flex items-center justify-between text-[6px]">
          <span className="text-[#4a6885]">
            {getConfidenceStatus(Math.round((sensorFusion.camera + sensorFusion.gps + sensorFusion.imu + sensorFusion.terrain + sensorFusion.mesh) / 5))}
          </span>
          <span className="text-[#4a6885]">OPERATIONAL</span>
        </div>
      </div>
    </div>
  );
}
