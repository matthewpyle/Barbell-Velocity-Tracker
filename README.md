# Barbell-Velocity-Tracker
A compact, BLE-enabled smart barbell collar for velocity-based training (VBT). The system captures barbell motion with an IMU, computes rep-level metrics on-device, and streams results to a mobile app in real time. Built as part of my Electronics Engineering project and packaged here for reproducible builds and future development.

<h1>Highlights</h1>

- Live VBT metrics: rep count, concentric mean/peak velocity, ROM, time-under-tension, bar path flags (instability), set summaries.

- On-device signal processing: sensor fusion, drift handling, rep segmentation, velocity & displacement from IMU data.

- BLE GATT service: low-latency streaming + command/control; works with mobile app.

- RPE/RIR assist: estimates using velocity loss and historical load–velocity profile.

- Portable hardware: ESP32 (S3 target) + 6-DoF IMU, LiPo battery, USB-C charging, on/off + status LEDs.

- Smart clip form factor: mounts to a standard plastic barbell collar.

- System Architecture

<h1>Hardware</h1>

- MCU: ESP32-S3 (final), prototyped on ESP32-WROOM

- IMU: LSM6DSOX

- Power: 3.7 V LiPo + charger (TP4056/IPS-based), USB-C

- Enclosure: 3D-printed sled bonded to a commercial barbell clip

<h1>Firmware</h1>

-ESP-IDF/Arduino framework

-I²C IMU driver, DMA sampling

-Fixed-point filters for real-time calculations

-BLE GATT: characteristics for metrics, config, OTA trigger

<h1>Mobile App</h1>

- React Native (Expo) client

- BLE connect, live charts, set/rep history

- Basic device settings & IMU calibration wizard

<h1>Algorithms</h1>

- Calibration & bias removal

- Orientation-aware axis selection (gravity compensation)

- Rep detection via velocity zero-crossings + adaptive thresholds

- Displacement integration with windowed drift correction

- Velocity loss & fatigue indices for RPE/RIR helper

<h1>Repo Structure</h1>

/hardware<br>
  ├─ schematics/ (PDF, source)<br>
  ├─ pcb/ (Gerbers, BOM)<br>
  └─ enclosure/ (STL, STEP)<br>
/firmware<br>
  ├─ src/ (drivers, BLE, algos)<br>
  ├─ include/<br>
  └─ platformio.ini or CMakeLists.txt<br>
/app<br>
  ├─ app/ (Expo project)<br>
  └─ src/ (screens, BLE, charts)<br>
/docs<br>
  ├─ quickstart.md<br>
  ├─ calibration.md<br>
  ├─ algorithms.md<br>
  └─ test-protocols.md<br>
