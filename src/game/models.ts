import * as THREE from 'three';
import { CarStyleId, PotholeSeverity } from './types';

export interface CarRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  paintMat: THREE.MeshPhysicalMaterial;
  accentMat: THREE.MeshStandardMaterial;
  wheels: THREE.Group[];
  brakeLights: THREE.MeshStandardMaterial;
  topAccessory: THREE.Object3D;
  tireMeshes: THREE.Mesh[];
  contactShadow: THREE.Mesh;
}

export interface PedestrianRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  head: THREE.Group;
  madGroup: THREE.Group;
  babbleMouth: THREE.Mesh;
  walkPhase: number;
  isGuard: boolean;
}

export interface PotholeRig {
  root: THREE.Group;
  ringMesh: THREE.Mesh;
  starGroup: THREE.Group | null;
  severity: PotholeSeverity;
}

function makeRoundedBoxShape(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return shape;
}

export function createCarModel(
  style: CarStyleId,
  primaryHex: number,
  accentHex: number,
  contactShadowTexture: THREE.Texture,
  isSoftwareGl: boolean,
): CarRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: primaryHex,
    roughness: 0.2,
    metalness: 0.16,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    roughness: 0.4,
    metalness: 0.12,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.72,
    metalness: 0.2,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.15,
    metalness: 0.88,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbfe9ff,
    roughness: 0.08,
    metalness: 0.05,
    transmission: isSoftwareGl ? 0 : 0.45,
    transparent: true,
    opacity: isSoftwareGl ? 0.75 : 0.92,
    ior: 1.45,
  });

  // 1. Soft contact shadow grounded at y = 0.02
  const shadowGeo = new THREE.PlaneGeometry(2.6, 4.1);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.48,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.02;
  root.add(contactShadow);

  // 2. Primary Chassis Silhouette (Beveled ExtrudeGeometry)
  const hullShape = makeRoundedBoxShape(1.88, 3.24, 0.28);
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.62,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.08,
    bevelThickness: 0.08,
  });
  hullGeo.rotateX(Math.PI / 2);
  hullGeo.computeVertexNormals();
  const hull = new THREE.Mesh(hullGeo, paintMat);
  hull.position.set(0, 1.0, 0);
  hull.castShadow = true;
  hull.receiveShadow = true;
  bodyGroup.add(hull);

  // 3. Secondary Silhouette: Cabin / Roof
  const cabinWidth = style === 'van' ? 1.68 : 1.54;
  const cabinLength = style === 'van' ? 2.25 : 1.65;
  const cabinHeight = style === 'van' ? 0.76 : 0.62;
  const cabinShape = makeRoundedBoxShape(cabinWidth, cabinLength, 0.22);
  const cabinGeo = new THREE.ExtrudeGeometry(cabinShape, {
    depth: cabinHeight,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.06,
    bevelThickness: 0.06,
  });
  cabinGeo.rotateX(Math.PI / 2);
  const cabin = new THREE.Mesh(cabinGeo, style === 'van' ? accentMat : paintMat);
  cabin.position.set(0, 1.02 + cabinHeight, style === 'van' ? 0.22 : 0.14);
  cabin.castShadow = true;
  bodyGroup.add(cabin);

  // 4. Windshield & Side Windows
  const frontGlass = new THREE.Mesh(
    new THREE.BoxGeometry(cabinWidth - 0.14, cabinHeight * 0.62, 0.1),
    glassMat,
  );
  frontGlass.position.set(0, 1.34, style === 'van' ? -0.92 : -0.7);
  frontGlass.rotation.x = -0.18;
  bodyGroup.add(frontGlass);

  const rearGlass = new THREE.Mesh(
    new THREE.BoxGeometry(cabinWidth - 0.18, cabinHeight * 0.56, 0.1),
    glassMat,
  );
  rearGlass.position.set(0, 1.34, style === 'van' ? 1.36 : 0.98);
  rearGlass.rotation.x = 0.15;
  bodyGroup.add(rearGlass);

  const sideGlass = new THREE.Mesh(
    new THREE.BoxGeometry(cabinWidth + 0.08, cabinHeight * 0.56, cabinLength * 0.68),
    glassMat,
  );
  sideGlass.position.set(0, 1.35, style === 'van' ? 0.22 : 0.14);
  bodyGroup.add(sideGlass);

  // 5. Front & Rear Bumpers + Racing Stripe + Dual Exhaust Pipes
  const frontBumper = new THREE.Mesh(
    new THREE.BoxGeometry(1.98, 0.22, 0.22),
    chromeMat,
  );
  frontBumper.position.set(0, 0.44, -1.67);
  frontBumper.castShadow = true;
  bodyGroup.add(frontBumper);

  const rearBumper = new THREE.Mesh(
    new THREE.BoxGeometry(1.98, 0.22, 0.22),
    chromeMat,
  );
  rearBumper.position.set(0, 0.44, 1.67);
  rearBumper.castShadow = true;
  bodyGroup.add(rearBumper);

  const hoodStripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.05, 0.92),
    accentMat,
  );
  hoodStripe.position.set(0, 1.09, -1.06);
  bodyGroup.add(hoodStripe);

  const exhaustGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.28, 10);
  exhaustGeo.rotateX(Math.PI / 2);
  [-0.45, 0.45].forEach((ex) => {
    const pipe = new THREE.Mesh(exhaustGeo, chromeMat);
    pipe.position.set(ex, 0.34, 1.78);
    bodyGroup.add(pipe);
  });

  // 6. Headlights + Brake Lights
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff3b0,
    emissiveIntensity: 0.75,
    roughness: 0.15,
  });
  const headlightGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 16);
  headlightGeo.rotateX(Math.PI / 2);

  [-0.62, 0.62].forEach((xPos) => {
    const hl = new THREE.Mesh(headlightGeo, headlightMat);
    hl.position.set(xPos, 0.72, -1.66);
    bodyGroup.add(hl);
  });

  const brakeLights = new THREE.MeshStandardMaterial({
    color: 0xff2a2a,
    emissive: 0xff1e1e,
    emissiveIntensity: 0.45,
    roughness: 0.25,
  });
  [-0.64, 0.64].forEach((xPos) => {
    const tl = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.2, 0.1),
      brakeLights,
    );
    tl.position.set(xPos, 0.74, 1.66);
    bodyGroup.add(tl);
  });

  // 7. Roof Accessory
  const topAccessory = new THREE.Group();
  topAccessory.position.set(0, 1.08 + cabinHeight, style === 'van' ? 0.22 : 0.14);
  if (style === 'taxi') {
    const signBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.26, 0.36),
      new THREE.MeshStandardMaterial({
        color: 0xfffbeb,
        emissive: 0xfde047,
        emissiveIntensity: 0.45,
        roughness: 0.3,
      }),
    );
    signBase.position.y = 0.13;
    topAccessory.add(signBase);
  } else if (style === 'buggy') {
    const spoiler = new THREE.Mesh(
      new THREE.BoxGeometry(1.56, 0.1, 0.36),
      accentMat,
    );
    spoiler.position.set(0, 0.18, 0.64);
    const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.14), trimMat);
    strutL.position.set(-0.5, 0.08, 0.64);
    const strutR = strutL.clone();
    strutR.position.x = 0.5;
    topAccessory.add(spoiler, strutL, strutR);
  } else {
    const surfBoard = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.24, 1.45, 6, 10),
      new THREE.MeshStandardMaterial({
        color: 0x00bbf9,
        roughness: 0.22,
        metalness: 0.12,
      }),
    );
    surfBoard.rotation.x = Math.PI / 2;
    surfBoard.scale.set(1.25, 1, 0.32);
    surfBoard.position.y = 0.14;
    topAccessory.add(surfBoard);
  }
  bodyGroup.add(topAccessory);

  // 8. 4 Wheels
  const wheels: THREE.Group[] = [];
  const tireMeshes: THREE.Mesh[] = [];
  const tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 20);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.34, 14);
  rimGeo.rotateZ(Math.PI / 2);
  const hubCapGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.36, 12);
  hubCapGeo.rotateZ(Math.PI / 2);

  const wheelPositions: [number, number, number][] = [
    [-0.99, 0.38, -1.04],
    [0.99, 0.38, -1.04],
    [-0.99, 0.38, 1.04],
    [0.99, 0.38, 1.04],
  ];

  wheelPositions.forEach(([wx, wy, wz]) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(wx, wy, wz);
    const tire = new THREE.Mesh(tireGeo, trimMat);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, chromeMat);
    const hub = new THREE.Mesh(hubCapGeo, paintMat);
    wheelGroup.add(tire, rim, hub);
    root.add(wheelGroup);
    wheels.push(wheelGroup);
    tireMeshes.push(tire);
  });

  return {
    root,
    bodyGroup,
    paintMat,
    accentMat,
    wheels,
    brakeLights,
    topAccessory,
    tireMeshes,
    contactShadow,
  };
}

