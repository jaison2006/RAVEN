// Sensor Fusion Engine
// Simulates multiple sensor inputs and confidence levels

export interface SensorReading {
  camera: number;      // 0-100
  gps: number;         // 0-100
  imu: number;         // Inertial measurement unit 0-100
  terrain: number;     // Terrain sensors 0-100
  mesh: number;        // Mesh network reports 0-100
}

export interface SensorFusionState {
  current: SensorReading;
  overall: number;     // 0-100
  trend: 'improving' | 'stable' | 'degrading';
}

const INITIAL_READINGS: SensorReading = {
  camera: 94,
  gps: 99,
  imu: 97,
  terrain: 88,
  mesh: 91,
};

export function initializeSensorState(): SensorFusionState {
  return {
    current: { ...INITIAL_READINGS },
    overall: computeOverallConfidence(INITIAL_READINGS),
    trend: 'stable',
  };
}

export function computeOverallConfidence(readings: SensorReading): number {
  // Weighted average of sensor confidences
  const weights = {
    camera: 0.25,
    gps: 0.20,
    imu: 0.20,
    terrain: 0.20,
    mesh: 0.15,
  };

  const overall = Math.round(
    readings.camera * weights.camera +
    readings.gps * weights.gps +
    readings.imu * weights.imu +
    readings.terrain * weights.terrain +
    readings.mesh * weights.mesh
  );

  return Math.min(100, Math.max(0, overall));
}

export function degradeSensor(sensor: keyof SensorReading, amount: number = 15): (readings: SensorReading) => SensorReading {
  return (readings: SensorReading) => ({
    ...readings,
    [sensor]: Math.max(0, readings[sensor] - amount),
  });
}

export function upgradeSensor(sensor: keyof SensorReading, amount: number = 10): (readings: SensorReading) => SensorReading {
  return (readings: SensorReading) => ({
    ...readings,
    [sensor]: Math.min(100, readings[sensor] + amount),
  });
}

export function addNoise(readings: SensorReading, amount: number = 5): SensorReading {
  const noise = () => (Math.random() - 0.5) * amount * 2;
  return {
    camera: Math.max(0, Math.min(100, readings.camera + noise())),
    gps: Math.max(0, Math.min(100, readings.gps + noise())),
    imu: Math.max(0, Math.min(100, readings.imu + noise())),
    terrain: Math.max(0, Math.min(100, readings.terrain + noise())),
    mesh: Math.max(0, Math.min(100, readings.mesh + noise())),
  };
}

export function getTrendDescription(current: number, previous: number): 'improving' | 'stable' | 'degrading' {
  const diff = current - previous;
  if (diff > 2) return 'improving';
  if (diff < -2) return 'degrading';
  return 'stable';
}

export function getConfidenceStatus(confidence: number): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' {
  if (confidence >= 90) return 'EXCELLENT';
  if (confidence >= 75) return 'GOOD';
  if (confidence >= 50) return 'FAIR';
  return 'POOR';
}
