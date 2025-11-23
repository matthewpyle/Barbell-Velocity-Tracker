// src/hooks/useBle.ts
import { useEffect, useRef, useState } from "react";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import { Device, Subscription } from "react-native-ble-plx";
import {
  DATA_UUID,
  manager,
  parsePkt,
  Sample,
  SERVICE_UUID,
  SetSummary,
  TARGET_NAME,
} from "../lib/ble";

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
  const [samples, setSamples] = useState<Sample[]>([]);
  const [summary, setSummary] = useState<SetSummary | null>(null);
  const activeRef = useRef(false);

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
    setSamples([]);
    setSummary(null);

    const d = await dev.connect();
    setConnected(d);
    await d.discoverAllServicesAndCharacteristics();

    // Single data stream: t_ms,aZ_filt,vZ,rep_id
    subs.current.push(
      d.monitorCharacteristicForService(
        SERVICE_UUID,
        DATA_UUID,
        (error, ch) => {
          if (error || !ch?.value) return;
          const s = parsePkt(ch.value);
          if (!s) return;

          setSample(s);

          if (activeRef.current) {
            setSamples((prev) => [...prev, s]);
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
    setSample(null);
    setActive(false);
    setSamples([]);
    setSummary(null);
  };

  const startSet = () => {
    activeRef.current = true;
    setActive(true);
    setSamples([]);
    setSummary(null);
  };

  const stopSet = () => {
    activeRef.current = false;
    setActive(false);

    if (!samples.length) {
      setSummary(null);
      return;
    }

    const firstT = samples[0].tMs;
    const lastT = samples[samples.length - 1].tMs;
    const setDurMs = lastT - firstT;

    // Unique repIds > 0
    const repIds = Array.from(
      new Set(samples.map((s) => s.repId).filter((r) => r > 0))
    );
    const totalReps = repIds.length;

    let peakConcentricVel = 0;
    const perRepMeans: number[] = [];

    repIds.forEach((repId) => {
      const thisRep = samples.filter(
        (s) => s.repId === repId && s.vZ > 0 // concentric only
      );
      if (!thisRep.length) return;

      const vels = thisRep.map((s) => s.vZ);
      const mean =
        vels.reduce((acc, v) => acc + v, 0) / Math.max(vels.length, 1);
      perRepMeans.push(mean);

      const peak = Math.max(...vels);
      if (peak > peakConcentricVel) peakConcentricVel = peak;
    });

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
  };
}
