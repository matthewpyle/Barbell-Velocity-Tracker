// app/(tabs)/train.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useBleContext } from "@/context/BleContext";
import { brzycki1RM, clamp, epley1RM } from "@/lib/strength";

const STORAGE_WEIGHT_KEY = "benchPressWeightKg";
const ACCESSORY_ID = "trainNumericDoneAccessory";

function estimateRirFromVelocityLossPct(lossPct: number): number {
  const x = clamp(lossPct, 0, 100);

  // Simple mapping (tune later)
  if (x < 5) return 5;
  if (x < 10) return 4;
  if (x < 15) return 3;
  if (x < 20) return 2;
  if (x < 30) return 1;
  return 0;
}

export default function TrainScreen() {
  const {
    connected,
    sample,
    active,
    summary,
    startSet,
    stopSet,
    currentSetRep,
    calibrating,
    calibrate,
  } = useBleContext();

  const [weightText, setWeightText] = useState<string>("");

  // Load persisted weight
  useEffect(() => {
    (async () => {
      try {
        const savedW = await AsyncStorage.getItem(STORAGE_WEIGHT_KEY);
        if (savedW != null) setWeightText(savedW);
      } catch {
        // ignore for MVP
      }
    })();
  }, []);

  // Persist weight
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_WEIGHT_KEY, weightText).catch(() => {});
  }, [weightText]);

  const weightKg = useMemo(() => {
    const n = parseFloat(weightText.replace(",", "."));
    return Number.isFinite(n) ? clamp(n, 0, 500) : 0;
  }, [weightText]);

  const currentVelocity = sample?.vZ ?? 0;

  // Prefer rep mean velocities, fall back to rep peaks
  const repVels = useMemo(() => {
    if (!summary) return null;
    const s: any = summary;

    const arr =
      (Array.isArray(s.repMeanConcentricVels) &&
      s.repMeanConcentricVels.length >= 2
        ? s.repMeanConcentricVels
        : null) ??
      (Array.isArray(s.repPeakConcentricVels) &&
      s.repPeakConcentricVels.length >= 2
        ? s.repPeakConcentricVels
        : null);

    if (!arr) return null;
    if (!arr.every((x: any) => typeof x === "number")) return null;
    return arr as number[];
  }, [summary]);

  const velocityDrop = useMemo(() => {
    if (!repVels) return null;

    const best = Math.max(...repVels);
    const last = repVels[repVels.length - 1];
    if (!(best > 0)) return null;

    const lossPct = ((best - last) / best) * 100;
    const rirEst = estimateRirFromVelocityLossPct(lossPct);

    return { best, last, lossPct, rirEst };
  }, [repVels]);

  const oneRM = useMemo(() => {
    if (!summary) return null;
    if (weightKg <= 0) return null;

    const reps = summary.totalReps ?? 0;
    if (reps <= 0) return null;

    const rirUsed = velocityDrop?.rirEst ?? 0;
    const repsForEstimate = reps + rirUsed;

    const epley = epley1RM(weightKg, repsForEstimate);
    const brzycki = brzycki1RM(weightKg, repsForEstimate);

    const candidates = [epley, brzycki].filter((x) => x > 0);
    const conservative = candidates.length ? Math.min(...candidates) : 0;

    return { reps, rirUsed, repsForEstimate, epley, brzycki, conservative };
  }, [summary, weightKg, velocityDrop?.rirEst]);

  if (!connected) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "700" }}>Train</Text>
        <Text style={{ marginBottom: 12 }}>
          No device connected. Go to the Device tab to connect.
        </Text>
        <Link href="/device">
          <Text style={{ color: "#2563eb", fontWeight: "500" }}>
            Go to Device
          </Text>
        </Link>
      </SafeAreaView>
    );
  }

  const canStartSet = !calibrating && !active;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View
            style={{
              marginBottom: 16,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 24, fontWeight: "700" }}>Train</Text>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "#22c55e",
              }}
            >
              <Text style={{ fontSize: 12, color: "#16a34a" }}>
                Connected: {connected.name ?? connected.id}
              </Text>
            </View>
          </View>

          {/* Status row */}
          <View
            style={{
              marginBottom: 12,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <View
              style={{
                flex: 1,
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: active ? "#dcfce7" : "#f1f5f9",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: active ? "#16a34a" : "#475569",
                }}
              >
                {active ? "Set active" : "Set idle"}
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: calibrating ? "#fef3c7" : "#f1f5f9",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: calibrating ? "#b45309" : "#475569",
                }}
              >
                {calibrating ? "Calibrating…" : "Calibrated"}
              </Text>
            </View>
          </View>

          {/* Bench settings */}
          <View
            style={{
              marginBottom: 12,
              padding: 12,
              borderWidth: 1,
              borderRadius: 16,
              borderColor: "#e2e8f0",
              backgroundColor: "#ffffff",
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700" }}>
              Bench press settings
            </Text>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, color: "#475569" }}>
                Load (kg) — total on the bar
              </Text>
              <TextInput
                value={weightText}
                onChangeText={setWeightText}
                keyboardType="decimal-pad"
                inputAccessoryViewID={
                  Platform.OS === "ios" ? ACCESSORY_ID : undefined
                }
                placeholder="e.g. 80"
                editable={!active}
                style={{
                  borderWidth: 1,
                  borderColor: "#e2e8f0",
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 16,
                  backgroundColor: active ? "#f8fafc" : "#ffffff",
                }}
              />
              <Text style={{ fontSize: 12, color: "#64748b" }}>
                Parsed: {weightKg.toFixed(1)} kg
              </Text>
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, color: "#475569" }}>
                Estimated RIR (from velocity drop-off)
              </Text>
              {velocityDrop ? (
                <Text style={{ fontSize: 14 }}>
                  RIR ≈ {velocityDrop.rirEst} (loss{" "}
                  {velocityDrop.lossPct.toFixed(0)}%, best{" "}
                  {velocityDrop.best.toFixed(2)} → last{" "}
                  {velocityDrop.last.toFixed(2)} m/s)
                </Text>
              ) : (
                <Text style={{ fontSize: 12, color: "#64748b" }}>
                  N/A — complete a set to compute velocity drop-off.
                </Text>
              )}
            </View>
          </View>

          {/* iOS Done button */}
          {Platform.OS === "ios" && (
            <InputAccessoryView nativeID={ACCESSORY_ID}>
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: "#f1f5f9",
                  borderTopWidth: 1,
                  borderTopColor: "#e2e8f0",
                  alignItems: "flex-end",
                }}
              >
                <Pressable onPress={() => Keyboard.dismiss()}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#2563eb",
                    }}
                  >
                    Done
                  </Text>
                </Pressable>
              </View>
            </InputAccessoryView>
          )}

          {/* Controls */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Calibrate"
                onPress={calibrate}
                disabled={calibrating || active}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={active ? "Stop Set" : "Start Set"}
                onPress={() => {
                  Keyboard.dismiss();
                  active ? stopSet() : startSet();
                }}
                disabled={!canStartSet && !active}
              />
            </View>
          </View>

          {calibrating && (
            <Text style={{ marginBottom: 12, fontSize: 12, color: "#b45309" }}>
              Calibrating gravity… keep the bar still in the start position.
            </Text>
          )}

          {/* Live set */}
          <View
            style={{
              marginTop: 8,
              padding: 20,
              borderWidth: 1,
              borderRadius: 16,
              borderColor: "#e2e8f0",
              backgroundColor: "#f8fafc",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 4 }}>
              Live set
            </Text>
            <Text style={{ fontSize: 40, fontWeight: "800", marginBottom: 4 }}>
              Rep {currentSetRep}
            </Text>
            <Text style={{ fontSize: 18 }}>
              Velocity: {currentVelocity.toFixed(2)} m/s
            </Text>
          </View>

          {/* Set summary */}
          <View
            style={{
              marginTop: 16,
              padding: 16,
              borderWidth: 1,
              borderRadius: 16,
              borderColor: "#e2e8f0",
              backgroundColor: "#ffffff",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>
              Set summary
            </Text>

            {summary ? (
              <View style={{ gap: 4 }}>
                <Text>Total reps: {summary.totalReps}</Text>
                <Text>
                  Set duration: {(summary.setDurMs / 1000).toFixed(1)} s
                </Text>
                <Text>
                  Mean concentric v: {summary.meanConcentricVel.toFixed(2)} m/s
                </Text>
                <Text>
                  Peak concentric v: {summary.peakConcentricVel.toFixed(2)} m/s
                </Text>

                {oneRM && oneRM.conservative > 0 ? (
                  <View style={{ marginTop: 10, gap: 4 }}>
                    <Text style={{ fontWeight: "700" }}>Predicted 1RM</Text>
                    <Text>
                      Using reps for estimate: {oneRM.repsForEstimate}{" "}
                      {oneRM.rirUsed > 0
                        ? `(reps + est. RIR ${oneRM.rirUsed})`
                        : `(reps)`}
                    </Text>
                    <Text>Epley: {oneRM.epley.toFixed(1)} kg</Text>
                    <Text>Brzycki: {oneRM.brzycki.toFixed(1)} kg</Text>
                    <Text style={{ fontWeight: "700" }}>
                      Conservative: {oneRM.conservative.toFixed(1)} kg
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}
                  >
                    Enter a load (kg) to calculate predicted 1RM.
                  </Text>
                )}
              </View>
            ) : (
              <Text style={{ marginTop: 4, color: "#94a3b8" }}>
                No completed set yet.
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
