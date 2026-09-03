import { RoutePlanner, type PlannedRoute } from './RoutePlanner';
import type { RoadGraph, RoadSegment } from './RoadGraph';

export type TravelRecord = { segmentId: string; startT: number; endT: number; safe: boolean };

export class RecoveryPlanner {
  private readonly history: TravelRecord[] = [];
  record(segmentId: string, startT: number, endT: number, safe = true) { this.history.push({ segmentId, startT, endT, safe }); }
  get travelled() { return [...this.history]; }
  findNearestSafeRecoveryPoint(segments: Map<string, RoadSegment>) {
    for (let index = this.history.length - 1; index >= 0; index--) {
      const record = this.history[index];
      if (record.safe && segments.has(record.segmentId)) return { record, segment: segments.get(record.segmentId)! };
    }
    return null;
  }
  findSafeBacktrack(graph: RoadGraph, currentSegmentId: string, segmentT: number, traversedSegments: string[], destination: string, riskLimit: number, blockedSegmentId = currentSegmentId) {
    const current = graph.segments.get(currentSegmentId);
    if (!current || segmentT <= 0.01) return null;

    const candidates = [current, ...traversedSegments.slice().reverse().map(id => graph.segments.get(id)).filter((segment): segment is RoadSegment => Boolean(segment))];
    for (const candidate of candidates) {
      const recoveryNode = candidate.from;
      const alternative = new RoutePlanner(graph).findSafeRoute(recoveryNode, destination, riskLimit, new Set([blockedSegmentId]));
      if (alternative && alternative.segments[0]?.id !== currentSegmentId) {
        const backtrackSegments = candidates.slice(0, candidates.indexOf(candidate) + 1).map(segment => segment.id);
        return {
          possible: true,
          recoveryNode,
          backtrackSegments,
          alternativeSegments: alternative.segments,
          backtrackDistance: current.length * segmentT + backtrackSegments.slice(1).reduce((distance, id) => distance + (graph.segments.get(id)?.length ?? 0), 0),
        };
      }
    }
    return null;
  }
  clear() { this.history.length = 0; }
}
