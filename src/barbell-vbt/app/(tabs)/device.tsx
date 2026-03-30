// app/(tabs)/device.tsx
import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBleContext } from "@/context/BleContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

export default function DeviceScreen() {
  const { devices, connected, scan, connect, disconnect } = useBleContext();

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "dark"];
  const styles = getStyles(theme);

  if (connected) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.screenTitle}>Device</Text>
            <Text style={styles.screenSubtitle}>
              Manage your LiftIQ clip connection
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.statusRow}>
              <View>
                <Text style={styles.eyebrow}>STATUS</Text>
                <Text style={styles.connectedText}>Connected</Text>
              </View>

              <View style={[styles.badge, styles.badgeConnected]}>
                <Text style={[styles.badgeText, styles.badgeTextConnected]}>
                  READY
                </Text>
              </View>
            </View>

            <Text style={styles.deviceName}>
              {connected.name ?? "(no name)"}
            </Text>
            <Text style={styles.deviceId}>{connected.id}</Text>

            <Pressable
              onPress={disconnect}
              style={({ pressed }) => [
                styles.primaryButton,
                styles.disconnectButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Disconnect</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.screenTitle}>Device</Text>
              <Text style={styles.screenSubtitle}>
                Scan for nearby LiftIQ clips and connect
              </Text>
            </View>

            <Pressable
              onPress={scan}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Scan for devices</Text>
            </Pressable>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Not connected</Text>
              <Text style={styles.infoBody}>
                Start a scan, then select your clip from the list below.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Available devices</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No devices found yet</Text>
            <Text style={styles.emptyBody}>
              Tap scan to search for nearby BLE devices.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.deviceCard}>
            <View style={styles.deviceCardTop}>
              <View style={styles.deviceTextWrap}>
                <Text style={styles.deviceCardName}>
                  {item.name ?? "(no name)"}
                </Text>
                <Text style={styles.deviceCardId}>{item.id}</Text>
              </View>

              <Pressable
                onPress={() => connect(item)}
                style={({ pressed }) => [
                  styles.connectButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.connectButtonText}>Connect</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function getStyles(theme: (typeof Colors)["dark"]) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    listContent: {
      padding: 20,
      paddingBottom: 40,
    },
    header: {
      marginBottom: 20,
    },
    screenTitle: {
      fontSize: 30,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 6,
    },
    screenSubtitle: {
      fontSize: 14,
      color: theme.subtext,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    infoCard: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginTop: 16,
      marginBottom: 20,
    },
    infoTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 6,
    },
    infoBody: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.subtext,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 12,
    },
    statusRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1,
      color: theme.muted,
      marginBottom: 6,
    },
    connectedText: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.success,
    },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    badgeConnected: {
      backgroundColor: "rgba(124, 255, 178, 0.12)",
    },
    badgeText: {
      fontSize: 12,
      fontWeight: "700",
    },
    badgeTextConnected: {
      color: theme.success,
    },
    deviceName: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 6,
    },
    deviceId: {
      fontSize: 13,
      color: theme.muted,
      marginBottom: 18,
    },
    primaryButton: {
      backgroundColor: theme.primary,
      borderRadius: 16,
      paddingVertical: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    disconnectButton: {
      backgroundColor: theme.danger,
    },
    primaryButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },
    deviceCard: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 12,
    },
    deviceCardTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    deviceTextWrap: {
      flex: 1,
    },
    deviceCardName: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 4,
    },
    deviceCardId: {
      fontSize: 12,
      color: theme.muted,
    },
    connectButton: {
      backgroundColor: theme.primary,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    connectButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    emptyCard: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 6,
    },
    emptyBody: {
      fontSize: 14,
      color: theme.subtext,
      lineHeight: 20,
    },
    pressed: {
      opacity: 0.88,
    },
  });
}
