export type RouteStatus = 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'UNSAFE' | 'ACTIVE' | 'ALTERNATIVE';

export type MissionPhase =
  | 'IDLE'
  | 'INITIALIZING'
  | 'ROUTE_ANALYSIS'
  | 'MOVING'
  | 'HAZARD_DETECTED'
  | 'RISK_EVALUATION'
  | 'REROUTING'
  | 'RESUMED'
  | 'COMPLETED';

export type HazardType = 'LANDSLIDE' | 'ROAD_BLOCK' | 'FIRE' | 'OBSTACLE' | 'DAMAGED_ROAD';
export type LogType = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'AI' | 'MESH';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Route {
  id: string;
  label: string;
  waypoints: Vec3[];
  distance: number;
  terrainRisk: number;
  obstructionRisk: number;
  environmentalRisk: number;
  sensorConfidence: number;
  currentRisk: number;
  status: RouteStatus;
}

export interface CommNode {
  id: string;
  label: string;
  position: Vec3;
  status: 'ONLINE' | 'HAZARD' | 'UPDATING' | 'RELAYING';
  lastMessage?: string;
}

export interface Hazard {
  id: string;
  type: HazardType;
  position: Vec3;
  routeId: string;
  confidence: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: string;
  active: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  source: string;
  message: string;
  type: LogType;
}

export interface AIDecision {
  currentRoute: string;
  currentRisk: number;
  status: string;
  reason: string;
  alternatives: Array<{
    routeId: string;
    risk: number;
    distance: number;
    feasible: boolean;
    reason: string;
  }>;
  selectedRoute: string;
  explanation: string[];
  summary: string;
}

export interface MeshMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  progress: number; // 0-1 animation progress
  timestamp: number;
}

export interface MissionState {
  phase: MissionPhase;
  demoPhaseLabel: string;
  progress: number;
  activeRouteId: string;
  vehicleT: number; // 0-1 along active route
  routes: Route[];
  nodes: CommNode[];
  hazards: Hazard[];
  log: LogEntry[];
  missionRiskLimit: number;
  reroutes: number;
  hazardsDetected: number;
  aiDecision: AIDecision | null;
  meshMessages: MeshMessage[];
  showYoloPanel: boolean;
  yoloDetection: { object: string; confidence: number; region: string; severity: string } | null;
  terrainAnalysis: { slope: number; elevation: number; stability: string; landslideRisk: number };
  startTime: number;
  totalDistance: number;
  finalRisk: number;
}
