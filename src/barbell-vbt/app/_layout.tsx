// app/_layout.tsx
import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      {/* any other stacks, e.g. modals */}
    </Stack>
  );
}
