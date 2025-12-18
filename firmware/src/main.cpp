// Firmware v0.2 - Bench press IMU logger + BLE streaming
// - LSM6DSOX accel/gyro
// - Vertical acceleration & velocity
// - Simple rep counter
// - CSV over Serial
// - CSV over BLE notify characteristic

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_LSM6DSOX.h>  // IMU
#include <math.h>
#include <NimBLEDevice.h>       // BLE

// --------- IMU / motion config ---------
#define SDA_PIN 21
#define SCL_PIN 22

Adafruit_LSM6DSOX imu;

static float ODR_HZ = 104.0f;   // IMU data rate
uint32_t lastMicros = 0;

enum RepState { IDLE, ACTIVE };
RepState state = IDLE;

// Vertical signal state
float aZ_filt = 0.0f;           // filtered vertical acceleration (m/s^2)
float vZ      = 0.0f;           // vertical velocity (m/s)
uint16_t rep_id = 0;            // rep counter

// Filter / integration parameters
const float LPF_ALPHA = 0.1f;   // low-pass factor
const float GRAVITY   = 9.80665f;

// Gravity calibration
float gravityEst = GRAVITY;   
bool  calibRunning = false;      // true while calibration is in progress
uint32_t calibStart_ms = 0;
double calibSumAz = 0.0;
uint32_t calibSamples = 0;
uint8_t calibFlag = 0;   // 0 = normal, 1 = calibrating


const uint32_t CALIB_DURATION_MS = 2000;  // 2 seconds

// Rep detection tuning
// Assume positive vZ = bar moving UP (concentric)
const float VEL_START_THRESH   = 0.10f;   // m/s
const float VEL_END_THRESH     = 0.02f;   // m/s
const float ACC_STILL_THRESH   = 0.30f;   // m/s^2
const uint16_t MIN_REP_TIME_MS = 200;     // ms

uint32_t repStart_ms = 0;

// --------- BLE config ---------
#define BARBELL_SERVICE_UUID "12345678-1234-1234-1234-1234567890ab"
#define DATA_CHAR_UUID       "abcd1234-1234-1234-1234-1234567890ab"
#define CONTROL_CHAR_UUID    "deadbeef-1234-1234-1234-1234567890ab" 


NimBLEServer*        pServer   = nullptr;
NimBLECharacteristic* pDataChar = nullptr;
bool deviceConnected = false;
uint32_t lastBLE_ms  = 0;       // for rate-limiting BLE sends

class MyServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* pServer) override {
    deviceConnected = true;
    Serial.println("BLE: device connected");
  }
  void onDisconnect(NimBLEServer* pServer) override {
    deviceConnected = false;
    Serial.println("BLE: device disconnected, restarting advertising");
    NimBLEDevice::startAdvertising();
  }
};
void startCalibration() {
  calibRunning = true;
  calibFlag = 1;
  calibStart_ms = millis();
  calibSumAz = 0.0;
  calibSamples = 0;

  // Reset motion state while calibrating
  vZ = 0.0f;
  aZ_filt = 0.0f;
  state = IDLE;
  rep_id = 0;

  Serial.println("CAL: starting gravity calibration, keep bar still...");
}

class ControlCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* pChar) override {
    std::string val = pChar->getValue();  // raw bytes from app

    if (!val.empty()) {
      uint8_t cmd = static_cast<uint8_t>(val[0]);
      // Simple protocol: 0x01 = start calibration
      if (cmd == 0x01) {
        Serial.println("BLE CTRL: start calibration command received");
        startCalibration();
      }
    }
  }
};

