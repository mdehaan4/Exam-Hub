import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export class Car extends THREE.Group {
  constructor() {
    super();

    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xb52f2f,
      emissive: 0x000000,
      metalness: 0.45,
      roughness: 0.42,
      clearcoat: 0.35,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.45,
    });

    const body = new THREE.Mesh(new RoundedBoxGeometry(2.5, 0.7, 4.9, 3, 0.18), bodyMaterial);
    body.position.y = 0.9;
    body.castShadow = true;
    body.receiveShadow = true;
    this.add(body);

    const hood = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.42, 1.7, 3, 0.14), bodyMaterial);
    hood.position.set(0, 1.18, 1.45);
    hood.castShadow = true;
    this.add(hood);

    const cabin = new THREE.Mesh(
      new RoundedBoxGeometry(1.8, 0.72, 2.2, 3, 0.16),
      new THREE.MeshPhysicalMaterial({
        color: 0x9cc7e7,
        emissive: 0x000000,
        metalness: 0.35,
        roughness: 0.18,
        transmission: 0.2,
        transparent: true,
        opacity: 0.88,
        clearcoat: 0.5,
        envMapIntensity: 0.5,
      })
    );
    cabin.position.set(0, 1.55, -0.2);
    cabin.castShadow = true;
    this.add(cabin);

    const windshield = new THREE.Mesh(
      new RoundedBoxGeometry(1.45, 0.5, 1.4, 2, 0.1),
      new THREE.MeshPhysicalMaterial({
        color: 0xadd8ff,
        emissive: 0x000000,
        metalness: 0.1,
        roughness: 0.08,
        transmission: 0.55,
        transparent: true,
        opacity: 0.7,
        envMapIntensity: 0.5,
      })
    );
    windshield.position.set(0, 1.5, 0.9);
    windshield.rotation.x = -0.2;
    this.add(windshield);

    const roof = new THREE.Mesh(new RoundedBoxGeometry(1.55, 0.18, 2.0, 2, 0.08), bodyMaterial);
    roof.position.set(0, 1.95, -0.15);
    roof.castShadow = true;
    this.add(roof);

    const bumper = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.35, 0.35, 2, 0.1), bodyMaterial);
    bumper.position.set(0, 0.72, 2.6);
    bumper.castShadow = true;
    this.add(bumper);

    const wing = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.12, 0.8, 2, 0.05), bodyMaterial);
    wing.position.set(0, 1.1, -2.55);
    wing.castShadow = true;
    this.add(wing);

    const headlightMaterial = new THREE.MeshStandardMaterial({ color: 0xf7f9ff, emissive: 0xfff8dc, emissiveIntensity: 0.15 });
    const headlightL = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.18, 0.18, 2, 0.06), headlightMaterial);
    headlightL.position.set(-0.8, 1.1, 2.5);
    const headlightR = headlightL.clone();
    headlightR.position.x = 0.8;
    this.add(headlightL, headlightR);

    const wheelGeometry = new THREE.CylinderGeometry(0.45, 0.45, 0.42, 24);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.85, metalness: 0.25 });
    const rimGeometry = new THREE.CylinderGeometry(0.28, 0.28, 0.44, 6);
    const rimMaterial = new THREE.MeshStandardMaterial({ color: 0xcbd2d9, roughness: 0.35, metalness: 0.85 });
    const hubGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.46, 12);
    const hubMaterial = new THREE.MeshStandardMaterial({ color: 0x8a9099, roughness: 0.3, metalness: 0.9 });
    const wheelPositions = [
      [-1.15, 0.42, 1.6],
      [1.15, 0.42, 1.6],
      [-1.15, 0.42, -1.6],
      [1.15, 0.42, -1.6],
    ];

    this.wheels = [];
    wheelPositions.forEach(([x, y, z]) => {
      const wheel = new THREE.Group();
      wheel.position.set(x, y, z);

      const tire = new THREE.Mesh(wheelGeometry, wheelMaterial);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      tire.receiveShadow = true;
      wheel.add(tire);

      const rim = new THREE.Mesh(rimGeometry, rimMaterial);
      rim.rotation.z = Math.PI / 2;
      wheel.add(rim);

      const hub = new THREE.Mesh(hubGeometry, hubMaterial);
      hub.rotation.z = Math.PI / 2;
      wheel.add(hub);

      this.add(wheel);
      this.wheels.push(wheel);
    });

    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.steer = 0;
    this.turnInput = 0;
    this.drift = 0;
    this.maxSpeed = 42;
    this.position.set(0, 0.22, 0);
  }

  steer(amount) {
    this.turnInput = amount;
  }
}
