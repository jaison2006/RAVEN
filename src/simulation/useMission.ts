import { useRef, useState, useCallback, useEffect } from 'react';
import type { MissionState, LogEntry, Hazard, MeshMessage, AIDecision, CommNode, Vec3 } from './types';
import { INITIAL_ROUTES, INITIAL_NODES, HAZARD_POSITION, HAZARD_RADIUS, SOURCE_POS } from '../data/mapData';
import { applyHazardToRoute, computeRisk } from './riskEngine';
import { initializeSensorState, computeOverallConfidence } from './sensorEngine';
import { getTerrainAnalysis, getYoloObject } from './hazardEngine';
import { ROAD_GRAPH, getMissionSegments, sampleRoadSegments, type RoadSegment } from '../engine/RoadGraph';
import { RoutePlanner } from '../engine/RoutePlanner';
import { RerouteEngine } from '../engine/RerouteEngine';
import { createHazardEvent } from '../engine/HazardEventEngine';
import {
  isInHazardRadius,
  checkHazardIntersectsRoute,
  markBlockedWaypoints,
  movementIntersectsHazard,
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
  const activeRouteRef = useRef('ROUTE-A');
  const vehiclePositionRef = useRef<Vec3>(SOURCE_POS);
  const routesRef = useRef(INITIAL_ROUTES);
  const runIdRef = useRef(0);
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rerouteEngineRef = useRef(new RerouteEngine(ROAD_GRAPH));
  const pendingRouteRef = useRef<string | null>(null);
  const navigationRef = useRef({
    segments: getMissionSegments('ROUTE-A'),
    segmentIndex: 0,
    segmentT: 0,
    direction: 1 as 1 | -1,
    mode: 'FORWARD' as 'FORWARD' | 'BACKTRACKING' | 'TURNING',
    traversedSegments: [] as string[],
    recoveryNode: null as string | null,
    recoverySegments: [] as RoadSegment[],
    recoveryIndex: 0,
    alternativeSegments: [] as RoadSegment[],
  });

  const schedule = useCallback((delay: number, callback: () => void) => {
    const runId = runIdRef.current;
    const timeoutId = setTimeout(() => {
      if (runId === runIdRef.current) callback();
    }, delay);
    timeoutIdsRef.current.push(timeoutId);
  }, []);

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

    const navigation = navigationRef.current;
    const currentSegment = navigation.segments[navigation.segmentIndex];
    const nextSegment = navigation.segments[navigation.segmentIndex + 1];
    const targetSegment = currentSegment && navigation.segmentT < 0.86 ? currentSegment : (nextSegment ?? currentSegment);
    const route = routesRef.current.find(r => r.id === activeRouteRef.current);
    const hazardWaypointIndex = route
      ? Math.min(route.waypoints.length - 1, Math.max(1, Math.ceil(navigation.segmentT * (route.waypoints.length - 1)) + 1))
      : 1;

    const hazardT = targetSegment === currentSegment
      ? Math.min(0.92, Math.max(navigation.segmentT + 0.22, 0.72))
      : 0.18;
    const event = targetSegment ? createHazardEvent(ROAD_GRAPH, targetSegment, type, `hazard-event-${Date.now()}`) : null;
    const hazardPoint = event?.position ?? targetSegment?.curve.getPointAt(hazardT);
    const hazard: Hazard = {
      id: `h-${Date.now()}`,
      type,
      position: hazardPoint ? { x: hazardPoint.x, y: hazardPoint.y, z: hazardPoint.z } : (route?.waypoints[hazardWaypointIndex] ?? HAZARD_POSITION),
      radius: Math.max(HAZARD_RADIUS, 1.25),
      affectedRouteId: activeRouteRef.current,
      affectedNodeIndex: hazardWaypointIndex,
      segmentId: targetSegment?.id ?? '',
      segmentT: hazardT,
      targetNodeId: event?.targetNodeId ?? targetSegment?.to ?? '',
      blocking: false,
      animation: event?.animation ?? 'STATIC',
      confidence: 94 + Math.random() * 4,
      severity: 'CRITICAL',
      timestamp: ts(),
      active: true,
    };

    if (targetSegment) schedule(type === 'LANDSLIDE' ? 1100 : 0, () => {
      ROAD_GRAPH.setBlocked(targetSegment.id, true);
      setState(current => ({ ...current, hazards: current.hazards.map(item => item.id === hazard.id ? { ...item, blocking: true } : item) }));
    });

    phaseRef.current = 'HAZARD_DETECTED';

    const yoloObject = getYoloObject(type);
    const terrainAnalysis = getTerrainAnalysis(type);

    setState(s => {
      vehiclePositionRef.current = currentSegment ? { ...currentSegment.curve.getPointAt(navigation.segmentT) } : SOURCE_POS;
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

    schedule(1800, () => {
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
    });

    schedule(2800, () => {
      addMeshMsg('NODE-02', 'NODE-01', 'ROUTE RISK UPDATED');
      updateNodes(nodes => nodes.map(n => n.id === 'NODE-02' ? { ...n, status: 'UPDATING', lastMessage: 'ROUTE UPDATE' } : n));
    });

    schedule(1800, () => {
      setState(s => {
        const oldActiveId = activeRouteRef.current;
        const currentSegment = navigationRef.current.segments[navigationRef.current.segmentIndex];
        const currentRoad = currentSegment
          ? { segment: currentSegment, segmentT: navigationRef.current.segmentT }
          : { segment: undefined, segmentT: 0 };
        const activeSegments = getMissionSegments(oldActiveId);
        const currentIndex = currentRoad.segment ? activeSegments.findIndex(segment => segment.id === currentRoad.segment?.id) : -1;
        const travelledSegments = [...navigationRef.current.traversedSegments, ...activeSegments.slice(0, currentIndex).map(segment => segment.id)];
        const decision = currentRoad.segment
          ? rerouteEngineRef.current.decide(currentRoad.segment.id, currentRoad.segmentT, travelledSegments, 'DESTINATION_NODE', s.missionRiskLimit, s.hazards.find(hazard => hazard.active)?.segmentId ?? currentRoad.segment.id)
          : null;
        if (!decision || decision.mode === 'SAFE_HOLD' || !decision.newRoute) {
          addLog('AI', 'No safe backtrack available — assistance required', 'ERROR');
          phaseRef.current = 'SAFE_HOLD';
          return { ...s, phase: 'SAFE_HOLD', demoPhaseLabel: 'NO SAFE ROUTE', vehicleNavigationMode: 'SAFE_HOLD', systemStatus: 'CRITICAL' };
        }
        const recoveryNode = decision.recoveryNode;
        const graphPlan = decision.newRoute;
        const plannedIds = new Set(graphPlan?.segments.map(segment => segment.id) ?? []);
        const bestId = plannedIds.has('R_ALT_01') ? 'ROUTE-B' : plannedIds.has('R_CONNECT_01') ? 'ROUTE-C' : null;
        const bestRoute = s.routes.find(r => r.id === bestId);

        if (!bestId || !bestRoute || !graphPlan) {
          addLog('AI', 'No safe route available — evaluating risk override', 'ERROR');
          phaseRef.current = 'SAFE_HOLD';
          return { ...s, phase: 'SAFE_HOLD', demoPhaseLabel: 'NO SAFE ROUTE', vehicleNavigationMode: 'STOPPED', systemStatus: 'CRITICAL' };
        }

        // Calculate vehicle's current position on the old route
        const vehiclePos = vehiclePositionRef.current;

        navigationRef.current.mode = 'BACKTRACKING';
        navigationRef.current.direction = -1;
        navigationRef.current.segmentT = currentRoad.segmentT;
        navigationRef.current.recoveryNode = recoveryNode;
        navigationRef.current.recoverySegments = decision.backtrackSegments.map(id => ROAD_GRAPH.segments.get(id)!).filter(Boolean);
        navigationRef.current.recoveryIndex = 0;
        navigationRef.current.alternativeSegments = graphPlan.segments;
        pendingRouteRef.current = bestId;
        phaseRef.current = 'BACKTRACKING';

        const explanation = [
          `${type.replace('_', ' ')} detected on ${oldActiveId}`,
          `${oldActiveId} risk increased to 91%`,
          `Mission risk limit = ${s.missionRiskLimit}%`,
          `${oldActiveId} rejected — exceeds limit`,
          `Graph search: ${graphPlan.segments.map(segment => segment.id).join(' → ')}`,
          `${bestId} evaluated: risk = ${bestRoute.currentRisk}%`,
          `${bestRoute.currentRisk}% ≤ ${s.missionRiskLimit}% — satisfies constraints`,
          `${bestId} queued pending physical recovery at ${recoveryNode}`,
        ];

        return {
          ...s,
          phase: 'BACKTRACKING',
          demoPhaseLabel: `SAFE BACKTRACK AVAILABLE — ${recoveryNode}`,
          vehiclePosition: vehiclePos,
          vehicleNavigationMode: 'BACKTRACKING',
          routes: s.routes.map(route => route.id === bestId ? { ...route, status: 'ALTERNATIVE' as const } : route),
          aiDecision: { ...(s.aiDecision as AIDecision), selectedRoute: '', explanation: [...(s.aiDecision?.explanation ?? []), `SAFE BACKTRACK AVAILABLE — recovery node ${recoveryNode}`], summary: `Backtracking to ${recoveryNode} before committing a connected route.` },
          systemStatus: 'OPERATIONAL',
        };
      });

      addLog('AI', 'Evaluating alternative routes...', 'AI');
      addLog('MESH', 'Risk update propagated across network', 'MESH');
      addLog('AI', `Safe backtrack available — recovery node identified`, 'SUCCESS');
      addLog('NAV', 'Physical recovery initiated', 'INFO');
    });

    schedule(5200, () => {
      setState(s => ({ ...s, systemStatus: 'OPERATIONAL' }));
      updateNodes(nodes => nodes.map(n => ({ ...n, status: 'ONLINE' })));
    });
  }, [addLog, addMeshMsg, schedule, updateNodes]);

  const stopTick = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  const startMission = useCallback(() => {
    ROAD_GRAPH.segments.forEach(segment => ROAD_GRAPH.setBlocked(segment.id, false));
    activeRouteRef.current = 'ROUTE-A';
    navigationRef.current = {
      ...navigationRef.current,
      segments: getMissionSegments('ROUTE-A'),
      segmentIndex: 0,
      segmentT: 0,
      direction: 1,
      mode: 'FORWARD',
      traversedSegments: [],
      recoveryNode: null,
      recoverySegments: [],
      recoveryIndex: 0,
      alternativeSegments: [],
    };
    pendingRouteRef.current = null;
    vehiclePositionRef.current = SOURCE_POS;
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
      const speed = 0.00065;

      // Check for collision BEFORE updating position
      setState(s => {
        if (phaseRef.current === 'HAZARD_DETECTED' || phaseRef.current === 'RISK_EVALUATION') {
          return { ...s, vehicleNavigationMode: 'STOPPED' };
        }
        if (navigationRef.current.mode === 'BACKTRACKING') {
          const navigation = navigationRef.current;
          const segment = navigation.recoverySegments[navigation.recoveryIndex];
          if (!segment) return s;
          navigation.segmentT = Math.max(0, navigation.segmentT - 0.006);
          const position = segment.curve.getPointAt(navigation.segmentT);
          vehiclePositionRef.current = { x: position.x, y: position.y, z: position.z };
          if (navigation.segmentT > 0.001) {
            return { ...s, phase: 'BACKTRACKING', demoPhaseLabel: 'BACKTRACKING TO SAFE JUNCTION', vehiclePosition: vehiclePositionRef.current, vehicleNavigationMode: 'BACKTRACKING' };
          }
          navigation.recoveryIndex += 1;
          if (navigation.recoveryIndex < navigation.recoverySegments.length) {
            navigation.segmentT = 1;
            return { ...s, phase: 'BACKTRACKING', demoPhaseLabel: 'BACKTRACKING TO SAFE JUNCTION', vehiclePosition: vehiclePositionRef.current, vehicleNavigationMode: 'BACKTRACKING' };
          }
          const routeId = pendingRouteRef.current;
          if (!routeId || navigation.alternativeSegments.length === 0) return s;
          const node = ROAD_GRAPH.nodes.get(navigation.recoveryNode ?? '');
          const committed = navigation.alternativeSegments;
          navigation.segments = committed;
          navigation.segmentIndex = 0;
          navigation.segmentT = 0;
          navigation.direction = 1;
          navigation.mode = 'TURNING';
          const previousRouteId = activeRouteRef.current;
          activeRouteRef.current = routeId;
          pendingRouteRef.current = null;
          phaseRef.current = 'RESUMED';
          return {
            ...s,
            phase: 'RESUMED',
            demoPhaseLabel: 'SAFE REROUTE ACTIVE',
            activeRouteId: routeId,
            vehicleT: 0,
            vehiclePosition: node ? { x: node.position.x, y: node.position.y, z: node.position.z } : vehiclePositionRef.current,
            vehicleNavigationMode: 'TURNING',
            reroutes: s.reroutes + 1,
            routeHistory: [...s.routeHistory, routeId],
            routes: s.routes.map(r => r.id === routeId ? { ...r, status: 'ACTIVE' as const, blockedWaypoints: [] } : r.id === previousRouteId ? { ...r, status: 'UNSAFE' as const } : r),
            aiDecision: s.aiDecision ? { ...s.aiDecision, selectedRoute: routeId, summary: `${routeId} selected at ${navigation.recoveryNode} after physical backtrack.` } : s.aiDecision,
          };
        }
        if (phaseRef.current !== 'MOVING' && phaseRef.current !== 'RESUMED') return s;
        const activeRoute = s.routes.find(r => r.id === activeRouteRef.current);
        if (!activeRoute) return s;

        const navigation = navigationRef.current;
        if (navigation.mode === 'TURNING') navigation.mode = 'FORWARD';
        const navigationSegment = navigation.segments[navigation.segmentIndex];
        if (!navigationSegment) return s;
        const nextSegmentT = Math.min(1, navigation.segmentT + 0.0065);
        const nextPoint = navigationSegment.curve.getPointAt(nextSegmentT);
        const nextPos = { x: nextPoint.x, y: nextPoint.y, z: nextPoint.z };

        // **CRITICAL**: Check for hazard collision
        let collisionHazard: Hazard | undefined;
        for (const hazard of s.hazards) {
          if (hazard.active && (isInHazardRadius(nextPos, hazard) || movementIntersectsHazard(vehiclePositionRef.current, nextPos, hazard))) {
            collisionHazard = hazard;
            break;
          }
        }

        if (collisionHazard) return s;

        // No collision - proceed with movement
        navigation.segmentT = nextSegmentT;
        if (navigation.segmentT >= 1) {
          if (!navigation.traversedSegments.includes(navigationSegment.id)) navigation.traversedSegments.push(navigationSegment.id);
          if (navigation.segmentIndex < navigation.segments.length - 1) {
            navigation.segmentIndex += 1;
            navigation.segmentT = 0;
          }
        }
        vehiclePositionRef.current = nextPos;
        const progress = Math.round(((navigation.segmentIndex + navigation.segmentT) / Math.max(1, navigation.segments.length)) * 100);
        const newRiskHistory = [...s.riskHistory, { time: Date.now(), risk: activeRoute.currentRisk }].slice(-60);
        const missionDuration = Date.now() - s.startTime;

        if (navigation.segmentIndex === navigation.segments.length - 1 && navigation.segmentT >= 1) {
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

        return { ...s, vehicleT: progress / 100, vehiclePosition: nextPos, vehicleNavigationMode: 'FOLLOWING_ROUTE', progress, riskHistory: newRiskHistory, missionDuration };
      });

    }, 50);
  }, [addLog, stopTick]);

  const runDemo = useCallback(() => {
    // Clear any existing timeouts from previous runs
    stopTick();
    runIdRef.current += 1;
    timeoutIdsRef.current.forEach(id => clearTimeout(id));
    timeoutIdsRef.current = [];

    activeRouteRef.current = 'ROUTE-A';
    vehiclePositionRef.current = SOURCE_POS;

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
    demoSequence.forEach(([delay, fn]) => schedule(delay, fn));
  }, [addLog, schedule, startMission, triggerHazard, stopTick]);

  const resetMission = useCallback(() => {
    stopTick();
    runIdRef.current += 1;
    timeoutIdsRef.current.forEach(id => clearTimeout(id));
    timeoutIdsRef.current = [];
    ROAD_GRAPH.segments.forEach(segment => ROAD_GRAPH.setBlocked(segment.id, false));
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
