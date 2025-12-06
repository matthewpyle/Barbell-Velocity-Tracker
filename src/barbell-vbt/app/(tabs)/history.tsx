// app/(tabs)/history.tsx
import React from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HistoryScreen() {
  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 12 }}>
        History
      </Text>
      <Text>No sessions yet. History coming soon.</Text>
    </SafeAreaView>
  );
}