export function createTurntablePedestal(): THREE.Group {
  const group = new THREE.Group();

  // Main bright glossy stage disc
  const baseDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(3.1, 3.35, 0.28, 36),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.15,
    }),
  );
  baseDisc.position.y = 0.14;
  baseDisc.receiveShadow = true;
  group.add(baseDisc);

  // Bright sky-blue glowing trim ring
  const trimRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.16, 0.09, 10, 40),
    new THREE.MeshStandardMaterial({
      color: 0x00bbf9,
      emissive: 0x00bbf9,
      emissiveIntensity: 0.55,
      roughness: 0.2,
    }),
  );
  trimRing.rotation.x = Math.PI / 2;
  trimRing.position.y = 0.26;
  group.add(trimRing);

  // Decorative accent wedges around turntable rim
  const dotGeo = new THREE.BoxGeometry(0.32, 0.06, 0.22);
  const dotColors = [0xffd60a, 0xff4d6d, 0x38b000, 0x9b5de5];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const dot = new THREE.Mesh(
      dotGeo,
      new THREE.MeshStandardMaterial({
        color: dotColors[i % dotColors.length],
        roughness: 0.35,
      }),
    );
    dot.position.set(Math.cos(angle) * 2.7, 0.29, Math.sin(angle) * 2.7);
    dot.rotation.y = -angle;
    group.add(dot);
  }

  return group;
}

