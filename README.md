# Barbell Velocity Tracker

A compact, BLE-enabled smart barbell collar for velocity–based training (VBT).  
The device mounts to a standard barbell collar, measures vertical bar motion with an IMU, computes a simple rep counter and vertical velocity on-device, and streams data to a React Native app in real time.

Built as part of my final-year Electronics Engineering project. This repo contains:

- Custom ESP32-S3 hardware (PCB)
- Embedded firmware (PlatformIO / Arduino)
- Mobile app (Expo / React Native) for live feedback and set summaries

---

## Highlights

- **Live velocity feedback**
  - Vertical acceleration and velocity stream in real time
  - Rep count per set and live “Rep N, velocity” view in the app

- **On-device motion processing**
  - 3-axis accelerometer (LIS3DHTR)
  - Gravity calibration and low-pass filtering
  - 1D vertical velocity via numeric integration
  - Simple rep detection based on velocity thresholds

- **BLE link to phone**
  - Custom GATT service for:
    - Streaming vertical signal samples
    - Triggering calibration from the app
  - Built around `react-native-ble-plx` and NimBLE

- **Custom PCB hardware**
  - ESP32-S3-WROOM-1 (Wi-Fi + BLE, dual-core MCU)
  - LIS3DHTR 3-axis accelerometer (I²C)
  - LiPo via JST-PH, on-board LDO regulator
  - USB-powered via external USB-to-UART bridge for flashing
  - Status LED + pushbuttons for boot / reset

- **Mobile app UX**
  - Device tab: scan/connect/disconnect, status
  - Train tab: calibrate, start/stop set, live velocity, rep number, and basic set summary (total reps, duration, mean and peak concentric velocity)

---

## Hardware

**Final hardware (custom PCB)**

- **MCU:** ESP32-S3-WROOM-1 module  
- **IMU:** LIS3DHTR (3-axis accelerometer), connected via I²C  
  - On the PCB, SCL/SDA are mapped to ESP32-S3 pins IO41 / IO40
  - SDO tied to GND → I²C address `0x18`
- **Power:**
  - 3.7 V LiPo cell via JST-PH connector
  - On-board LDO regulator for 3V3 rail
  - Battery charging handled externally (off-board LiPo charger module)
- **User interface:**
  - Status LED on GPIO48 (heartbeat + fault indication)
  - Push buttons for EN / BOOT and for entering the ESP32 ROM bootloader
- **Programming:**
  - CP2102 (or similar) USB-to-UART bridge on a separate board
  - Standard ESP32-S3 UART bootloader pins wired out on a header

**Prototype hardware (breadboard phase)**

- ESP32 DevKit board (originally ESP32 + LSM6DSOX)
- Off-the-shelf IMU breakout
- USB power and jumper-wire connections

The firmware and BLE protocol were first proven on the breadboard, then ported to the custom PCB with the LIS3DHTR.

---

## Firmware

The firmware is written in C++ using **PlatformIO** and the **Arduino** framework.

Key components:

- **IMU driver**
  - `Adafruit_LIS3DH` library for LIS3DHTR
  - I²C at 400 kHz
  - Data rate ≈ 100 Hz
  - Configured for ±8 g range

- **Signal processing**
  - One axis (configurable) is treated as the **vertical** direction
  - 2-second gravity calibration:
    - App sends a command, firmware averages the chosen axis while the bar is held still
    - Estimated gravity is subtracted from subsequent readings
  - Low-pass filter:
    - First-order IIR with configurable `LPF_ALPHA`
  - Velocity integration:
    - Vertical acceleration (gravity-compensated) integrated over time to get vertical velocity
    - Simple drift control:
      - When |a| is below a stillness threshold, velocity is decayed towards zero

- **Rep detection**
  - Two-state machine: `IDLE` → `ACTIVE` → `IDLE`
  - A rep starts when vertical velocity exceeds a start threshold
  - A rep ends when |velocity| falls below an end threshold for long enough
  - Firmware maintains a monotonically increasing `rep_id` counter

- **BLE (NimBLE)**
  - Service UUID: `12345678-1234-1234-1234-1234567890ab`
  - Characteristics:
    - **DATA (notify + read)**  
      UUID: `abcd1234-1234-1234-1234-1234567890ab`  
      Payload: ASCII CSV, one line per sample:
      ```text
      <t_ms>,<aZ_filt>,<vZ>,<rep_id>,<calibFlag>
      ```
      where:
      - `t_ms` = timestamp (ms since boot)
      - `aZ_filt` = filtered vertical acceleration [m/s²]
      - `vZ` = vertical velocity [m/s]
      - `rep_id` = global rep counter (incremented on each concentric)
      - `calibFlag` = 1 while calibration is in progress, else 0
    - **CONTROL (write)**  
      UUID: `deadbeef-1234-1234-1234-1234567890ab`  
      Protocol:
      - `0x01` → start 2-second gravity calibration
      - `0x02` → reserved for future use (e.g. explicit “end set”)

