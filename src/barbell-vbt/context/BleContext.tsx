// src/context/BleContext.tsx
import React, { createContext, useContext } from "react";
import { useBle } from "../hooks/useBle"; // adjust path if needed

// This matches exactly what your hook returns
type BleContextValue = ReturnType<typeof useBle>;

const BleContext = createContext<BleContextValue | null>(null);

export const BleProvider = ({ children }: { children: React.ReactNode }) => {
  const ble = useBle();
  return <BleContext.Provider value={ble}>{children}</BleContext.Provider>;
};

export const useBleContext = () => {
  const ctx = useContext(BleContext);
  if (!ctx) {
    throw new Error("useBleContext must be used within a BleProvider");
  }
  return ctx;
};
