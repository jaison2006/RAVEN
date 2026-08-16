import type { Route } from './types';

export function computeRisk(route: Omit<Route, 'currentRisk' | 'status'>): number {
  const { terrainRisk, obstructionRisk, environmentalRisk, sensorConfidence } = route;
  const sensorPenalty = (100 - sensorConfidence) * 0.5;
  const raw =
    (environmentalRisk * 0.35 +
      terrainRisk * 0.30 +
      obstructionRisk * 0.25 +
      sensorPenalty * 0.10);
  return Math.min(100, Math.max(0, Math.round(raw)));
}

export function getRouteStatus(risk: number, isActive: boolean, isAlternative: boolean): Route['status'] {
  if (isActive) return 'ACTIVE';
  if (isAlternative) return 'ALTERNATIVE';
  if (risk >= 80) return 'UNSAFE';
  if (risk >= 55) return 'HIGH_RISK';
  if (risk >= 35) return 'CAUTION';
  return 'SAFE';
}

export function applyHazardToRoute(route: Route): Route {
  const environmentalRisk = 95;
  const obstructionRisk = 90;
  const sensorConfidence = 60;
  const terrainRisk = route.terrainRisk + 30;
  const currentRisk = computeRisk({ ...route, terrainRisk, obstructionRisk, environmentalRisk, sensorConfidence });
  return {
    ...route,
    terrainRisk,
    obstructionRisk,
    environmentalRisk,
    sensorConfidence,
    currentRisk,
    status: 'UNSAFE',
  };
}

export function selectBestRoute(routes: Route[], limit: number, excludeId: string): string | null {
  const candidates = routes
    .filter(r => r.id !== excludeId && r.currentRisk <= limit)
    .sort((a, b) => a.currentRisk - b.currentRisk);
  return candidates[0]?.id ?? null;
}