- **Status LED**
  - Heartbeat blink in normal operation
  - Fast blink in hard fault (e.g. IMU not found)

- **Debug output**
  - Full feature CSV on UART (Serial Monitor) for offline analysis:
    ```text
    rep_id,t_ms,ax_mps2,ay_mps2,az_mps2,gx_rads,gy_rads,gz_rads,aZ_filt,vZ,calibFlag
    ```

---

## Mobile App

The app is built with **React Native** and **Expo**, using **expo-router** and **react-native-ble-plx** for BLE.

### BLE layer (`src/lib/ble.ts` + `src/hooks/useBle.ts`)

- **Connection & scanning**
  - Scans for devices named `"BarbellIMU"`
  - Requests appropriate BLE/location permissions on Android
  - Connects and discovers services/characteristics

- **Protocol**
  - Matches the firmware UUIDs:
    - `SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab"`
    - `DATA_UUID    = "abcd1234-1234-1234-1234-1234567890ab"`
    - `CONTROL_UUID = "deadbeef-1234-1234-1234-1234567890ab"`
  - `monitorCharacteristicForService()` subscribes to notifications from `DATA_UUID`
  - Each notification is a base64-encoded ASCII CSV line, parsed into:
    ```ts
    type Sample = {
      tMs: number;      // ms
      aZ: number;       // filtered vertical accel (m/s^2)
      vZ: number;       // vertical velocity (m/s)
      repId: number;    // global rep counter
      calibFlag: number;// 0/1 from firmware
    };
    ```

- **Calibration**
  - “Calibrate” button calls `calibrate()`:
    - Sends a single byte `0x01` to `CONTROL_UUID`
    - UI shows a “Calibrating…” state while the firmware averages gravity

- **Set handling and metrics**
  - When a set starts, the app:
    - Records the current global `repId` as an offset
    - Starts buffering incoming `Sample`s
  - When the set stops, the app:
    - Segments samples by rep (global `repId` minus offset)
    - Uses only concentric (positive velocity) samples
    - Computes:
      - Total reps
      - Set duration
      - Mean concentric velocity across reps
      - Peak concentric velocity across the set

### UI (`app/(tabs)/device.tsx`, `app/(tabs)/train.tsx`)

- **Device Tab**
  - Scan for devices
  - List available `"BarbellIMU"` peripherals
  - Connect / disconnect
  - Show current connection status

- **Train Tab**
  - Shows:
    - Device connected badge
    - Status chips: “Set active / idle” and “Calibrated / Calibrating…”
  - Controls:
    - **Calibrate** button (disabled while calibrating or during a set)
    - **Start Set / Stop Set** button
  - Live metrics:
    - Current rep number within the set
    - Current vertical velocity (m/s)
  - Set summary:
    - Total reps
    - Set duration
    - Mean concentric velocity (m/s)
    - Peak concentric velocity (m/s)

---

## Algorithms (Current Implementation)

The current implementation focuses on a **1D vertical model**:

- **Gravity calibration**
  - 2-second average of the chosen axis while the bar is held still
  - Used as `gravityEst` and subtracted from raw acceleration

- **Filtering**
  - First order low-pass:
    ```c
    aZ_filt = LPF_ALPHA * aZ_no_g + (1 - LPF_ALPHA) * aZ_filt;
    ```

- **Velocity integration**
  - Simple Euler integration:
    ```c
    vZ += aZ_filt * dt;
    ```
  - Drift reduction:
    - When |aZ_filt| is below a stillness threshold, velocity is decayed and clamped back towards 0

- **Rep detection**
  - Thresholding on `vZ`:
    - Start of rep when `vZ > VEL_START_THRESH`
    - End of rep when `|vZ| < VEL_END_THRESH` for at least `MIN_REP_TIME_MS`
  - Firmware increments a global `rep_id`, which is then segmented per set on the app

Future work (not yet implemented in this repo) could include:

- Full 3D orientation estimation / sensor fusion
- Bar path / stability metrics
- ROM and time-under-tension
- Load–velocity profiling and RPE/RIR estimation

---

## Repo Structure

```text
/firmware
  ├─ src/           # ESP32-S3 firmware (IMU, BLE, rep detection)
  ├─ include/
  └─ platformio.ini

/app
  ├─ app/           # Expo Router screens (Device, Train, etc.)
  ├─ src/
  │   ├─ hooks/     # useBle and related hooks
  │   └─ lib/       # BLE protocol helpers (UUIDs, packet parsing)
  └─ package.json
   
