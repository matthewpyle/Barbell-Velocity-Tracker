// app/(tabs)/index.tsx
import React from "react";
import { View, Text, Button } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { useBleContext } from "@/context/BleContext";

export default function HomeScreen() {
  const { connected } = useBleContext();

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Home</Text>

      <Text>
        {connected
          ? `Connected to ${connected.name ?? connected.id}`
          : "Not connected to any device"}
      </Text>

      <Button title="Go to Train" onPress={() => {}} />

      {!connected && (
        <View style={{ marginTop: 8 }}>
          <Link href="/device">
            <Text style={{ color: "blue" }}>Connect a device</Text>
          </Link>
        </View>
      )}
    </SafeAreaView>
  );
}
