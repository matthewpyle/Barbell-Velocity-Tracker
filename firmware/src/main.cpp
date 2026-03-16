// Firmware v0.4 - Bench press IMU logger + BLE (custom PCB with LIS3DHTR)
// Simple rep detection:
//   IDLE -> ACTIVE
// Counts a rep when upward velocity crosses threshold, ends when motion settles.
// CSV over Serial (for debugging)
// CSV text over BLE DATA_UUID (compatible with lib/ble.ts parsePkt)
// CTRL 0x01 triggers calibration
// Heartbeat LED on GPIO48

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_LIS3DH.h>
#include <Adafruit_Sensor.h>
#include <math.h>
#include <NimBLEDevice.h>

// --------- IMU / motion config ---------
// CUSTOM PCB PINS: IO40 = SDA, IO41 = SCL
#define SDA_PIN 40
#define SCL_PIN 41

// Status LED
#define LED_PIN 48

Adafruit_LIS3DH imu;

// LIS3DHTR ODR ≈ 100 Hz
static float ODR_HZ = 100.0f;
uint32_t lastMicros = 0;

// --------- Rep state ---------
enum RepState { IDLE, ACTIVE };
RepState state = IDLE;

uint32_t repStart_ms = 0;

// Simple rep detection tuning
// Positive vZ = bar moving UP
const float VEL_START_THRESH = 0.10f;   // m/s
const float VEL_END_THRESH   = 0.02f;   // m/s
const float ACC_STILL_THRESH = 0.30f;   // m/s^2
const uint16_t MIN_REP_TIME_MS = 200;   // ms

// --------- Vertical signal state ---------
float aZ_filt = 0.0f;   // filtered vertical acceleration (m/s^2)
float vZ      = 0.0f;   // vertical velocity (m/s)
uint16_t rep_id = 0;    // rep counter

// Filter / integration parameters
const float LPF_ALPHA = 0.1f;
const float GRAVITY   = 9.80665f;

// Gravity calibration
float    gravityEst    = GRAVITY;
bool     calibRunning  = false;
uint32_t calibStart_ms = 0;
double   calibSumAz    = 0.0;
uint32_t calibSamples  = 0;
uint8_t  calibFlag     = 0;   // 0 = normal, 1 = calibrating

const uint32_t CALIB_DURATION_MS = 2000;

// --------- BLE config (match lib/ble.ts) ---------
#define BARBELL_SERVICE_UUID "12345678-1234-1234-1234-1234567890ab"
#define DATA_CHAR_UUID       "abcd1234-1234-1234-1234-1234567890ab"
#define CONTROL_CHAR_UUID    "deadbeef-1234-1234-1234-1234567890ab"

NimBLEServer*         pServer   = nullptr;
NimBLECharacteristic* pDataChar = nullptr;
bool deviceConnected            = false;
uint32_t lastBLE_ms             = 0;   // send ~20 Hz

class MyServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo) override {
    (void)pServer;
    (void)connInfo;
    deviceConnected = true;
    Serial.println("BLE: device connected");
  }

  void onDisconnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo, int reason) override {
    (void)pServer;
    (void)connInfo;
    deviceConnected = false;
    Serial.print("BLE: device disconnected, reason=");
    Serial.println(reason);
    // Advertising restart handled by advertiseOnDisconnect(true)
  }
};

void resetRepFSM() {
  state = IDLE;
  repStart_ms = 0;
  vZ = 0.0f;
  aZ_filt = 0.0f;
}

void startCalibration() {
  calibRunning  = true;
  calibFlag     = 1;
  calibStart_ms = millis();
  calibSumAz    = 0.0;
  calibSamples  = 0;

  resetRepFSM();
  rep_id = 0;

  Serial.println("CAL: starting gravity calibration, keep bar still...");
}

class ControlCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* pChar, NimBLEConnInfo& connInfo) override {
    (void)connInfo;

    std::string val = pChar->getValue();

    if (!val.empty()) {
      uint8_t cmd = static_cast<uint8_t>(val[0]);

      if (cmd == 0x01) {
        Serial.println("BLE CTRL: start calibration command received");
        startCalibration();
      }
      // 0x02 reserved for future use
    }
  }
};

