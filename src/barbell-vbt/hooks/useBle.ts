// hooks/useBle.ts
import { fromByteArray } from "base64-js";
import { useEffect, useRef, useState } from "react";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import { Device, Subscription } from "react-native-ble-plx";
import {
  CTRL_UUID,
  DATA_UUID,
  manager,
  METRIC_UUID,
  parseMetric,
  parsePkt,
  RepEvent,
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
  const [repEvents, setRepEvents] = useState<RepEvent[]>([]);
  const [summary, setSummary] = useState<SetSummary | null>(null);

  const subs = useRef<Subscription[]>([]);

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
    setRepEvents([]);
    setSummary(null);

    const d = await dev.connect();
    setConnected(d);
    await d.discoverAllServicesAndCharacteristics();

    // RAW data notifications (only while ACTIVE)
    subs.current.push(
      d.monitorCharacteristicForService(
        SERVICE_UUID,
        DATA_UUID,
        (error, ch) => {
          if (error || !ch?.value) return;
          const s = parsePkt(ch.value);
          if (s) setSample(s);
        }
      )
    );

    // METRICS notifications (rep events + summary)
    subs.current.push(
      d.monitorCharacteristicForService(
        SERVICE_UUID,
        METRIC_UUID,
        (error, ch) => {
          if (error || !ch?.value) return;
          const msg = parseMetric(ch.value);
          if (!msg) return;
          if (msg.type === "rep") {
            setRepEvents((prev) => [msg.data, ...prev].slice(0, 50)); // keep last 50
          } else if (msg.type === "summary") {
            setSummary(msg.data);
            setActive(false);
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
    setRepEvents([]);
    setSummary(null);
  };

  const writeCtrl = async (bytes: number[], withResponse = false) => {
    if (!connected) return;
    const b64 = fromByteArray(Uint8Array.from(bytes));
    if (withResponse) {
      await connected.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CTRL_UUID,
        b64
      );
    } else {
      await connected.writeCharacteristicWithoutResponseForService(
        SERVICE_UUID,
        CTRL_UUID,
        b64
      );
    }
  };

  const startSet = async () => {
    await writeCtrl([0x01], false);
    setActive(true);
    setRepEvents([]);
    setSummary(null);
  };
  const stopSet = async () => {
    await writeCtrl([0x02], false); /* summary will arrive via notify */
  };

  return {
    devices,
    connected,
    sample,
    active,
    repEvents,
    summary,
    scan,
    connect,
    disconnect,
    startSet,
    stopSet,
  };
}
