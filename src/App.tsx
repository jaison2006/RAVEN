import { Suspense } from 'react';
import { useMission } from './simulation/useMission';
import MissionHeader from './components/MissionHeader';
import TerrainScene from './components/TerrainScene';
import RoutePanel from './components/RoutePanel';
import AIDecisionPanel from './components/AIDecisionPanel';
import EventLog from './components/EventLog';
import NetworkTopology from './components/NetworkTopology';
import MissionControls from './components/MissionControls';
import MissionComplete from './components/MissionComplete';
import HazardAlert from './components/HazardAlert';
import SensorFusionPanel from './components/SensorFusionPanel';
import TerrainAnalysisPanel from './components/TerrainAnalysisPanel';
import MissionAnalyticsPanel from './components/MissionAnalyticsPanel';
import SystemHealthPanel from './components/SystemHealthPanel';

function Panel({
  children,
  className = '',
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded overflow-hidden flex flex-col ${className}`}
      style={{
        background: 'rgba(7,17,32,0.92)',
        border: '1px solid rgba(0,212,255,0.12)',
        backdropFilter: 'blur(8px)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function App() {
  const { state, startMission, triggerHazard, runDemo, resetMission, pauseMission } = useMission();
  const activeHazard = state.hazards.find(h => h.active);
  const showAlert = state.phase === 'HAZARD_DETECTED' || state.phase === 'RISK_EVALUATION';

  return (
    <div
      className="flex flex-col w-full h-screen overflow-hidden relative"
      style={{ background: '#040c18', fontFamily: "'Inter', sans-serif" }}
    >
      {/* Background grid */}
      <div className="absolute inset-0 grid-lines opacity-30 pointer-events-none" />

      {/* Header */}
      <MissionHeader state={state} />

      {/* Main content area */}
      <div
        className="mission-layout flex flex-1 gap-1.5 p-1.5 overflow-hidden"
        style={{ minHeight: 0 }}
      >
        {/* Left column - Mission Info */}
        <div className="mission-column mission-column-left flex flex-col gap-1.5" style={{ width: '180px', flexShrink: 0 }}>
          <Panel style={{ flex: '1 1 0', minHeight: 0 }}>
            <RoutePanel state={state} />
          </Panel>
          <Panel style={{ height: '140px', flexShrink: 0 }}>
            <NetworkTopology nodes={state.nodes} messages={state.meshMessages} />
          </Panel>
          <Panel style={{ height: '120px', flexShrink: 0 }}>
            <SystemHealthPanel state={state} />
          </Panel>
        </div>

        {/* Second column - Analysis Panels */}
        <div className="mission-column mission-column-analysis flex flex-col gap-1.5" style={{ width: '160px', flexShrink: 0 }}>
          <Panel style={{ flex: '1 1 0', minHeight: 0 }}>
            <SensorFusionPanel state={state} />
          </Panel>
          <Panel style={{ height: '150px', flexShrink: 0 }}>
            <TerrainAnalysisPanel state={state} />
          </Panel>
        </div>

        {/* Center: terrain map */}
        <div className="mission-terrain flex-1 relative overflow-hidden rounded" style={{ minWidth: 0 }}>
          <div
            className="w-full h-full overflow-hidden rounded"
            style={{ border: '1px solid rgba(0,212,255,0.15)' }}
          >
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center bg-bg">
                <div className="font-mono text-[11px] text-cyan animate-blink tracking-widest">
                  LOADING TERRAIN...
                </div>
              </div>
            }>
              <TerrainScene state={state} />
            </Suspense>
          </div>

          {/* Hazard alert overlay */}
          <HazardAlert hazard={activeHazard} visible={showAlert} />

          {/* Mission complete overlay */}
          <MissionComplete state={state} onReset={resetMission} />

          {/* Phase transition banner */}
          {state.phase === 'REROUTING' && (
            <div
              className="absolute bottom-4 left-1/2 animate-fade-up"
              style={{ transform: 'translateX(-50%)' }}
            >
              <div
                className="rounded px-5 py-2 flex items-center gap-3"
                style={{
                  background: 'rgba(0,255,140,0.08)',
                  border: '1px solid rgba(0,255,140,0.4)',
                  boxShadow: '0 0 20px rgba(0,255,140,0.15)',
                }}
              >
                <div className="w-2 h-2 rounded-full bg-green animate-pulse-dot" />
                <span className="font-display text-[9px] font-bold tracking-widest text-green">
                  AUTONOMOUS REROUTING — ROUTE {state.activeRouteId}
                </span>
              </div>
            </div>
          )}

          {/* Idle start hint */}
          {state.phase === 'IDLE' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="font-display text-[28px] font-bold text-cyan opacity-10 tracking-[0.3em]">
                  RAVEN-RX
                </div>
                <div className="font-mono text-[10px] text-text-dim tracking-widest mt-2">
                  PRESS DEMO MODE OR START MISSION
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column - AI & Analytics */}
        <div className="mission-column mission-column-right flex flex-col gap-1.5" style={{ width: '210px', flexShrink: 0 }}>
          <Panel style={{ flex: '1 1 0', minHeight: 0 }}>
            <AIDecisionPanel state={state} />
          </Panel>
          <Panel style={{ height: '140px', flexShrink: 0 }}>
            <MissionAnalyticsPanel state={state} />
          </Panel>

          {/* Innovation cards */}
          <Panel style={{ flexShrink: 0, padding: '8px' }}>
            <div className="font-display text-[6px] font-bold tracking-widest text-purple mb-1.5">RAVEN-RX TECH</div>
            <div className="grid grid-cols-2 gap-0.5">
              {[
                { title: 'FUSION', color: '#00d4ff' },
                { title: 'LIMIT', color: '#ffb800' },
                { title: 'XAI', color: '#9b6dff' },
                { title: 'MESH', color: '#00ff8c' },
              ].map(({ title, color }) => (
                <div
                  key={title}
                  className="rounded p-1"
                  style={{ background: `${color}08`, border: `1px solid ${color}22` }}
                >
                  <div className="font-mono text-[5px] font-bold" style={{ color }}>{title}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* Bottom: event log + controls */}
      <div
        className="mission-footer flex gap-1.5 px-1.5 pb-1.5"
        style={{ height: '130px', flexShrink: 0 }}
      >
        <Panel style={{ flex: 1, minWidth: 0 }}>
          <EventLog log={state.log} />
        </Panel>
        <div
          className="shrink-0 flex flex-col justify-center rounded overflow-hidden"
          style={{
            background: 'rgba(5,13,28,0.95)',
            border: '1px solid rgba(0,212,255,0.12)',
          }}
        >
          <MissionControls
            state={state}
            onStart={startMission}
            onHazard={triggerHazard}
            onReset={resetMission}
            onPause={pauseMission}
            onDemo={runDemo}
          />
        </div>
      </div>
    </div>
  );
}
