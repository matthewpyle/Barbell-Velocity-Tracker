// app/(tabs)/device.tsx
import React from "react";
import { Button, FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBleContext } from "@/context/BleContext"; // adjust path

export default function DeviceScreen() {
  const { devices, connected, scan, connect, disconnect } = useBleContext();

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Device</Text>

      <Text>
        Status:{" "}
        {connected
          ? `Connected to ${connected.name ?? connected.id}`
          : "Not connected"}
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
        <View style={{ marginTop: 16 }}>
          <Button title="Disconnect" onPress={disconnect} />
        </View>
      )}
    </SafeAreaView>
  );
}