// --------- BLE initialization ---------
void initBLE() {
  Serial.println("BLE: init");

  if (!NimBLEDevice::init("BarbellIMU")) {
    Serial.println("BLE ERROR: NimBLEDevice::init failed");
    return;
  }

  if (!NimBLEDevice::setPower(0)) {   // 0 dBm
    Serial.println("BLE WARN: setPower failed");
  }

  Serial.println("BLE: create server");
  pServer = NimBLEDevice::createServer();
  if (!pServer) {
    Serial.println("BLE ERROR: createServer failed");
    return;
  }

  pServer->setCallbacks(new MyServerCallbacks());
  pServer->advertiseOnDisconnect(true);

  Serial.println("BLE: create service");
  NimBLEService* pService = pServer->createService(BARBELL_SERVICE_UUID);
  if (!pService) {
    Serial.println("BLE ERROR: createService failed");
    return;
  }

  Serial.println("BLE: create data char");
  pDataChar = pService->createCharacteristic(
      DATA_CHAR_UUID,
      NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
  );
  if (!pDataChar) {
    Serial.println("BLE ERROR: create data characteristic failed");
    return;
  }
  pDataChar->setValue("ready");

  Serial.println("BLE: create control char");
  NimBLECharacteristic* pControlChar = pService->createCharacteristic(
      CONTROL_CHAR_UUID,
      NIMBLE_PROPERTY::WRITE
  );
  if (!pControlChar) {
    Serial.println("BLE ERROR: create control characteristic failed");
    return;
  }
  pControlChar->setCallbacks(new ControlCallbacks());

  Serial.println("BLE: start service");
  if (!pService->start()) {
    Serial.println("BLE ERROR: service start failed");
    return;
  }

  Serial.println("BLE: get advertising");
  NimBLEAdvertising* pAdvertising = NimBLEDevice::getAdvertising();
  if (!pAdvertising) {
    Serial.println("BLE ERROR: getAdvertising failed");
    return;
  }

  if (!pAdvertising->addServiceUUID(BARBELL_SERVICE_UUID)) {
    Serial.println("BLE WARN: addServiceUUID failed");
  }

  // In NimBLE 2.x the device name is not always advertised automatically.
  if (!pAdvertising->setName("BarbellIMU")) {
    Serial.println("BLE WARN: setName failed");
  }

  // Leave off for now unless you specifically need it.
  // pAdvertising->enableScanResponse(true);

  Serial.println("BLE: start advertising");
  if (!pAdvertising->start()) {
    Serial.println("BLE ERROR: advertising start failed");
    return;
  }

  Serial.println("BLE: advertising as 'BarbellIMU'");
}

// --------- Setup ---------
void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);   // active-LOW LED off

  Serial.begin(115200);
  delay(300);

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);

  // Init IMU (LIS3DHTR via Adafruit LIS3DH)
  // SDO tied to GND -> I2C address 0x18
  if (!imu.begin(0x18)) {
    Serial.println("ERROR: LIS3DHTR not found at 0x18");

    while (true) {
      digitalWrite(LED_PIN, LOW);
      delay(150);
      digitalWrite(LED_PIN, HIGH);
      delay(150);
    }
  }

  Serial.println("IMU: LIS3DHTR detected");

  imu.setRange(LIS3DH_RANGE_8_G);
  imu.setDataRate(LIS3DH_DATARATE_100_HZ);

  // CSV header for Serial debugging
  Serial.println("rep_id,t_ms,ax_mps2,ay_mps2,az_mps2,gx_rads,gy_rads,gz_rads,aZ_filt,vZ,calibFlag");

  initBLE();

  lastMicros = micros();
}

