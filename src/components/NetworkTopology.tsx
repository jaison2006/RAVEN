import type { CommNode, MeshMessage } from '../simulation/types';

interface Props {
  nodes: CommNode[];
  messages: MeshMessage[];
}

const nodeStatusColor: Record<string, string> = {
  ONLINE: '#00ff8c',
  HAZARD: '#ff2d2d',
  UPDATING: '#ffb800',
  RELAYING: '#00d4ff',
};

// Simple fixed positions for the topology diagram
const NODE_POS: Record<string, { x: number; y: number }> = {
  'NODE-01': { x: 50, y: 90 },
  'NODE-02': { x: 25, y: 55 },
  'NODE-03': { x: 50, y: 20 },
  'NODE-04': { x: 75, y: 55 },
  'NODE-05': { x: 50, y: 90 }, // same as NODE-01 for base/dest symmetry
};

// Better layout
const TOPO_POS: Record<string, { x: number; y: number }> = {
  'NODE-01': { x: 20, y: 75 },
  'NODE-02': { x: 35, y: 45 },
  'NODE-03': { x: 50, y: 20 },
  'NODE-04': { x: 65, y: 50 },
  'NODE-05': { x: 80, y: 75 },
};

const CONNECTIONS = [
  ['NODE-01', 'NODE-02'],
  ['NODE-02', 'NODE-03'],
  ['NODE-03', 'NODE-04'],
  ['NODE-04', 'NODE-05'],
  ['NODE-02', 'NODE-04'],
];

export default function NetworkTopology({ nodes, messages }: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
        <div className="w-1.5 h-1.5 rounded-full bg-[#00d4ff]" style={{ boxShadow: '0 0 4px #00d4ff' }} />
        <span className="font-display text-[8px] font-bold tracking-widest text-[#00d4ff]">NETWORK TOPOLOGY</span>
      </div>

      <div className="flex-1 relative p-2">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Connection lines */}
          {CONNECTIONS.map(([a, b]) => {
            const pa = TOPO_POS[a];
            const pb = TOPO_POS[b];
            return (
              <line
                key={`${a}-${b}`}
                x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                stroke="rgba(0,212,255,0.15)"
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
            );
          })}

          {/* Mesh message pulses */}
          {messages.map(msg => {
            const from = TOPO_POS[msg.from];
            const to = TOPO_POS[msg.to];
            if (!from || !to) return null;
            const x = from.x + (to.x - from.x) * msg.progress;
            const y = from.y + (to.y - from.y) * msg.progress;
            return (
              <circle
                key={msg.id}
                cx={x} cy={y} r="1.5"
                fill="#00d4ff"
                opacity={1 - msg.progress * 0.5}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const pos = TOPO_POS[node.id];
            if (!pos) return null;
            const color = nodeStatusColor[node.status] ?? '#00d4ff';
            return (
              <g key={node.id}>
                <circle cx={pos.x} cy={pos.y} r="5" fill="rgba(8,15,30,0.9)" stroke={color} strokeWidth="0.8" opacity="0.9" />
                <circle cx={pos.x} cy={pos.y} r="2" fill={color} opacity="0.9" />
                <text x={pos.x} y={pos.y + 9} textAnchor="middle" fontSize="3.5" fill={color} fontFamily="JetBrains Mono" opacity="0.9">
                  {node.label}
                </text>
                {node.status !== 'ONLINE' && (
                  <text x={pos.x} y={pos.y - 8} textAnchor="middle" fontSize="3" fill={color} fontFamily="JetBrains Mono" opacity="0.8">
                    {node.lastMessage}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Message feed */}
      <div className="border-t px-2 py-1.5 max-h-20 overflow-y-auto" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
        {messages.slice(0, 4).map(msg => (
          <div key={msg.id} className="flex gap-1 font-mono text-[7px] py-0.5">
            <span className="text-[#00d4ff]">{msg.from}</span>
            <span className="text-[#2a4060]">→</span>
            <span className="text-[#00d4ff]">{msg.to}</span>
            <span className="text-[#4a6885]">{msg.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