const potholeSharedGeos = {
  outerRing: new THREE.RingGeometry(0.88, 1.16, 24),
  innerGlowRing: new THREE.RingGeometry(1.18, 1.36, 24),
  craterRim: new THREE.TorusGeometry(0.88, 0.12, 8, 24),
  craterPit: new THREE.CircleGeometry(0.88, 24),
  puddle: new THREE.CircleGeometry(0.68, 20),
  mediumGem: new THREE.OctahedronGeometry(0.36, 0),
  highStar: new THREE.OctahedronGeometry(0.46, 0),
  halo: new THREE.TorusGeometry(0.62, 0.06, 8, 22),
  coneBody: new THREE.ConeGeometry(0.18, 0.52, 10),
  coneBase: new THREE.BoxGeometry(0.38, 0.06, 0.38),
  coneStripe: new THREE.CylinderGeometry(0.11, 0.14, 0.12, 10),
};

potholeSharedGeos.outerRing.rotateX(-Math.PI / 2);
potholeSharedGeos.innerGlowRing.rotateX(-Math.PI / 2);
potholeSharedGeos.craterRim.rotateX(Math.PI / 2);
potholeSharedGeos.craterPit.rotateX(-Math.PI / 2);
potholeSharedGeos.puddle.rotateX(-Math.PI / 2);

const potholeSharedMats = {
  lowRing: new THREE.MeshBasicMaterial({
    color: 0xffd60a,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  }),
  mediumRing: new THREE.MeshBasicMaterial({
    color: 0xff7b00,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  }),
  highRing: new THREE.MeshBasicMaterial({
    color: 0xf15bb5,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  }),
  highGoldRing: new THREE.MeshBasicMaterial({
    color: 0xffd60a,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  }),
  rimAsphalt: new THREE.MeshStandardMaterial({
    color: 0x262b36,
    roughness: 0.92,
    metalness: 0.05,
  }),
  pitDark: new THREE.MeshStandardMaterial({
    color: 0x161922,
    roughness: 0.95,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  }),
  waterPuddle: new THREE.MeshStandardMaterial({
    color: 0x00bbf9,
    roughness: 0.08,
    metalness: 0.25,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  }),
  mediumPuddle: new THREE.MeshStandardMaterial({
    color: 0xff9f1c,
    emissive: 0xff7b00,
    emissiveIntensity: 0.3,
    roughness: 0.12,
    metalness: 0.4,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  }),
  highPuddle: new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: 0xf15bb5,
    emissiveIntensity: 0.55,
    roughness: 0.1,
    metalness: 0.7,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  }),
  mediumGem: new THREE.MeshStandardMaterial({
    color: 0xffb703,
    emissive: 0xff7b00,
    emissiveIntensity: 0.45,
    roughness: 0.18,
    metalness: 0.75,
  }),
  highStar: new THREE.MeshStandardMaterial({
    color: 0xfff3b0,
    emissive: 0xf15bb5,
    emissiveIntensity: 0.65,
    roughness: 0.14,
    metalness: 0.88,
  }),
  coneOrange: new THREE.MeshStandardMaterial({
    color: 0xff6b00,
    roughness: 0.45,
  }),
  coneWhite: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
  }),
};