// --------- Main loop ---------
void loop() {
  // Heartbeat LED
  {
    static uint32_t lastBlink_ms = 0;
    static bool ledOn = false;
    uint32_t now = millis();

    if (now - lastBlink_ms >= 250) {
      lastBlink_ms = now;
      ledOn = !ledOn;
      digitalWrite(LED_PIN, ledOn ? LOW : HIGH);
    }
  }

  // Serial calibration command
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == 'C' || c == 'c') {
      startCalibration();
    }
  }

  // Pace roughly at IMU ODR, but use actual dt
  const uint32_t period_us = (uint32_t)(1e6f / ODR_HZ);
  uint32_t nowUS = micros();
  int32_t diff = (int32_t)(nowUS - lastMicros);

  if (diff < (int32_t)period_us) {
    return;
  }

  float dt = diff / 1e6f;
  lastMicros = nowUS;

  // Get IMU data: LIS3DHTR accel only
  sensors_event_t accEvent;
  imu.getEvent(&accEvent);

  float ax = accEvent.acceleration.x;
  float ay = accEvent.acceleration.y;
  float az = accEvent.acceleration.z;

  // No gyro on LIS3DHTR – keep CSV shape
  float gx = 0.0f;
  float gy_ = 0.0f;
  float gz = 0.0f;

  uint32_t t_ms = millis();

  // Gravity calibration logic
  if (calibRunning) {
    calibSumAz += az;
    calibSamples++;

    if ((t_ms - calibStart_ms) >= CALIB_DURATION_MS) {
      if (calibSamples > 0) {
        gravityEst = (float)(calibSumAz / (double)calibSamples);
        Serial.print("CAL: done. GRAVITY_EST = ");
        Serial.println(gravityEst, 6);
      }

      calibRunning = false;
      calibFlag    = 0;

      resetRepFSM();
      rep_id = 0;
    }
    // Fall through so data still streams during calibration
  }

  // Vertical accel: subtract gravity, low-pass filter
  float aZ_no_g = az - gravityEst;
  aZ_filt = LPF_ALPHA * aZ_no_g + (1.0f - LPF_ALPHA) * aZ_filt;

  // Integrate to velocity
  vZ += aZ_filt * dt;

  // Drift control when bar is quiet
  if (fabsf(aZ_filt) < ACC_STILL_THRESH) {
    vZ *= 0.98f;
  }

  t_ms = millis();

  // Simple rep state machine
  switch (state) {
    case IDLE:
      // Start of rep when upward velocity exceeds threshold
      if (vZ > VEL_START_THRESH) {
        state = ACTIVE;
        rep_id++;
        repStart_ms = t_ms;
      }
      break;

    case ACTIVE:
      // End rep when nearly stopped and minimum duration met
      if (fabsf(vZ) < VEL_END_THRESH &&
          (t_ms - repStart_ms) > MIN_REP_TIME_MS) {
        state = IDLE;
        vZ = 0.0f;   // reset between reps to reduce drift
      }
      break;
  }

  // Serial CSV output
  Serial.print(rep_id);
  Serial.print(',');
  Serial.print(t_ms);
  Serial.print(',');
  Serial.print(ax, 6);
  Serial.print(',');
  Serial.print(ay, 6);
  Serial.print(',');
  Serial.print(az, 6);
  Serial.print(',');
  Serial.print(gx, 6);
  Serial.print(',');
  Serial.print(gy_, 6);
  Serial.print(',');
  Serial.print(gz, 6);
  Serial.print(',');
  Serial.print(aZ_filt, 6);
  Serial.print(',');
  Serial.print(vZ, 6);
  Serial.print(',');
  Serial.println(calibFlag);

  if (calibFlag == 1) {
    Serial.println("CAL: calibrating...");
  }

  // BLE: send CSV line ~20 Hz whenever connected
  // Format: "<t_ms>,<aZ_filt>,<vZ>,<rep_id>,<calibFlag>"
  if (deviceConnected && pDataChar != nullptr && (t_ms - lastBLE_ms) >= 50) {
    lastBLE_ms = t_ms;

    char buf[64];
    int len = snprintf(
        buf,
        sizeof(buf),
        "%lu,%.5f,%.5f,%u,%u",
        (unsigned long)t_ms,
        aZ_filt,
        vZ,
        (unsigned int)rep_id,
        (unsigned int)calibFlag
    );

    if (len > 0) {
      pDataChar->setValue((uint8_t*)buf, len);
      if (!pDataChar->notify()) {
        Serial.println("BLE WARN: notify failed");
      }
    }
  }
}