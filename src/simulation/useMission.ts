import { useRef, useState, useCallback, useEffect } from 'react';
import type { MissionState, LogEntry, Hazard, MeshMessage, AIDecision, CommNode, Vec3 } from './types';
import { INITIAL_ROUTES, INITIAL_NODES, HAZARD_POSITION, HAZARD_RADIUS, SOURCE_POS, interpolateRoute } from '../data/mapData';
import { applyHazardToRoute, selectBestRoute, computeRisk, getRouteStatus } from './riskEngine';
import { initializeSensorState, computeOverallConfidence } from './sensorEngine';
import { getTerrainAnalysis, getYoloObject } from './hazardEngine';
import {
  isInHazardRadius,
  checkHazardIntersectsRoute,
  markBlockedWaypoints,
  movementIntersectsHazard,
  interpolatePath,
} from './routeSafety';

let logIdCounter = 0;
let meshIdCounter = 0;

function ts(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function mkLog(source: string, message: string, type: LogEntry['type'] = 'INFO'): LogEntry {
  return { id: `log-${logIdCounter++}`, timestamp: ts(), source, message, type };
}

const sensorState = initializeSensorState();

const INIT_STATE: MissionState = {
  phase: 'IDLE',
  demoPhaseLabel: '',
  progress: 0,
  activeRouteId: 'ROUTE-A',
  vehicleT: 0,
  vehiclePosition: SOURCE_POS,
  vehicleNavigationMode: 'STOPPED',
  routes: INITIAL_ROUTES,
  nodes: INITIAL_NODES,
  hazards: [],
  log: [],
  missionRiskLimit: 35,
  reroutes: 0,
  routeHistory: ['ROUTE-A'],
  hazardsDetected: 0,
  aiDecision: null,
  meshMessages: [],
  showYoloPanel: false,
  yoloDetection: null,
  terrainAnalysis: { slope: 12, elevation: 420, stability: 'STABLE', landslideRisk: 14 },
  sensorFusion: sensorState.current,
  riskHistory: [],
  startTime: 0,
  totalDistance: 0,
  finalRisk: 0,
  missionDuration: 0,
  systemStatus: 'IDLE',
};

export function useMission() {
  const [state, setState] = useState<MissionState>(INIT_STATE);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<string>('IDLE');
  const vehicleTRef = useRef(0);
  const activeRouteRef = useRef('ROUTE-A');
  const vehiclePositionRef = useRef<Vec3>(SOURCE_POS);
  const transitionPathRef = useRef<Vec3[]>([]);
  const transitionTRef = useRef(0);
  const routesRef = useRef(INITIAL_ROUTES);

  useEffect(() => {
    routesRef.current = state.routes;
  }, [state.routes]);

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

    const route = routesRef.current.find(r => r.id === activeRouteRef.current);
    const hazardWaypointIndex = route
      ? Math.min(route.waypoints.length - 1, Math.max(1, Math.ceil(vehicleTRef.current * (route.waypoints.length - 1)) + 1))
      : 1;

    const hazard: Hazard = {
      id: `h-${Date.now()}`,
      type,
      position: route?.waypoints[hazardWaypointIndex] ?? HAZARD_POSITION,
      radius: Math.max(HAZARD_RADIUS, 1.25),
      affectedRouteId: activeRouteRef.current,
      affectedNodeIndex: hazardWaypointIndex,
      confidence: 94 + Math.random() * 4,
      severity: 'CRITICAL',
      timestamp: ts(),
      active: true,
    };

    phaseRef.current = 'HAZARD_DETECTED';

    const yoloObject = getYoloObject(type);
    const terrainAnalysis = getTerrainAnalysis(type);

    setState(s => {
      vehiclePositionRef.current = interpolateRoute(
        s.routes.find(r => r.id === activeRouteRef.current)?.waypoints ?? [SOURCE_POS],
        vehicleTRef.current,
      );
      // Mark waypoints on active route as blocked by this hazard
      const activeRoute = s.routes.find(r => r.id === activeRouteRef.current);
      const blockedWaypoints = activeRoute
        ? checkHazardIntersectsRoute(hazard, activeRoute)
        : [];

      return {
        ...s,
        phase: 'HAZARD_DETECTED',
        demoPhaseLabel: 'HAZARD DETECTED',
        hazards: [...s.hazards, hazard],
        hazardsDetected: s.hazardsDetected + 1,
        showYoloPanel: true,
        yoloDetection: {
          object: yoloObject,
          confidence: Math.round(hazard.confidence * 10) / 10,
          region: activeRouteRef.current,
          severity: 'CRITICAL',
        },
        terrainAnalysis,
        systemStatus: 'WARNING',
        vehiclePosition: vehiclePositionRef.current,
        vehicleNavigationMode: 'STOPPED',
        routes: s.routes.map(r =>
          r.id === activeRouteRef.current
            ? { ...r, blockedWaypoints }
            : r
        ),
      };
    });

    addLog('NODE-03', `${type.replace('_', ' ')} detected on ${activeRouteRef.current}`, 'WARN');
    addLog('VISION', `YOLOv8 Simulation: ${yoloObject} — ${Math.round(hazard.confidence)}%`, 'WARN');
    addLog('TERRAIN', `Slope: ${terrainAnalysis.slope}° | Stability: ${terrainAnalysis.stability}`, 'TERRAIN');

    updateNodes(nodes => nodes.map(n => n.id === 'NODE-03' ? { ...n, status: 'HAZARD', lastMessage: 'HAZARD DETECTED' } : n));

    setTimeout(() => {
      addLog('RISK', `${activeRouteRef.current} risk → 91%`, 'ERROR');
      addLog('ROUTER', `${activeRouteRef.current} rejected — exceeds mission limit`, 'ERROR');
      addMeshMsg('NODE-03', 'NODE-02', 'HAZARD DETECTED');
      updateNodes(nodes => nodes.map(n => n.id === 'NODE-03' ? { ...n, status: 'RELAYING' } : n));

      setState(s => {
        const updatedRoutes = s.routes.map(r =>
          r.id === activeRouteRef.current ? applyHazardToRoute(r, type) : r
        );
        const aiDecision: AIDecision = {
          currentRoute: activeRouteRef.current,
          currentRisk: updatedRoutes.find(r => r.id === activeRouteRef.current)?.currentRisk || 91,
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
        const bestId = selectBestRoute(s.routes, s.missionRiskLimit, [activeRouteRef.current]);
        const bestRoute = s.routes.find(r => r.id === bestId);
        const oldActiveId = activeRouteRef.current;

        if (!bestId || !bestRoute) {
          addLog('AI', 'No safe route available — evaluating risk override', 'ERROR');
          phaseRef.current = 'SAFE_HOLD';
          return { ...s, phase: 'SAFE_HOLD', demoPhaseLabel: 'NO SAFE ROUTE', vehicleNavigationMode: 'STOPPED', systemStatus: 'CRITICAL' };
        }

        // Calculate vehicle's current position on the old route
        const oldRoute = s.routes.find(r => r.id === oldActiveId);
        const vehiclePos = oldRoute
          ? interpolateRoute(oldRoute.waypoints, vehicleTRef.current)
          : undefined;

        const entryIndex = Math.max(1, Math.min(bestRoute.waypoints.length - 1,
          bestRoute.waypoints.findIndex(point => Math.hypot(point.x - (vehiclePos?.x ?? 0), point.z - (vehiclePos?.z ?? 0)) < 4) || 1));
        const entryPoint = bestRoute.waypoints[entryIndex];
        transitionPathRef.current = vehiclePos ? [vehiclePos, {
          x: (vehiclePos.x + entryPoint.x) / 2,
          y: (vehiclePos.y + entryPoint.y) / 2 + 0.2,
          z: (vehiclePos.z + entryPoint.z) / 2,
        }, entryPoint] : [entryPoint];
        transitionTRef.current = 0;
        const newT = entryIndex / (bestRoute.waypoints.length - 1);
        vehiclePositionRef.current = vehiclePos ?? entryPoint;

        activeRouteRef.current = bestId;
        vehicleTRef.current = newT;
        phaseRef.current = 'REROUTING';

        const explanation = [
          `${type.replace('_', ' ')} detected on ${oldActiveId}`,
          `${oldActiveId} risk increased to 91%`,
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
          if (r.id === bestId) return { ...r, status: 'ACTIVE' as const, blockedWaypoints: [] };
          if (r.id === oldActiveId) return { ...r, status: 'UNSAFE' as const };
          const risk = r.currentRisk;
          return { ...r, status: getRouteStatus(risk, false, false) };
        });

        return {
          ...s,
          phase: 'REROUTING',
          demoPhaseLabel: 'REROUTING',
          activeRouteId: bestId,
          vehicleT: newT,
          vehiclePosition: vehiclePos ?? entryPoint,
          vehicleNavigationMode: 'TRANSITIONING',
          reroutes: s.reroutes + 1,
          routeHistory: [...s.routeHistory, bestId],
          routes: updatedRoutes,
          aiDecision: updatedAi,
          systemStatus: 'OPERATIONAL',
        };
      });

      addLog('AI', 'Evaluating alternative routes...', 'AI');
      addLog('MESH', 'Risk update propagated across network', 'MESH');
      addLog('AI', `${activeRouteRef.current} selected — safest feasible route`, 'SUCCESS');
      addLog('NAV', 'Autonomous rerouting initiated', 'INFO');
    }, 4000);

    setTimeout(() => {
      setState(s => ({ ...s, systemStatus: 'OPERATIONAL' }));
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
    vehiclePositionRef.current = SOURCE_POS;
    transitionPathRef.current = [];
    transitionTRef.current = 0;
    phaseRef.current = 'MOVING';

    const newSensorState = initializeSensorState();

    setState(s => ({
      ...s,
      phase: 'MOVING',
      demoPhaseLabel: 'AUTONOMOUS MOVEMENT',
      progress: 0,
      vehicleT: 0,
      vehiclePosition: SOURCE_POS,
      vehicleNavigationMode: 'FOLLOWING_ROUTE',
      activeRouteId: 'ROUTE-A',
      routes: INITIAL_ROUTES,
      nodes: INITIAL_NODES,
      hazards: [],
      meshMessages: [],
      showYoloPanel: false,
      yoloDetection: null,
      terrainAnalysis: { slope: 12, elevation: 420, stability: 'STABLE', landslideRisk: 14 },
      sensorFusion: newSensorState.current,
      riskHistory: [],
      reroutes: 0,
      routeHistory: ['ROUTE-A'],
      hazardsDetected: 0,
      aiDecision: null,
      startTime: Date.now(),
      systemStatus: 'OPERATIONAL',
    }));

    addLog('NODE-01', 'Mission initialized — BASE-01 → ZONE-07', 'SUCCESS');
    addLog('AI', 'Route analysis complete — Route A selected (risk: 18%)', 'AI');
    addLog('SENSOR', 'Sensor fusion operational — Overall confidence 94%', 'SENSOR');
    addLog('NAV', 'Autonomous movement initiated', 'INFO');

    stopTick();
    tickRef.current = setInterval(() => {
      const speed = 0.0018;
      const nextT = Math.min(1, vehicleTRef.current + speed);

      // Check for collision BEFORE updating position
      setState(s => {
        if (phaseRef.current === 'HAZARD_DETECTED' || phaseRef.current === 'RISK_EVALUATION') {
          return { ...s, vehicleNavigationMode: 'STOPPED' };
        }
        if (transitionPathRef.current.length > 0) {
          const transitionT = Math.min(1, transitionTRef.current + 0.02);
          const position = interpolatePath(transitionPathRef.current, transitionT);
          transitionTRef.current = transitionT;
          vehiclePositionRef.current = position;
          if (transitionT < 1) return { ...s, vehiclePosition: position, vehicleNavigationMode: 'TRANSITIONING' };
          transitionPathRef.current = [];
          phaseRef.current = 'RESUMED';
          return { ...s, phase: 'RESUMED', demoPhaseLabel: 'SAFE REROUTE ACTIVE', vehiclePosition: position, vehicleNavigationMode: 'FOLLOWING_ROUTE' };
        }
        if (phaseRef.current !== 'MOVING' && phaseRef.current !== 'RESUMED') return s;
        const activeRoute = s.routes.find(r => r.id === activeRouteRef.current);
        if (!activeRoute) return s;

        const nextPos = interpolateRoute(activeRoute.waypoints, nextT);

        // **CRITICAL**: Check for hazard collision
        let collisionHazard: Hazard | undefined;
        for (const hazard of s.hazards) {
          if (hazard.active && (isInHazardRadius(nextPos, hazard) || movementIntersectsHazard(vehiclePositionRef.current, nextPos, hazard))) {
            collisionHazard = hazard;
            break;
          }
        }

        if (collisionHazard) {
          // COLLISION DETECTED - EMERGENCY STOP AND REROUTE
          if (phaseRef.current !== 'REROUTING' && phaseRef.current !== 'COMPLETED') {
            addLog('SAFETY', `⚠ COLLISION AVOIDANCE - ${collisionHazard.type} detected!`, 'ERROR');
            addLog('NAV', 'Emergency stop activated — analyzing alternatives', 'WARN');

            // Directly trigger the rerouting sequence
            phaseRef.current = 'RISK_EVALUATION';

            // Get current vehicle position
            const vehiclePos = interpolateRoute(activeRoute.waypoints, vehicleTRef.current);

            // Calculate which routes are viable
            const bestId = selectBestRoute(s.routes, s.missionRiskLimit, [activeRouteRef.current]);
            const bestRoute = s.routes.find(r => r.id === bestId);
            const oldActiveId = activeRouteRef.current;

            if (!bestId || !bestRoute) {
              addLog('AI', 'No safe alternative — mission aborted', 'ERROR');
              phaseRef.current = 'SAFE_HOLD';
              return { ...s, phase: 'SAFE_HOLD', demoPhaseLabel: 'NO SAFE ROUTE', vehicleNavigationMode: 'STOPPED', systemStatus: 'CRITICAL' };
            }

            const entryIndex = Math.max(1, Math.min(bestRoute.waypoints.length - 1,
              bestRoute.waypoints.findIndex(point => Math.hypot(point.x - vehiclePos.x, point.z - vehiclePos.z) < 4) || 1));
            const entryPoint = bestRoute.waypoints[entryIndex];
            transitionPathRef.current = [vehiclePos, {
              x: (vehiclePos.x + entryPoint.x) / 2,
              y: (vehiclePos.y + entryPoint.y) / 2 + 0.2,
              z: (vehiclePos.z + entryPoint.z) / 2,
            }, entryPoint];
            transitionTRef.current = 0;
            const newT = entryIndex / (bestRoute.waypoints.length - 1);
            vehiclePositionRef.current = vehiclePos;

            activeRouteRef.current = bestId;
            vehicleTRef.current = newT;
            phaseRef.current = 'REROUTING';

            const explanation = [
              `${collisionHazard.type.replace('_', ' ')} detected ahead`,
              `${oldActiveId} blocked — cannot continue`,
              `Mission risk limit = ${s.missionRiskLimit}%`,
              `${oldActiveId} rejected`,
              `${bestId} evaluated: risk = ${bestRoute.currentRisk}%`,
              `${bestRoute.currentRisk}% ≤ ${s.missionRiskLimit}% — satisfies constraints`,
              `${bestId} selected as safest route`,
            ];

            const updatedAi: AIDecision = {
              ...(s.aiDecision as AIDecision),
              selectedRoute: bestId,
              explanation,
              summary: `Emergency reroute to ${bestId} — collision avoided.`,
            };

            const updatedRoutes = s.routes.map(r => {
              if (r.id === bestId) return { ...r, status: 'ACTIVE' as const, blockedWaypoints: [] };
              if (r.id === oldActiveId) return { ...r, status: 'UNSAFE' as const };
              return r;
            });

            addLog('AI', 'Rerouting to safest alternative...', 'AI');
            addLog('AI', `${bestId} selected — collision avoided`, 'SUCCESS');

            // Resume after brief delay
            setTimeout(() => {
              phaseRef.current = 'RESUMED';
              setState(s => ({ ...s, phase: 'RESUMED', demoPhaseLabel: 'REROUTE ACTIVE', systemStatus: 'OPERATIONAL' }));
              addLog('NAV', 'Vehicle resumed on new route', 'SUCCESS');
            }, 1500);

            return {
              ...s,
              phase: 'REROUTING',
              demoPhaseLabel: 'EMERGENCY REROUTE',
              activeRouteId: bestId,
              vehicleT: newT,
              vehiclePosition: vehiclePos,
              vehicleNavigationMode: 'TRANSITIONING',
              reroutes: s.reroutes + 1,
              routeHistory: [...s.routeHistory, bestId],
              routes: updatedRoutes,
              aiDecision: updatedAi,
              systemStatus: 'OPERATIONAL',
            };
          }
          return s; // Already rerouting or completed, don't move
        }

        // No collision - proceed with movement
        vehicleTRef.current = nextT;
        vehiclePositionRef.current = nextPos;
        const t = vehicleTRef.current;

        const progress = Math.round(t * 100);
        const newRiskHistory = [...s.riskHistory, { time: Date.now(), risk: activeRoute.currentRisk }].slice(-60);
        const missionDuration = Date.now() - s.startTime;

        if (t >= 1) {
          stopTick();
          phaseRef.current = 'COMPLETED';
          return {
            ...s,
            phase: 'COMPLETED',
            demoPhaseLabel: 'MISSION COMPLETE',
            vehicleT: 1,
            vehiclePosition: nextPos,
            vehicleNavigationMode: 'COMPLETED',
            progress: 100,
            finalRisk: activeRoute.currentRisk,
            totalDistance: s.routes.filter(r => r.status === 'ACTIVE').reduce((acc, r) => acc + r.distance, 0),
            missionDuration,
            riskHistory: newRiskHistory,
            systemStatus: 'OPERATIONAL',
          };
        }

        return { ...s, vehicleT: t, vehiclePosition: nextPos, vehicleNavigationMode: 'FOLLOWING_ROUTE', progress, riskHistory: newRiskHistory, missionDuration };
      });

    }, 50);
  }, [addLog, stopTick]);

  const runDemo = useCallback(() => {
    // Clear any existing timeouts from previous runs
    stopTick();

    vehicleTRef.current = 0;
    activeRouteRef.current = 'ROUTE-A';
    vehiclePositionRef.current = SOURCE_POS;
    transitionPathRef.current = [];
    transitionTRef.current = 0;

    const newSensorState = initializeSensorState();

    setState(() => ({
      ...INIT_STATE,
      phase: 'INITIALIZING',
      demoPhaseLabel: 'INITIALIZING TERRAIN',
      log: [mkLog('SYSTEM', 'RAVEN-RX DEMO MODE ACTIVATED', 'SUCCESS')],
      startTime: Date.now(),
      sensorFusion: newSensorState.current,
    }));
    phaseRef.current = 'INITIALIZING';

    const demoSequence: Array<[number, () => void]> = [
      [800, () => {
        setState(s => ({ ...s, demoPhaseLabel: 'DISCOVERING ROUTES' }));
        addLog('AI', 'Terrain initialized — scanning routes', 'INFO');
        addLog('NAV', 'Sensor fusion online — all systems ready', 'INFO');
      }],
      [1600, () => {
        setState(s => ({ ...s, phase: 'ROUTE_ANALYSIS', demoPhaseLabel: 'CALCULATING RISK SCORES' }));
        addLog('RISK', 'Route A: 18% | Route B: 31% | Route C: 72%', 'AI');
        addLog('AI', 'Multi-factor risk fusion complete', 'INFO');
      }],
      [2600, () => {
        addLog('AI', 'Route A selected — optimal risk within mission limit (35%)', 'SUCCESS');
        setState(s => ({ ...s, demoPhaseLabel: 'OPTIMAL ROUTE SELECTED' }));
      }],
      [3500, () => {
        // Start the actual mission
        startMission();
      }],
      [12000, () => {
        // Trigger a hazard if still moving
        if (phaseRef.current === 'MOVING') {
          triggerHazard('LANDSLIDE');
        }
      }],
      // After hazard and rerouting complete, mission continues
      // Final completion happens automatically via the mission tick
    ];

    // Schedule all demo events
    const timeoutIds = demoSequence.map(([delay, fn]) => setTimeout(fn, delay));

    // Store timeout IDs for cleanup if needed
    const cleanupTimeouts = () => {
      timeoutIds.forEach(id => clearTimeout(id));
    };

    // No need to return cleanup as we handle resets separately
  }, [addLog, startMission, triggerHazard, stopTick]);

  const resetMission = useCallback(() => {
    stopTick();
    vehicleTRef.current = 0;
    activeRouteRef.current = 'ROUTE-A';
    phaseRef.current = 'IDLE';
    const newSensorState = initializeSensorState();
    setState(() => ({
      ...INIT_STATE,
      sensorFusion: newSensorState.current,
      log: [mkLog('SYSTEM', 'Mission reset', 'INFO')],
    }));
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
