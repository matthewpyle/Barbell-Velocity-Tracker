// Firmware v0.1 - Bench press IMU logger
// Features: vertical accel/velocity, rep counting, CSV over Serial

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_LSM6DSOX.h> // https://github.com/adafruit/Adafruit_LSM6DS
#include <math.h>

#define SDA_PIN 21 // GPIO21 on ESP32
#define SCL_PIN 22 // GPIO22 on ESP32

Adafruit_LSM6DSOX imu; // Create an instance of the LSM6DSOX sensor

static float ODR_HZ = 104.0f;  // Output Data Rate in Hz
uint32_t lastMicros = 0;

enum RepState { IDLE, ACTIVE };
RepState state = IDLE;

// Simple vertical signal state
float aZ_filt = 0.0f;       // filtered vertical acceleration (m/s^2)
float vZ      = 0.0f;       // vertical velocity (m/s)
uint16_t rep_id = 0;        // simple rep counter

// Filter / integration parameters
const float LPF_ALPHA = 0.1f;        // low-pass filter factor (0–1, smaller = smoother)
const float GRAVITY   = 9.80665f;    // m/s^2

// Rep detection tuning
// Assume positive vZ = bar moving UP (concentric). If it’s opposite in your plots,
// flip the sign later (vZ = -vZ) or swap > / < where noted.
const float VEL_START_THRESH = 0.10f;   // m/s, concentric start threshold (lower than before)
const float VEL_END_THRESH   = 0.02f;   // m/s, “back to rest” threshold
const float ACC_STILL_THRESH = 0.30f;   // m/s^2, to detect bar roughly still
const uint16_t MIN_REP_TIME_MS = 200;   // minimum rep duration to avoid noise

uint32_t repStart_ms = 0;

void setup() {
  Serial.begin(115200);
  delay(300);

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);

  // Initialize the IMU sensor on I2C
  if (!imu.begin_I2C()) {
    Serial.println("ERROR: Gyro not found");
    while (true) {
      delay(1000);
    }
  }

  // Configure the IMU settings
  imu.setAccelRange(LSM6DS_ACCEL_RANGE_16_G);
  imu.setGyroRange(LSM6DS_GYRO_RANGE_2000_DPS);
  imu.setAccelDataRate(LSM6DS_RATE_104_HZ);
  imu.setGyroDataRate(LSM6DS_RATE_104_HZ);

  // CSV header
  Serial.println("rep_id,t_ms,ax_mps2,ay_mps2,az_mps2,gx_rads,gy_rads,gz_rads,aZ_filt,vZ");

  lastMicros = micros();
}

void loop() {
  // ---- Timer to pace at approximately ODR, but use real dt for integration ----
  const uint32_t period_us = (uint32_t)(1e6f / ODR_HZ);
  uint32_t nowUS = micros();
  int32_t diff = (int32_t)(nowUS - lastMicros);

  if (diff < period_us) {
    return; // not time yet
  }

  float dt = diff / 1e6f;   // seconds since last sample
  lastMicros = nowUS;

  // ---- Get new IMU data ----
  sensors_event_t acc, gy, temp;
  imu.getEvent(&acc, &gy, &temp);

  // Raw acceleration (m/s^2)
  float ax = acc.acceleration.x;
  float ay = acc.acceleration.y;
  float az = acc.acceleration.z;

  // Raw gyro (rad/s)
  float gx = gy.gyro.x;
  float gy_ = gy.gyro.y;
  float gz = gy.gyro.z;

  // ---- Vertical axis handling ----
  // Assumption: sensor Z-axis is roughly vertical.
  float aZ_no_g = az - GRAVITY;

  // Simple low-pass filter on vertical accel
  aZ_filt = LPF_ALPHA * aZ_no_g + (1.0f - LPF_ALPHA) * aZ_filt;

  // Integrate to get vertical velocity (very rough; will drift!)
  vZ += aZ_filt * dt;

  // ---- Simple drift control when bar is still ----
  // If acceleration is near zero for a bit, gently push velocity back towards 0.
  if (fabsf(aZ_filt) < ACC_STILL_THRESH) {
    vZ *= 0.98f;  // small decay towards 0 when bar is still
  }

  // ---- Rep detection ----
  uint32_t t_ms = millis();

  switch (state) {
    case IDLE:
      // Concentric start: vZ goes above start threshold.
      // If your sign is flipped, change this to (vZ < -VEL_START_THRESH).
      if (vZ > VEL_START_THRESH) {
        state = ACTIVE;
        rep_id++;
        repStart_ms = t_ms;
        // Optional debug
        // Serial.println("START REP");
      }
      break;

    case ACTIVE:
      // End rep when velocity magnitude is small again and we’ve had a minimum duration
      if (fabsf(vZ) < VEL_END_THRESH && (t_ms - repStart_ms) > MIN_REP_TIME_MS) {
        state = IDLE;
        // Reset velocity to reduce drift between reps
        vZ = 0.0f;
        // Optional debug
        // Serial.println("END REP");
      }
      break;
  }

  // ---- CSV output ----
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
}
