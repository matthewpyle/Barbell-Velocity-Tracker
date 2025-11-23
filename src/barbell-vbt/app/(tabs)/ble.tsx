// app/(tabs)/ble.tsx
import React from "react";
import { Button, FlatList, Text, View, ScrollView } from "react-native";
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
  } = useBle();

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>BLE • BarbellIMU</Text>

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
          <View style={{ flexDirection: "row", gap: 8 }}>
            {!active ? (
              <Button title="Start Set" onPress={startSet} />
            ) : (
              <Button title="Stop Set" onPress={stopSet} />
            )}
            <Button title="Disconnect" onPress={disconnect} />
          </View>

          {/* Latest sample */}
          <View
            style={{
              marginTop: 12,
              padding: 12,
              borderWidth: 1,
              borderRadius: 10,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700" }}>
              Latest sample
            </Text>
            <Text>t_ms: {sample?.tMs ?? "--"}</Text>
            <Text>aZ (m/s²): {sample?.aZ?.toFixed?.(3) ?? "--"}</Text>
            <Text>vZ (m/s): {sample?.vZ?.toFixed?.(3) ?? "--"}</Text>
            <Text>rep_id: {sample?.repId ?? "--"}</Text>
          </View>

          {/* Set summary */}
          <View
            style={{
              marginTop: 12,
              padding: 12,
              borderWidth: 1,
              borderRadius: 10,
              flex: 1,
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

            <ScrollView style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 12, color: "#666" }}>
                Press Start Set to begin recording samples. Press Stop Set to
                compute the set summary from streamed vZ and rep_id.
              </Text>
            </ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