export function createPotholeModel(severity: PotholeSeverity): PotholeRig {
  const root = new THREE.Group();

  const scaleFactor =
    severity === 'high' ? 1.38 : severity === 'medium' ? 1.18 : 1.0;

  const ringMat =
    severity === 'high'
      ? potholeSharedMats.highRing
      : severity === 'medium'
        ? potholeSharedMats.mediumRing
        : potholeSharedMats.lowRing;

  const ringMesh = new THREE.Mesh(potholeSharedGeos.outerRing, ringMat);
  ringMesh.position.y = 0.025;
  ringMesh.scale.setScalar(scaleFactor);
  root.add(ringMesh);

  if (severity === 'high' || severity === 'medium') {
    const outerGlow = new THREE.Mesh(
      potholeSharedGeos.innerGlowRing,
      severity === 'high'
        ? potholeSharedMats.highGoldRing
        : potholeSharedMats.lowRing,
    );
    outerGlow.position.y = 0.024;
    outerGlow.scale.setScalar(scaleFactor);
    root.add(outerGlow);
  }

  const craterRim = new THREE.Mesh(
    potholeSharedGeos.craterRim,
    potholeSharedMats.rimAsphalt,
  );
  craterRim.position.y = 0.04;
  craterRim.scale.set(1.02 * scaleFactor, 0.6 * scaleFactor, 0.92 * scaleFactor);
  root.add(craterRim);

  const craterPit = new THREE.Mesh(
    potholeSharedGeos.craterPit,
    potholeSharedMats.pitDark,
  );
  craterPit.position.y = 0.028;
  craterPit.scale.set(scaleFactor, 1, 0.9 * scaleFactor);
  root.add(craterPit);

  const puddleMat =
    severity === 'high'
      ? potholeSharedMats.highPuddle
      : severity === 'medium'
        ? potholeSharedMats.mediumPuddle
        : potholeSharedMats.waterPuddle;

  const puddle = new THREE.Mesh(potholeSharedGeos.puddle, puddleMat);
  puddle.position.y = 0.032;
  puddle.scale.set(1.05 * scaleFactor, 1, 0.86 * scaleFactor);
  root.add(puddle);

  let starGroup: THREE.Group | null = null;
  if (severity === 'medium') {
    starGroup = new THREE.Group();
    starGroup.position.y = 0.85;
    const gem = new THREE.Mesh(
      potholeSharedGeos.mediumGem,
      potholeSharedMats.mediumGem,
    );
    starGroup.add(gem);
    root.add(starGroup);
  } else if (severity === 'high') {
    starGroup = new THREE.Group();
    starGroup.position.y = 1.05;
    const star = new THREE.Mesh(
      potholeSharedGeos.highStar,
      potholeSharedMats.highStar,
    );
    const halo = new THREE.Mesh(
      potholeSharedGeos.halo,
      potholeSharedMats.highStar,
    );
    halo.rotation.x = Math.PI / 3;
    starGroup.add(star, halo);
    root.add(starGroup);

    // Two mini orange safety cones flanking high severity potholes
    [-1.42, 1.42].forEach((cx) => {
      const cone = new THREE.Group();
      cone.position.set(cx, 0.02, 0);
      const cBase = new THREE.Mesh(
        potholeSharedGeos.coneBase,
        potholeSharedMats.coneOrange,
      );
      cBase.position.y = 0.03;
      const cBody = new THREE.Mesh(
        potholeSharedGeos.coneBody,
        potholeSharedMats.coneOrange,
      );
      cBody.position.y = 0.28;
      cBody.castShadow = true;
      const cStripe = new THREE.Mesh(
        potholeSharedGeos.coneStripe,
        potholeSharedMats.coneWhite,
      );
      cStripe.position.y = 0.26;
      cone.add(cBase, cBody, cStripe);
      root.add(cone);
    });
  }

  return { root, ringMesh, starGroup, severity };
}

const SHIRT_COLORS = [0xff4d6d, 0x00bbf9, 0x9b5de5, 0xff7b00, 0x38b000, 0xf15bb5];
const PANTS_COLORS = [0x1e3a8a, 0x334155, 0x7c2d12, 0x0f766e];
const SKIN_COLORS = [0xfcd5b5, 0xe8b48a, 0xc68652, 0x8d5524, 0xfde2c8];
const BACKPACK_COLORS = [0xffd60a, 0xff4d6d, 0x00bbf9, 0x38b000, 0xf15bb5];

