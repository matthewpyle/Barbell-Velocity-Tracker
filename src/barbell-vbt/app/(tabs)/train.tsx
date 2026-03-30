// app/(tabs)/train.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useBleContext } from "@/context/BleContext";
import { brzycki1RM, clamp, epley1RM } from "@/lib/strength";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

const STORAGE_WEIGHT_KEY = "benchPressWeightKg";
const ACCESSORY_ID = "trainNumericDoneAccessory";

function estimateRirFromVelocityLossPct(lossPct: number): number {
  const x = clamp(lossPct, 0, 100);

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

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "dark"];
  const styles = getStyles(theme);

  const [weightText, setWeightText] = useState("");

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

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_WEIGHT_KEY, weightText).catch(() => {});
  }, [weightText]);

  const weightKg = useMemo(() => {
    const n = parseFloat(weightText.replace(",", "."));
    return Number.isFinite(n) ? clamp(n, 0, 500) : 0;
  }, [weightText]);

  const currentVelocity = sample?.vZ ?? 0;

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

  const canStartSet = !calibrating && !active;
  const canCalibrate = !calibrating && !active;
  const canToggleSet = !calibrating;

  if (!connected) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.disconnectedWrap}>
          <Text style={styles.screenTitle}>Train</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>No device connected</Text>
            <Text style={styles.cardBody}>
              Go to the Device tab and connect your LiftIQ clip before starting
              a session.
            </Text>

            <Link href="/device" asChild>
              <Pressable style={({ pressed }) => [pressed && styles.pressed]}>
                <Text style={styles.secondaryLink}>Go to Device</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.screenTitle}>Train</Text>
              <Text style={styles.screenSubtitle}>
                Live velocity tracking for your current set
              </Text>
            </View>

            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>
                {connected.name ?? connected.id}
              </Text>
            </View>
          </View>

          <View style={styles.pillRow}>
            <View
              style={[
                styles.pill,
                active ? styles.pillSuccessBg : styles.pillNeutralBg,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  active ? styles.pillSuccessText : styles.pillNeutralText,
                ]}
              >
                {active ? "Set active" : "Set idle"}
              </Text>
            </View>

            <View
              style={[
                styles.pill,
                calibrating ? styles.pillWarningBg : styles.pillNeutralBg,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  calibrating ? styles.pillWarningText : styles.pillNeutralText,
                ]}
              >
                {calibrating ? "Calibrating…" : "Calibrated"}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bench press settings</Text>

            <Text style={styles.fieldLabel}>Load (kg) — total on the bar</Text>
            <TextInput
              value={weightText}
              onChangeText={setWeightText}
              keyboardType="decimal-pad"
              inputAccessoryViewID={
                Platform.OS === "ios" ? ACCESSORY_ID : undefined
              }
              placeholder="e.g. 80"
              placeholderTextColor={theme.muted}
              editable={!active}
              style={[styles.input, active && styles.inputDisabled]}
            />
            <Text style={styles.helperText}>
              Parsed: {weightKg.toFixed(1)} kg
            </Text>

            <View style={styles.metricBlock}>
              <Text style={styles.fieldLabel}>
                Estimated RIR (from velocity drop-off)
              </Text>
              {velocityDrop ? (
                <Text style={styles.metricText}>
                  RIR ≈ {velocityDrop.rirEst} (loss{" "}
                  {velocityDrop.lossPct.toFixed(0)}%, best{" "}
                  {velocityDrop.best.toFixed(2)} → last{" "}
                  {velocityDrop.last.toFixed(2)} m/s)
                </Text>
              ) : (
                <Text style={styles.helperText}>
                  N/A — complete a set to compute velocity drop-off.
                </Text>
              )}
            </View>
          </View>

          {Platform.OS === "ios" && (
            <InputAccessoryView nativeID={ACCESSORY_ID}>
              <View style={styles.accessoryBar}>
                <Pressable onPress={() => Keyboard.dismiss()}>
                  <Text style={styles.accessoryDone}>Done</Text>
                </Pressable>
              </View>
            </InputAccessoryView>
          )}

          <View style={styles.controlsRow}>
            <Pressable
              onPress={calibrate}
              disabled={!canCalibrate}
              style={({ pressed }) => [
                styles.controlButton,
                styles.controlButtonSecondary,
                !canCalibrate && styles.controlButtonDisabled,
                pressed && canCalibrate && styles.pressed,
              ]}
            >
              <Text style={styles.controlButtonSecondaryText}>Calibrate</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                active ? stopSet() : startSet();
              }}
              disabled={!canToggleSet}
              style={({ pressed }) => [
                styles.controlButton,
                active
                  ? styles.controlButtonDanger
                  : styles.controlButtonPrimary,
                !canToggleSet && styles.controlButtonDisabled,
                pressed && canToggleSet && styles.pressed,
              ]}
            >
              <Text style={styles.controlButtonPrimaryText}>
                {active ? "Stop Set" : "Start Set"}
              </Text>
            </Pressable>
          </View>

          {calibrating && (
            <Text style={styles.warningText}>
              Calibrating gravity… keep the bar still in the start position.
            </Text>
          )}

          <View style={[styles.card, styles.liveCard]}>
            <Text style={styles.liveLabel}>Live set</Text>
            <Text style={styles.liveRep}>Rep {currentSetRep}</Text>
            <Text style={styles.liveVelocity}>
              Velocity: {currentVelocity.toFixed(2)} m/s
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Set summary</Text>

            {summary ? (
              <View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total reps</Text>
                  <Text style={styles.summaryValue}>{summary.totalReps}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Set duration</Text>
                  <Text style={styles.summaryValue}>
                    {(summary.setDurMs / 1000).toFixed(1)} s
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Mean concentric v</Text>
                  <Text style={styles.summaryValue}>
                    {summary.meanConcentricVel.toFixed(2)} m/s
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Peak concentric v</Text>
                  <Text style={styles.summaryValue}>
                    {summary.peakConcentricVel.toFixed(2)} m/s
                  </Text>
                </View>

                {oneRM && oneRM.conservative > 0 ? (
                  <View style={styles.predictionBlock}>
                    <Text style={styles.predictionTitle}>Predicted 1RM</Text>

                    <Text style={styles.predictionText}>
                      Using reps for estimate: {oneRM.repsForEstimate}{" "}
                      {oneRM.rirUsed > 0
                        ? `(reps + est. RIR ${oneRM.rirUsed})`
                        : `(reps)`}
                    </Text>
                    <Text style={styles.predictionText}>
                      Epley: {oneRM.epley.toFixed(1)} kg
                    </Text>
                    <Text style={styles.predictionText}>
                      Brzycki: {oneRM.brzycki.toFixed(1)} kg
                    </Text>
                    <Text style={styles.predictionStrong}>
                      Conservative: {oneRM.conservative.toFixed(1)} kg
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.helperText}>
                    Enter a load (kg) to calculate predicted 1RM.
                  </Text>
                )}
              </View>
            ) : (
              <Text style={styles.emptyText}>No completed set yet.</Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getStyles(theme: (typeof Colors)["dark"]) {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    disconnectedWrap: {
      flex: 1,
      padding: 20,
    },
    header: {
      marginBottom: 18,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    screenTitle: {
      fontSize: 30,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 6,
    },
    screenSubtitle: {
      fontSize: 14,
      color: theme.subtext,
    },
    headerBadge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    headerBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.success,
    },
    pillRow: {
      flexDirection: "row",
      marginBottom: 16,
    },
    pill: {
      flex: 1,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginRight: 8,
    },
    pillSuccessBg: {
      backgroundColor: "rgba(124, 255, 178, 0.12)",
    },
    pillWarningBg: {
      backgroundColor: "rgba(245, 158, 11, 0.16)",
    },
    pillNeutralBg: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pillText: {
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center",
    },
    pillSuccessText: {
      color: theme.success,
    },
    pillWarningText: {
      color: "#f59e0b",
    },
    pillNeutralText: {
      color: theme.muted,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 14,
    },
    cardBody: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.subtext,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.muted,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.text,
      backgroundColor: theme.background,
      marginBottom: 8,
    },
    inputDisabled: {
      opacity: 0.65,
    },
    helperText: {
      fontSize: 12,
      color: theme.muted,
      lineHeight: 18,
    },
    metricBlock: {
      marginTop: 14,
    },
    metricText: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.text,
    },
    accessoryBar: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      alignItems: "flex-end",
    },
    accessoryDone: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.primary,
    },
    controlsRow: {
      flexDirection: "row",
      marginBottom: 12,
    },
    controlButton: {
      flex: 1,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    controlButtonPrimary: {
      backgroundColor: theme.primary,
      marginLeft: 6,
    },
    controlButtonDanger: {
      backgroundColor: theme.danger,
      marginLeft: 6,
    },
    controlButtonSecondary: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      marginRight: 6,
    },
    controlButtonDisabled: {
      opacity: 0.45,
    },
    controlButtonPrimaryText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    controlButtonSecondaryText: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.text,
    },
    warningText: {
      marginBottom: 12,
      fontSize: 12,
      color: "#f59e0b",
    },
    liveCard: {
      alignItems: "center",
      paddingVertical: 24,
    },
    liveLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.subtext,
      marginBottom: 6,
    },
    liveRep: {
      fontSize: 42,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 6,
    },
    liveVelocity: {
      fontSize: 18,
      color: theme.text,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 6,
    },
    summaryLabel: {
      fontSize: 14,
      color: theme.subtext,
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
    },
    predictionBlock: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    predictionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 8,
    },
    predictionText: {
      fontSize: 14,
      color: theme.subtext,
      marginBottom: 4,
    },
    predictionStrong: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.text,
      marginTop: 4,
    },
    emptyText: {
      fontSize: 14,
      color: theme.muted,
    },
    secondaryLink: {
      marginTop: 14,
      fontSize: 14,
      fontWeight: "700",
      color: theme.primary,
    },
    pressed: {
      opacity: 0.85,
    },
  });
}
