// lib/ble.ts
import { toByteArray } from "base64-js";
import { BleManager } from "react-native-ble-plx";

export const manager = new BleManager();

export const SERVICE_UUID = "6f6b0001-8a3a-4e7f-a12d-3f6a9c0a0001";
export const DATA_UUID = "6f6b0002-8a3a-4e7f-a12d-3f6a9c0a0002";
export const CTRL_UUID = "6f6b0003-8a3a-4e7f-a12d-3f6a9c0a0003";
export const METRIC_UUID = "6f6b0004-8a3a-4e7f-a12d-3f6a9c0a0004";
export const TARGET_NAME = "BarbellIMU";

export type Sample = {
  t_ms: number;
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
};

export function parsePkt(b64: string): Sample | null {
  const b = toByteArray(b64);
  if (b.length < 16) return null;
  const u32 = (i: number) =>
    (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
  const i16 = (i: number) => {
    const v = (b[i] | (b[i + 1] << 8)) & 0xffff;
    return v & 0x8000 ? v - 0x10000 : v;
  };
  return {
    t_ms: u32(0),
    ax: i16(4),
    ay: i16(6),
    az: i16(8),
    gx: i16(10),
    gy: i16(12),
    gz: i16(14),
  };
}

// ---- Metrics
export type RepEvent = {
  rep: number;
  totalReps: number;
  durMs: number;
  meanVel_mmps: number;
  peakVel_mmps: number;
  meanAbsA_mg: number;
};

export type SetSummary = {
  totalReps: number;
  setDurMs: number;
  meanOfMeans_mmps: number;
  bestPeak_mmps: number;
  avgRepDurMs: number;
};

export type MetricMsg =
  | { type: "rep"; data: RepEvent }
  | { type: "summary"; data: SetSummary };

export function parseMetric(b64: string): MetricMsg | null {
  const b = toByteArray(b64);
  if (b.length < 4) return null;
  const u32 = (i: number) =>
    (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
  const i16 = (i: number) => {
    const v = (b[i] | (b[i + 1] << 8)) & 0xffff;
    return v & 0x8000 ? v - 0x10000 : v;
  };
  const u16 = (i: number) => (b[i] | (b[i + 1] << 8)) & 0xffff;

  const t = b[0];
  if (t === 0xa1 && b.length >= 16) {
    return {
      type: "rep",
      data: {
        rep: b[1],
        totalReps: b[2],
        durMs: u32(4),
        meanVel_mmps: i16(8),
        peakVel_mmps: i16(10),
        meanAbsA_mg: u16(12),
      },
    };
  }
  if (t === 0xa2 && b.length >= 16) {
    return {
      type: "summary",
      data: {
        totalReps: b[1],
        setDurMs: u32(4),
        meanOfMeans_mmps: i16(8),
        bestPeak_mmps: i16(10),
        avgRepDurMs: u16(12),
      },
    };
  }
  return null;
}
