export type RouteStatus = 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'UNSAFE' | 'ACTIVE' | 'ALTERNATIVE';

export type MissionPhase =
  | 'IDLE'
  | 'INITIALIZING'
  | 'ROUTE_ANALYSIS'
  | 'MOVING'
  | 'HAZARD_DETECTED'
  | 'RISK_EVALUATION'
  | 'REROUTING'
  | 'BACKTRACKING'
  | 'REPLANNING'
  | 'TURNING'
  | 'RESUMED'
  | 'SAFE_HOLD'
  | 'COMPLETED';

export type HazardType = 'LANDSLIDE' | 'ROAD_BLOCK' | 'FIRE' | 'OBSTACLE' | 'DAMAGED_ROAD' | 'FLOOD' | 'SMOKE' | 'UNSTABLE_TERRAIN';
export type LogType = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'AI' | 'MESH' | 'SENSOR' | 'TERRAIN';

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
  blockedWaypoints?: number[]; // Indices of waypoints blocked by hazards
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
  radius: number; // Hazard collision radius in world units
  affectedRouteId: string;
  affectedNodeIndex?: number; // Which waypoint index this hazard blocks
  confidence: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  segmentId: string;
  segmentT: number;
  timestamp: string;
  active: boolean;
  targetNodeId: string;
  blocking: boolean;
  animation: 'FALLING' | 'STATIC';
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
  vehiclePosition: Vec3;
  vehicleNavigationMode: 'STOPPED' | 'FOLLOWING_ROUTE' | 'TRANSITIONING' | 'BACKTRACKING' | 'REPLANNING' | 'TURNING' | 'SAFE_HOLD' | 'COMPLETED';
  routes: Route[];
  nodes: CommNode[];
  hazards: Hazard[];
  log: LogEntry[];
  missionRiskLimit: number;
  reroutes: number;
  routeHistory: string[]; // Track route changes
  hazardsDetected: number;
  aiDecision: AIDecision | null;
  meshMessages: MeshMessage[];
  showYoloPanel: boolean;
  yoloDetection: { object: string; confidence: number; region: string; severity: string } | null;
  terrainAnalysis: { slope: number; elevation: number; stability: string; landslideRisk: number };
  sensorFusion: {
    camera: number;
    gps: number;
    imu: number;
    terrain: number;
    mesh: number;
  };
  riskHistory: Array<{ time: number; risk: number }>;
  startTime: number;
  totalDistance: number;
  finalRisk: number;
  missionDuration: number;
  systemStatus: 'OPERATIONAL' | 'WARNING' | 'CRITICAL' | 'IDLE';
}
