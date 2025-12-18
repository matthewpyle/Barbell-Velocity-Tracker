// src/hooks/useBle.ts
import { useEffect, useRef, useState } from "react";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import { Device, Subscription } from "react-native-ble-plx";
import {
  DATA_UUID,
  SERVICE_UUID,
  CONTROL_UUID,
  TARGET_NAME,
  manager,
  parsePkt,
  Sample,
  SetSummary,
} from "../lib/ble";
import { fromByteArray } from "base64-js"; // if you're already using toByteArray, this is from same lib

async function ensureBlePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  const wanted =
    Platform.Version >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const res = await PermissionsAndroid.requestMultiple(wanted);
  return Object.values(res).every(
    (v) => v === PermissionsAndroid.RESULTS.GRANTED
  );
}

export function useBle() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [connected, setConnected] = useState<Device | null>(null);
  const [sample, setSample] = useState<Sample | null>(null);

  const [active, setActive] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [summary, setSummary] = useState<SetSummary | null>(null);

  // "Is recording" flag usable inside BLE callback
  const activeRef = useRef(false);

  // Track current connected device for control writes
  const connectedRef = useRef<Device | null>(null);

  // Global rep offset at the start of a set
  const startRepRef = useRef(0);

  // Rep number within the current set (what the UI should show)
  const [currentSetRep, setCurrentSetRep] = useState(0);

  const subs = useRef<Subscription[]>([]);

  // Cleanup on unmount / app bg
  useEffect(() => {
    const appSub = AppState.addEventListener("change", (s) => {
      if (s !== "active") manager.stopDeviceScan();
    });
    return () => {
      manager.stopDeviceScan();
      subs.current.forEach((s) => s?.remove());
      subs.current = [];
      manager.destroy();
      appSub.remove();
    };
  }, []);

  const scan = async () => {
    if (!(await ensureBlePermissions())) return;

    setDevices([]);
    manager.startDeviceScan(null, { allowDuplicates: false }, (err, dev) => {
      if (err || !dev) return;
      const name = dev.name || dev.localName;
      if (name === TARGET_NAME) {
        setDevices((prev) =>
          prev.find((d) => d.id === dev.id) ? prev : [...prev, dev]
        );
      }
    });

    setTimeout(() => manager.stopDeviceScan(), 6000);
  };

  const connect = async (dev: Device) => {
    manager.stopDeviceScan();
    subs.current.forEach((s) => s?.remove());
    subs.current = [];

    setSample(null);
    setActive(false);
    setCalibrating(false);
    setSamples([]);
    setSummary(null);
    activeRef.current = false;
    startRepRef.current = 0;
    setCurrentSetRep(0);

    const d = await dev.connect();
    await d.discoverAllServicesAndCharacteristics();

    setConnected(d);
    connectedRef.current = d;

    // Data stream: t_ms,aZ_filt,vZ,rep_id[,calibFlag]
    subs.current.push(
      d.monitorCharacteristicForService(
        SERVICE_UUID,
        DATA_UUID,
        (error, ch) => {
          if (error || !ch?.value) return;

          const s = parsePkt(ch.value);
          if (!s) return;

          setSample(s);
          setCalibrating(s.calibFlag === 1);

          if (activeRef.current) {
            setSamples((prev) => [...prev, s]);

            // Rep number within this set: global rep minus starting offset
            const repWithinSet = Math.max(0, s.repId - startRepRef.current);
            setCurrentSetRep(repWithinSet);
          }
        }
      )
    );
  };

  const disconnect = async () => {
    try {
      subs.current.forEach((s) => s?.remove());
      subs.current = [];
      if (connected) await connected.cancelConnection();
    } catch {}

    setConnected(null);
    connectedRef.current = null;

    setSample(null);
    setActive(false);
    setCalibrating(false);
    setSamples([]);
    setSummary(null);
    activeRef.current = false;
    startRepRef.current = 0;
    setCurrentSetRep(0);
  };

  const startSet = () => {
    // Don't allow starting a set while calibrating
    if (calibrating) return;

    activeRef.current = true;
    setActive(true);

    // Remember the global rep id at start of set
    startRepRef.current = sample?.repId ?? 0;
    setCurrentSetRep(0);

    setSamples([]);
    setSummary(null);
  };

  const stopSet = () => {
    activeRef.current = false;
    setActive(false);

    if (!samples.length) {
      setSummary(null);
      setCurrentSetRep(0);
      return;
    }

    const firstT = samples[0].tMs;
    const lastT = samples[samples.length - 1].tMs;
    const setDurMs = lastT - firstT;

    // Build map of repWithinSet -> list of concentric velocities
    const repMap = new Map<number, number[]>();

    for (const s of samples) {
      const repWithinSet = s.repId - startRepRef.current;
      if (repWithinSet <= 0) continue; // ignore "rep 0" / anything before start
      if (s.vZ <= 0) continue; // concentric only

      if (!repMap.has(repWithinSet)) {
        repMap.set(repWithinSet, []);
      }
      repMap.get(repWithinSet)!.push(s.vZ);
    }

    const repIdsWithin = Array.from(repMap.keys()).sort((a, b) => a - b);
    const totalReps = repIdsWithin.length;

    let peakConcentricVel = 0;
    const perRepMeans: number[] = [];

    for (const repIdWithin of repIdsWithin) {
      const vels = repMap.get(repIdWithin)!;
      if (!vels.length) continue;

      const mean =
        vels.reduce((acc, v) => acc + v, 0) / Math.max(vels.length, 1);
      perRepMeans.push(mean);

      const peak = Math.max(...vels);
      if (peak > peakConcentricVel) peakConcentricVel = peak;
    }

    const meanConcentricVel =
      perRepMeans.length > 0
        ? perRepMeans.reduce((a, b) => a + b, 0) / perRepMeans.length
        : 0;

    const summary: SetSummary = {
      totalReps,
      setDurMs,
      meanConcentricVel,
      peakConcentricVel,
    };

    setSummary(summary);
    // optional: leave currentSetRep showing last rep, or reset to 0
    // setCurrentSetRep(0);
  };

  // Send "start calibration" command to firmware via control characteristic
  const calibrate = async () => {
    const dev = connectedRef.current;
    if (!dev) return;

    try {
      // Command protocol: single byte 0x01 = start calibration
      const cmdBytes = Uint8Array.of(0x01);
      const base64 = fromByteArray(cmdBytes);

      await dev.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CONTROL_UUID,
        base64
      );

      // Optimistically set calibrating until data comes back with calibFlag=1/0
      setCalibrating(true);
    } catch (e) {
      console.warn("BLE calibrate() error", e);
    }
  };

  return {
    devices,
    connected,
    sample,
    active,
    summary,
    scan,
    connect,
    disconnect,
    startSet,
    stopSet,
    currentSetRep, // used by the UI for "Rep N"
    calibrating, // used to show "Calibrating..." and disable Start Set
    calibrate, // call from a button in the app
  };
}
