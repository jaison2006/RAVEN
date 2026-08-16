import { useEffect, useRef } from 'react';
import type { LogEntry } from '../simulation/types';

const typeColor: Record<string, string> = {
  INFO: '#4a8090',
  WARN: '#ffb800',
  ERROR: '#ff2d2d',
  SUCCESS: '#00ff8c',
  AI: '#9b6dff',
  MESH: '#00d4ff',
};

const sourceColor: Record<string, string> = {
  'NODE-01': '#00d4ff',
  'NODE-02': '#00d4ff',
  'NODE-03': '#00d4ff',
  'NODE-04': '#00d4ff',
  'NODE-05': '#00d4ff',
  'AI': '#9b6dff',
  'RISK': '#ffb800',
  'ROUTER': '#ff6b00',
  'NAV': '#00ff8c',
  'VISION': '#ff4090',
  'MESH': '#00d4ff',
  'SYSTEM': '#d4e8ff',
};

interface Props {
  log: LogEntry[];
}

export default function EventLog({ log }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00ff8c] animate-pulse-dot" style={{ boxShadow: '0 0 4px #00ff8c' }} />
          <span className="font-display text-[8px] font-bold tracking-widest text-[#00d4ff]">DECISION LOG</span>
        </div>
        <span className="font-mono text-[7px] text-[#4a6885]">{log.length} EVENTS</span>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        {log.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <span className="font-mono text-[8px] text-[#2a4060]">Awaiting events...</span>
          </div>
        )}
        {[...log].reverse().map(entry => (
          <div
            key={entry.id}
            className="flex gap-2 py-0.5 px-1 rounded hover:bg-[rgba(0,212,255,0.03)] transition-colors group animate-sweep"
          >
            <span className="font-mono text-[8px] text-[#2a4060] shrink-0 mt-0.5">{entry.timestamp}</span>
            <span
              className="font-mono text-[8px] font-bold shrink-0 mt-0.5 w-12 text-right"
              style={{ color: sourceColor[entry.source] ?? '#4a6885' }}
            >
              {entry.source}
            </span>
            <span
              className="font-mono text-[8px] leading-relaxed"
              style={{ color: typeColor[entry.type] ?? '#a0b8d0' }}
            >
              {entry.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
