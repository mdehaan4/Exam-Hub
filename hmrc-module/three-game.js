import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const WORLD_HALF_WIDTH = 17;
const WORLD_HALF_DEPTH = 13;

const KEY_BINDINGS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
]);

export function createHMRCGame(rootElement) {
  if (!rootElement) {
    return null;
  }

  const root = rootElement;
  root.innerHTML = '';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101827);
  scene.fog = new THREE.Fog(0x101827, 18, 44);

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 7, 10);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  root.appendChild(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0xfff0cf, 0x171b24, 1.5);
  scene.add(hemi);

  const ambientWarm = new THREE.PointLight(0xffc980, 28, 90, 2);
  ambientWarm.position.set(0, 8, 0);
  scene.add(ambientWarm);

  const sun = new THREE.DirectionalLight(0xffefcc, 1.2);
  sun.position.set(8, 16, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.bias = -0.0002;
  scene.add(sun);

  const tent = new THREE.Mesh(
    new THREE.CylinderGeometry(19, 19, 2.4, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xd7c1a4, side: THREE.DoubleSide, roughness: 0.9, metalness: 0.12 })
  );
  tent.position.y = 6.2;
  tent.castShadow = true;
  tent.receiveShadow = true;
  scene.add(tent);

  const tentRing = new THREE.Mesh(
    new THREE.TorusGeometry(18.8, 0.18, 12, 72),
    new THREE.MeshStandardMaterial({ color: 0xc98a4d, emissive: 0x451d09, emissiveIntensity: 0.3 })
  );
  tentRing.rotation.x = Math.PI / 2;
  tentRing.position.y = 5.7;
  scene.add(tentRing);

  const floorTextureCanvas = document.createElement('canvas');
  floorTextureCanvas.width = 256;
  floorTextureCanvas.height = 256;
  const floorTextureCtx = floorTextureCanvas.getContext('2d');
  floorTextureCtx.fillStyle = '#43372b';
  floorTextureCtx.fillRect(0, 0, 256, 256);
  floorTextureCtx.fillStyle = '#5a483b';
  for (let x = 0; x < 256; x += 32) {
    for (let y = 0; y < 256; y += 32) {
      floorTextureCtx.fillRect(x, y, 16, 16);
      floorTextureCtx.fillRect(x + 16, y + 16, 16, 16);
    }
  }
  floorTextureCtx.strokeStyle = '#7c6250';
  floorTextureCtx.lineWidth = 4;
  for (let i = 0; i <= 256; i += 32) {
    floorTextureCtx.beginPath();
    floorTextureCtx.moveTo(i, 0);
    floorTextureCtx.lineTo(i, 256);
    floorTextureCtx.moveTo(0, i);
    floorTextureCtx.lineTo(256, i);
    floorTextureCtx.stroke();
  }
  const floorTexture = new THREE.CanvasTexture(floorTextureCanvas);
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(3, 2.4);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 28),
    new THREE.MeshStandardMaterial({
      map: floorTexture,
      color: 0x8d725f,
      roughness: 0.9,
      metalness: 0.05,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const centerMat = new THREE.Mesh(
    new THREE.CircleGeometry(4.8, 32),
    new THREE.MeshStandardMaterial({ color: 0x7a4b2c, roughness: 0.9 })
  );
  centerMat.rotation.x = -Math.PI / 2;
  centerMat.position.y = 0.03;
  centerMat.receiveShadow = true;
  scene.add(centerMat);

  const roomBounds = new THREE.Group();
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x3b3e4f, roughness: 0.9, metalness: 0.1 });
  const wallSpec = [
    { size: [34, 4.6, 0.5], pos: [0, 2.3, -14] },
    { size: [34, 4.6, 0.5], pos: [0, 2.3, 14] },
    { size: [0.5, 4.6, 28], pos: [-17, 2.3, 0] },
    { size: [0.5, 4.6, 28], pos: [17, 2.3, 0] },
  ];

  for (const wall of wallSpec) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...wall.size), wallMaterial);
    mesh.position.set(...wall.pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    roomBounds.add(mesh);
  }
  scene.add(roomBounds);

  const stringLightMat = new THREE.MeshStandardMaterial({ color: 0xf8d58b, emissive: 0xf4af5b, emissiveIntensity: 0.75 });
  const lightPositions = [
    [-12, 5.5, -10], [-4, 5.5, -10], [4, 5.5, -10], [12, 5.5, -10],
    [-12, 5.5, 10], [-4, 5.5, 10], [4, 5.5, 10], [12, 5.5, 10],
    [-14, 5.5, 0], [14, 5.5, 0],
  ];

  for (const [x, y, z] of lightPositions) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), stringLightMat);
    bulb.position.set(x, y, z);
    scene.add(bulb);

    const lamp = new THREE.PointLight(0xffc880, 1.6, 18, 2);
    lamp.position.set(x, y - 0.25, z);
    scene.add(lamp);
  }

  const buntingGroup = new THREE.Group();
  const buntingColors = [0xf15b5b, 0x4aa3ff, 0x58c77d, 0xffb84d, 0xad7cff, 0xf8d77d];
  for (let i = 0; i < 10; i++) {
    const pennantY = 5.1 + (i % 2) * 0.2;
    const pennant = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.5, 4),
      new THREE.MeshStandardMaterial({ color: buntingColors[i % buntingColors.length], emissive: 0x2a1a08, emissiveIntensity: 0.15 })
    );
    pennant.rotation.z = i % 2 === 0 ? 0 : Math.PI;
    pennant.position.set(-15 + i * 3.3, pennantY, -13.2);
    pennant.castShadow = true;
    buntingGroup.add(pennant);
  }
  for (let i = 0; i < 10; i++) {
    const pennant = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.5, 4),
      new THREE.MeshStandardMaterial({ color: buntingColors[i % buntingColors.length], emissive: 0x2a1a08, emissiveIntensity: 0.15 })
    );
    pennant.rotation.z = i % 2 === 0 ? 0 : Math.PI;
    pennant.position.set(-15 + i * 3.3, 5.2 + (i % 2) * 0.2, 13.2);
    pennant.castShadow = true;
    buntingGroup.add(pennant);
  }
  scene.add(buntingGroup);

  const balloonPositions = [
    [-14, 4.8, -7], [-9, 5.1, -11], [-3, 5.4, -9], [5, 4.9, -10], [12, 5.2, -7],
    [-12, 5.1, 10], [-5, 5.4, 11], [3, 5.2, 9], [11, 5.0, 11],
  ];
  for (const [x, y, z] of balloonPositions) {
    const balloon = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 16, 16),
      new THREE.MeshStandardMaterial({ color: buntingColors[Math.abs(x) % buntingColors.length], emissive: 0x20130d, emissiveIntensity: 0.2, roughness: 0.8 })
    );
    balloon.position.set(x, y, z);
    balloon.castShadow = true;
    scene.add(balloon);

    const string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1.0, 8),
      new THREE.MeshStandardMaterial({ color: 0xf1e2be, roughness: 1 })
    );
    string.position.set(x, y - 0.7, z);
    string.rotation.z = 0.08;
    scene.add(string);
  }

  const stallDefs = [
    { x: -11.5, z: -8.1, color: 0xf15b5b, banner: 'TAX', text: 'Tax', accent: 0xffd680 },
    { x: -1.5, z: -8.2, color: 0x4aa3ff, banner: 'PAY', text: 'Payroll', accent: 0xfff8c6 },
    { x: 9.5, z: -8.3, color: 0x58c77d, banner: 'VAT', text: 'VAT', accent: 0xe8ffb0 },
    { x: -8.3, z: 8.1, color: 0xffb84d, banner: 'NI', text: 'NI', accent: 0xfff1b8 },
    { x: 8.2, z: 8.4, color: 0xad7cff, banner: 'RFI', text: 'Refunds', accent: 0xeae0ff },
  ];

  const stallGroup = new THREE.Group();
  const boothMaterial = new THREE.MeshStandardMaterial({ color: 0xefe4d3, roughness: 0.9, metalness: 0.08 });
  const counterMaterial = new THREE.MeshStandardMaterial({ color: 0x70543a, roughness: 0.8 });

  const createCharacter = ({ skinColor = 0xf1d7bc, outfitColor = 0x4d6fff, accentColor = 0xf7d15c, hairColor = 0x2b1d0f, hatColor = 0x6a3f2f, hasHat = false } = {}) => {
    const character = new THREE.Group();

    const pelvis = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 0.46, 0.42),
      new THREE.MeshStandardMaterial({ color: outfitColor, roughness: 0.7 })
    );
    pelvis.position.y = 1.02;
    pelvis.castShadow = true;
    character.add(pelvis);

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 1.52, 0.46),
      new THREE.MeshStandardMaterial({ color: outfitColor, roughness: 0.72, metalness: 0.08 })
    );
    torso.position.y = 1.88;
    torso.scale.set(1.02, 1.08, 0.92);
    torso.castShadow = true;
    character.add(torso);

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.14, 0.22, 10),
      new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.9 })
    );
    neck.position.y = 2.8;
    neck.castShadow = true;
    character.add(neck);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 22, 22),
      new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.9 })
    );
    head.position.y = 3.3;
    head.scale.set(1.0, 1.08, 1.0);
    head.castShadow = true;
    character.add(head);

    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.14, 12),
      new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.9 })
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 3.22, 0.3);
    nose.castShadow = true;
    character.add(nose);

    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 20, 20, 0, Math.PI * 2, 0, Math.PI / 1.5),
      new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.8 })
    );
    hair.position.set(0, 3.48, -0.08);
    hair.scale.set(1.08, 0.72, 1.12);
    hair.castShadow = true;
    character.add(hair);

    const collar = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.18, 0.28),
      new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.7 })
    );
    collar.position.set(0, 2.18, 0.04);
    collar.castShadow = true;
    character.add(collar);

    if (hasHat) {
      const hat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.44, 0.26, 20),
        new THREE.MeshStandardMaterial({ color: hatColor, roughness: 0.7 })
      );
      hat.position.y = 3.62;
      hat.castShadow = true;
      character.add(hat);
    }

    const leftArmUpper = new THREE.Group();
    leftArmUpper.position.set(-0.72, 2.5, 0);
    character.add(leftArmUpper);
    const leftUpperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.12, 0.62, 4, 8),
      new THREE.MeshStandardMaterial({ color: outfitColor, roughness: 0.72 })
    );
    leftUpperArm.position.y = -0.34;
    leftUpperArm.rotation.z = -0.28;
    leftUpperArm.castShadow = true;
    leftArmUpper.add(leftUpperArm);

    const leftArmLower = new THREE.Group();
    leftArmLower.position.set(0, -0.68, 0.02);
    leftArmUpper.add(leftArmLower);
    const leftLowerArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.11, 0.62, 4, 8),
      new THREE.MeshStandardMaterial({ color: outfitColor, roughness: 0.72 })
    );
    leftLowerArm.position.y = -0.34;
    leftLowerArm.rotation.z = 0.18;
    leftLowerArm.castShadow = true;
    leftArmLower.add(leftLowerArm);

    const leftHand = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 12),
      new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.9 })
    );
    leftHand.position.set(0, -0.74, 0.04);
    leftHand.castShadow = true;
    leftArmLower.add(leftHand);

    const rightArmUpper = new THREE.Group();
    rightArmUpper.position.set(0.72, 2.5, 0);
    character.add(rightArmUpper);
    const rightUpperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.12, 0.62, 4, 8),
      new THREE.MeshStandardMaterial({ color: outfitColor, roughness: 0.72 })
    );
    rightUpperArm.position.y = -0.34;
    rightUpperArm.rotation.z = 0.28;
    rightUpperArm.castShadow = true;
    rightArmUpper.add(rightUpperArm);

    const rightArmLower = new THREE.Group();
    rightArmLower.position.set(0, -0.68, 0.02);
    rightArmUpper.add(rightArmLower);
    const rightLowerArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.11, 0.62, 4, 8),
      new THREE.MeshStandardMaterial({ color: outfitColor, roughness: 0.72 })
    );
    rightLowerArm.position.y = -0.34;
    rightLowerArm.rotation.z = -0.18;
    rightLowerArm.castShadow = true;
    rightArmLower.add(rightLowerArm);

    const rightHand = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 12),
      new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.9 })
    );
    rightHand.position.set(0, -0.74, 0.04);
    rightHand.castShadow = true;
    rightArmLower.add(rightHand);

    const leftLegUpper = new THREE.Group();
    leftLegUpper.position.set(-0.22, 0.96, 0);
    character.add(leftLegUpper);
    const leftUpperLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.14, 0.9, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.82 })
    );
    leftUpperLeg.position.y = -0.48;
    leftUpperLeg.castShadow = true;
    leftLegUpper.add(leftUpperLeg);

    const leftLegLower = new THREE.Group();
    leftLegLower.position.set(0, -0.94, 0.04);
    leftLegUpper.add(leftLegLower);
    const leftLowerLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.12, 0.82, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.82 })
    );
    leftLowerLeg.position.y = -0.46;
    leftLowerLeg.castShadow = true;
    leftLegLower.add(leftLowerLeg);

    const leftFoot = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.12, 0.38),
      new THREE.MeshStandardMaterial({ color: 0x15191d, roughness: 0.9 })
    );
    leftFoot.position.set(0, -1.02, 0.12);
    leftFoot.castShadow = true;
    leftLegLower.add(leftFoot);

    const rightLegUpper = new THREE.Group();
    rightLegUpper.position.set(0.22, 0.96, 0);
    character.add(rightLegUpper);
    const rightUpperLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.14, 0.9, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.82 })
    );
    rightUpperLeg.position.y = -0.48;
    rightUpperLeg.castShadow = true;
    rightLegUpper.add(rightUpperLeg);

    const rightLegLower = new THREE.Group();
    rightLegLower.position.set(0, -0.94, 0.04);
    rightLegUpper.add(rightLegLower);
    const rightLowerLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.12, 0.82, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.82 })
    );
    rightLowerLeg.position.y = -0.46;
    rightLowerLeg.castShadow = true;
    rightLegLower.add(rightLowerLeg);

    const rightFoot = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.12, 0.38),
      new THREE.MeshStandardMaterial({ color: 0x15191d, roughness: 0.9 })
    );
    rightFoot.position.set(0, -1.02, 0.12);
    rightFoot.castShadow = true;
    rightLegLower.add(rightFoot);

    character.userData.parts = {
      torso,
      pelvis,
      head,
      hair,
      leftArmUpper,
      rightArmUpper,
      leftArmLower,
      rightArmLower,
      leftLegUpper,
      rightLegUpper,
      leftLegLower,
      rightLegLower,
    };

    character.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    return character;
  };

  const createNpc = (skinColor = 0xf1d7bc, outfitColor = 0x4d6fff, accentColor = 0xf7d15c, hairColor = 0x2b1d0f, hasHat = false) => createCharacter({ skinColor, outfitColor, accentColor, hairColor, hasHat });

  const createStall = (def, index) => {
    const stall = new THREE.Group();

    const platform = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 2.9), boothMaterial);
    platform.position.y = 0.25;
    platform.receiveShadow = true;
    stall.add(platform);

    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.1, 0.7), counterMaterial);
    counter.position.set(0, 0.8, 0.65);
    counter.castShadow = true;
    stall.add(counter);

    const awning = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 2.6), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7, metalness: 0.15 }));
    awning.position.set(0, 2.4, 0);
    awning.castShadow = true;
    stall.add(awning);

    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.7, 0.12),
      new THREE.MeshStandardMaterial({ color: def.accent, emissive: def.accent, emissiveIntensity: 0.18, roughness: 0.5 })
    );
    banner.position.set(0, 2.8, -0.22);
    stall.add(banner);

    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.32, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x17171a, emissive: 0x1c1c1c, emissiveIntensity: 0.15 })
    );
    sign.position.set(0, 2.8, -0.17);
    stall.add(sign);

    const signText = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: (() => {
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 128;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 56px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(def.banner, 128, 64);
          const tex = new THREE.CanvasTexture(canvas);
          tex.needsUpdate = true;
          return tex;
        })(),
        transparent: true,
      })
    );
    signText.position.set(0, 2.8, -0.12);
    signText.scale.set(1.4, 0.7, 1);
    stall.add(signText);

    const boothLight = new THREE.PointLight(def.color, 2.6, 13, 2);
    boothLight.position.set(0, 2.7, 0.7);
    boothLight.intensity = 1.7;
    stall.add(boothLight);

    const npcPalette = [
      { skin: 0xf2d0ad, outfit: 0x3d7ef7, accent: 0xfadf72, hair: 0x2f241c },
      { skin: 0xd9a77d, outfit: 0xf25a4a, accent: 0xffe78a, hair: 0x3f2f20 },
      { skin: 0xf3d3b4, outfit: 0x38b667, accent: 0xdff8b5, hair: 0x3b2b1e },
      { skin: 0xc68e6a, outfit: 0xf4a63d, accent: 0xffefae, hair: 0x1d1713 },
      { skin: 0xe7c59b, outfit: 0x8a63e6, accent: 0xf4ecff, hair: 0x36291d },
    ][index % 5];

    const npcSide = index % 2 === 0 ? -1.9 : 1.9;
    const npcDepth = 3.7;

    const npcBackdrop = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 2.35, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x12151a, roughness: 0.8, metalness: 0.14 })
    );
    npcBackdrop.position.set(npcSide, 1.22, 0.9);
    npcBackdrop.castShadow = true;
    npcBackdrop.receiveShadow = true;
    stall.add(npcBackdrop);

    const npcPedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.92, 1.02, 0.32, 18),
      new THREE.MeshStandardMaterial({ color: 0x2d221e, roughness: 0.9, metalness: 0.08 })
    );
    npcPedestal.position.set(npcSide, 0.18, npcDepth);
    npcPedestal.castShadow = true;
    npcPedestal.receiveShadow = true;
    stall.add(npcPedestal);

    const npcShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 18),
      new THREE.MeshStandardMaterial({ color: 0x180e0c, transparent: true, opacity: 0.4 })
    );
    npcShadow.rotation.x = -Math.PI / 2;
    npcShadow.position.set(npcSide, 0.04, npcDepth);
    stall.add(npcShadow);

    const npc = createNpc(npcPalette.skin, npcPalette.outfit, npcPalette.accent, npcPalette.hair, index % 2 === 0);
    npc.scale.setScalar(1.22);
    npc.position.set(npcSide, 0.24, npcDepth + 0.18);
    npc.rotation.y = index % 2 === 0 ? -0.9 : 0.9;
    stall.add(npc);
    stall.userData.npc = npc;

    stall.position.set(def.x, 0, def.z);
    stallGroup.add(stall);
    return stall;
  };

  stallDefs.forEach((def, index) => createStall(def, index));
  scene.add(stallGroup);

  const playerGroup = createCharacter({
    skinColor: 0xf2d0ad,
    outfitColor: 0x2f7cf7,
    accentColor: 0xffd864,
    hairColor: 0x2b1d0d,
    hasHat: true,
  });
  playerGroup.position.set(0, 0, 0);
  scene.add(playerGroup);

  const playerParts = playerGroup.userData.parts;

  const moveState = {
    forward: false,
    back: false,
    left: false,
    right: false,
  };

  const handleKey = (event, pressed) => {
    if (!KEY_BINDINGS.has(event.code)) {
      return;
    }

    if (event.code === 'KeyW' || event.code === 'ArrowUp') moveState.forward = pressed;
    if (event.code === 'KeyS' || event.code === 'ArrowDown') moveState.back = pressed;
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') moveState.left = pressed;
    if (event.code === 'KeyD' || event.code === 'ArrowRight') moveState.right = pressed;

    if (pressed) {
      event.preventDefault();
    }
  };

  window.addEventListener('keydown', (event) => handleKey(event, true));
  window.addEventListener('keyup', (event) => handleKey(event, false));

  const clock = new THREE.Clock();
  const playerVelocity = new THREE.Vector3();

  const resize = () => {
    const { innerWidth, innerHeight } = window;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  window.addEventListener('resize', resize);

  const updatePlayer = (delta) => {
    const forwardInput = (moveState.forward ? 1 : 0) - (moveState.back ? 1 : 0);
    const strafeInput = (moveState.right ? 1 : 0) - (moveState.left ? 1 : 0);

    const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    cameraForward.y = 0;
    if (cameraForward.lengthSq() > 0) {
      cameraForward.normalize();
    }

    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    cameraRight.y = 0;
    if (cameraRight.lengthSq() > 0) {
      cameraRight.normalize();
    }

    const moveVector = new THREE.Vector3();
    moveVector.addScaledVector(cameraForward, forwardInput);
    moveVector.addScaledVector(cameraRight, strafeInput);

    const isMoving = moveVector.lengthSq() > 0;

    if (isMoving) {
      moveVector.normalize();
      const speed = 6.5;
      playerVelocity.set(moveVector.x * speed, 0, moveVector.z * speed);
      const angle = Math.atan2(moveVector.x, moveVector.z);
      playerGroup.rotation.y = THREE.MathUtils.lerp(playerGroup.rotation.y, angle, 10 * delta);
      playerGroup.position.x += moveVector.x * speed * delta;
      playerGroup.position.z += moveVector.z * speed * delta;

      const clampedX = THREE.MathUtils.clamp(playerGroup.position.x, -WORLD_HALF_WIDTH + 1.2, WORLD_HALF_WIDTH - 1.2);
      const clampedZ = THREE.MathUtils.clamp(playerGroup.position.z, -WORLD_HALF_DEPTH + 1.2, WORLD_HALF_DEPTH - 1.2);
      playerGroup.position.set(clampedX, 0, clampedZ);
    } else {
      playerVelocity.set(0, 0, 0);
    }

    const walkCycle = isMoving ? clock.elapsedTime * 9.5 : 0;
    const gait = Math.sin(walkCycle) * (isMoving ? 1 : 0.15);
    const sway = Math.sin(walkCycle * 0.5) * (isMoving ? 0.18 : 0.04);

    if (playerParts.torso) {
      playerParts.torso.rotation.z = THREE.MathUtils.lerp(playerParts.torso.rotation.z, -moveVector.x * 0.16, 8 * delta);
      playerParts.torso.rotation.x = THREE.MathUtils.lerp(playerParts.torso.rotation.x, -gait * 0.16, 8 * delta);
      playerParts.torso.position.y = 1.88 + Math.abs(gait) * 0.06;
    }
    if (playerParts.pelvis) {
      playerParts.pelvis.rotation.z = sway * 0.8;
      playerParts.pelvis.position.y = 1.02 + Math.abs(gait) * 0.05;
    }
    if (playerParts.head) {
      playerParts.head.rotation.z = THREE.MathUtils.lerp(playerParts.head.rotation.z, -moveVector.x * 0.12, 8 * delta);
      playerParts.head.rotation.y = THREE.MathUtils.lerp(playerParts.head.rotation.y, moveVector.x * 0.2, 8 * delta);
      playerParts.head.position.y = 3.3 + Math.abs(gait) * 0.04;
    }
    if (playerParts.leftArmUpper) {
      playerParts.leftArmUpper.rotation.x = -gait * 1.05 + (isMoving ? 0.18 : 0.0);
      playerParts.leftArmUpper.rotation.z = -0.28;
    }
    if (playerParts.rightArmUpper) {
      playerParts.rightArmUpper.rotation.x = gait * 1.05 - (isMoving ? 0.18 : 0.0);
      playerParts.rightArmUpper.rotation.z = 0.28;
    }
    if (playerParts.leftArmLower) {
      playerParts.leftArmLower.rotation.x = -gait * 0.7;
      playerParts.leftArmLower.rotation.z = 0.18;
    }
    if (playerParts.rightArmLower) {
      playerParts.rightArmLower.rotation.x = gait * 0.7;
      playerParts.rightArmLower.rotation.z = -0.18;
    }
    if (playerParts.leftLegUpper) playerParts.leftLegUpper.rotation.x = gait * 1.6;
    if (playerParts.rightLegUpper) playerParts.rightLegUpper.rotation.x = -gait * 1.6;
    if (playerParts.leftLegLower) playerParts.leftLegLower.rotation.x = -gait * 0.9;
    if (playerParts.rightLegLower) playerParts.rightLegLower.rotation.x = gait * 0.9;
  };

  const updateCamera = (delta) => {
    const desiredOffset = new THREE.Vector3(0, 5.0, -8.2);
    desiredOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerGroup.rotation.y);
    const desiredPosition = playerGroup.position.clone().add(desiredOffset);
    camera.position.lerp(desiredPosition, 1 - Math.exp(-delta * 6));

    const lookTarget = playerGroup.position.clone().add(new THREE.Vector3(0, 2.2, 0));
    camera.lookAt(lookTarget);
  };

  const tick = () => {
    const delta = Math.min(clock.getDelta(), 0.05);
    updatePlayer(delta);
    updateCamera(delta);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };

  tick();

  const publicApi = {
    scene,
    camera,
    renderer,
    player: playerGroup,
    clock,
  };

  window.__hmrcGame = publicApi;
  return publicApi;
}