export function createPedestrianModel(
  seed: number,
  isGuard: boolean,
  contactShadowTexture: THREE.Texture,
): PedestrianRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const shirtColor = isGuard
    ? 0xa3e635
    : SHIRT_COLORS[seed % SHIRT_COLORS.length];
  const pantsColor = PANTS_COLORS[(seed + 1) % PANTS_COLORS.length];
  const skinColor = SKIN_COLORS[(seed + 2) % SKIN_COLORS.length];
  const bagColor = BACKPACK_COLORS[(seed + 3) % BACKPACK_COLORS.length];

  const shirtMat = new THREE.MeshStandardMaterial({
    color: shirtColor,
    roughness: 0.7,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: pantsColor,
    roughness: 0.78,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinColor,
    roughness: 0.65,
  });
  const bagMat = new THREE.MeshStandardMaterial({
    color: bagColor,
    roughness: 0.5,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
  });

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 1.15),
    new THREE.MeshBasicMaterial({
      map: contactShadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.42,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  const legGeo = new THREE.CapsuleGeometry(0.11, 0.36, 4, 8);
  const shoeGeo = new THREE.BoxGeometry(0.22, 0.14, 0.34);

  const makeLeg = (xOffset: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xOffset, 0.62, 0);
    const legMesh = new THREE.Mesh(legGeo, pantsMat);
    legMesh.position.y = -0.26;
    legMesh.castShadow = true;
    const shoe = new THREE.Mesh(shoeGeo, darkMat);
    shoe.position.set(0, -0.54, 0.05);
    shoe.castShadow = true;
    legPivot.add(legMesh, shoe);
    bodyGroup.add(legPivot);
    return legPivot;
  };

  const leftLeg = makeLeg(-0.15);
  const rightLeg = makeLeg(0.15);

  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.26, 0.36, 6, 10),
    shirtMat,
  );
  torso.position.y = 0.98;
  torso.castShadow = true;
  bodyGroup.add(torso);

  if (!isGuard) {
    const backpack = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.44, 0.24),
      bagMat,
    );
    backpack.position.set(0, 1.0, -0.28);
    backpack.castShadow = true;
    bodyGroup.add(backpack);
  } else {
    const vestStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.1, 0.48),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 0.3,
        roughness: 0.35,
      }),
    );
    vestStripe.position.y = 0.96;
    bodyGroup.add(vestStripe);
  }

  const armGeo = new THREE.CapsuleGeometry(0.09, 0.34, 4, 8);
  const makeArm = (xOffset: number) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(xOffset, 1.2, 0);
    const arm = new THREE.Mesh(armGeo, shirtMat);
    arm.position.y = -0.22;
    arm.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), skinMat);
    hand.position.y = -0.44;
    armPivot.add(arm, hand);
    bodyGroup.add(armPivot);
    return armPivot;
  };

  const leftArm = makeArm(-0.34);
  const rightArm = makeArm(0.34);

  if (isGuard) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 1.0, 8),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 }),
    );
    pole.position.set(0, -0.1, 0.25);
    const stopSign = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.06, 8),
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 0.25,
        roughness: 0.4,
      }),
    );
    stopSign.rotation.x = Math.PI / 2;
    stopSign.position.set(0, 0.45, 0.25);
    rightArm.add(pole, stopSign);
    rightArm.rotation.x = -0.5;
  }

  const head = new THREE.Group();
  head.position.set(0, 1.56, 0);
  const skull = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 16, 14),
    skinMat,
  );
  skull.castShadow = true;
  head.add(skull);

  const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8);
  [-0.09, 0.09].forEach((ex) => {
    const eye = new THREE.Mesh(eyeGeo, darkMat);
    eye.position.set(ex, 0.03, 0.24);
    head.add(eye);
  });

  // Babble mouth (opens/closes rapidly when mad)
  const babbleMouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.045, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.4 }),
  );
  babbleMouth.position.set(0, -0.1, 0.245);
  head.add(babbleMouth);

  // Mad eyebrows + overhead cartoon anger symbol (hidden until bumped)
  const madGroup = new THREE.Group();
  madGroup.visible = false;

  const browGeo = new THREE.BoxGeometry(0.12, 0.035, 0.04);
  const browMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
  const leftBrow = new THREE.Mesh(browGeo, browMat);
  leftBrow.position.set(-0.09, 0.1, 0.26);
  leftBrow.rotation.z = -0.38;
  const rightBrow = new THREE.Mesh(browGeo, browMat);
  rightBrow.position.set(0.09, 0.1, 0.26);
  rightBrow.rotation.z = 0.38;
  madGroup.add(leftBrow, rightBrow);

  // Overhead cartoon anger starburst & steam puff
  const angerMat = new THREE.MeshStandardMaterial({
    color: 0xff2a54,
    emissive: 0xff2a54,
    emissiveIntensity: 0.5,
    roughness: 0.3,
  });
  const steamMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.4,
  });

  const angerCrossA = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.1, 0.1),
    angerMat,
  );
  angerCrossA.position.set(0.28, 0.56, 0);
  angerCrossA.rotation.z = Math.PI / 4;

  const angerCrossB = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.1, 0.1),
    angerMat,
  );
  angerCrossB.position.set(0.28, 0.56, 0);
  angerCrossB.rotation.z = -Math.PI / 4;

  const puffLeft = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), steamMat);
  puffLeft.position.set(-0.34, 0.45, 0);
  const puffRight = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), steamMat);
  puffRight.position.set(-0.22, 0.58, 0);
  madGroup.add(angerCrossA, angerCrossB, puffLeft, puffRight);

  head.add(madGroup);

  const capMat = new THREE.MeshStandardMaterial({
    color: isGuard ? 0xfacc15 : bagColor,
    roughness: 0.45,
  });
  const capDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.285, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    capMat,
  );
  capDome.position.y = 0.03;
  const capBrim = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.05, 0.22),
    capMat,
  );
  capBrim.position.set(0, 0.08, 0.22);
  head.add(capDome, capBrim);

  bodyGroup.add(head);

  return {
    root,
    bodyGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    head,
    madGroup,
    babbleMouth,
    walkPhase: seed * 1.7,
    isGuard,
  };
}

