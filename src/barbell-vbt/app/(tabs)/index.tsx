// app/(tabs)/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useBleContext } from "@/context/BleContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { brzycki1RM, clamp, epley1RM } from "@/lib/strength";

const STORAGE_WEIGHT_KEY = "benchPressWeightKg";

function estimateRirFromVelocityLossPct(lossPct: number): number {
  const x = clamp(lossPct, 0, 100);

  if (x < 5) return 5;
  if (x < 10) return 4;
  if (x < 15) return 3;
  if (x < 20) return 2;
  if (x < 30) return 1;
  return 0;
}

export default function HomeScreen() {
  const { connected, summary } = useBleContext();
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
        // ignore
      }
    })();
  }, []);

  const deviceName = connected?.name ?? connected?.id ?? "No device connected";

  const handleStart = () => {
    if (connected) {
      router.push("/train");
    } else {
      router.push("/device");
    }
  };

  const weightKg = useMemo(() => {
    const n = parseFloat(weightText.replace(",", "."));
    return Number.isFinite(n) ? clamp(n, 0, 500) : 0;
  }, [weightText]);

  const repVels = useMemo(() => {
    if (!summary) return null;
    const s: any = summary;

    const arr =
      (Array.isArray(s.repMeanConcentricVels) &&
      s.repMeanConcentricVels.length >= 1
        ? s.repMeanConcentricVels
        : null) ??
      (Array.isArray(s.repPeakConcentricVels) &&
      s.repPeakConcentricVels.length >= 1
        ? s.repPeakConcentricVels
        : null);

    if (!arr) return null;
    if (!arr.every((x: any) => typeof x === "number")) return null;
    return arr as number[];
  }, [summary]);

  const velocityDrop = useMemo(() => {
    if (!repVels || repVels.length < 2) return null;

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
    return candidates.length ? Math.min(...candidates) : null;
  }, [summary, weightKg, velocityDrop?.rirEst]);

  const lastSetReps = summary?.totalReps ?? null;
  const lastSetMeanVel = summary?.meanConcentricVel ?? null;
  const lastSetPeakVel =
    repVels && repVels.length > 0
      ? Math.max(...repVels)
      : (summary?.peakConcentricVel ?? null);

  const formatNumber = (value: number | null, digits = 2) =>
    value != null ? value.toFixed(digits) : "--";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>LiftIQ</Text>
          <Text style={styles.subtitle}>
            Velocity-based training for every rep
          </Text>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.sectionEyebrow}>DEVICE</Text>
              <Text
                style={[
                  styles.statusText,
                  connected ? styles.connectedText : styles.disconnectedText,
                ]}
              >
                {connected ? "Connected" : "Not connected"}
              </Text>
            </View>

            <View
              style={[
                styles.badge,
                connected ? styles.badgeConnected : styles.badgeDisconnected,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  connected
                    ? styles.badgeTextConnected
                    : styles.badgeTextDisconnected,
                ]}
              >
                {connected ? "READY" : "OFFLINE"}
              </Text>
            </View>
          </View>

          <Text style={styles.deviceName}>{deviceName}</Text>

          <Text style={styles.description}>
            {connected
              ? "Your clip is ready for live rep and velocity tracking."
              : "Connect your clip to begin tracking reps and bar speed."}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleStart}
          >
            <Text style={styles.primaryButtonText}>
              {connected ? "Start Training" : "Connect Device"}
            </Text>
          </Pressable>

          <Link href="/device" asChild>
            <Pressable style={({ pressed }) => pressed && styles.linkPressed}>
              <Text style={styles.secondaryLink}>Manage device</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Previous Set</Text>
          <Text style={styles.sectionSubtitle}>
            {summary
              ? "From your most recent completed set"
              : "Complete a set to populate these stats"}
          </Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Reps</Text>
              <Text style={styles.statValue}>
                {lastSetReps != null ? String(lastSetReps) : "--"}
              </Text>
              <Text style={styles.statUnit}>last set</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Mean</Text>
              <Text style={styles.statValue}>
                {formatNumber(lastSetMeanVel)}
              </Text>
              <Text style={styles.statUnit}>m/s</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Peak</Text>
              <Text style={styles.statValue}>
                {formatNumber(lastSetPeakVel)}
              </Text>
              <Text style={styles.statUnit}>m/s</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Est. 1RM</Text>
              <Text style={styles.statValue}>{formatNumber(oneRM, 1)}</Text>
              <Text style={styles.statUnit}>kg</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(theme: (typeof Colors)["dark"]) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      padding: 20,
      paddingBottom: 32,
    },
    header: {
      marginBottom: 24,
    },
    brand: {
      fontSize: 32,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 15,
      color: theme.subtext,
    },
    statusCard: {
      backgroundColor: theme.surface,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 28,
    },
    statusRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    sectionEyebrow: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1,
      color: theme.muted,
      marginBottom: 6,
    },
    statusText: {
      fontSize: 24,
      fontWeight: "800",
    },
    connectedText: {
      color: theme.success,
    },
    disconnectedText: {
      color: theme.danger,
    },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    badgeConnected: {
      backgroundColor: "rgba(124, 255, 178, 0.12)",
    },
    badgeDisconnected: {
      backgroundColor: "rgba(255, 138, 138, 0.12)",
    },
    badgeText: {
      fontSize: 12,
      fontWeight: "700",
    },
    badgeTextConnected: {
      color: theme.success,
    },
    badgeTextDisconnected: {
      color: theme.danger,
    },
    deviceName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 10,
    },
    description: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.subtext,
      marginBottom: 18,
    },
    primaryButton: {
      backgroundColor: theme.primary,
      borderRadius: 16,
      paddingVertical: 15,
      alignItems: "center",
    },
    primaryButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },
    buttonPressed: {
      opacity: 0.9,
    },
    secondaryLink: {
      marginTop: 14,
      textAlign: "center",
      fontSize: 14,
      fontWeight: "600",
      color: theme.muted,
    },
    linkPressed: {
      opacity: 0.7,
    },
    statsSection: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 4,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: theme.subtext,
      marginBottom: 14,
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 12,
    },
    statCard: {
      width: "47%",
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    statLabel: {
      fontSize: 13,
      color: theme.muted,
      marginBottom: 8,
    },
    statValue: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.text,
    },
    statUnit: {
      fontSize: 12,
      color: theme.muted,
      marginTop: 4,
    },
  });
}
