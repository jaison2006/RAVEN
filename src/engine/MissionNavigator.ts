import { ROAD_GRAPH, RoadGraph } from './RoadGraph';
import { RecoveryPlanner } from './RecoveryPlanner';
import { RoutePlanner, type PlannedRoute } from './RoutePlanner';

export class MissionNavigator {
  readonly graph: RoadGraph;
  readonly recovery = new RecoveryPlanner();
  readonly planner: RoutePlanner;
  currentNode = 'START_NODE';
  destination = 'DESTINATION_NODE';
  constructor(graph = ROAD_GRAPH) { this.graph = graph; this.planner = new RoutePlanner(graph); }
  plan(riskLimit: number): PlannedRoute | null { return this.planner.findSafeRoute(this.currentNode, this.destination, riskLimit); }
  block(segmentId: string) { this.graph.setBlocked(segmentId, true); }
  markSafe(segmentId: string, startT: number, endT: number) { this.recovery.record(segmentId, startT, endT, true); }
  reset() { this.currentNode = 'START_NODE'; this.recovery.clear(); this.graph.segments.forEach(segment => this.graph.setBlocked(segment.id, false)); }
}
