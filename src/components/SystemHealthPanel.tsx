import type { MissionState } from '../simulation/types';

interface Props {
  state: MissionState;
}

export default function SystemHealthPanel({ state }: Props) {
  const { systemStatus, phase } = state;

  const getStatusColor = (status: string): string => {
    if (status === 'OPERATIONAL') return '#00ff8c';
    if (status === 'WARNING') return '#ffb800';
    if (status === 'CRITICAL') return '#ff2d2d';
    return '#4a6885';
  };

  const getStatusIcon = (status: string): string => {
    if (status === 'OPERATIONAL') return '●';
    if (status === 'WARNING') return '◆';
    if (status === 'CRITICAL') return '✕';
    return '○';
  };

  const components = [
    { name: 'NAVIGATION', status: phase !== 'IDLE' ? 'OPERATIONAL' : 'STANDBY', icon: '🗺' },
    { name: 'PERCEPTION', status: 'OPERATIONAL', icon: '👁' },
    { name: 'RISK ENGINE', status: 'OPERATIONAL', icon: '⚙' },
    { name: 'MESH NETWORK', status: 'OPERATIONAL', icon: '📡' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header with overall status */}
      <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold"
              style={{ color: getStatusColor(systemStatus) }}
            >
              {getStatusIcon(systemStatus)}
            </span>
            <span className="font-display text-[8px] font-bold tracking-widest" style={{ color: getStatusColor(systemStatus) }}>
              {systemStatus}
            </span>
          </div>
        </div>

        {/* Status bar */}
        <div className="h-1 rounded bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.2)] overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{
              width:
                systemStatus === 'OPERATIONAL' ? '100%' : systemStatus === 'WARNING' ? '60%' : '20%',
              background:
                systemStatus === 'OPERATIONAL'
                  ? '#00ff8c'
                  : systemStatus === 'WARNING'
                    ? '#ffb800'
                    : '#ff2d2d',
            }}
          />
        </div>
      </div>

      {/* Component list */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-1">
          {components.map(comp => (
            <div
              key={comp.name}
              className="flex items-center justify-between px-2 py-1.5 rounded border text-[7px]"
              style={{
                borderColor: `${getStatusColor(comp.status)}33`,
                background: `${getStatusColor(comp.status)}08`,
              }}
            >
              <div className="flex items-center gap-1">
                <span>{comp.icon}</span>
                <span className="font-mono text-[6px] text-[#4a6885]">{comp.name}</span>
              </div>
              <span className="font-mono font-bold" style={{ color: getStatusColor(comp.status) }}>
                {getStatusIcon(comp.status)} {comp.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer info */}
      <div className="px-3 py-2 border-t text-[7px] text-[#4a6885]" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
        <div className="flex justify-between">
          <span>SYSTEMS:</span>
          <span className="font-mono">{components.filter(c => c.status === 'OPERATIONAL').length}/{components.length}</span>
        </div>
      </div>
    </div>
  );
}
