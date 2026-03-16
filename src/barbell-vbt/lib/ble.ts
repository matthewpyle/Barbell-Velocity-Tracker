// src/lib/ble.ts
import { BleManager } from "react-native-ble-plx";
import { toByteArray } from "base64-js";

export const manager = new BleManager();

// Match your ESP32 firmware
export const TARGET_NAME = "BarbellIMU";
export const SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
export const DATA_UUID = "abcd1234-1234-1234-1234-1234567890ab";
export const CONTROL_UUID = "deadbeef-1234-1234-1234-1234567890ab";

// What we actually get from the ESP32 over BLE
export type Sample = {
  tMs: number; // milliseconds
  aZ: number; // filtered vertical accel (m/s^2)
  vZ: number; // vertical velocity (m/s)
  repId: number; // rep counter
  calibFlag: number; // calibration flag
};

/**
 * Parse a BLE notification payload (base64-encoded CSV from ESP32)
 * Format: "<t_ms>,<aZ_filt>,<vZ>,<rep_id>"
 */
export function parsePkt(base64Value: string): Sample | null {
  try {
    const bytes = toByteArray(base64Value);
    const text = String.fromCharCode(...bytes).trim();

    const parts = text.split(",");
    if (parts.length < 4) {
      return null; // malformed packet
    }

    const [tStr, aStr, vStr, repStr, calibStr] = parts;

    const tMs = Number(tStr);
    const aZ = Number(aStr);
    const vZ = Number(vStr);
    const repId = Number(repStr);

    if ([tMs, aZ, vZ, repId].some((v) => Number.isNaN(v))) {
      return null;
    }

    // 5th field is optional; default to 0 if not present
    const calibFlag = calibStr !== undefined ? Number(calibStr) : 0;
    const safeCalibFlag = Number.isNaN(calibFlag) ? 0 : calibFlag;

    return { tMs, aZ, vZ, repId, calibFlag: safeCalibFlag };
  } catch {
    return null;
  }
}

/**
 * Simple set summary computed on the app:
 * - total reps
 * - set duration
 * - mean & peak concentric velocity
 */
export type SetSummary = {
  totalReps: number;
  setDurMs: number;
  meanConcentricVel: number; // m/s
  peakConcentricVel: number; // m/s

  repMeanConcentricVels: number[]; // per rep mean concentric v
  repPeakConcentricVels: number[]; // per rep peak concentric v
};