// Ultra-vibrant saturated toybox house color palettes!
const HOUSE_PALETTES = [
  { wall: 0xff2e93, roof: 0xffe600, door: 0x00d4ff, trim: 0xffffff }, // Hot Bubblegum + Canary + Electric Sky
  { wall: 0x00d4ff, roof: 0xff2e63, door: 0xffe600, trim: 0xffffff }, // Electric Cyan + Hot Berry
  { wall: 0xffe600, roof: 0x9d4edd, door: 0xff2e93, trim: 0xffffff }, // Canary Yellow + Vivid Grape
  { wall: 0x00f5a0, roof: 0xff6d00, door: 0x9d4edd, trim: 0xffffff }, // Neon Mint + Tangerine
  { wall: 0x9d4edd, roof: 0x00e676, door: 0xffe600, trim: 0xffffff }, // Vivid Grape + Emerald Pop
  { wall: 0xff6d00, roof: 0x00d4ff, door: 0x00e676, trim: 0xffffff }, // Tangerine + Electric Cyan
];

export function createHouseModel(seed: number): THREE.Group {
  const group = new THREE.Group();
  const pal = HOUSE_PALETTES[seed % HOUSE_PALETTES.length];

  const wallMat = new THREE.MeshStandardMaterial({
    color: pal.wall,
    roughness: 0.55,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: pal.roof,
    roughness: 0.4,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: pal.trim,
    roughness: 0.45,
  });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x7dd3fc,
    emissiveIntensity: 0.5,
    roughness: 0.12,
  });
  const doorMat = new THREE.MeshStandardMaterial({
    color: pal.door,
    roughness: 0.45,
  });

  const w = 4.6 + (seed % 2) * 0.8;
  const h = 3.5 + (seed % 3) * 0.55;
  const d = 4.4;

  const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  base.position.y = h / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const trimBand = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.16, 0.28, d + 0.16),
    trimMat,
  );
  trimBand.position.y = h;
  group.add(trimBand);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(w * 0.8, 2.3, 4),
    roofMat,
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = h + 1.25;
  roof.castShadow = true;
  group.add(roof);

  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 1.35, 0.62),
    doorMat,
  );
  chimney.position.set(w * 0.22, h + 1.25, -d * 0.15);
  group.add(chimney);

  const doorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(1.12, 1.78, 0.1),
    trimMat,
  );
  doorFrame.position.set(0, 0.89, d / 2 + 0.03);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.62, 0.14), doorMat);
  door.position.set(0, 0.81, d / 2 + 0.05);

  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.2, 0.65),
    roofMat,
  );
  awning.position.set(0, 1.92, d / 2 + 0.28);
  awning.rotation.x = 0.25;
  group.add(doorFrame, door, awning);

  [-1.3, 1.3].forEach((wx) => {
    const winFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.04, 1.04, 0.1),
      trimMat,
    );
    winFrame.position.set(wx, h * 0.6, d / 2 + 0.03);

    const win = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.84, 0.14),
      windowMat,
    );
    win.position.set(wx, h * 0.6, d / 2 + 0.05);

    const flowerBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.08, 0.24, 0.34),
      doorMat,
    );
    flowerBox.position.set(wx, h * 0.6 - 0.62, d / 2 + 0.16);
    group.add(winFrame, win, flowerBox);
  });

  return group;
}

export function createTreeModel(seed: number): THREE.Group {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.34, 1.7, 8),
    new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8 }),
  );
  trunk.position.y = 0.85;
  trunk.castShadow = true;
  group.add(trunk);

  const leafColors = [0x00e676, 0x22e559, 0x38b000];
  const leafMat = new THREE.MeshStandardMaterial({
    color: leafColors[seed % leafColors.length],
    roughness: 0.55,
  });

  const crown1 = new THREE.Mesh(new THREE.SphereGeometry(1.12, 12, 10), leafMat);
  crown1.position.y = 2.28;
  crown1.castShadow = true;

  const crown2 = new THREE.Mesh(new THREE.SphereGeometry(0.78, 10, 8), leafMat);
  crown2.position.set(0.55, 1.92, 0.25);
  crown2.castShadow = true;

  const crown3 = new THREE.Mesh(new THREE.SphereGeometry(0.72, 10, 8), leafMat);
  crown3.position.set(-0.5, 2.02, -0.2);
  crown3.castShadow = true;

  const fruitMat = new THREE.MeshStandardMaterial({
    color: seed % 2 === 0 ? 0xff2e63 : 0xffe600,
    roughness: 0.25,
  });
  const fruitGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const f1 = new THREE.Mesh(fruitGeo, fruitMat);
  f1.position.set(0.85, 2.35, 0.55);
  const f2 = new THREE.Mesh(fruitGeo, fruitMat);
  f2.position.set(-0.65, 2.55, 0.72);
  const f3 = new THREE.Mesh(fruitGeo, fruitMat);
  f3.position.set(0.15, 2.95, -0.6);

  group.add(crown1, crown2, crown3, f1, f2, f3);
  return group;
}

