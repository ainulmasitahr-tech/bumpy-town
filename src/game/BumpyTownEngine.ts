import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { markNameUsed, recordDriverScore } from './leaderboard';
import {
  CarRig,
  createCarModel,
  createCrosswalkBeacon,
  createHouseModel,
  createPedestrianModel,
  createPoliceSquadModel,
  createPotholeModel,
  createTurntablePedestal,
  createTrafficLightModel,
  createTreeModel,
  PedestrianRig,
  PoliceSquadRig,
  PotholeRig,
  TrafficLightRig,
} from './models';
import { soundFX } from './sound';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import {
  CAR_COLORS,
  CarStyleId,
  FloatingScorePopup,
  GameHUDState,
  GamePhase,
  LeaderboardEntry,
  POTHOLE_SEVERITY_INFO,
  PotholeSeverity,
  UpgradeId,
} from './types';

interface PotholeEntity {
  rig: PotholeRig;
  localZ: number;
  x: number;
  hit: boolean;
  severity: PotholeSeverity;
}

interface PedestrianEntity {
  rig: PedestrianRig;
  localZ: number;
  x: number;
  dir: 1 | -1;
  speed: number;
  pausedTimer: number;
  bumped: boolean;
  hopY: number;
  hopVel: number;
}

interface TrafficLightEntity {
  rig: TrafficLightRig;
  localZ: number;
  state: 'red' | 'yellow' | 'green';
  waitTimer: number;
  resolved: boolean;
}

interface RoadSegment {
  group: THREE.Group;
  z: number;
  hasCrosswalk: boolean;
  crosswalkCounted: boolean;
  crosswalkPlane: THREE.Mesh;
  beacons: THREE.Group[];
  potholes: PotholeEntity[];
  pedestrians: PedestrianEntity[];
  trafficLights: TrafficLightEntity[];
  index: number;
}

interface SplashParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  active: boolean;
}

const SEGMENT_LENGTH = 18;
const NUM_SEGMENTS = 9;
const ROAD_HALF_WIDTH = 4.35;
const MAX_RUN_SECONDS = 180; // 3-minute max run cap
const BEST_SCORE_KEY = 'bumpy_town_best_score_v1';

// Pre-allocated math helpers (zero GC inside render loop)
const _vec3 = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();

export interface EngineCallbacks {
  onHUDUpdate: (hud: GameHUDState) => void;
  onPopup: (popup: FloatingScorePopup) => void;
  onContextLost: (lost: boolean) => void;
  onLeaderboardUpdate: (entries: LeaderboardEntry[]) => void;
}

