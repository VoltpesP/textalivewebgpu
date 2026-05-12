export type Vec3 = [number, number, number];

export interface DirectionalLight {
  type: 'directional';
  /** Unit vector FROM light TOWARD scene (beam direction). */
  direction: Vec3;
  color: Vec3;
  intensity: number;
  enabled: boolean;
}

export interface SunLight {
  type: 'sun';
  /** Unit vector FROM sun TOWARD scene. Low elevation gives warm tint. */
  direction: Vec3;
  color: Vec3;
  intensity: number;
  enabled: boolean;
}

export interface SpotLight {
  type: 'spot';
  position: Vec3;
  /** Unit vector FROM spot TOWARD scene (cone axis). */
  direction: Vec3;
  innerAngleDeg: number;
  outerAngleDeg: number;
  range: number;
  color: Vec3;
  intensity: number;
  enabled: boolean;
}

export type LightDescriptor = DirectionalLight | SunLight | SpotLight;