export function createCrosswalkBeacon(): THREE.Group {
  const group = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 2.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.4 }),
  );
  post.position.y = 1.3;
  post.castShadow = true;
  group.add(post);

  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.78, 0.1),
    new THREE.MeshStandardMaterial({
      color: 0xffe600,
      emissive: 0xffaa00,
      emissiveIntensity: 0.3,
      roughness: 0.3,
    }),
  );
  signBoard.rotation.z = Math.PI / 4;
  signBoard.position.y = 2.45;
  group.add(signBoard);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xff6d00,
      emissiveIntensity: 1.1,
      roughness: 0.2,
    }),
  );
  beacon.position.y = 3.08;
  group.add(beacon);

  return group;
}

export interface TrafficLightRig {
  root: THREE.Group;
  redLightMat: THREE.MeshStandardMaterial;
  yellowLightMat: THREE.MeshStandardMaterial;
  greenLightMat: THREE.MeshStandardMaterial;
  stopStripMat: THREE.MeshStandardMaterial;
}

export function createTrafficLightModel(): TrafficLightRig {
  const root = new THREE.Group();

  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.6,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xffe600,
    roughness: 0.35,
  });
  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.45,
    metalness: 0.2,
  });

  // Left & Right sidewalk support poles (safely outside driving lanes)
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.17, 4.7, 10);
  const leftPole = new THREE.Mesh(poleGeo, poleMat);
  leftPole.position.set(-5.65, 2.35, 0);
  leftPole.castShadow = true;
  const rightPole = new THREE.Mesh(poleGeo, poleMat);
  rightPole.position.set(5.65, 2.35, 0);
  rightPole.castShadow = true;
  root.add(leftPole, rightPole);

  // Overhead horizontal crossbar high above traffic (y = 4.6)
  const crossbar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 11.5, 10),
    poleMat,
  );
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.set(0, 4.6, 0);
  crossbar.castShadow = true;
  root.add(crossbar);

  // Glowing stop strip & painted white STOP line across the road ahead of the gantry
  const stopLine = new THREE.Mesh(
    new THREE.PlaneGeometry(10.2, 0.52),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.7,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  stopLine.rotation.x = -Math.PI / 2;
  stopLine.position.set(0, 0.025, 2.1);
  root.add(stopLine);

  const stopStripMat = new THREE.MeshStandardMaterial({
    color: 0xff2e63,
    emissive: 0xff1e4d,
    emissiveIntensity: 0.85,
    roughness: 0.3,
  });
  const stopGlowStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(10.2, 0.18),
    stopStripMat,
  );
  stopGlowStrip.rotation.x = -Math.PI / 2;
  stopGlowStrip.position.set(0, 0.03, 1.72);
  root.add(stopGlowStrip);

  const redLightMat = new THREE.MeshStandardMaterial({
    color: 0xff2e63,
    emissive: 0xff1e4d,
    emissiveIntensity: 2.0,
    roughness: 0.2,
  });
  const yellowLightMat = new THREE.MeshStandardMaterial({
    color: 0xffe600,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.15,
    roughness: 0.2,
  });
  const greenLightMat = new THREE.MeshStandardMaterial({
    color: 0x00e676,
    emissive: 0x00c853,
    emissiveIntensity: 0.15,
    roughness: 0.2,
  });

  // Two large overhead signal heads hanging over the lanes
  const lensGeo = new THREE.SphereGeometry(0.22, 12, 12);
  for (const hx of [-1.85, 1.85]) {
    const signalGroup = new THREE.Group();
    signalGroup.position.set(hx, 3.85, 0);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 1.9, 0.46),
      frameMat,
    );
    frame.position.z = -0.04;
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.78, 0.54),
      housingMat,
    );
    housing.castShadow = true;

    const redLens = new THREE.Mesh(lensGeo, redLightMat);
    redLens.position.set(0, 0.54, 0.25);
    const yellowLens = new THREE.Mesh(lensGeo, yellowLightMat);
    yellowLens.position.set(0, 0, 0.25);
    const greenLens = new THREE.Mesh(lensGeo, greenLightMat);
    greenLens.position.set(0, -0.54, 0.25);

    signalGroup.add(frame, housing, redLens, yellowLens, greenLens);
    root.add(signalGroup);
  }

  return { root, redLightMat, yellowLightMat, greenLightMat, stopStripMat };
}

