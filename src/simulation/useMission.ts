import { useRef, useState, useCallback, useEffect } from 'react';
import type { MissionState, LogEntry, Hazard, MeshMessage, AIDecision, CommNode } from './types';
import { INITIAL_ROUTES, INITIAL_NODES, HAZARD_POSITION, interpolateRoute } from '../data/mapData';
import { applyHazardToRoute, selectBestRoute, computeRisk, getRouteStatus } from './riskEngine';

let logIdCounter = 0;
let meshIdCounter = 0;

function ts(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function mkLog(source: string, message: string, type: LogEntry['type'] = 'INFO'): LogEntry {
  return { id: `log-${logIdCounter++}`, timestamp: ts(), source, message, type };
}

const INIT_STATE: MissionState = {
  phase: 'IDLE',
  demoPhaseLabel: '',
  progress: 0,
  activeRouteId: 'ROUTE-A',
  vehicleT: 0,
  routes: INITIAL_ROUTES,
  nodes: INITIAL_NODES,
  hazards: [],
  log: [],
  missionRiskLimit: 35,
  reroutes: 0,
  hazardsDetected: 0,
  aiDecision: null,
  meshMessages: [],
  showYoloPanel: false,
  yoloDetection: null,
  terrainAnalysis: { slope: 12, elevation: 420, stability: 'STABLE', landslideRisk: 14 },
  startTime: 0,
  totalDistance: 0,
  finalRisk: 0,
};

export function useMission() {
  const [state, setState] = useState<MissionState>(INIT_STATE);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<string>('IDLE');
  const vehicleTRef = useRef(0);
  const activeRouteRef = useRef('ROUTE-A');

  const addLog = useCallback((source: string, message: string, type: LogEntry['type'] = 'INFO') => {
    setState(s => ({ ...s, log: [mkLog(source, message, type), ...s.log].slice(0, 60) }));
  }, []);

  const addMeshMsg = useCallback((from: string, to: string, content: string) => {
    const msg: MeshMessage = { id: `m-${meshIdCounter++}`, from, to, content, progress: 0, timestamp: Date.now() };
    setState(s => ({ ...s, meshMessages: [msg, ...s.meshMessages].slice(0, 8) }));
  }, []);

  const updateNodes = useCallback((updater: (nodes: CommNode[]) => CommNode[]) => {
    setState(s => ({ ...s, nodes: updater(s.nodes) }));
  }, []);

  const triggerHazard = useCallback((type: Hazard['type'] = 'LANDSLIDE') => {
    if (phaseRef.current !== 'MOVING' && phaseRef.current !== 'RESUMED') return;

    const hazard: Hazard = {
      id: `h-${Date.now()}`,
      type,
      position: HAZARD_POSITION,
      routeId: activeRouteRef.current,
      confidence: 94 + Math.random() * 4,
      severity: 'CRITICAL',
      timestamp: ts(),
      active: true,
    };

    phaseRef.current = 'HAZARD_DETECTED';

    setState(s => ({
      ...s,
      phase: 'HAZARD_DETECTED',
      demoPhaseLabel: 'HAZARD DETECTED',
      hazards: [...s.hazards, hazard],
      hazardsDetected: s.hazardsDetected + 1,
      showYoloPanel: true,
      yoloDetection: {
        object: type === 'LANDSLIDE' ? 'Terrain Obstruction' : type === 'FIRE' ? 'Fire Zone' : 'Road Obstruction',
        confidence: Math.round(hazard.confidence * 10) / 10,
        region: activeRouteRef.current,
        severity: 'HIGH',
      },
      terrainAnalysis: { slope: 38, elevation: 742, stability: 'LOW', landslideRisk: 91 },
    }));

    addLog('NODE-03', `${type.replace('_', ' ')} detected on ${activeRouteRef.current}`, 'WARN');
    addLog('VISION', `YOLOv8: ${type === 'LANDSLIDE' ? 'Terrain obstruction' : 'Hazard object'} — ${Math.round(hazard.confidence)}%`, 'WARN');

    updateNodes(nodes => nodes.map(n => n.id === 'NODE-03' ? { ...n, status: 'HAZARD', lastMessage: 'HAZARD DETECTED' } : n));

    setTimeout(() => {
      addLog('RISK', `${activeRouteRef.current} risk → 91%`, 'ERROR');
      addLog('ROUTER', `${activeRouteRef.current} rejected — exceeds mission limit`, 'ERROR');
      addMeshMsg('NODE-03', 'NODE-02', 'HAZARD DETECTED');
      updateNodes(nodes => nodes.map(n => n.id === 'NODE-03' ? { ...n, status: 'RELAYING' } : n));

      setState(s => {
        const updatedRoutes = s.routes.map(r =>
          r.id === activeRouteRef.current ? applyHazardToRoute(r) : r
        );
        const aiDecision: AIDecision = {
          currentRoute: activeRouteRef.current,
          currentRisk: 91,
          status: 'UNSAFE',
          reason: `${type.replace('_', ' ')} detected on active route`,
          alternatives: updatedRoutes
            .filter(r => r.id !== activeRouteRef.current)
            .map(r => {
              const feasible = r.currentRisk <= s.missionRiskLimit;
              return {
                routeId: r.id,
                risk: r.currentRisk,
                distance: r.distance,
                feasible,
                reason: feasible
                  ? `Risk ${r.currentRisk}% ≤ limit ${s.missionRiskLimit}% — FEASIBLE`
                  : `Risk ${r.currentRisk}% > limit ${s.missionRiskLimit}% — EXCEEDS LIMIT`,
              };
            }),
          selectedRoute: '',
          explanation: [],
          summary: '',
        };
        return {
          ...s,
          phase: 'RISK_EVALUATION',
          demoPhaseLabel: 'RISK EVALUATION',
          routes: updatedRoutes,
          aiDecision,
        };
      });

      phaseRef.current = 'RISK_EVALUATION';
    }, 1800);

    setTimeout(() => {
      addMeshMsg('NODE-02', 'NODE-01', 'ROUTE RISK UPDATED');
      updateNodes(nodes => nodes.map(n => n.id === 'NODE-02' ? { ...n, status: 'UPDATING', lastMessage: 'ROUTE UPDATE' } : n));
    }, 2800);

    setTimeout(() => {
      setState(s => {
        const bestId = selectBestRoute(s.routes, s.missionRiskLimit, activeRouteRef.current);
        const bestRoute = s.routes.find(r => r.id === bestId);
        const oldActiveId = activeRouteRef.current;

        if (!bestId || !bestRoute) {
          return { ...s, phase: 'COMPLETED', demoPhaseLabel: 'NO SAFE ROUTE' };
        }

        activeRouteRef.current = bestId;
        phaseRef.current = 'REROUTING';

        const explanation = [
          `${type.replace('_', ' ')} detected on ${oldActiveId}`,
          `${oldActiveId} risk increased from 18% → 91%`,
          `Mission risk limit = ${s.missionRiskLimit}%`,
          `${oldActiveId} rejected — exceeds limit`,
          `${bestId} evaluated: risk = ${bestRoute.currentRisk}%`,
          `${bestRoute.currentRisk}% ≤ ${s.missionRiskLimit}% — satisfies constraints`,
          `${bestId} selected as safest feasible route`,
        ];

        const updatedAi: AIDecision = {
          ...(s.aiDecision as AIDecision),
          selectedRoute: bestId,
          explanation,
          summary: `${bestId} selected — lowest feasible risk within mission threshold.`,
        };

        const updatedRoutes = s.routes.map(r => {
          if (r.id === bestId) return { ...r, status: 'ACTIVE' as const };
          if (r.id === oldActiveId) return { ...r, status: 'UNSAFE' as const };
          const risk = r.currentRisk;
          return { ...r, status: getRouteStatus(risk, false, false) };
        });

        return {
          ...s,
          phase: 'REROUTING',
          demoPhaseLabel: 'REROUTING',
          activeRouteId: bestId,
          reroutes: s.reroutes + 1,
          routes: updatedRoutes,
          aiDecision: updatedAi,
        };
      });

      addLog('AI', 'Evaluating alternative routes...', 'AI');
      addLog('MESH', 'Risk update propagated across network', 'MESH');
      addLog('AI', `${activeRouteRef.current} selected — safest feasible route`, 'SUCCESS');
      addLog('NAV', 'Autonomous rerouting initiated', 'INFO');
    }, 4000);

    setTimeout(() => {
      phaseRef.current = 'RESUMED';
      setState(s => ({ ...s, phase: 'RESUMED', demoPhaseLabel: 'SAFE REROUTE ACTIVE' }));
      updateNodes(nodes => nodes.map(n => ({ ...n, status: 'ONLINE' })));
    }, 5200);
  }, [addLog, addMeshMsg, updateNodes]);

  const stopTick = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  const startMission = useCallback(() => {
    vehicleTRef.current = 0;
    activeRouteRef.current = 'ROUTE-A';
    phaseRef.current = 'MOVING';

    setState(s => ({
      ...s,
      phase: 'MOVING',
      demoPhaseLabel: 'AUTONOMOUS MOVEMENT',
      progress: 0,
      vehicleT: 0,
      activeRouteId: 'ROUTE-A',
      routes: INITIAL_ROUTES,
      nodes: INITIAL_NODES,
      hazards: [],
      meshMessages: [],
      showYoloPanel: false,
      yoloDetection: null,
      terrainAnalysis: { slope: 12, elevation: 420, stability: 'STABLE', landslideRisk: 14 },
      reroutes: 0,
      hazardsDetected: 0,
      aiDecision: null,
      startTime: Date.now(),
    }));

    addLog('NODE-01', 'Mission initialized — BASE-01 → ZONE-07', 'SUCCESS');
    addLog('AI', 'Route analysis complete — Route A selected (risk: 18%)', 'AI');
    addLog('NAV', 'Autonomous movement initiated', 'INFO');

    stopTick();
    tickRef.current = setInterval(() => {
      const speed = 0.0018;
      vehicleTRef.current = Math.min(1, vehicleTRef.current + speed);
      const t = vehicleTRef.current;

      setState(s => {
        const activeRoute = s.routes.find(r => r.id === activeRouteRef.current);
        if (!activeRoute) return s;

        const pos = interpolateRoute(activeRoute.waypoints, t);
        const progress = Math.round(t * 100);

        if (t >= 1) {
          stopTick();
          phaseRef.current = 'COMPLETED';
          return {
            ...s,
            phase: 'COMPLETED',
            demoPhaseLabel: 'MISSION COMPLETE',
            vehicleT: 1,
            progress: 100,
            finalRisk: activeRoute.currentRisk,
            totalDistance: s.routes.filter(r => r.status === 'ACTIVE').reduce((acc, r) => acc + r.distance, 0),
          };
        }

        return { ...s, vehicleT: t, progress };
      });

      if (t >= 1) {
        addLog('NODE-05', 'ZONE-07 reached — MISSION COMPLETE', 'SUCCESS');
        addLog('AI', 'Mission completed safely', 'SUCCESS');
        stopTick();
      }
    }, 50);
  }, [addLog, stopTick]);

  const runDemo = useCallback(() => {
    vehicleTRef.current = 0;
    activeRouteRef.current = 'ROUTE-A';

    setState(() => ({
      ...INIT_STATE,
      phase: 'INITIALIZING',
      demoPhaseLabel: 'INITIALIZING TERRAIN',
      log: [mkLog('SYSTEM', 'RAVEN-RX DEMO MODE ACTIVATED', 'SUCCESS')],
      startTime: Date.now(),
    }));
    phaseRef.current = 'INITIALIZING';

    const sequence: Array<[number, () => void]> = [
      [800, () => {
        setState(s => ({ ...s, demoPhaseLabel: 'DISCOVERING ROUTES' }));
        addLog('AI', 'Terrain initialized — scanning routes', 'INFO');
      }],
      [1600, () => {
        setState(s => ({ ...s, phase: 'ROUTE_ANALYSIS', demoPhaseLabel: 'CALCULATING RISK SCORES' }));
        addLog('RISK', 'Route A: 18% | Route B: 31% | Route C: 72%', 'AI');
      }],
      [2600, () => {
        addLog('AI', 'Route A selected — optimal risk within mission limit', 'SUCCESS');
        setState(s => ({ ...s, demoPhaseLabel: 'OPTIMAL ROUTE SELECTED' }));
      }],
      [3500, () => {
        startMission();
      }],
      [12000, () => {
        if (phaseRef.current === 'MOVING') triggerHazard('LANDSLIDE');
      }],
    ];

    sequence.forEach(([delay, fn]) => setTimeout(fn, delay));
  }, [addLog, startMission, triggerHazard]);

  const resetMission = useCallback(() => {
    stopTick();
    vehicleTRef.current = 0;
    activeRouteRef.current = 'ROUTE-A';
    phaseRef.current = 'IDLE';
    setState(() => ({ ...INIT_STATE, log: [mkLog('SYSTEM', 'Mission reset', 'INFO')] }));
  }, [stopTick]);

  const pauseMission = useCallback(() => {
    if (tickRef.current) {
      stopTick();
      setState(s => ({ ...s, phase: 'IDLE', demoPhaseLabel: 'PAUSED' }));
    }
  }, [stopTick]);

  // Animate mesh messages
  useEffect(() => {
    const id = setInterval(() => {
      setState(s => ({
        ...s,
        meshMessages: s.meshMessages
          .map(m => ({ ...m, progress: Math.min(1, m.progress + 0.04) }))
          .filter(m => m.progress < 1 || Date.now() - m.timestamp < 4000),
      }));
    }, 60);
    return () => clearInterval(id);
  }, []);

  return { state, startMission, triggerHazard, runDemo, resetMission, pauseMission };
}
