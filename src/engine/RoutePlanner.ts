import { RoadGraph, type RoadSegment } from './RoadGraph';

export type PlannedRoute = { segments: RoadSegment[]; totalRisk: number; totalDistance: number };

export class RoutePlanner {
  constructor(private readonly graph: RoadGraph) {}

  findSafeRoute(from: string, destination: string, riskLimit: number, excluded = new Set<string>()): PlannedRoute | null {
    const frontier = [{ node: from, risk: 0, distance: 0, segments: [] as RoadSegment[] }];
    const best = new Map<string, number>([[from, 0]]);
    while (frontier.length) {
      frontier.sort((a, b) => a.risk + a.distance * 0.03 - (b.risk + b.distance * 0.03));
      const current = frontier.shift()!;
      if (current.node === destination) return { segments: current.segments, totalRisk: Math.round(current.risk), totalDistance: current.distance };
      for (const segment of this.graph.neighbors(current.node)) {
        if (!segment.traversable || excluded.has(segment.id) || current.segments.some(item => item.id === segment.id)) continue;
        const next = segment.from === current.node ? segment.to : segment.from;
        const risk = (current.risk * current.segments.length + segment.risk) / (current.segments.length + 1);
        if (risk > riskLimit || risk >= (best.get(next) ?? Infinity)) continue;
        best.set(next, risk);
        frontier.push({ node: next, risk, distance: current.distance + segment.length, segments: [...current.segments, segment] });
      }
    }
    return null;
  }
}
