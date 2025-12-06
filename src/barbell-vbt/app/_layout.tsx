// app/_layout.tsx
import { BleProvider } from "@/context/BleContext";
import { Stack } from "expo-router";

export default function Layout() {
  return (
    <BleProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        {/* any other stacks, e.g. modals */}
      </Stack>
    </BleProvider>
  );
}
