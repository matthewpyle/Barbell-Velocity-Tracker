// app/(tabs)/ble.tsx
import React from "react";
import { Button, FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBle } from "../../hooks/useBle";

export default function BleScreen() {
  const {
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
    currentSetRep,
  } = useBle();

  // Global values from the latest sample
  const currentVelocity = sample?.vZ ?? 0;

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>
        Smart Barbell Collar
      </Text>

      {!connected && (
        <>
          <Button title="Scan" onPress={scan} />
          <FlatList
            data={devices}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View
                style={{
                  padding: 12,
                  borderWidth: 1,
                  borderRadius: 10,
                  marginTop: 8,
                }}
              >
                <Text style={{ fontWeight: "600" }}>
                  {item.name ?? "(no name)"}
                </Text>
                <Text style={{ color: "#666" }}>{item.id}</Text>
                <Button title="Connect" onPress={() => connect(item)} />
              </View>
            )}
          />
        </>
      )}

      {connected && (
        <View style={{ flex: 1, gap: 12 }}>
          <Text>Connected: {connected.name ?? connected.id}</Text>

          {/* Controls */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {!active ? (
              <Button title="Start Set" onPress={startSet} />
            ) : (
              <Button title="Stop Set" onPress={stopSet} />
            )}
            <Button title="Disconnect" onPress={disconnect} />
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
                <Text>
                  Set duration: {(summary.setDurMs / 1000).toFixed(1)} s
                </Text>
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
        </View>
      )}
    </SafeAreaView>
  );
}