export class BumpyTownEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textures: ProceduralTextureSet;
  private dirLight: THREE.DirectionalLight;
  private pmremEnv: THREE.Texture;

  private playerName = 'Driver';
  private carStyle: CarStyleId = 'taxi';
  private carColorHex = CAR_COLORS[0].hex;
  private carAccentHex = CAR_COLORS[0].accentHex;
  private carColorCss = CAR_COLORS[0].css;

  private carRig: CarRig;
  private previewPedestal: THREE.Group;
  private previewYaw = 0.55;
  private previewAutoSpin = true;

  private policeSquad: PoliceSquadRig;
  private policeTimer = 0;
  private policeStartZ = -18;
  private policeTargetX = -2.2;

  private carX = 0;
  private carTargetX = 0;
  private carVelX = 0;
  private carBounceY = 0;
  private carBounceVel = 0;
  private carPitch = 0;
  private carRoll = 0;
  private invulnTimer = 0;
  private carStopTimer = 0;
  private arrestTimer = 0;

  private segments: RoadSegment[] = [];
  private particles: SplashParticle[] = [];
  private boostSpawnTimer = 0;

  private phase: GamePhase = 'menu';
  private score = 0;
  private bestScore = 0;
  private potholesHit = 0;
  private blockLevel = 1;
  private blockProgress = 0;
  private blockTarget = 10;
  private hearts = 3;
  private maxHearts = 3;
  private streak = 0;
  private honkCharges = 2;
  private honkCooldown = 0;
  private honkMaxCooldown = 0.7;
  private activeUpgrades: UpgradeId[] = [];
  private statusBanner: string | null = null;
  private statusBannerTimer = 0;
  private crosswalksEncountered = 0;
  private runElapsedSec = 0;
  private gameOverReason: 'hearts' | 'time' = 'hearts';
  private popupCounter = 1;

  private keys = {
    left: false,
    right: false,
    up: false,
    down: false,
  };
  private currentSpeed = 15.5;

  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;
  private hudThrottleTimer = 0;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    try {
      const saved = localStorage.getItem(BEST_SCORE_KEY);
      if (saved) this.bestScore = parseInt(saved, 10) || 0;
    } catch {
      this.bestScore = 0;
    }

    this.isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight,
    );

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);

    // Ultra-vibrant sunny cyan sky & horizon fog
    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color(0x38bdf8);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.Fog(0x7dd3fc, 64, 145);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremEnv = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;
    this.scene.environment = this.pmremEnv;
    pmremGenerator.dispose();

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(48, w / h, 0.2, 220);
    this.camera.position.set(4.1, 2.55, 5.1);
    this.camera.lookAt(0, 0.65, 0);

    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x22e559, 1.1);
    this.scene.add(hemi);

    this.dirLight = new THREE.DirectionalLight(0xfffbeb, 1.7);
    this.dirLight.position.set(18, 28, 16);
    this.dirLight.target.position.set(0, 0, -16);
    this.scene.add(this.dirLight.target);
    this.scene.add(this.dirLight);

    if (!this.isSoftwareGl) {
      this.dirLight.castShadow = true;
      this.dirLight.shadow.mapSize.set(1024, 1024);
      this.dirLight.shadow.camera.near = 2;
      this.dirLight.shadow.camera.far = 90;
      this.dirLight.shadow.camera.left = -20;
      this.dirLight.shadow.camera.right = 20;
      this.dirLight.shadow.camera.top = 28;
      this.dirLight.shadow.camera.bottom = -28;
      this.dirLight.shadow.bias = -0.0005;
      this.dirLight.shadow.normalBias = 0.02;
    }

    const rimLight = new THREE.DirectionalLight(0xf0f9ff, 0.55);
    rimLight.position.set(-14, 10, -24);
    this.scene.add(rimLight);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);

    const horizonMeadow = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 260),
      new THREE.MeshStandardMaterial({
        color: 0x22e559,
        roughness: 0.85,
      }),
    );
    horizonMeadow.rotation.x = -Math.PI / 2;
    horizonMeadow.position.set(0, -0.05, -60);
    horizonMeadow.receiveShadow = true;
    this.scene.add(horizonMeadow);

    this.buildRoadSegments();
    this.buildParticlePool();

    this.previewPedestal = createTurntablePedestal();
    this.scene.add(this.previewPedestal);

    this.carRig = createCarModel(
      this.carStyle,
      this.carColorHex,
      this.carAccentHex,
      this.textures.contactShadowTexture,
      this.isSoftwareGl,
    );
    this.carRig.root.position.y = 0.28;
    this.scene.add(this.carRig.root);

    this.policeSquad = createPoliceSquadModel();
    this.policeSquad.root.visible = false;
    this.scene.add(this.policeSquad.root);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResize);
    soundFX.setMusicMode('marimba');
    this.emitHUD();
    this.clock.start();
    this.tick();
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.callbacks.onContextLost(true);
  };

  private handleContextRestored = () => {
    this.callbacks.onContextLost(false);
  };

  private handleResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
  };

  private buildRoadSegments() {
    const roadMat = new THREE.MeshStandardMaterial({
      map: this.textures.roadTexture,
      roughness: 0.86,
      metalness: 0.04,
    });
    const sidewalkMat = new THREE.MeshStandardMaterial({
      map: this.textures.sidewalkTexture,
      roughness: 0.82,
    });
    const grassMat = new THREE.MeshStandardMaterial({
      map: this.textures.grassTexture,
      roughness: 0.88,
    });
    const cwMat = new THREE.MeshStandardMaterial({
      map: this.textures.crosswalkTexture,
      transparent: true,
      roughness: 0.78,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const roadGeo = new THREE.PlaneGeometry(10.6, SEGMENT_LENGTH);
    const swGeo = new THREE.BoxGeometry(3.2, 0.18, SEGMENT_LENGTH);
    const grassGeo = new THREE.PlaneGeometry(46, SEGMENT_LENGTH);
    const cwGeo = new THREE.PlaneGeometry(10.2, 4.4);

    for (let i = 0; i < NUM_SEGMENTS; i++) {
      const group = new THREE.Group();
      const z = 12 - i * SEGMENT_LENGTH;
      group.position.z = z;

      const road = new THREE.Mesh(roadGeo, roadMat);
      road.rotation.x = -Math.PI / 2;
      road.receiveShadow = true;
      group.add(road);

      const leftSW = new THREE.Mesh(swGeo, sidewalkMat);
      leftSW.position.set(-6.9, 0.09, 0);
      leftSW.receiveShadow = true;
      const rightSW = new THREE.Mesh(swGeo, sidewalkMat);
      rightSW.position.set(6.9, 0.09, 0);
      rightSW.receiveShadow = true;
      group.add(leftSW, rightSW);

      const leftGrass = new THREE.Mesh(grassGeo, grassMat);
      leftGrass.rotation.x = -Math.PI / 2;
      leftGrass.position.set(-31.5, 0.01, 0);
      leftGrass.receiveShadow = true;
      const rightGrass = new THREE.Mesh(grassGeo, grassMat);
      rightGrass.rotation.x = -Math.PI / 2;
      rightGrass.position.set(31.5, 0.01, 0);
      rightGrass.receiveShadow = true;
      group.add(leftGrass, rightGrass);

      const leftHouse = createHouseModel(i * 3 + 1);
      leftHouse.position.set(-12.8, 0, -3);
      leftHouse.rotation.y = Math.PI / 2;
      group.add(leftHouse);

      const rightHouse = createHouseModel(i * 5 + 2);
      rightHouse.position.set(12.8, 0, 3);
      rightHouse.rotation.y = -Math.PI / 2;
      group.add(rightHouse);

      const leftTree = createTreeModel(i);
      leftTree.position.set(-10.2, 0, 5.2);
      group.add(leftTree);

      const rightTree = createTreeModel(i + 1);
      rightTree.position.set(10.2, 0, -5.2);
      group.add(rightTree);

      const crosswalkPlane = new THREE.Mesh(cwGeo, cwMat);
      crosswalkPlane.rotation.x = -Math.PI / 2;
      crosswalkPlane.position.set(0, 0.02, 0);
      crosswalkPlane.visible = false;
      group.add(crosswalkPlane);

      const leftBeacon = createCrosswalkBeacon();
      leftBeacon.position.set(-5.8, 0.18, 0);
      leftBeacon.visible = false;
      const rightBeacon = createCrosswalkBeacon();
      rightBeacon.position.set(5.8, 0.18, 0);
      rightBeacon.visible = false;
      group.add(leftBeacon, rightBeacon);

      const seg: RoadSegment = {
        group,
        z,
        hasCrosswalk: false,
        crosswalkCounted: false,
        crosswalkPlane,
        beacons: [leftBeacon, rightBeacon],
        potholes: [],
        pedestrians: [],
        trafficLights: [],
        index: i,
      };

      this.populateSegmentEntities(seg, i < 2);
      this.scene.add(group);
      this.segments.push(seg);
    }
  }

  private clearSegmentEntities(seg: RoadSegment) {
    for (const ph of seg.potholes) {
      seg.group.remove(ph.rig.root);
    }
    seg.potholes.length = 0;
    for (const ped of seg.pedestrians) {
      seg.group.remove(ped.rig.root);
    }
    seg.pedestrians.length = 0;
    for (const tl of seg.trafficLights) {
      seg.group.remove(tl.rig.root);
    }
    seg.trafficLights.length = 0;
  }

  private rollPotholeSeverity(): PotholeSeverity {
    const r = Math.random();
    if (this.hasUpgrade('gold_rush')) {
      if (r < 0.16) return 'high';
      if (r < 0.48) return 'medium';
      return 'low';
    }
    if (r < 0.07) return 'high';
    if (r < 0.28) return 'medium';
    return 'low';
  }

  private populateSegmentEntities(seg: RoadSegment, isStartingSafeZone: boolean) {
    this.clearSegmentEntities(seg);
    seg.crosswalkCounted = false;

    if (isStartingSafeZone) {
      seg.hasCrosswalk = false;
      seg.crosswalkPlane.visible = false;
      seg.beacons.forEach((b) => (b.visible = false));
      if (seg.index === 1) {
        const phRig = createPotholeModel('low');
        phRig.root.position.set(0, 0, 0);
        seg.group.add(phRig.root);
        seg.potholes.push({
          rig: phRig,
          localZ: 0,
          x: 0,
          hit: false,
          severity: 'low',
        });
      }
      return;
    }

    // Traffic Lights appear starting at Block 3 (Red light -> must brake & stop until Green!)
    const trafficLightChance =
      this.blockLevel >= 3
        ? Math.min(0.34 + (this.blockLevel - 3) * 0.08, 0.52)
        : 0;
    const hasTrafficLight =
      this.blockLevel >= 3 && Math.random() < trafficLightChance;

    // More crosswalks as blocks climb (kept separate from traffic light segments)
    const crosswalkChance = Math.min(0.42 + (this.blockLevel - 1) * 0.08, 0.85);
    const hasCrosswalk = !hasTrafficLight && Math.random() < crosswalkChance;
    seg.hasCrosswalk = hasCrosswalk;
    seg.crosswalkPlane.visible = hasCrosswalk;
    seg.beacons.forEach((b) => (b.visible = hasCrosswalk));

    // Potholes
    const potholeCount = this.blockLevel >= 2 && Math.random() < 0.6 ? 2 : 1;
    for (let p = 0; p < potholeCount; p++) {
      const severity = this.rollPotholeSeverity();
      const phRig = createPotholeModel(severity);
      const laneChoices = [-3.0, -1.5, 0, 1.5, 3.0];
      const x = laneChoices[Math.floor(Math.random() * laneChoices.length)];
      let localZ = p === 0 ? -5.6 : 5.4;
      if (!hasCrosswalk && !hasTrafficLight) {
        localZ = (Math.random() - 0.5) * 11;
      }
      phRig.root.position.set(x, 0, localZ);
      seg.group.add(phRig.root);
      seg.potholes.push({
        rig: phRig,
        localZ,
        x,
        hit: false,
        severity,
      });
    }

    if (hasTrafficLight) {
      const tlRig = createTrafficLightModel();
      const localZ = 0;
      tlRig.root.position.set(0, 0, localZ);
      seg.group.add(tlRig.root);
      seg.trafficLights.push({
        rig: tlRig,
        localZ,
        state: 'red',
        waitTimer: 0,
        resolved: false,
      });
    }

    // Pedestrians: slower walking speed + MORE pedestrians as block increases!
    if (hasCrosswalk) {
      const maxPeds = Math.min(1 + this.blockLevel, 4);
      const pedCount =
        this.blockLevel === 1
          ? 1
          : Math.min(maxPeds, 1 + Math.floor(Math.random() * this.blockLevel));

      // As block rises, pedestrians walk slower so they block lanes longer!
      const baseWalkSpeed = Math.max(0.85, 2.3 - (this.blockLevel - 1) * 0.25);

      for (let k = 0; k < pedCount; k++) {
        const dir: 1 | -1 = k % 2 === 0 ? 1 : -1;
        const isGuard = k === 0 && Math.random() < 0.28;
        const seed = Math.floor(Math.random() * 1000);
        const rig = createPedestrianModel(
          seed,
          isGuard,
          this.textures.contactShadowTexture,
        );
        const spreadOffset = (k * 2.4) % 8;
        const startX =
          dir === 1
            ? -6.4 + (k > 0 ? spreadOffset * 0.45 : 0)
            : 6.4 - (k > 0 ? spreadOffset * 0.45 : 0);
        const localZ = -1.2 + (k % 3) * 1.1;
        rig.root.position.set(startX, 0.02, localZ);
        rig.root.rotation.y = dir === 1 ? Math.PI / 2 : -Math.PI / 2;
        seg.group.add(rig.root);

        seg.pedestrians.push({
          rig,
          localZ,
          x: startX,
          dir,
          speed: baseWalkSpeed + Math.random() * 0.35,
          pausedTimer: 0,
          bumped: false,
          hopY: 0,
          hopVel: 0,
        });
      }
    }
  }

  private buildParticlePool() {
    const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const colors = [0xffe600, 0x00d4ff, 0xff2e63, 0x00e676, 0xff2e93];
    for (let i = 0; i < 64; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        roughness: 0.28,
        emissive: colors[i % colors.length],
        emissiveIntensity: 0.35,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.6,
        active: false,
      });
    }
  }

  private spawnSplash(x: number, y: number, z: number, severity: PotholeSeverity) {
    let spawned = 0;
    const targetCount =
      severity === 'high' ? 24 : severity === 'medium' ? 16 : 10;
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.45 + Math.random() * 0.25;
        p.mesh.position.set(x, y + 0.2, z);
        p.mesh.scale.setScalar(
          severity === 'high' ? 1.3 : severity === 'medium' ? 1.1 : 0.85,
        );
        p.mesh.visible = true;
        const angle = Math.random() * Math.PI * 2;
        const spd = 2.0 + Math.random() * (severity === 'high' ? 4.8 : 3.5);
        p.vx = Math.cos(angle) * spd;
        p.vy = (severity === 'high' ? 5.2 : 3.8) + Math.random() * 3.8;
        p.vz = Math.sin(angle) * spd;
        spawned++;
        if (spawned >= targetCount) break;
      }
    }
  }

  private spawnBoostTrail() {
    for (const exOffset of [-0.45, 0.45]) {
      for (const p of this.particles) {
        if (!p.active) {
          p.active = true;
          p.life = 0;
          p.maxLife = 0.28;
          p.mesh.position.set(
            this.carX + exOffset,
            0.34 + this.carBounceY,
            1.85,
          );
          p.mesh.scale.setScalar(0.65);
          p.mesh.visible = true;
          p.vx = (Math.random() - 0.5) * 0.8;
          p.vy = 0.6 + Math.random() * 0.9;
          p.vz = 5.5 + Math.random() * 2.5;
          break;
        }
      }
    }
  }

  private hasUpgrade(id: UpgradeId): boolean {
    return this.activeUpgrades.includes(id);
  }

  public setPlayerName(name: string) {
    this.playerName = name.trim() || 'Driver';
    this.emitHUD();
  }

  public setCarStyle(style: CarStyleId) {
    if (this.carStyle === style) return;
    this.carStyle = style;
    const prevX = this.carRig.root.position.x;
    const prevY = this.carRig.root.position.y;
    const prevRotY = this.carRig.root.rotation.y;
    this.scene.remove(this.carRig.root);
    this.carRig = createCarModel(
      style,
      this.carColorHex,
      this.carAccentHex,
      this.textures.contactShadowTexture,
      this.isSoftwareGl,
    );
    this.carRig.root.position.set(prevX, prevY, 0);
    this.carRig.root.rotation.y = prevRotY;
    this.applyCarUpgradeVisuals();
    this.scene.add(this.carRig.root);
  }

  public setCarColor(colorHex: number, accentHex: number, colorCss: string) {
    this.carColorHex = colorHex;
    this.carAccentHex = accentHex;
    this.carColorCss = colorCss;
    this.carRig.paintMat.color.setHex(colorHex);
    this.carRig.accentMat.color.setHex(accentHex);
    this.emitHUD();
  }

  public spinCarPreview(deltaX: number) {
    if (this.phase !== 'menu') return;
    this.previewAutoSpin = false;
    this.previewYaw += deltaX * 0.012;
  }

  private applyCarUpgradeVisuals() {
    const tireScale = this.hasUpgrade('wide_tires') ? 1.35 : 1.0;
    for (const t of this.carRig.tireMeshes) {
      t.scale.set(tireScale, 1, 1);
    }
  }

  public startNewGame(name: string) {
    soundFX.unlock();
    const cleanName = name.trim() || 'Driver';
    this.playerName = cleanName;
    markNameUsed(cleanName);

    this.score = 0;
    this.potholesHit = 0;
    this.blockLevel = 1;
    this.blockProgress = 0;
    this.blockTarget = 10;
    this.hearts = 3;
    this.maxHearts = 3;
    this.streak = 0;
    this.honkCharges = 2;
    this.honkCooldown = 0;
    this.activeUpgrades = [];
    this.carX = 0;
    this.carTargetX = 0;
    this.carVelX = 0;
    this.carBounceY = 0;
    this.carBounceVel = 0;
    this.invulnTimer = 0;
    this.carStopTimer = 0;
    this.arrestTimer = 0;
    this.policeTimer = 0;
    this.policeSquad.root.visible = false;
    this.crosswalksEncountered = 0;
    this.runElapsedSec = 0;
    this.gameOverReason = 'hearts';
    this.currentSpeed = 15.5;
    this.statusBanner = 'Block 1: Pop Potholes! Avoid Crossing People!';
    this.statusBannerTimer = 3.0;

    this.previewPedestal.visible = false;
    this.carRig.root.position.set(0, 0, 0);
    this.carRig.root.rotation.set(0, 0, 0);
    this.applyCarUpgradeVisuals();

    this.segments.forEach((seg, i) => {
      seg.z = 12 - i * SEGMENT_LENGTH;
      seg.group.position.z = seg.z;
      this.populateSegmentEntities(seg, i < 2);
    });

    this.phase = 'playing';
    soundFX.setMusicMode('arcade');
    this.emitHUD();
  }

  public applyUpgradeAndContinue(upgradeId: UpgradeId) {
    soundFX.unlock();
    soundFX.playClick();
    if (!this.activeUpgrades.includes(upgradeId)) {
      this.activeUpgrades.push(upgradeId);
    }
    if (upgradeId === 'super_honk') {
      this.honkCharges += 2;
    }
    this.applyCarUpgradeVisuals();

    this.blockLevel += 1;
    this.blockProgress = 0;
    this.blockTarget = 10 + (this.blockLevel - 1) * 5;
    this.invulnTimer = 1.0;
    this.statusBanner =
      this.blockLevel === 3
        ? 'Block 3: Red Lights Ahead! Stop Until Green!'
        : `Block ${this.blockLevel}: Faster Drive!`;
    this.statusBannerTimer = 2.8;
    this.phase = 'playing';
    soundFX.setMusicMode('arcade');
    this.emitHUD();
  }

  public setPaused(paused: boolean) {
    if (this.phase !== 'playing' && this.phase !== 'paused') return;
    this.phase = paused ? 'paused' : 'playing';
    soundFX.setMusicMode(paused ? 'none' : 'arcade');
    this.emitHUD();
  }

  public returnToMenu() {
    this.phase = 'menu';
    soundFX.setMusicMode('marimba');
    this.keys.left = false;
    this.keys.right = false;
    this.keys.up = false;
    this.keys.down = false;
    this.carStopTimer = 0;
    this.arrestTimer = 0;
    this.policeTimer = 0;
    this.policeSquad.root.visible = false;
    this.previewPedestal.visible = true;
    this.previewAutoSpin = true;
    this.carX = 0;
    this.carTargetX = 0;
    this.carBounceY = 0;
    this.carRig.bodyGroup.visible = true;
    this.carRig.bodyGroup.position.y = 0;
    this.carRig.bodyGroup.rotation.set(0, 0, 0);
    this.carRig.root.position.set(0, 0.28, 0);
    this.emitHUD();
  }

  public setControlInput(
    control: 'left' | 'right' | 'up' | 'down',
    active: boolean,
  ) {
    this.keys[control] = active;
  }

  public steerByDelta(deltaX: number) {
    if (this.phase !== 'playing' || this.carStopTimer > 0) return;
    this.carTargetX = THREE.MathUtils.clamp(
      this.carTargetX + deltaX,
      -ROAD_HALF_WIDTH + 0.65,
      ROAD_HALF_WIDTH - 0.65,
    );
  }

  public triggerHonk() {
    if (this.phase !== 'playing' || this.carStopTimer > 0) return;
    if (this.honkCooldown > 0) return;

    if (this.honkCharges <= 0) {
      soundFX.playClick();
      this.emitScreenPopup(
        this.carX,
        1.8,
        0,
        'Hit High Pothole for Honks!',
        'warning',
      );
      return;
    }

    soundFX.unlock();
    soundFX.playHonk();
    this.honkCharges -= 1;
    this.honkCooldown = this.honkMaxCooldown;
    const hasSuper = this.hasUpgrade('super_honk');
    const freezeTime = hasSuper ? 3.2 : 2.1;

    let pausedCount = 0;
    for (const seg of this.segments) {
      for (const ped of seg.pedestrians) {
        const worldZ = seg.z + ped.localZ;
        if (worldZ < 4 && worldZ > -46 && ped.pausedTimer <= 0 && !ped.bumped) {
          ped.pausedTimer = freezeTime;
          pausedCount++;
        }
      }
    }

    const honkPoints = pausedCount > 0 ? 5 : 2;
    this.score += honkPoints;
    this.blockProgress += honkPoints;
    this.updateBestScore();

    this.carBounceVel = Math.max(this.carBounceVel, 2.2);
    this.emitScreenPopup(
      this.carX,
      2.0,
      0,
      pausedCount > 0 ? `TOOT! +${honkPoints} Safe Honk!` : `TOOT! +${honkPoints} Pt`,
      'honk',
    );

    if (this.blockProgress >= this.blockTarget) {
      soundFX.setMusicMode('none');
      soundFX.playLevelUp();
      this.phase = 'upgrade';
    }
    this.emitHUD();
  }

  private updateBestScore() {
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      try {
        localStorage.setItem(BEST_SCORE_KEY, String(this.bestScore));
      } catch {
        // ignore storage errors
      }
    }
  }

  private emitScreenPopup(
    worldX: number,
    worldY: number,
    worldZ: number,
    text: string,
    tone: FloatingScorePopup['tone'],
  ) {
    _vec3.set(worldX, worldY, worldZ);
    _vec3.project(this.camera);
    const xPercent = THREE.MathUtils.clamp((_vec3.x * 0.5 + 0.5) * 100, 16, 84);
    const yPercent = THREE.MathUtils.clamp((-_vec3.y * 0.5 + 0.5) * 100, 18, 76);
    this.callbacks.onPopup({
      id: this.popupCounter++,
      text,
      tone,
      xPercent,
      yPercent,
    });
  }

  private emitHUD() {
    let pedestrianAheadHint = false;
    if (this.crosswalksEncountered <= 2) {
      for (const seg of this.segments) {
        if (!seg.hasCrosswalk) continue;
        if (seg.z < -2 && seg.z > -32) {
          for (const ped of seg.pedestrians) {
            if (!ped.bumped && Math.abs(ped.x) < 6.4) {
              pedestrianAheadHint = true;
              break;
            }
          }
        }
        if (pedestrianAheadHint) break;
      }
    }

    let trafficLightAhead: GameHUDState['trafficLightAhead'] = null;
    for (const seg of this.segments) {
      for (const tl of seg.trafficLights) {
        const stopLineZ = seg.z + tl.localZ + 2.1;
        if (stopLineZ > -38 && stopLineZ <= 1.2) {
          trafficLightAhead = {
            state: tl.state,
            waitProgress: THREE.MathUtils.clamp(tl.waitTimer / 1.55, 0, 1),
          };
          break;
        }
      }
      if (trafficLightAhead) break;
    }

    this.callbacks.onHUDUpdate({
      phase: this.phase,
      playerName: this.playerName,
      carColorCss: this.carColorCss,
      score: this.score,
      bestScore: this.bestScore,
      potholesHit: this.potholesHit,
      blockLevel: this.blockLevel,
      blockProgress: this.blockProgress,
      blockTarget: this.blockTarget,
      hearts: this.hearts,
      maxHearts: this.maxHearts,
      streak: this.streak,
      honkCharges: this.honkCharges,
      honkCooldownRatio:
        this.honkMaxCooldown > 0
          ? THREE.MathUtils.clamp(this.honkCooldown / this.honkMaxCooldown, 0, 1)
          : 0,
      speedKmh: Math.round(this.currentSpeed * 2.8),
      timeRemainingSec: Math.max(0, Math.ceil(MAX_RUN_SECONDS - this.runElapsedSec)),
      isBoosting:
        this.phase === 'playing' &&
        this.carStopTimer <= 0 &&
        this.keys.up &&
        !this.keys.down,
      isBraking:
        this.phase === 'playing' && (this.keys.down || this.carStopTimer > 0),
      activeUpgrades: [...this.activeUpgrades],
      statusBanner: this.statusBanner,
      pedestrianAheadHint,
      trafficLightAhead,
      gameOverReason: this.gameOverReason,
    });
  }

  private tick = () => {
    if (this.disposed) return;

    const rawDelta = this.clock.getDelta();
    const dt = Math.min(rawDelta, 0.05);
    const elapsed = this.clock.elapsedTime;

    this.updateScene(dt, elapsed);
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateScene(dt: number, elapsed: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
      } else {
        p.vy -= 18 * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.rotation.x += 8 * dt;
        p.mesh.rotation.y += 6 * dt;
        const shrink = 1 - p.life / p.maxLife;
        p.mesh.scale.setScalar(shrink);
      }
    }

    const isPortraitPhone = this.camera.aspect < 0.88;

    // Start Screen Car Picker Mode
    if (this.phase === 'menu') {
      this.previewPedestal.visible = true;
      if (this.previewAutoSpin) {
        this.previewYaw += 0.55 * dt;
      }
      this.previewPedestal.rotation.y = this.previewYaw;
      this.carRig.root.position.set(0, 0.28 + Math.sin(elapsed * 2.2) * 0.02, 0);
      this.carRig.root.rotation.set(0, this.previewYaw, 0);
      this.carRig.brakeLights.emissiveIntensity = 0.45;

      const zoomOut = isPortraitPhone ? 1.38 : 1.0;
      _camTargetPos.set(3.9 * zoomOut, 2.35 * zoomOut, 5.2 * zoomOut);
      _camLookAt.set(0, isPortraitPhone ? 0.25 : 0.45, 0);
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camTargetPos.x, 5, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camTargetPos.y, 5, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camTargetPos.z, 5, dt);
      this.camera.lookAt(_camLookAt);
      const targetMenuFov = isPortraitPhone ? 54 : 46;
      if (Math.abs(this.camera.fov - targetMenuFov) > 0.1) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetMenuFov, 5, dt);
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    if (this.phase === 'paused' || this.phase === 'upgrade' || this.phase === 'gameover') {
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 6.8, 3, dt);
      if (this.phase === 'gameover' && this.gameOverReason === 'hearts' && this.policeSquad.root.visible) {
        const flash = Math.floor(elapsed * 8) % 2 === 0;
        this.policeSquad.sirenRedMat.emissiveIntensity = flash ? 2.2 : 0.25;
        this.policeSquad.sirenBlueMat.emissiveIntensity = flash ? 0.25 : 2.2;
        this.policeSquad.officerRightArm.rotation.x = -1.2 + Math.sin(elapsed * 10) * 0.3;
      }
      return;
    }

    // Police Arrest Sequence when all hearts are lost!
    if (this.phase === 'arrested') {
      this.arrestTimer = Math.max(0, this.arrestTimer - dt);
      this.currentSpeed = 0;
      this.carRig.brakeLights.emissiveIntensity = 2.2;

      this.policeSquad.root.visible = true;
      this.policeSquad.root.position.x = THREE.MathUtils.damp(
        this.policeSquad.root.position.x,
        this.policeTargetX,
        6.5,
        dt,
      );
      this.policeSquad.root.position.z = THREE.MathUtils.damp(
        this.policeSquad.root.position.z,
        -0.6,
        6.5,
        dt,
      );
      const flash = Math.floor(elapsed * 12) % 2 === 0;
      this.policeSquad.sirenRedMat.emissiveIntensity = flash ? 2.4 : 0.25;
      this.policeSquad.sirenBlueMat.emissiveIntensity = flash ? 0.25 : 2.4;
      this.policeSquad.officerGroup.position.y = Math.abs(Math.sin(elapsed * 12)) * 0.14;
      this.policeSquad.officerRightArm.rotation.x = -1.2 + Math.sin(elapsed * 18) * 0.45;
      this.policeSquad.officerLeftArm.rotation.z = -0.6 + Math.cos(elapsed * 16) * 0.35;

      // Animate any bumped pedestrian still grumbling nearby
      for (const seg of this.segments) {
        for (const ped of seg.pedestrians) {
          if (!ped.bumped) continue;
          ped.rig.babbleMouth.scale.y = 0.8 + Math.abs(Math.sin(elapsed * 30)) * 2.5;
          ped.rig.madGroup.rotation.z = Math.sin(elapsed * 16) * 0.12;
        }
      }

      const camDistZ = isPortraitPhone ? 10.2 : 8.2;
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.carX * 0.5, 5, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 4.9, 5, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, camDistZ, 5, dt);
      this.camera.lookAt(this.carX * 0.4, 0.9, -1.2);

      if (this.arrestTimer <= 0) {
        this.finishGame('hearts');
      }
      return;
    }

    // Enforce 3-minute max challenge timer
    this.runElapsedSec += dt;
    if (this.runElapsedSec >= MAX_RUN_SECONDS) {
      this.finishGame('time');
      return;
    }

    // Stopped state (while viewing mad babbling person!)
    if (this.carStopTimer > 0) {
      this.carStopTimer = Math.max(0, this.carStopTimer - dt);
    }

    const isStopped = this.carStopTimer > 0;

    // Challenging speed scaling per block
    const baseCruise = 15.5 + (this.blockLevel - 1) * 3.1;
    let targetSpeed = baseCruise;
    const isBraking = this.keys.down || isStopped;
    const isBoosting = this.keys.up && !isBraking;

    if (isStopped || this.keys.down) {
      // Holding Brake (S/Down) brings the car to a full stop so players can wait cleanly at Red Lights!
      targetSpeed = 0;
    } else if (isBoosting) {
      targetSpeed = baseCruise * 1.56;
    }

    this.currentSpeed = THREE.MathUtils.damp(
      this.currentSpeed,
      targetSpeed,
      isStopped ? 14 : this.keys.down ? 12.5 : 6.0,
      dt,
    );

    if (isBoosting) {
      this.boostSpawnTimer += dt;
      if (this.boostSpawnTimer >= 0.05) {
        this.boostSpawnTimer = 0;
        this.spawnBoostTrail();
      }
    }

    this.carRig.brakeLights.emissiveIntensity = isBraking ? 2.2 : 0.4;

    if (!isStopped) {
      const steerSpeed = 11.2;
      if (this.keys.left) this.carTargetX -= steerSpeed * dt;
      if (this.keys.right) this.carTargetX += steerSpeed * dt;
      this.carTargetX = THREE.MathUtils.clamp(
        this.carTargetX,
        -ROAD_HALF_WIDTH + 0.65,
        ROAD_HALF_WIDTH - 0.65,
      );
    }

    const prevCarX = this.carX;
    this.carX = THREE.MathUtils.damp(this.carX, this.carTargetX, 11.5, dt);
    this.carVelX = (this.carX - prevCarX) / Math.max(dt, 0.001);

    // Subtle grounded suspension bounce (realistic, not sky-high)
    this.carBounceVel -= 44 * dt;
    this.carBounceY += this.carBounceVel * dt;
    if (this.carBounceY < 0) {
      this.carBounceY = 0;
      this.carBounceVel = 0;
    }

    const targetRoll = THREE.MathUtils.clamp(-this.carVelX * 0.032, -0.22, 0.22);
    const targetPitch =
      this.carBounceY * 0.14 + (isBraking ? 0.08 : isBoosting ? -0.04 : 0);
    this.carRoll = THREE.MathUtils.damp(this.carRoll, targetRoll, 10, dt);
    this.carPitch = THREE.MathUtils.damp(this.carPitch, targetPitch, 10, dt);

    this.carRig.root.position.set(this.carX, 0, 0);
    this.carRig.root.rotation.set(0, 0, 0);
    this.carRig.bodyGroup.position.y = this.carBounceY;
    this.carRig.bodyGroup.rotation.set(this.carPitch, -this.carVelX * 0.03, this.carRoll);
    this.carRig.contactShadow.scale.setScalar(
      Math.max(0.78, 1 - this.carBounceY * 0.2),
    );

    if (this.invulnTimer > 0 && !isStopped) {
      this.invulnTimer = Math.max(0, this.invulnTimer - dt);
      this.carRig.bodyGroup.visible = Math.floor(this.invulnTimer * 14) % 2 === 0;
    } else {
      this.carRig.bodyGroup.visible = true;
    }

    const wheelDelta = (this.currentSpeed * dt) / 0.38;
    for (const w of this.carRig.wheels) {
      w.rotation.x -= wheelDelta;
    }

    if (this.honkCooldown > 0) {
      this.honkCooldown = Math.max(0, this.honkCooldown - dt);
    }
    if (this.statusBannerTimer > 0) {
      this.statusBannerTimer -= dt;
      if (this.statusBannerTimer <= 0) {
        this.statusBanner = null;
      }
    }

    const totalLength = NUM_SEGMENTS * SEGMENT_LENGTH;
    const baseHitWidth = this.hasUpgrade('wide_tires') ? 1.85 : 1.45;
    const magnetPull = this.hasUpgrade('bouncy_springs') ? 2.6 : 0;

    for (const seg of this.segments) {
      seg.z += this.currentSpeed * dt;
      if (seg.z > 24) {
        seg.z -= totalLength;
        this.populateSegmentEntities(seg, false);
      }
      seg.group.position.z = seg.z;

      // Count encountered crosswalks once they approach view
      if (seg.hasCrosswalk && !seg.crosswalkCounted && seg.z > -34 && seg.z < 0) {
        seg.crosswalkCounted = true;
        this.crosswalksEncountered += 1;
      }

      // Potholes
      for (const ph of seg.potholes) {
        if (ph.rig.starGroup && !ph.hit) {
          ph.rig.starGroup.rotation.y += (ph.severity === 'high' ? 3.4 : 2.2) * dt;
          ph.rig.starGroup.position.y =
            (ph.severity === 'high' ? 1.05 : 0.85) + Math.sin(elapsed * 4) * 0.14;
        }
        const worldZ = seg.z + ph.localZ;

        if (!isStopped && !ph.hit && magnetPull > 0 && worldZ > -14 && worldZ < 2) {
          const dx = this.carX - ph.x;
          if (Math.abs(dx) < 3.4) {
            ph.x += Math.sign(dx) * magnetPull * dt;
            ph.rig.root.position.x = ph.x;
          }
        }

        const sevBonusWidth = ph.severity === 'high' ? 0.35 : ph.severity === 'medium' ? 0.18 : 0;
        if (!isStopped && !ph.hit && Math.abs(worldZ) < 1.7) {
          if (Math.abs(this.carX - ph.x) < baseHitWidth + sevBonusWidth) {
            ph.hit = true;
            ph.rig.root.scale.set(1.25, 0.35, 1.25);
            if (ph.rig.starGroup) ph.rig.starGroup.visible = false;
            this.handlePotholeHit(ph);
          }
        }
      }

      // Traffic Lights (Block 3+: Red Light -> Stop behind line until it turns Green!)
      for (const tl of seg.trafficLights) {
        const stopLineZ = seg.z + tl.localZ + 2.1;

        if (tl.state === 'red') {
          tl.rig.redLightMat.emissiveIntensity = 2.2;
          tl.rig.yellowLightMat.emissiveIntensity = 0.15;
          tl.rig.greenLightMat.emissiveIntensity = 0.15;
          tl.rig.stopStripMat.color.setHex(0xff2e63);
          tl.rig.stopStripMat.emissive.setHex(0xff1e4d);
          tl.rig.stopStripMat.emissiveIntensity = 0.85 + Math.sin(elapsed * 8) * 0.25;

          if (!tl.resolved) {
            if (
              stopLineZ >= -15 &&
              stopLineZ <= 0.45 &&
              (this.currentSpeed < 4.5 || this.keys.down)
            ) {
              tl.waitTimer += dt;
              if (tl.waitTimer >= 1.55) {
                tl.state = 'green';
                tl.resolved = true;
                soundFX.playGreenLight();
                this.score += 3;
                this.blockProgress += 3;
                this.updateBestScore();
                this.emitScreenPopup(
                  this.carX,
                  2.1,
                  0,
                  'GREEN LIGHT! GO! +3 Pts!',
                  'honk',
                );
                if (this.blockProgress >= this.blockTarget) {
                  soundFX.setMusicMode('none');
                  soundFX.playLevelUp();
                  this.phase = 'upgrade';
                }
              }
            } else if (stopLineZ > 0.45) {
              tl.resolved = true;
              this.handleRedLightViolation();
            }
          }
        } else {
          tl.rig.redLightMat.emissiveIntensity = 0.15;
          tl.rig.yellowLightMat.emissiveIntensity = 0.15;
          tl.rig.greenLightMat.emissiveIntensity = 2.4;
          tl.rig.stopStripMat.color.setHex(0x00e676);
          tl.rig.stopStripMat.emissive.setHex(0x00c853);
          tl.rig.stopStripMat.emissiveIntensity = 0.9;
        }
      }

      // Pedestrians
      for (const ped of seg.pedestrians) {
        if (ped.bumped) {
          ped.hopVel -= 24 * dt;
          ped.hopY += ped.hopVel * dt;
          if (ped.hopY < 0) ped.hopY = 0;
          ped.rig.root.position.y = ped.hopY + 0.02;

          // Keep the mad pedestrian clearly visible right beside/in front of the stopped car!
          const sideTarget =
            ped.x >= this.carX
              ? Math.min(4.0, this.carX + 1.85)
              : Math.max(-4.0, this.carX - 1.85);
          ped.x = THREE.MathUtils.damp(ped.x, sideTarget, 5.5, dt);
          ped.rig.root.position.x = ped.x;
          ped.rig.root.rotation.y = THREE.MathUtils.damp(
            ped.rig.root.rotation.y,
            0,
            10,
            dt,
          );

          // Angry stomping, arm waving, head shaking & rapid mouth babbling
          ped.rig.leftArm.rotation.z = -2.4 + Math.sin(elapsed * 26) * 0.45;
          ped.rig.rightArm.rotation.z = 2.4 - Math.sin(elapsed * 26) * 0.45;
          ped.rig.leftArm.rotation.x = Math.cos(elapsed * 22) * 0.4;
          ped.rig.rightArm.rotation.x = -Math.cos(elapsed * 22) * 0.4;
          ped.rig.leftLeg.rotation.x = Math.sin(elapsed * 28) * 0.6;
          ped.rig.rightLeg.rotation.x = -Math.sin(elapsed * 28) * 0.6;
          ped.rig.head.rotation.z = Math.sin(elapsed * 24) * 0.22;
          ped.rig.babbleMouth.scale.y = 0.8 + Math.abs(Math.sin(elapsed * 30)) * 2.5;
          ped.rig.babbleMouth.scale.x = 1.0 + Math.abs(Math.cos(elapsed * 22)) * 0.4;
          ped.rig.madGroup.position.y = Math.sin(elapsed * 18) * 0.06;
          ped.rig.madGroup.rotation.z = Math.sin(elapsed * 16) * 0.12;
          continue;
        }

        if (ped.pausedTimer > 0) {
          ped.pausedTimer -= dt;
          ped.rig.rightArm.rotation.z = Math.sin(elapsed * 12) * 0.35 + 2.2;
          ped.rig.leftLeg.rotation.x = 0;
          ped.rig.rightLeg.rotation.x = 0;
        } else {
          ped.x += ped.dir * ped.speed * dt;
          if (ped.dir === 1 && ped.x > 7.6) ped.x = -7.6;
          if (ped.dir === -1 && ped.x < -7.6) ped.x = 7.6;
          ped.rig.root.position.x = ped.x;

          const onSidewalk = Math.abs(ped.x) > 5.3;
          ped.rig.root.position.y = onSidewalk ? 0.18 : 0.02;

          ped.rig.walkPhase += ped.speed * 3.1 * dt;
          const swing = Math.sin(ped.rig.walkPhase) * 0.65;
          ped.rig.leftLeg.rotation.x = swing;
          ped.rig.rightLeg.rotation.x = -swing;
          ped.rig.leftArm.rotation.x = -swing * 0.75;
          if (!ped.rig.isGuard) {
            ped.rig.rightArm.rotation.x = swing * 0.75;
            ped.rig.rightArm.rotation.z = 0;
          } else {
            ped.rig.rightArm.rotation.z = 0;
          }
          ped.rig.bodyGroup.position.y = Math.abs(Math.cos(ped.rig.walkPhase)) * 0.06;
        }

        const worldZ = seg.z + ped.localZ;
        if (
          !isStopped &&
          this.invulnTimer <= 0 &&
          Math.abs(worldZ) < 1.55 &&
          Math.abs(this.carX - ped.x) < 1.18
        ) {
          this.handlePedestrianBump(ped, worldZ);
        }
      }
    }

    // Responsive Chase Camera (adjusts cleanly for narrow portrait phones)
    const camTargetX = this.carX * 0.45;
    const camHeight = isPortraitPhone ? 7.2 : 6.15;
    const camDistZ = isPortraitPhone ? 11.2 : 9.2;

    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      camTargetX,
      5.5,
      dt,
    );
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      camHeight + this.carBounceY * 0.25,
      6,
      dt,
    );
    this.camera.position.z = THREE.MathUtils.damp(
      this.camera.position.z,
      camDistZ,
      5.5,
      dt,
    );
    this.camera.lookAt(this.carX * 0.35, 1.0, -10.5);

    const baseFov = isPortraitPhone ? 62 : 55;
    const targetFov = isBoosting ? baseFov + 8 : isBraking ? baseFov - 4 : baseFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5.5, dt);
      this.camera.updateProjectionMatrix();
    }

    this.hudThrottleTimer += dt;
    if (this.hudThrottleTimer >= 0.065) {
      this.hudThrottleTimer = 0;
      this.emitHUD();
    }
  }

  private handlePotholeHit(ph: PotholeEntity) {
    this.streak += 1;
    this.potholesHit += 1;

    const sevInfo = POTHOLE_SEVERITY_INFO[ph.severity];
    let pointsEarned = sevInfo.points;
    if (this.hasUpgrade('star_boost') && this.streak % 3 === 0) {
      pointsEarned += 2;
    }

    if (sevInfo.honkReward > 0) {
      this.honkCharges += sevInfo.honkReward;
    }

    this.score += pointsEarned;
    this.blockProgress += pointsEarned;
    this.updateBestScore();

    // Realistic smaller car bounce
    const springMult = this.hasUpgrade('bouncy_springs') ? 1.15 : 1.0;
    const baseJump =
      ph.severity === 'high' ? 5.2 : ph.severity === 'medium' ? 4.3 : 3.4;
    this.carBounceVel = baseJump * springMult;

    this.spawnSplash(ph.x, 0.1, 0, ph.severity);
    soundFX.playPotholePop(ph.severity, this.streak);

    if (ph.severity === 'high') {
      this.emitScreenPopup(
        ph.x,
        1.8,
        0,
        `HIGH! +${pointsEarned} Pts & +1 Honk!`,
        'high',
      );
    } else if (ph.severity === 'medium') {
      this.emitScreenPopup(
        ph.x,
        1.6,
        0,
        `MEDIUM! +${pointsEarned} Pts!`,
        'medium',
      );
    } else {
      const streakLabel =
        this.streak >= 3 ? `+${pointsEarned} (x${this.streak}!)` : `+${pointsEarned} Pt`;
      this.emitScreenPopup(ph.x, 1.4, 0, streakLabel, 'low');
    }

    if (this.blockProgress >= this.blockTarget) {
      soundFX.setMusicMode('none');
      soundFX.playLevelUp();
      this.phase = 'upgrade';
    }
    this.emitHUD();
  }

  private handlePedestrianBump(ped: PedestrianEntity, worldZ: number) {
    ped.bumped = true;
    ped.hopVel = 7.4;
    ped.rig.madGroup.visible = true;
    this.streak = 0;
    this.hearts = Math.max(0, this.hearts - 1);
    this.invulnTimer = 3.2;
    this.carStopTimer = 2.2; // Stop car so user clearly sees the person mad & babbling!
    this.currentSpeed = 0;
    this.carBounceVel = 2.8;
    soundFX.playPedestrianBabble();

    const babbleLines = [
      'Blab-blab-grr! -1 Heart',
      'Hey! Watch it! Blub-blub!',
      'Grumble-mumble! -1 Heart',
      'Blargh! My backpack! -1 Heart',
    ];
    const line = babbleLines[Math.floor(Math.random() * babbleLines.length)];

    this.emitScreenPopup(ped.x, 2.2, worldZ, line, 'warning');

    if (this.hearts <= 0) {
      // Brief moment to see the mad babbling person, then police come arrest the player!
      window.setTimeout(() => {
        if (!this.disposed && this.phase === 'playing') {
          this.triggerPoliceArrest();
        }
      }, 950);
    } else if (this.crosswalksEncountered <= 2) {
      this.statusBanner = 'Whoa! Watch for Crossers — Brake (S) or Honk (Space)!';
      this.statusBannerTimer = 2.4;
    } else {
      this.statusBanner = 'Oops! Someone is grumbling!';
      this.statusBannerTimer = 2.2;
    }
    this.emitHUD();
  }

  private handleRedLightViolation() {
    this.streak = 0;
    this.hearts = Math.max(0, this.hearts - 1);
    this.invulnTimer = 1.6;
    soundFX.playPedestrianBabble();

    this.emitScreenPopup(
      this.carX,
      2.3,
      0,
      'RAN RED LIGHT! -1 Heart',
      'warning',
    );

    if (this.hearts <= 0) {
      this.triggerPoliceArrest();
    } else {
      this.statusBanner = 'Red Light! Hold Brake (S) Until It Turns GREEN!';
      this.statusBannerTimer = 2.5;
      this.emitHUD();
    }
  }

  private triggerPoliceArrest() {
    this.phase = 'arrested';
    this.arrestTimer = 2.6;
    this.carStopTimer = 2.6;
    this.currentSpeed = 0;
    this.keys.left = false;
    this.keys.right = false;
    this.keys.up = false;
    this.keys.down = false;

    soundFX.setMusicMode('none');
    soundFX.playPoliceSiren();

    this.policeTargetX = this.carX > 0 ? this.carX - 2.3 : this.carX + 2.3;
    this.policeSquad.root.position.set(this.policeTargetX, 0, this.policeStartZ);
    this.policeSquad.root.visible = true;

    this.statusBanner = 'WEE-WOO! Out of Hearts — Police Are Arresting You!';
    this.statusBannerTimer = 2.6;
    this.emitScreenPopup(
      this.carX,
      2.4,
      0,
      'WEE-WOO! BUSTED!',
      'police',
    );
    this.emitHUD();
  }

  private finishGame(reason: 'hearts' | 'time') {
    this.phase = 'gameover';
    this.gameOverReason = reason;
    soundFX.setMusicMode('none');
    this.statusBanner = null;
    if (reason === 'time') {
      this.policeSquad.root.visible = false;
    }
    const updated = recordDriverScore({
      name: this.playerName,
      score: this.score,
      blockLevel: this.blockLevel,
      potholesHit: this.potholesHit,
      carColorCss: this.carColorCss,
      carStyle: this.carStyle,
    });
    this.callbacks.onLeaderboardUpdate(updated);
    this.emitHUD();
  }

  public dispose() {
    this.disposed = true;
    soundFX.setMusicMode('none');
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    this.renderer.domElement.removeEventListener(
      'webglcontextlost',
      this.handleContextLost,
    );
    this.renderer.domElement.removeEventListener(
      'webglcontextrestored',
      this.handleContextRestored,
    );

    this.textures.dispose();
    this.pmremEnv.dispose();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
