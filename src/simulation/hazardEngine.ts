// Hazard Detection Engine
// Simulates the perception and detection pipeline

import type { Hazard, HazardType } from './types';

export interface DetectionResult {
  detected: boolean;
  hazardType: HazardType;
  confidence: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  bboxRegion: string;
  detectionLatency: number; // ms
}

export interface TerrainAnalysis {
  slope: number;         // degrees
  elevation: number;     // meters
  stability: 'STABLE' | 'UNSTABLE' | 'CRITICAL';
  landslideRisk: number; // 0-100
  surfaceCondition: string;
}

export const HAZARD_CONFIGS: Record<HazardType, {
  name: string;
  icon: string;
  yoloObject: string;
  defaultConfidence: number;
  terrainImpact: Partial<TerrainAnalysis>;
  riskMultiplier: number;
}> = {
  LANDSLIDE: {
    name: 'Landslide',
    icon: '⛰',
    yoloObject: 'Terrain Obstruction',
    defaultConfidence: 94,
    terrainImpact: {
      slope: 38,
      elevation: 742,
      stability: 'CRITICAL',
      landslideRisk: 91,
      surfaceCondition: 'Unstable - High Risk',
    },
    riskMultiplier: 1.2,
  },
  ROAD_BLOCK: {
    name: 'Road Blockage',
    icon: '🚧',
    yoloObject: 'Road Obstruction',
    defaultConfidence: 96,
    terrainImpact: {
      stability: 'UNSTABLE',
      landslideRisk: 45,
      surfaceCondition: 'Blocked - Impassable',
    },
    riskMultiplier: 1.1,
  },
  FIRE: {
    name: 'Fire Zone',
    icon: '🔥',
    yoloObject: 'Fire/Smoke',
    defaultConfidence: 93,
    terrainImpact: {
      stability: 'UNSTABLE',
      landslideRisk: 35,
      surfaceCondition: 'Fire Zone - Extreme Heat',
    },
    riskMultiplier: 1.15,
  },
  FLOOD: {
    name: 'Flood',
    icon: '💧',
    yoloObject: 'Water/Flood Zone',
    defaultConfidence: 92,
    terrainImpact: {
      slope: 15,
      stability: 'UNSTABLE',
      landslideRisk: 72,
      surfaceCondition: 'Waterlogged - Unstable',
    },
    riskMultiplier: 1.18,
  },
  SMOKE: {
    name: 'Smoke Zone',
    icon: '💨',
    yoloObject: 'Smoke/Obscuration',
    defaultConfidence: 78,
    terrainImpact: {
      stability: 'STABLE',
      landslideRisk: 20,
      surfaceCondition: 'Reduced Visibility',
    },
    riskMultiplier: 0.95,
  },
  OBSTACLE: {
    name: 'Obstacle',
    icon: '⬛',
    yoloObject: 'Object/Obstacle',
    defaultConfidence: 91,
    terrainImpact: {
      stability: 'STABLE',
      landslideRisk: 10,
      surfaceCondition: 'Path Obstructed',
    },
    riskMultiplier: 1.05,
  },
  UNSTABLE_TERRAIN: {
    name: 'Unstable Terrain',
    icon: '🌍',
    yoloObject: 'Terrain Degradation',
    defaultConfidence: 87,
    terrainImpact: {
      slope: 35,
      stability: 'UNSTABLE',
      landslideRisk: 68,
      surfaceCondition: 'Degraded Surface',
    },
    riskMultiplier: 1.12,
  },
  DAMAGED_ROAD: {
    name: 'Damaged Road',
    icon: '⚠',
    yoloObject: 'Road Damage',
    defaultConfidence: 89,
    terrainImpact: {
      stability: 'UNSTABLE',
      landslideRisk: 30,
      surfaceCondition: 'Severe Pavement Damage',
    },
    riskMultiplier: 1.08,
  },
};

export const DEFAULT_TERRAIN: TerrainAnalysis = {
  slope: 12,
  elevation: 420,
  stability: 'STABLE',
  landslideRisk: 14,
  surfaceCondition: 'Normal - Good',
};

export function simulateDetection(hazardType: HazardType): DetectionResult {
  const config = HAZARD_CONFIGS[hazardType];
  const confidence = config.defaultConfidence + (Math.random() - 0.5) * 4;

  return {
    detected: true,
    hazardType,
    confidence: Math.min(100, Math.max(0, Math.round(confidence * 10) / 10)),
    severity: 'CRITICAL',
    bboxRegion: `Route-A / Node-A3`,
    detectionLatency: 150 + Math.random() * 100, // 150-250ms
  };
}

export function getTerrainAnalysis(hazardType: HazardType | null): TerrainAnalysis {
  if (!hazardType) return DEFAULT_TERRAIN;

  const config = HAZARD_CONFIGS[hazardType];
  return {
    ...DEFAULT_TERRAIN,
    ...config.terrainImpact,
  } as TerrainAnalysis;
}

export function getHazardName(type: HazardType): string {
  return HAZARD_CONFIGS[type].name;
}

export function getHazardIcon(type: HazardType): string {
  return HAZARD_CONFIGS[type].icon;
}

export function getYoloObject(type: HazardType): string {
  return HAZARD_CONFIGS[type].yoloObject;
}
