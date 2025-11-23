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
    repEvents,
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
        <View style={{ gap: 12 }}>
          <Text>Connected: {connected.name ?? connected.id}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {!active ? (
              <Button title="Start Set" onPress={startSet} />
            ) : (
              <Button title="Stop Set" onPress={stopSet} />
            )}
            <Button title="Disconnect" onPress={disconnect} />
          </View>

          <View
            style={{
              marginTop: 12,
              padding: 12,
              borderWidth: 1,
              borderRadius: 10,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700" }}>
              Latest RAW sample (ACTIVE only)
            </Text>
            <Text>t_ms: {sample?.t_ms ?? "--"}</Text>
            <Text>
              ax, ay, az (mg): {sample?.ax ?? "--"}, {sample?.ay ?? "--"},{" "}
              {sample?.az ?? "--"}
            </Text>
            <Text>
              gx, gy, gz (mdps): {sample?.gx ?? "--"}, {sample?.gy ?? "--"},{" "}
              {sample?.gz ?? "--"}
            </Text>
          </View>

          <View
            style={{
              marginTop: 12,
              padding: 12,
              borderWidth: 1,
              borderRadius: 10,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700" }}>
              Rep events (latest first)
            </Text>
            <FlatList
              data={repEvents}
              keyExtractor={(item, idx) => `${item.rep}-${idx}`}
              renderItem={({ item }) => (
                <View style={{ marginTop: 8 }}>
                  <Text>
                    Rep #{item.rep} • dur {item.durMs} ms
                  </Text>
                  <Text>
                    Mean |vel| {(item.meanVel_mmps / 1000).toFixed(2)} m/s •
                    Peak |vel| {(item.peakVel_mmps / 1000).toFixed(2)} m/s
                  </Text>
                  <Text>Mean |accel| {item.meanAbsA_mg} mg</Text>
                </View>
              )}
            />
          </View>

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
              <>
                <Text>Total reps: {summary.totalReps}</Text>
                <Text>
                  Set duration: {(summary.setDurMs / 1000).toFixed(1)} s
                </Text>
                <Text>
                  Mean of means: {(summary.meanOfMeans_mmps / 1000).toFixed(2)}{" "}
                  m/s
                </Text>
                <Text>
                  Best peak: {(summary.bestPeak_mmps / 1000).toFixed(2)} m/s
                </Text>
                <Text>Avg rep dur: {summary.avgRepDurMs} ms</Text>
              </>
            ) : (
              <Text>—</Text>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
