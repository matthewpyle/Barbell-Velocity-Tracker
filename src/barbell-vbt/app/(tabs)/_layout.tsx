import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: "#111",
        tabBarInactiveTintColor: "#999",
      }}
    >
      {/* Home – app/(tabs)/index.tsx */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="house.fill" color={color} />
          ),
        }}
      />

      {/* Train – app/(tabs)/train.tsx */}
      <Tabs.Screen
        name="train"
        options={{
          title: "Train",
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={24}
              name="figure.strengthtraining.traditional"
              color={color}
            />
          ),
        }}
      />

      {/* Device – app/(tabs)/device.tsx */}
      <Tabs.Screen
        name="device"
        options={{
          title: "Device",
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={24}
              name="antenna.radiowaves.left.and.right"
              color={color}
            />
          ),
        }}
      />

      {/* History – app/(tabs)/history.tsx */}
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="chart.bar.xaxis" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
