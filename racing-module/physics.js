import { TRACK_LENGTH } from './biomes.js';

export function updateCarPhysics(car, input, delta) {
  const accelerationForce = 26;
  const brakingForce = 30;
  const drag = 9;
  const steerBase = 1.15;
  const trackHalfWidth = 42; // road widened to 90 units (see scene.js) for building-scale answer text
  const trackLength = TRACK_LENGTH + 40; // a little slack past the finish before any wrap safety net kicks in

  const throttle = input.forward ? 1 : 0;
  const brake = input.brake ? 1 : 0;
  const turning = (input.left ? 1 : 0) - (input.right ? 1 : 0);

  const momentumPhase = (car.speed >= 0 ? 1 : -1) * Math.min(Math.abs(car.speed) / car.maxSpeed, 1.2);
  const brakeForce = brake && car.speed > 0 ? brakingForce : 0;
  const targetAccel = throttle * accelerationForce - brakeForce;

  car.speed += targetAccel * delta;
  car.speed -= drag * delta * (1 + Math.abs(car.speed) * 0.05);

  if (car.speed < 0) car.speed = 0;
  if ((!throttle && !brake) || car.speed <= 0.05) {
    car.speed = Math.max(0, car.speed);
  }

  if (car.speed > car.maxSpeed) car.speed = car.maxSpeed;
  if (Math.abs(car.speed) < 0.12) car.speed = 0;

  const speedFactor = Math.min(Math.abs(car.speed) / 26, 1.5);
  const steerSensitivity = Math.max(0.26, 1.6 - speedFactor * 0.95);
  const steeringAmount = turning * steerBase * steerSensitivity;

  const sharpTurnThreshold = 0.72;
  const isDrifting = Math.abs(turning) > sharpTurnThreshold && Math.abs(car.speed) > 14;
  const driftTarget = isDrifting ? turning * (Math.abs(car.speed) * 0.22) : 0;
  car.drift += (driftTarget - car.drift) * (delta * 6);

  const steerVelocity = Math.sign(steeringAmount || 1) * Math.min(Math.abs(steeringAmount), 1.6);
  // Ramp up turn responsiveness quickly from a standstill, then hold steady — steerSensitivity
  // above already tapers steerVelocity down at speed, so this must NOT also grow with speed
  // (it used to, and the two effects compounded into an ever-accelerating spin at speed).
  const turnRamp = Math.min(1, 0.4 + Math.abs(car.speed) * 0.04);
  car.heading += steerVelocity * delta * 1.4 * turnRamp;

  const forwardX = Math.sin(car.heading);
  const forwardZ = Math.cos(car.heading);
  const sidewaysX = Math.cos(car.heading);
  const sidewaysZ = -Math.sin(car.heading);

  car.position.x += forwardX * car.speed * delta + sidewaysX * car.drift * delta * 0.8;
  car.position.z += forwardZ * car.speed * delta + sidewaysZ * car.drift * delta * 0.8;

  const wrappedZ = ((car.position.z + trackLength / 2) % trackLength) - trackLength / 2;
  car.position.z = wrappedZ;
  car.position.x = Math.min(trackHalfWidth, Math.max(-trackHalfWidth, car.position.x));

  const MAX_LEAN = 0.09; // radians (~5°) — cosmetic bank into the turn, never a tip-over
  const steerNormalized = steeringAmount / (steerBase * 1.6); // -1..1
  const leanFromSteer = -steerNormalized * MAX_LEAN * Math.min(speedFactor, 1);
  const leanFromDrift = -car.drift * 0.004;
  car.rotation.y = -car.heading;
  car.rotation.z = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, leanFromSteer + leanFromDrift));

  car.steer = steeringAmount;
  car.velocity.set(forwardX * car.speed, 0, forwardZ * car.speed);

  return {
    forwardX,
    forwardZ,
    speedFactor,
    drift: car.drift,
    isDrifting,
    momentumPhase,
  };
}
