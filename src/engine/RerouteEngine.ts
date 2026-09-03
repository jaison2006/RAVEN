import { RoutePlanner, type PlannedRoute } from './RoutePlanner';
import type { RoadGraph } from './RoadGraph';

export type RerouteMode = 'FORWARD_REPLAN' | 'BACKTRACK' | 'SAFE_HOLD';

export type RerouteDecision = {
  mode: RerouteMode;
  blockedSegmentId: string;
  recoveryNode: string | null;
  backtrackSegments: string[];
  newRoute: PlannedRoute | null;
  reason: string;
};

export class RerouteEngine {
  private readonly planner: RoutePlanner;

  constructor(private readonly graph: RoadGraph) {
    this.planner = new RoutePlanner(graph);
  }

  decide(currentSegmentId: string, currentSegmentT: number, travelledSegments: string[], destination: string, riskLimit: number, blockedSegmentId: string): RerouteDecision {
    const current = this.graph.segments.get(currentSegmentId);
    if (!current) return { mode: 'SAFE_HOLD', blockedSegmentId, recoveryNode: null, backtrackSegments: [], newRoute: null, reason: 'Current road segment is unavailable.' };

    const forwardRoute = currentSegmentT >= 0.999
      ? this.planner.findSafeRoute(current.to, destination, riskLimit, new Set([blockedSegmentId]))
      : null;
    if (forwardRoute) return { mode: 'FORWARD_REPLAN', blockedSegmentId, recoveryNode: current.to, backtrackSegments: [], newRoute: forwardRoute, reason: 'Safe forward alternative found.' };

    const candidates = [currentSegmentId, ...travelledSegments.slice().reverse()];
    for (const [index, segmentId] of candidates.entries()) {
      const segment = this.graph.segments.get(segmentId);
      if (!segment) continue;
      const route = this.planner.findSafeRoute(segment.from, destination, riskLimit, new Set([blockedSegmentId]));
      if (!route || route.segments[0]?.id === blockedSegmentId) continue;
      return {
        mode: 'BACKTRACK',
        blockedSegmentId,
        recoveryNode: segment.from,
        backtrackSegments: candidates.slice(0, index + 1),
        newRoute: route,
        reason: `Forward path unavailable. Safe recovery junction ${segment.from} has a feasible alternative route.`,
      };
    }

    return { mode: 'SAFE_HOLD', blockedSegmentId, recoveryNode: null, backtrackSegments: [], newRoute: null, reason: 'No safe forward route and no safe recovery path.' };
  }
}