export interface PoliceSquadRig {
  root: THREE.Group;
  carGroup: THREE.Group;
  officerGroup: THREE.Group;
  officerLeftArm: THREE.Group;
  officerRightArm: THREE.Group;
  sirenRedMat: THREE.MeshStandardMaterial;
  sirenBlueMat: THREE.MeshStandardMaterial;
}

export function createPoliceSquadModel(): PoliceSquadRig {
  const root = new THREE.Group();
  const carGroup = new THREE.Group();
  root.add(carGroup);

  const darkBlueMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e3a8a,
    roughness: 0.25,
    metalness: 0.2,
    clearcoat: 0.85,
  });
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
  });
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.75,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    roughness: 0.15,
  });

  // Mini Police Cruiser Body
  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.62, 2.95),
    darkBlueMat,
  );
  chassis.position.y = 0.56;
  chassis.castShadow = true;
  carGroup.add(chassis);

  // White Police Doors Band
  const doorBand = new THREE.Mesh(
    new THREE.BoxGeometry(1.79, 0.52, 1.35),
    whiteMat,
  );
  doorBand.position.y = 0.56;
  carGroup.add(doorBand);

  // Cabin
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.42, 0.54, 1.45),
    whiteMat,
  );
  cabin.position.set(0, 1.1, 0.05);
  cabin.castShadow = true;
  carGroup.add(cabin);

  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(1.32, 0.36, 1.5),
    glassMat,
  );
  windshield.position.set(0, 1.12, 0.05);
  carGroup.add(windshield);

  // Flashing Red & Blue Siren Bar
  const sirenRedMat = new THREE.MeshStandardMaterial({
    color: 0xff2e63,
    emissive: 0xff1e4d,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const sirenBlueMat = new THREE.MeshStandardMaterial({
    color: 0x00d4ff,
    emissive: 0x00bbf9,
    emissiveIntensity: 0.4,
    roughness: 0.2,
  });
  const sirenLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.2, 0.26),
    sirenRedMat,
  );
  sirenLeft.position.set(-0.26, 1.47, 0.05);
  const sirenRight = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.2, 0.26),
    sirenBlueMat,
  );
  sirenRight.position.set(0.26, 1.47, 0.05);
  carGroup.add(sirenLeft, sirenRight);

  // 4 Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  [
    [-0.9, 0.32, -0.92],
    [0.9, 0.32, -0.92],
    [-0.9, 0.32, 0.92],
    [0.9, 0.32, 0.92],
  ].forEach(([wx, wy, wz]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, wy, wz);
    carGroup.add(w);
  });

  // Funny Chibi Police Officer standing beside the cruiser!
  const officerGroup = new THREE.Group();
  officerGroup.position.set(1.5, 0, 0.2);
  root.add(officerGroup);

  const uniMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.65 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xfcd5b5, roughness: 0.6 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffe600,
    metalness: 0.7,
    roughness: 0.25,
  });

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.56, 0.3), wheelMat);
  legs.position.y = 0.28;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.36, 4, 10), uniMat);
  torso.position.y = 0.88;
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.06), goldMat);
  badge.position.set(-0.1, 0.96, 0.25);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), skinMat);
  head.position.y = 1.46;

  // Police Cap
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.26, 0.18, 12),
    uniMat,
  );
  cap.position.y = 1.69;
  const capBadge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.06), goldMat);
  capBadge.position.set(0, 1.7, 0.26);

  officerGroup.add(legs, torso, badge, head, cap, capBadge);

  const officerLeftArm = new THREE.Group();
  officerLeftArm.position.set(-0.34, 1.08, 0);
  const armMeshL = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.32, 4, 8), uniMat);
  armMeshL.position.y = -0.2;
  officerLeftArm.add(armMeshL);

  const officerRightArm = new THREE.Group();
  officerRightArm.position.set(0.34, 1.08, 0);
  const armMeshR = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.32, 4, 8), uniMat);
  armMeshR.position.y = -0.2;
  // White ticket pad in right hand!
  const ticket = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.04), whiteMat);
  ticket.position.set(0, -0.38, 0.12);
  officerRightArm.add(armMeshR, ticket);

  officerGroup.add(officerLeftArm, officerRightArm);

  return {
    root,
    carGroup,
    officerGroup,
    officerLeftArm,
    officerRightArm,
    sirenRedMat,
    sirenBlueMat,
  };
}

