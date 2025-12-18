// app/(tabs)/train.tsx
import React from "react";
import { Button, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { useBleContext } from "@/context/BleContext";

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

  const currentVelocity = sample?.vZ ?? 0;

  // If not connected, show a friendly message + link to Device tab
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
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
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

      {/* Controls */}
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          marginBottom: 12,
        }}
      >
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
            onPress={active ? stopSet : startSet}
            disabled={!canStartSet && !active} // disable when calibrating
          />
        </View>
      </View>

      {calibrating && (
        <Text
          style={{
            marginBottom: 12,
            fontSize: 12,
            color: "#b45309",
          }}
        >
          Calibrating gravity… keep the bar still in the start position.
        </Text>
      )}

      {/* Big live metrics */}
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
        {!active && !calibrating && (
          <Text
            style={{
              fontSize: 12,
              color: "#64748b",
              marginTop: 6,
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
            <Text>Set duration: {(summary.setDurMs / 1000).toFixed(1)} s</Text>
            <Text>
              Mean concentric v: {summary.meanConcentricVel.toFixed(2)} m/s
            </Text>
            <Text>
              Peak concentric v: {summary.peakConcentricVel.toFixed(2)} m/s
            </Text>
          </View>
        ) : (
          <Text style={{ marginTop: 4, color: "#94a3b8" }}>
            No completed set yet.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
