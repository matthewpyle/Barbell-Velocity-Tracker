// app/(tabs)/train.tsx
import React from "react";
import { Button, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { useBleContext } from "@/context/BleContext"; // adjust path

export default function TrainScreen() {
  const {
    connected,
    sample,
    active,
    summary,
    startSet,
    stopSet,
    currentSetRep,
  } = useBleContext();

  const currentVelocity = sample?.vZ ?? 0;

  // If not connected, show a friendly message + link to Device tab
  if (!connected) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>Train</Text>
        <Text style={{ marginBottom: 12 }}>
          No device connected. Go to the Device tab to connect.
        </Text>
        <Link href="/device">
          <Text style={{ color: "blue" }}>Go to Device</Text>
        </Link>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Train</Text>

      <Text>Connected: {connected.name ?? connected.id}</Text>

      {/* Controls */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {!active ? (
          <Button title="Start Set" onPress={startSet} />
        ) : (
          <Button title="Stop Set" onPress={stopSet} />
        )}
      </View>

      {/* Big live metrics */}
      <View
        style={{
          marginTop: 12,
          padding: 16,
          borderWidth: 1,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 8 }}>
          Live set
        </Text>
        <Text style={{ fontSize: 48, fontWeight: "800" }}>
          Rep {currentSetRep}
        </Text>
        <Text style={{ fontSize: 20, marginTop: 8 }}>
          Velocity: {currentVelocity.toFixed(2)} m/s
        </Text>
        {!active && (
          <Text
            style={{
              fontSize: 12,
              color: "#666",
              marginTop: 4,
              textAlign: "center",
            }}
          >
            Press Start Set and perform reps to update.
          </Text>
        )}
      </View>

      {/* Set summary */}
      <View
        style={{
          marginTop: 12,
          padding: 12,
          borderWidth: 1,
          borderRadius: 10,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "700" }}>Set summary</Text>
        {summary ? (
          <View style={{ marginTop: 8 }}>
            <Text>Total reps: {summary.totalReps}</Text>
            <Text>Set duration: {(summary.setDurMs / 1000).toFixed(1)} s</Text>
            <Text>
              Mean concentric v: {summary.meanConcentricVel.toFixed(2)} m/s
            </Text>
            <Text>
              Peak concentric v: {summary.peakConcentricVel.toFixed(2)} m/s
            </Text>
          </View>
        ) : (
          <Text style={{ marginTop: 8 }}>—</Text>
        )}
      </View>
    </SafeAreaView>
  );
}
