import type { Route, Hazard } from './types';

export interface RiskBreakdown {
  environmentalRisk: number;
  terrainRisk: number;
  obstructionRisk: number;
  sensorPenalty: number;
  total: number;
  factors: {
    environmental: { value: number; weight: 0.35 };
    terrain: { value: number; weight: 0.30 };
    obstruction: { value: number; weight: 0.25 };
    sensor: { value: number; weight: 0.10 };
  };
}

export function computeRiskBreakdown(route: Omit<Route, 'currentRisk' | 'status'>): RiskBreakdown {
  const { terrainRisk, obstructionRisk, environmentalRisk, sensorConfidence } = route;
  const sensorPenalty = (100 - sensorConfidence) * 0.5;

  const weights = { env: 0.35, terrain: 0.30, obs: 0.25, sensor: 0.10 };

  const raw =
    environmentalRisk * weights.env +
    terrainRisk * weights.terrain +
    obstructionRisk * weights.obs +
    sensorPenalty * weights.sensor;

  return {
    environmentalRisk,
    terrainRisk,
    obstructionRisk,
    sensorPenalty,
    total: Math.min(100, Math.max(0, Math.round(raw))),
    factors: {
      environmental: { value: environmentalRisk, weight: weights.env },
      terrain: { value: terrainRisk, weight: weights.terrain },
      obstruction: { value: obstructionRisk, weight: weights.obs },
      sensor: { value: sensorPenalty, weight: weights.sensor },
    },
  };
}

export function computeRisk(route: Omit<Route, 'currentRisk' | 'status'>): number {
  return computeRiskBreakdown(route).total;
}

export function getRouteStatus(risk: number, isActive: boolean, isAlternative: boolean): Route['status'] {
  if (isActive) return 'ACTIVE';
  if (isAlternative) return 'ALTERNATIVE';
  if (risk >= 80) return 'UNSAFE';
  if (risk >= 55) return 'HIGH_RISK';
  if (risk >= 35) return 'CAUTION';
  return 'SAFE';
}

export function applyHazardToRoute(route: Route, hazardType: string = 'LANDSLIDE'): Route {
  let environmentalRisk = 95;
  let obstructionRisk = 90;
  let sensorConfidence = 60;
  let terrainRisk = route.terrainRisk + 30;

  // Different hazard types have different risk profiles
  if (hazardType === 'FLOOD') {
    environmentalRisk = 90;
    obstructionRisk = 70;
    sensorConfidence = 65;
    terrainRisk = route.terrainRisk + 25;
  } else if (hazardType === 'FIRE') {
    environmentalRisk = 92;
    obstructionRisk = 50;
    sensorConfidence = 70;
    terrainRisk = route.terrainRisk + 15;
  } else if (hazardType === 'SMOKE') {
    environmentalRisk = 85;
    obstructionRisk = 40;
    sensorConfidence = 55;
    terrainRisk = route.terrainRisk + 10;
  } else if (hazardType === 'ROAD_BLOCK') {
    environmentalRisk = 50;
    obstructionRisk = 95;
    sensorConfidence = 88;
    terrainRisk = route.terrainRisk + 5;
  }

  const currentRisk = computeRisk({
    ...route,
    terrainRisk,
    obstructionRisk,
    environmentalRisk,
    sensorConfidence,
  });

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

export function selectBestRoute(routes: Route[], limit: number, excludeIds: string[] = []): string | null {
  const candidates = routes
    .filter(r => !excludeIds.includes(r.id) && r.currentRisk <= limit)
    .sort((a, b) => a.currentRisk - b.currentRisk);
  return candidates[0]?.id ?? null;
}

export function getAllHazardAffectedRoutes(hazard: Hazard, routes: Route[]): string[] {
  // In a real system, this would check spatial proximity
  // For the simulation, we'll affect the route the hazard is on
  return [hazard.affectedRouteId];
}

export function getPrimaryRiskFactor(breakdown: RiskBreakdown): string {
  const factors = [
    { name: 'Environmental', value: breakdown.environmentalRisk, weight: 0.35 },
    { name: 'Terrain', value: breakdown.terrainRisk, weight: 0.30 },
    { name: 'Obstruction', value: breakdown.obstructionRisk, weight: 0.25 },
    { name: 'Sensor Uncertainty', value: breakdown.sensorPenalty, weight: 0.10 },
  ];

  const weighted = factors.map(f => f.value * f.weight);
  const maxIndex = weighted.indexOf(Math.max(...weighted));
  return factors[maxIndex].name;
}
