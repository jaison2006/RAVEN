import type { MissionState } from '../simulation/types';

interface Props { state: MissionState }

export default function AIDecisionPanel({ state }: Props) {
  const { aiDecision, yoloDetection, showYoloPanel, missionRiskLimit } = state;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
        <div className="w-1.5 h-1.5 rounded-full bg-[#9b6dff]" style={{ boxShadow: '0 0 5px #9b6dff' }} />
        <span className="font-display text-[9px] font-bold tracking-widest text-[#9b6dff]">AI ROUTE DECISION</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* YOLO panel */}
        {showYoloPanel && yoloDetection && (
          <div className="m-2 rounded border border-[rgba(255,45,45,0.3)] bg-[rgba(255,45,45,0.04)] p-2.5 animate-fade-up">
            <div className="flex items-center justify-between mb-2">
              <span className="font-display text-[8px] font-bold tracking-widest text-[#ff2d2d]">AI VISION ENGINE</span>
              <span className="font-mono text-[6px] text-[#4a6885] border border-[rgba(255,45,45,0.2)] px-1 rounded">
                SIMULATED YOLOv8
              </span>
            </div>
            <div className="grid gap-1">
              {[
                { l: 'OBJECT', v: yoloDetection.object },
                { l: 'CONFIDENCE', v: `${yoloDetection.confidence}%`, c: '#ff2d2d' },
                { l: 'REGION', v: yoloDetection.region },
                { l: 'SEVERITY', v: yoloDetection.severity, c: '#ff2d2d' },
              ].map(({ l, v, c }) => (
                <div key={l} className="flex justify-between">
                  <span className="font-mono text-[7px] text-[#4a6885]">{l}</span>
                  <span className="font-mono text-[8px] font-bold" style={{ color: c ?? '#d4e8ff' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No decision state */}
        {!aiDecision && (
          <div className="flex flex-col items-center justify-center p-6 gap-3 text-center">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(155,109,255,0.08)', border: '1px solid rgba(155,109,255,0.2)' }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7" stroke="#9b6dff" strokeWidth="1.2" opacity="0.5" />
                <path d="M9 5v5l3 2" stroke="#9b6dff" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
              </svg>
            </div>
            <span className="font-mono text-[9px] text-[#4a6885] leading-relaxed">
              Awaiting mission data.<br />Start a mission to activate AI routing.
            </span>
          </div>
        )}

        {/* Decision panel */}
        {aiDecision && (
          <div className="p-2 flex flex-col gap-2">
            {/* Current route status */}
            <div className="rounded border p-2.5 border-[rgba(255,45,45,0.3)] bg-[rgba(255,45,45,0.04)]">
              <div className="font-mono text-[7px] text-[#4a6885] mb-1 tracking-widest">CURRENT ROUTE</div>
              <div className="font-display text-[11px] font-bold text-[#ff2d2d]">{aiDecision.currentRoute}</div>
              <div className="flex justify-between mt-1">
                <span className="font-mono text-[8px] text-[#ff2d2d]">STATUS: {aiDecision.status}</span>
                <span className="font-mono text-[8px] text-[#ff2d2d]">RISK: {aiDecision.currentRisk}%</span>
              </div>
              <div className="font-mono text-[7px] text-[#ff6060] mt-1">{aiDecision.reason}</div>
            </div>

            {/* Mission limit */}
            <div className="flex justify-between items-center px-2 py-1.5 rounded border border-[rgba(255,184,0,0.2)] bg-[rgba(255,184,0,0.04)]">
              <span className="font-mono text-[7px] text-[#ffb800]">MISSION RISK LIMIT</span>
              <span className="font-mono text-[9px] font-bold text-[#ffb800]">{missionRiskLimit}%</span>
            </div>

            {/* Alternatives */}
            <div>
              <div className="font-mono text-[7px] text-[#4a6885] tracking-widest mb-1.5">ALTERNATIVE ANALYSIS</div>
              <div className="flex flex-col gap-1.5">
                {aiDecision.alternatives.map(alt => (
                  <div
                    key={alt.routeId}
                    className="rounded border p-2"
                    style={{
                      borderColor: alt.feasible ? 'rgba(0,255,140,0.25)' : 'rgba(255,45,45,0.2)',
                      background: alt.feasible ? 'rgba(0,255,140,0.04)' : 'rgba(255,45,45,0.03)',
                    }}
                  >
                    <div className="flex justify-between items-center mb-0.5">
                      <span
                        className="font-display text-[8px] font-bold"
                        style={{ color: alt.feasible ? '#00ff8c' : '#ff2d2d' }}
                      >
                        {alt.routeId}
                      </span>
                      <span
                        className="font-mono text-[7px]"
                        style={{ color: alt.feasible ? '#00ff8c' : '#ff2d2d' }}
                      >
                        {alt.feasible ? '✓ FEASIBLE' : '✕ REJECTED'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-[7px] text-[#4a6885]">Risk: {alt.risk}%</span>
                      <span className="font-mono text-[7px] text-[#4a6885]">{alt.distance} km</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Final decision */}
            {aiDecision.selectedRoute && (
              <div className="rounded border border-[rgba(0,255,140,0.35)] bg-[rgba(0,255,140,0.05)] p-2.5">
                <div className="font-mono text-[7px] text-[#4a6885] tracking-widest mb-1">FINAL DECISION</div>
                <div className="font-display text-[12px] font-bold text-[#00ff8c]">{aiDecision.selectedRoute} SELECTED</div>
                <div className="font-mono text-[7px] text-[#00c070] mt-1">SAFE REROUTING INITIATED</div>
              </div>
            )}

            {/* Explainability */}
            {aiDecision.explanation.length > 0 && (
              <div>
                <div className="font-mono text-[7px] text-[#9b6dff] tracking-widest mb-1.5">WHY DID THE SYSTEM REROUTE?</div>
                <div className="flex flex-col gap-1">
                  {aiDecision.explanation.map((line, i) => (
                    <div key={i} className="flex gap-2 items-start animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                      <span className="font-mono text-[7px] text-[#4a6885] mt-0.5 shrink-0">{i + 1}.</span>
                      <span className="font-mono text-[7px] text-[#a0b8d0] leading-relaxed">{line}</span>
                    </div>
                  ))}
                </div>
                {aiDecision.summary && (
                  <div className="mt-2 p-2 rounded border border-[rgba(155,109,255,0.2)] bg-[rgba(155,109,255,0.04)]">
                    <div className="font-mono text-[7px] text-[#9b6dff] mb-0.5">DECISION EXPLAINED</div>
                    <div className="font-mono text-[7px] text-[#c0a8ff] leading-relaxed">&quot;{aiDecision.summary}&quot;</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