void initBLE() {
  NimBLEDevice::init("BarbellIMU");
  NimBLEDevice::setPower(ESP_PWR_LVL_N0);

  pServer = NimBLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  NimBLEService* pService = pServer->createService(BARBELL_SERVICE_UUID);

  // Data characteristic (unchanged)
  pDataChar = pService->createCharacteristic(
      DATA_CHAR_UUID,
      NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
  );
  pDataChar->setValue("ready");

  // NEW: control characteristic (write-only from app)
  NimBLECharacteristic* pControlChar = pService->createCharacteristic(
      CONTROL_CHAR_UUID,
      NIMBLE_PROPERTY::WRITE
  );
  pControlChar->setCallbacks(new ControlCallbacks());

  pService->start();

  NimBLEAdvertising* pAdvertising = NimBLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(BARBELL_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  NimBLEDevice::startAdvertising();

  Serial.println("BLE: advertising as 'BarbellIMU'");
}



// --------- Setup ---------
void setup() {
  Serial.begin(115200);
  delay(300);

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);

  // Init IMU
  if (!imu.begin_I2C()) {
    Serial.println("ERROR: IMU not found");
    while (true) {
      delay(1000);
    }
  }

  imu.setAccelRange(LSM6DS_ACCEL_RANGE_16_G);
  imu.setGyroRange(LSM6DS_GYRO_RANGE_2000_DPS);
  imu.setAccelDataRate(LSM6DS_RATE_104_HZ);
  imu.setGyroDataRate(LSM6DS_RATE_104_HZ);

  // CSV header for Serial
  Serial.println("rep_id,t_ms,ax_mps2,ay_mps2,az_mps2,gx_rads,gy_rads,gz_rads,aZ_filt,vZ");

  // Init BLE
  initBLE();

  lastMicros = micros();
}

// --------- Main loop ---------
void loop() {
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

  if (diff < period_us) {
    return;  // not time yet
  }

  float dt = diff / 1e6f;  // seconds
  lastMicros = nowUS;

  // Get IMU data
  sensors_event_t acc, gy, temp;
  imu.getEvent(&acc, &gy, &temp);

  float ax = acc.acceleration.x;
  float ay = acc.acceleration.y;
  float az = acc.acceleration.z;

  float gx = gy.gyro.x;
  float gy_ = gy.gyro.y;
  float gz = gy.gyro.z;

    uint32_t t_ms = millis();

  // --- Gravity calibration logic ---
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
      calibFlag = 0;

      // Reset motion state after calibration
      vZ = 0.0f;
      aZ_filt = 0.0f;
      state = IDLE;
      rep_id = 0;
    }

    // During calibration we can optionally skip integration/rep logic,
    // but still log raw data if you want. For now, fall through so you see data.
  }

  


  // Vertical accel: subtract gravity, low-pass filter
  float aZ_no_g = az - gravityEst;
  aZ_filt = LPF_ALPHA * aZ_no_g + (1.0f - LPF_ALPHA) * aZ_filt;

  // Integrate to velocity (rough, will drift)
  vZ += aZ_filt * dt;

  // Simple drift control when bar is still
  if (fabsf(aZ_filt) < ACC_STILL_THRESH) {
    vZ *= 0.98f;  // decay towards 0
  }

  t_ms = millis();

  // Rep state machine
  switch (state) {
    case IDLE:
      // Start of concentric when vZ exceeds threshold
      if (vZ > VEL_START_THRESH) {
        state = ACTIVE;
        rep_id++;
        repStart_ms = t_ms;
      }
      break;

    case ACTIVE:
      // End rep when almost stopped and long enough
      if (fabsf(vZ) < VEL_END_THRESH &&
          (t_ms - repStart_ms) > MIN_REP_TIME_MS) {
        state = IDLE;
        vZ = 0.0f;  // reset between reps to reduce drift
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
  Serial.println(vZ, 6);
  Serial.print(',');
  Serial.print(calibFlag);
  Serial.println();

  if(calibFlag == 1){
    Serial.println("CAL: calibrating...");
  }

  // BLE: send a CSV line ~20 Hz if connected
  if (deviceConnected && (t_ms - lastBLE_ms) >= 50) {  // 50 ms = 20 Hz
    lastBLE_ms = t_ms;

    char buf[64];
    int len = snprintf(
        buf,
        sizeof(buf),
        "%lu,%.3f,%.3f,%u",
        (unsigned long)t_ms,
        aZ_filt,
        vZ,
        rep_id,
        calibFlag
    );

    if (len > 0 && pDataChar != nullptr) {
      pDataChar->setValue((uint8_t*)buf, len);
      pDataChar->notify();
    }
  }
}
