import * as THREE from 'three';

export type ArenaId = 'cathedral' | 'robotics';

export interface ArenaMetadata {
  id: ArenaId;
  name: string;
  shortName: string;
  subtitle: string;
  wideCameraLabel: string;
}

export const ARENA_CATALOG: Record<ArenaId, ArenaMetadata> = {
  cathedral: {
    id: 'cathedral',
    name: 'Gothic Cathedral',
    shortName: 'Cathedral',
    subtitle: 'Sculpted marble & obsidian statues inside a vaulted stone sanctum lit by twin fire braziers.',
    wideCameraLabel: 'Cathedral Wide',
  },
  robotics: {
    id: 'robotics',
    name: 'Robotics Workcell',
    shortName: 'Robotics Lab',
    subtitle: 'EVA astronaut chess crew on an optical metrology table facing a 6-DOF industrial robotic arm.',
    wideCameraLabel: 'Workcell Wide',
  },
};

export interface RoboticsArenaUpdateState {
  turn: 'w' | 'b';
  isAIThinking: boolean;
  isAnimatingMove: boolean;
  isGameOver: boolean;
  inCheck: boolean;
  reducedMotion: boolean;
  targetCoord?: { r: number; c: number } | null;
}

export interface RoboticsLabArenaInstance {
  group: THREE.Group;
  lights: THREE.Light[];
  update: (dt: number, state: RoboticsArenaUpdateState) => void;
  applyQuality: (quality: 'low' | 'medium' | 'high') => void;
  dispose: () => void;
}

const BOARD_SQ_SIZE = 0.34;

export function createRoboticsPMREMEnvironment(glRenderer: THREE.WebGLRenderer): THREE.Texture {
  const pmremGen = new THREE.PMREMGenerator(glRenderer);
  pmremGen.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x131922);

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const createdMats: THREE.Material[] = [];

  const addPanel = (colorHex: number, intensity: number, pos: [number, number, number], scl: [number, number, number]) => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex).multiplyScalar(intensity),
    });
    createdMats.push(mat);
    const m = new THREE.Mesh(boxGeo, mat);
    m.position.fromArray(pos);
    m.scale.fromArray(scl);
    envScene.add(m);
  };

  // Overhead cleanroom LED linear banks
  addPanel(0xeef6ff, 3.0, [0, 8.8, -3.5], [7.0, 0.4, 2.2]);
  addPanel(0xeef6ff, 3.0, [0, 8.8, 3.5], [7.0, 0.4, 2.2]);
  addPanel(0xdbeafe, 2.4, [-6.5, 5.2, 0], [0.8, 3.2, 14.0]);
  addPanel(0xdbeafe, 2.4, [6.5, 5.2, 0], [0.8, 3.2, 14.0]);
  // Subtle industrial amber & cyan instrument accents for crisp specular rims
  addPanel(0xff8c38, 1.8, [-4.2, 1.8, -2.5], [1.4, 1.8, 2.2]);
  addPanel(0x38bdf8, 1.8, [4.2, 1.8, -2.5], [1.4, 1.8, 2.2]);
  addPanel(0x28323e, 0.85, [0, -4.0, 0], [16.0, 1.0, 24.0]);

  const envTex = pmremGen.fromScene(envScene, 0.04).texture;
  boxGeo.dispose();
  for (const m of createdMats) m.dispose();
  pmremGen.dispose();
  return envTex;
}

function createEpoxyFloorTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#181e27';
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle industrial epoxy micro-speckle
  for (let i = 0; i < 4200; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 19341.123) % 1;
    const px = Math.abs(x) * 1024;
    const py = Math.abs(y) * 1024;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(10,14,18,0.07)';
    ctx.fillRect(px, py, 2, 2);
  }

  // Metrology 0.25m & 1.0m tile seams
  ctx.strokeStyle = 'rgba(110, 140, 175, 0.14)';
  ctx.lineWidth = 2;
  for (let g = 0; g <= 1024; g += 128) {
    ctx.beginPath();
    ctx.moveTo(g, 0);
    ctx.lineTo(g, 1024);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, g);
    ctx.lineTo(1024, g);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 1020, 1020);

  // Corner fiducial ticks
  ctx.fillStyle = 'rgba(226, 232, 240, 0.24)';
  for (const cx of [128, 896]) {
    for (const cy of [128, 896]) {
      ctx.fillRect(cx - 10, cy - 1, 20, 2);
      ctx.fillRect(cx - 1, cy - 10, 2, 20);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 12);
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

function createOpticalBreadboardTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1b222c';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle brushed metal grain
  for (let y = 0; y < 512; y += 2) {
    ctx.fillStyle = y % 4 === 0 ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.03)';
    ctx.fillRect(0, y, 512, 1);
  }

  // M6 tapped optical table hole matrix
  for (let y = 16; y < 512; y += 24) {
    for (let x = 16; x < 512; x += 24) {
      ctx.beginPath();
      ctx.arc(x, y, 3.0, 0, Math.PI * 2);
      ctx.fillStyle = '#0c1016';
      ctx.fill();
      ctx.strokeStyle = 'rgba(180, 198, 220, 0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

function createHazardStripeTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#14171c';
  ctx.fillRect(0, 0, 256, 64);

  ctx.fillStyle = '#d98218';
  for (let x = -64; x < 320; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.lineTo(x + 24, 64);
    ctx.lineTo(x + 56, 0);
    ctx.lineTo(x + 32, 0);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 1);
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

function createFiducialMarkerTexture(label: string, maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#10151c';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 112, 112);

  // Target crosshair
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(64, 64, 24, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(26, 64);
  ctx.lineTo(102, 64);
  ctx.moveTo(64, 26);
  ctx.lineTo(64, 102);
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(64, 64, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(label, 14, 112);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

function createTelemetryScreenTexture(side: 'L' | 'R', maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#07111a';
  ctx.fillRect(0, 0, 512, 320);

  // Header bar
  ctx.fillStyle = '#0f2538';
  ctx.fillRect(0, 0, 512, 42);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(side === 'L' ? 'ORBITAL CHESS BAY // VISION MATRIX' : 'EVA CREW // 6-DOF SERVO OPPONENT', 18, 27);

  // Grid & visual diagram
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 1;
  if (side === 'L') {
    const startX = 28;
    const startY = 62;
    const cell = 26;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(226, 232, 240, 0.14)' : 'rgba(15, 30, 46, 0.65)';
        ctx.fillRect(startX + c * cell, startY + r * cell, cell - 1, cell - 1);
      }
    }
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(startX - 2, startY - 2, cell * 8 + 4, cell * 8 + 4);

    // Coordinate calibration readouts
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('BOARD: 8x8 METROLOGY', 262, 84);
    ctx.fillText('PITCH: 340.0 mm', 262, 112);
    ctx.fillText('Z-DATUM: 775.0 mm', 262, 140);
    ctx.fillStyle = '#22c55e';
    ctx.fillText('OPTICS: CALIBRATED', 262, 174);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('SAFETY: INTERLOCK OK', 262, 202);

    // Sparkline graph
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 40; i++) {
      const gx = 262 + i * 5.5;
      const gy = 258 + Math.sin(i * 0.45) * 18 + Math.cos(i * 0.9) * 7;
      if (i === 0) ctx.moveTo(gx, gy);
      else ctx.lineTo(gx, gy);
    }
    ctx.stroke();
  } else {
    // Joint waveform chart
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
    for (let x = 24; x <= 488; x += 46) {
      ctx.beginPath();
      ctx.moveTo(x, 64);
      ctx.lineTo(x, 286);
      ctx.stroke();
    }
    for (let y = 64; y <= 286; y += 37) {
      ctx.beginPath();
      ctx.moveTo(24, y);
      ctx.lineTo(488, y);
      ctx.stroke();
    }

    const curves: [string, number, number][] = [
      ['#38bdf8', 110, 0.25],
      ['#f97316', 175, 0.38],
      ['#22c55e', 240, 0.52],
    ];
    for (const [col, baseY, freq] of curves) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let x = 24; x <= 488; x += 6) {
        const py = baseY + Math.sin(x * 0.025 + freq * 12) * 20;
        if (x === 24) ctx.moveTo(x, py);
        else ctx.lineTo(x, py);
      }
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

export function createRoboticsLabArena(renderer: THREE.WebGLRenderer): RoboticsLabArenaInstance {
  const maxAniso = renderer.capabilities.getMaxAnisotropy() || 8;
  const group = new THREE.Group();
  group.name = 'Robotics_Lab_Arena';

  const disposables: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[]; textures: THREE.Texture[] } = {
    geometries: [],
    materials: [],
    textures: [],
  };

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    disposables.textures.push(t);
    return t;
  };

  // Procedural textures
  const floorTex = trackTex(createEpoxyFloorTexture(maxAniso));
  const breadboardTex = trackTex(createOpticalBreadboardTexture(maxAniso));
  const hazardTex = trackTex(createHazardStripeTexture(maxAniso));
  const screenTexL = trackTex(createTelemetryScreenTexture('L', maxAniso));
  const screenTexR = trackTex(createTelemetryScreenTexture('R', maxAniso));
  const fiducialTextures = ['A1', 'H1', 'A8', 'H8'].map((lbl) =>
    trackTex(createFiducialMarkerTexture(lbl, maxAniso))
  );

  // Shared PBR material palette (distinct roughness & metalness steps)
  const floorMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: floorTex,
      color: 0xdce4ee,
      roughness: 0.72,
      metalness: 0.14,
    })
  );
  const darkCastIronMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1a2029,
      roughness: 0.56,
      metalness: 0.62,
    })
  );
  const gunmetalAnodizedMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x262f3b,
      roughness: 0.34,
      metalness: 0.82,
    })
  );
  const brushedAluminumMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xc2ccd8,
      roughness: 0.24,
      metalness: 0.90,
      anisotropy: 0.65,
    })
  );
  const chromeSteelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.14,
      metalness: 0.96,
    })
  );
  const robotOrangeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe66a19,
      roughness: 0.30,
      metalness: 0.22,
      clearcoat: 0.55,
      clearcoatRoughness: 0.18,
    })
  );
  const copperCoilMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc87a42,
      roughness: 0.24,
      metalness: 0.92,
    })
  );
  const rubberConduitMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x12151a,
      roughness: 0.84,
      metalness: 0.08,
    })
  );
  const bayWallMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x222934,
      roughness: 0.68,
      metalness: 0.24,
    })
  );
  const dadoSteelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b4656,
      roughness: 0.38,
      metalness: 0.74,
    })
  );
  const cleanroomLightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xeff6ff,
      emissive: 0xd8ecff,
      emissiveIntensity: 2.2,
      roughness: 0.15,
      metalness: 0.0,
    })
  );
  const tableStatusLedMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.9,
      roughness: 0.2,
      metalness: 0.1,
    })
  );
  const robotStatusLedMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 2.1,
      roughness: 0.2,
      metalness: 0.1,
    })
  );

  // =========================================================================
  // 1. Sealed Industrial Epoxy Floor & Hazard Workcell Perimeter
  // =========================================================================
  const floorGeo = trackGeo(new THREE.PlaneGeometry(16.0, 38.0));
  floorGeo.rotateX(-Math.PI / 2);
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.set(0, 0, 0);
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // Hazard caution border around central chess worktable + robotic arm pedestal
  const hazardMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.62,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const hzW = 5.4;
  const hzDepthMin = -3.35;
  const hzDepthMax = 2.65;
  const hzMidZ = (hzDepthMin + hzDepthMax) * 0.5;
  const hzLenZ = hzDepthMax - hzDepthMin;
  const hzThick = 0.12;

  const hzHorizGeo = trackGeo(new THREE.PlaneGeometry(hzW, hzThick));
  hzHorizGeo.rotateX(-Math.PI / 2);
  for (const zEdge of [hzDepthMin, hzDepthMax]) {
    const strip = new THREE.Mesh(hzHorizGeo, hazardMat);
    strip.position.set(0, 0.004, zEdge);
    strip.receiveShadow = true;
    group.add(strip);
  }
  const hzVertGeo = trackGeo(new THREE.PlaneGeometry(hzThick, hzLenZ));
  hzVertGeo.rotateX(-Math.PI / 2);
  for (const xEdge of [-hzW * 0.5, hzW * 0.5]) {
    const strip = new THREE.Mesh(hzVertGeo, hazardMat);
    strip.position.set(xEdge, 0.004, hzMidZ);
    strip.receiveShadow = true;
    group.add(strip);
  }

  // =========================================================================
  // 2. CNC Optical Breadboard Worktable (Matches 2.22m x 2.12m Footprint at y=0.722)
  // =========================================================================
  const opticalTableGroup = new THREE.Group();
  opticalTableGroup.name = 'Optical_Worktable';

  // Cast-iron vibration-isolation base plinth
  const baseFootGeo = trackGeo(new THREE.BoxGeometry(2.68, 0.10, 2.58));
  const baseFoot = new THREE.Mesh(baseFootGeo, darkCastIronMat);
  baseFoot.position.set(0, 0.05, 0);
  baseFoot.castShadow = true;
  baseFoot.receiveShadow = true;
  opticalTableGroup.add(baseFoot);

  // 4 pneumatic isolator leg columns
  const legGeo = trackGeo(new THREE.CylinderGeometry(0.16, 0.19, 0.54, 20));
  const collarGeo = trackGeo(new THREE.CylinderGeometry(0.21, 0.21, 0.06, 20));
  for (const lx of [-1.02, 1.02]) {
    for (const lz of [-0.96, 0.96]) {
      const leg = new THREE.Mesh(legGeo, gunmetalAnodizedMat);
      leg.position.set(lx, 0.37, lz);
      leg.castShadow = true;
      leg.receiveShadow = true;
      opticalTableGroup.add(leg);

      const collar = new THREE.Mesh(collarGeo, brushedAluminumMat);
      collar.position.set(lx, 0.61, lz);
      opticalTableGroup.add(collar);
    }
  }

  // Central equipment chassis core under table
  const coreGeo = trackGeo(new THREE.BoxGeometry(1.76, 0.52, 1.66));
  const coreMesh = new THREE.Mesh(coreGeo, darkCastIronMat);
  coreMesh.position.set(0, 0.36, 0);
  coreMesh.castShadow = true;
  coreMesh.receiveShadow = true;
  opticalTableGroup.add(coreMesh);

  // Main optical breadboard deck (top sits at y = 0.722, safely below BOARD_SURFACE_Y = 0.775)
  const breadboardMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: breadboardTex,
      roughness: 0.36,
      metalness: 0.78,
    })
  );
  const deckGeo = trackGeo(new THREE.BoxGeometry(4.12, 0.082, 3.92));
  const deckMesh = new THREE.Mesh(deckGeo, breadboardMat);
  deckMesh.position.set(0, 0.681, 0);
  deckMesh.castShadow = true;
  deckMesh.receiveShadow = true;
  opticalTableGroup.add(deckMesh);

  // Machined aluminum outer trim rail around the optical table
  const railHGeo = trackGeo(new THREE.BoxGeometry(4.24, 0.092, 0.07));
  const railVGeo = trackGeo(new THREE.BoxGeometry(0.07, 0.092, 4.04));
  for (const sz of [-1.96, 1.96]) {
    const rMesh = new THREE.Mesh(railHGeo, brushedAluminumMat);
    rMesh.position.set(0, 0.681, sz);
    opticalTableGroup.add(rMesh);
  }
  for (const sx of [-2.06, 2.06]) {
    const rMesh = new THREE.Mesh(railVGeo, brushedAluminumMat);
    rMesh.position.set(sx, 0.681, 0);
    opticalTableGroup.add(rMesh);
  }

  // Turn-reactive status LED strips recessed on North/South table edges
  const ledStripGeo = trackGeo(new THREE.BoxGeometry(2.68, 0.018, 0.02));
  for (const sz of [-2.0, 2.0]) {
    const led = new THREE.Mesh(ledStripGeo, tableStatusLedMat);
    led.position.set(0, 0.685, sz);
    opticalTableGroup.add(led);
  }

  // 4 Corner Vision-Calibration Fiducial Target Plates on the optical deck
  const fidGeo = trackGeo(new THREE.PlaneGeometry(0.24, 0.24));
  fidGeo.rotateX(-Math.PI / 2);
  const fidPositions: [number, number][] = [
    [-1.68, 1.62],
    [1.68, 1.62],
    [-1.68, -1.62],
    [1.68, -1.62],
  ];
  fidPositions.forEach(([fx, fz], idx) => {
    const fMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: fiducialTextures[idx],
        roughness: 0.32,
        metalness: 0.2,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    const fPlate = new THREE.Mesh(fidGeo, fMat);
    fPlate.position.set(fx, 0.724, fz);
    opticalTableGroup.add(fPlate);
  });

  // Raised machined pedestal pad right beneath the 8x8 chessboard (top y = 0.738, flush under 0.739 tile underside)
  const boardSubPadGeo = trackGeo(new THREE.BoxGeometry(2.90, 0.016, 2.90));
  const boardSubPad = new THREE.Mesh(boardSubPadGeo, gunmetalAnodizedMat);
  boardSubPad.position.set(0, 0.730, 0);
  boardSubPad.receiveShadow = true;
  opticalTableGroup.add(boardSubPad);

  group.add(opticalTableGroup);

  // =========================================================================
  // 3. Articulated 6-DOF Industrial Robotic Arm Opponent Rig (z = -2.28)
  // =========================================================================
  const robotRigRoot = new THREE.Group();
  robotRigRoot.name = 'Robotic_Arm_Rig';
  robotRigRoot.position.set(0, 0, -2.28);

  // Heavy cast-iron column pedestal
  const pedBaseGeo = trackGeo(new THREE.CylinderGeometry(0.46, 0.54, 0.14, 8));
  const pedBase = new THREE.Mesh(pedBaseGeo, darkCastIronMat);
  pedBase.position.y = 0.07;
  pedBase.castShadow = true;
  pedBase.receiveShadow = true;
  robotRigRoot.add(pedBase);

  const pedColGeo = trackGeo(new THREE.CylinderGeometry(0.28, 0.34, 0.62, 24));
  const pedCol = new THREE.Mesh(pedColGeo, gunmetalAnodizedMat);
  pedCol.position.y = 0.45;
  pedCol.castShadow = true;
  pedCol.receiveShadow = true;
  robotRigRoot.add(pedCol);

  const pedPlateGeo = trackGeo(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 24));
  const pedPlate = new THREE.Mesh(pedPlateGeo, brushedAluminumMat);
  pedPlate.position.y = 0.79;
  pedPlate.castShadow = true;
  robotRigRoot.add(pedPlate);

  // Instanced hex flange bolts on pedestal base & turret collar (24 total)
  const boltGeo = trackGeo(new THREE.CylinderGeometry(0.016, 0.016, 0.028, 6));
  const boltsMesh = new THREE.InstancedMesh(boltGeo, chromeSteelMat, 24);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 0.44, 0.15, Math.sin(a) * 0.44);
    dummy.updateMatrix();
    boltsMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(Math.cos(a) * 0.31, 0.83, Math.sin(a) * 0.31);
    dummy.updateMatrix();
    boltsMesh.setMatrixAt(12 + i, dummy.matrix);
  }
  boltsMesh.computeBoundingSphere();
  robotRigRoot.add(boltsMesh);

  // Axis 1: Base Rotary Turret (yaw)
  const yawGroup = new THREE.Group();
  yawGroup.position.set(0, 0.82, 0);
  robotRigRoot.add(yawGroup);

  const turretDrumGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.27, 0.22, 24));
  const turretDrum = new THREE.Mesh(turretDrumGeo, robotOrangeMat);
  turretDrum.position.y = 0.11;
  turretDrum.castShadow = true;
  yawGroup.add(turretDrum);

  const statusRingGeo = trackGeo(new THREE.TorusGeometry(0.245, 0.014, 12, 32));
  statusRingGeo.rotateX(Math.PI / 2);
  const statusRing = new THREE.Mesh(statusRingGeo, robotStatusLedMat);
  statusRing.position.y = 0.21;
  yawGroup.add(statusRing);

  // Shoulder Clevis Cheek Plates
  const shoulderYokeGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.22, 0.24));
  const shoulderYoke = new THREE.Mesh(shoulderYokeGeo, darkCastIronMat);
  shoulderYoke.position.set(0, 0.29, 0);
  shoulderYoke.castShadow = true;
  yawGroup.add(shoulderYoke);

  // Axis 2: Shoulder Pitch Pivot
  const shoulderGroup = new THREE.Group();
  shoulderGroup.position.set(0, 0.34, 0.04);
  yawGroup.add(shoulderGroup);

  const servoCapGeo = trackGeo(new THREE.CylinderGeometry(0.13, 0.13, 0.38, 20));
  servoCapGeo.rotateZ(Math.PI / 2);
  const shoulderServo = new THREE.Mesh(servoCapGeo, gunmetalAnodizedMat);
  shoulderServo.castShadow = true;
  shoulderGroup.add(shoulderServo);

  const copperCapGeo = trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.40, 18));
  copperCapGeo.rotateZ(Math.PI / 2);
  const shoulderCopper = new THREE.Mesh(copperCapGeo, copperCoilMat);
  shoulderGroup.add(shoulderCopper);

  // Machined lower arm boom (ExtrudeGeometry tapered spar)
  const boomShape = new THREE.Shape();
  boomShape.moveTo(-0.095, 0);
  boomShape.lineTo(0.095, 0);
  boomShape.lineTo(0.068, 0.96);
  boomShape.lineTo(-0.068, 0.96);
  boomShape.closePath();

  const lowerBoomGeo = trackGeo(
    new THREE.ExtrudeGeometry(boomShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.012,
      bevelSegments: 2,
    })
  );
  lowerBoomGeo.translate(0, 0, -0.07);
  const lowerBoom = new THREE.Mesh(lowerBoomGeo, robotOrangeMat);
  lowerBoom.castShadow = true;
  shoulderGroup.add(lowerBoom);

  const lowerRibGeo = trackGeo(new THREE.BoxGeometry(0.05, 0.72, 0.17));
  const lowerRib = new THREE.Mesh(lowerRibGeo, brushedAluminumMat);
  lowerRib.position.set(0, 0.48, 0);
  shoulderGroup.add(lowerRib);

  // Axis 3: Elbow Pivot
  const elbowGroup = new THREE.Group();
  elbowGroup.position.set(0, 0.96, 0);
  shoulderGroup.add(elbowGroup);

  const elbowServoGeo = trackGeo(new THREE.CylinderGeometry(0.105, 0.105, 0.28, 20));
  elbowServoGeo.rotateZ(Math.PI / 2);
  const elbowServo = new THREE.Mesh(elbowServoGeo, gunmetalAnodizedMat);
  elbowServo.castShadow = true;
  elbowGroup.add(elbowServo);

  const elbowHousingGeo = trackGeo(new THREE.BoxGeometry(0.15, 0.20, 0.28));
  const elbowHousing = new THREE.Mesh(elbowHousingGeo, robotOrangeMat);
  elbowHousing.position.set(0, 0.05, 0.10);
  elbowHousing.castShadow = true;
  elbowGroup.add(elbowHousing);

  // Upper forearm extending toward +Z (board direction)
  const forearmTubeGeo = trackGeo(new THREE.CylinderGeometry(0.064, 0.082, 0.82, 18));
  forearmTubeGeo.rotateX(Math.PI / 2);
  const forearmTube = new THREE.Mesh(forearmTubeGeo, brushedAluminumMat);
  forearmTube.position.set(0, 0.04, 0.50);
  forearmTube.castShadow = true;
  elbowGroup.add(forearmTube);

  // Umbilical pneumatic/power conduit along the forearm
  const conduitCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.09, 0.08, -0.02),
    new THREE.Vector3(0.11, 0.16, 0.28),
    new THREE.Vector3(0.09, 0.11, 0.62),
    new THREE.Vector3(0.05, 0.05, 0.88),
  ]);
  const conduitGeo = trackGeo(new THREE.TubeGeometry(conduitCurve, 24, 0.017, 10, false));
  const conduitMesh = new THREE.Mesh(conduitGeo, rubberConduitMat);
  elbowGroup.add(conduitMesh);

  // Axis 4/5: Wrist Gimbal + Vision Camera + Parallel-Jaw Precision Gripper
  const wristGroup = new THREE.Group();
  wristGroup.position.set(0, 0.04, 0.92);
  elbowGroup.add(wristGroup);

  const wristDrumGeo = trackGeo(new THREE.CylinderGeometry(0.058, 0.058, 0.12, 16));
  wristDrumGeo.rotateZ(Math.PI / 2);
  const wristDrum = new THREE.Mesh(wristDrumGeo, darkCastIronMat);
  wristGroup.add(wristDrum);

  const gripperBodyGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.07, 0.12));
  const gripperBody = new THREE.Mesh(gripperBodyGeo, gunmetalAnodizedMat);
  gripperBody.position.set(0, -0.04, 0.08);
  gripperBody.castShadow = true;
  wristGroup.add(gripperBody);

  // Wrist-mounted machine-vision camera pod
  const camPodGeo = trackGeo(new THREE.BoxGeometry(0.07, 0.048, 0.06));
  const camPod = new THREE.Mesh(camPodGeo, darkCastIronMat);
  camPod.position.set(0, 0.04, 0.07);
  wristGroup.add(camPod);

  const camLensGeo = trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 16));
  camLensGeo.rotateX(Math.PI / 2);
  const camLens = new THREE.Mesh(camLensGeo, robotStatusLedMat);
  camLens.position.set(0, 0.04, 0.105);
  wristGroup.add(camLens);

  // Left & Right Parallel Servo Gripper Jaws
  const fingerGeo = trackGeo(new THREE.BoxGeometry(0.022, 0.13, 0.042));
  const leftFinger = new THREE.Mesh(fingerGeo, chromeSteelMat);
  leftFinger.position.set(-0.045, -0.13, 0.09);
  wristGroup.add(leftFinger);

  const rightFinger = new THREE.Mesh(fingerGeo, chromeSteelMat);
  rightFinger.position.set(0.045, -0.13, 0.09);
  wristGroup.add(rightFinger);

  group.add(robotRigRoot);

  // =========================================================================
  // 4. Modular T-Slot Gantry Frame & Cleanroom Overhead Light Rig
  // =========================================================================
  const gantryGeoV = trackGeo(new THREE.BoxGeometry(0.16, 4.90, 0.16));
  const gantryFootGeo = trackGeo(new THREE.BoxGeometry(0.34, 0.08, 0.34));
  const gantryXs = [-4.65, 4.65];
  const gantryZs = [-4.35, 4.35];

  for (const gx of gantryXs) {
    for (const gz of gantryZs) {
      const col = new THREE.Mesh(gantryGeoV, brushedAluminumMat);
      col.position.set(gx, 2.45, gz);
      col.receiveShadow = true;
      group.add(col);

      const foot = new THREE.Mesh(gantryFootGeo, darkCastIronMat);
      foot.position.set(gx, 0.04, gz);
      group.add(foot);
    }
  }

  // Longitudinal overhead gantry beams & cross bridge
  const longBeamGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.22, 8.86));
  for (const gx of gantryXs) {
    const b = new THREE.Mesh(longBeamGeo, gunmetalAnodizedMat);
    b.position.set(gx, 4.92, 0);
    group.add(b);
  }
  const crossBeamGeo = trackGeo(new THREE.BoxGeometry(9.46, 0.22, 0.20));
  for (const bz of [-4.35, 0, 4.35]) {
    const b = new THREE.Mesh(crossBeamGeo, brushedAluminumMat);
    b.position.set(0, 4.92, bz);
    group.add(b);
  }

  // Cleanroom overhead LED luminaire banks
  const ledHousingGeo = trackGeo(new THREE.BoxGeometry(2.90, 0.08, 0.65));
  const ledPanelGeo = trackGeo(new THREE.PlaneGeometry(2.74, 0.52));
  ledPanelGeo.rotateX(Math.PI / 2);
  for (const lz of [-2.4, 0.0, 2.4]) {
    const housing = new THREE.Mesh(ledHousingGeo, darkCastIronMat);
    housing.position.set(0, 5.02, lz);
    group.add(housing);

    const diffuser = new THREE.Mesh(ledPanelGeo, cleanroomLightMat);
    diffuser.position.set(0, 4.978, lz);
    group.add(diffuser);
  }

  // =========================================================================
  // 5. Flanking Sensor Pylons (at x = +/-3.65, z = 0) & Control Cabinets
  // =========================================================================
  const pylonBaseGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.38, 0.14, 16));
  const pylonShaftGeo = trackGeo(new THREE.CylinderGeometry(0.09, 0.11, 1.42, 16));
  const pylonHeadGeo = trackGeo(new THREE.BoxGeometry(0.28, 0.20, 0.24));
  const pylonRingGeo = trackGeo(new THREE.TorusGeometry(0.11, 0.015, 10, 24));
  pylonRingGeo.rotateX(Math.PI / 2);

  for (const sx of [-3.65, 3.65]) {
    const pGroup = new THREE.Group();
    pGroup.position.set(sx, 0, 0);

    const base = new THREE.Mesh(pylonBaseGeo, darkCastIronMat);
    base.position.y = 0.07;
    pGroup.add(base);

    const shaft = new THREE.Mesh(pylonShaftGeo, brushedAluminumMat);
    shaft.position.y = 0.85;
    pGroup.add(shaft);

    const head = new THREE.Mesh(pylonHeadGeo, gunmetalAnodizedMat);
    head.position.y = 1.64;
    head.rotation.y = sx < 0 ? Math.PI * 0.18 : -Math.PI * 0.18;
    pGroup.add(head);

    const ring = new THREE.Mesh(pylonRingGeo, tableStatusLedMat);
    ring.position.y = 1.50;
    pGroup.add(ring);

    group.add(pGroup);
  }

  // Telemetry & Vision Controller Cabinets flanking the cell
  const cabBodyGeo = trackGeo(new THREE.BoxGeometry(0.95, 1.72, 0.72));
  const screenPlaneGeo = trackGeo(new THREE.PlaneGeometry(0.66, 0.42));
  const beaconGeo = trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 12));
  const greenBeaconMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x22c55e,
      emissiveIntensity: 1.8,
    })
  );

  for (const [cx, tex] of [
    [-4.10, screenTexL],
    [4.10, screenTexR],
  ] as [number, THREE.CanvasTexture][]) {
    const cabGroup = new THREE.Group();
    cabGroup.position.set(cx, 0, -2.10);
    cabGroup.rotation.y = cx < 0 ? 0.36 : -0.36;

    const body = new THREE.Mesh(cabBodyGeo, darkCastIronMat);
    body.position.y = 0.86;
    body.castShadow = true;
    body.receiveShadow = true;
    cabGroup.add(body);

    const bezel = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.74, 0.50, 0.04)),
      brushedAluminumMat
    );
    bezel.position.set(0, 1.24, 0.36);
    cabGroup.add(bezel);

    const scrMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: 0xffffff,
        emissiveIntensity: 0.75,
        roughness: 0.2,
      })
    );
    const scr = new THREE.Mesh(screenPlaneGeo, scrMat);
    scr.position.set(0, 1.24, 0.382);
    cabGroup.add(scr);

    const beacon = new THREE.Mesh(beaconGeo, greenBeaconMat);
    beacon.position.set(0, 1.80, 0);
    cabGroup.add(beacon);

    group.add(cabGroup);
  }

  // =========================================================================
  // 6. Enclosing Industrial Lab Bay Walls, Dado Rails, Clerestory Windows & Roof
  // =========================================================================
  const sideWallGeo = trackGeo(new THREE.BoxGeometry(0.30, 9.20, 38.0));
  const endWallGeo = trackGeo(new THREE.BoxGeometry(14.8, 9.20, 0.30));
  for (const sx of [-7.0, 7.0]) {
    const wall = new THREE.Mesh(sideWallGeo, bayWallMat);
    wall.position.set(sx, 4.60, 0);
    wall.receiveShadow = true;
    group.add(wall);

    const dado = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.18, 37.8)), dadoSteelMat);
    dado.position.set(sx < 0 ? -6.82 : 6.82, 1.20, 0);
    group.add(dado);

    // High clerestory light strip windows
    const stripWin = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.06, 0.55, 28.0)),
      cleanroomLightMat
    );
    stripWin.position.set(sx < 0 ? -6.82 : 6.82, 6.20, 0);
    group.add(stripWin);
  }

  for (const sz of [-18.4, 18.4]) {
    const endW = new THREE.Mesh(endWallGeo, bayWallMat);
    endW.position.set(0, 4.60, sz);
    group.add(endW);

    const endDado = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(14.2, 0.18, 0.36)), dadoSteelMat);
    endDado.position.set(0, 1.20, sz < 0 ? -18.22 : 18.22);
    group.add(endDado);

    const endWin = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(9.6, 0.65, 0.08)),
      cleanroomLightMat
    );
    endWin.position.set(0, 6.20, sz < 0 ? -18.22 : 18.22);
    group.add(endWin);
  }

  // Acoustic ceiling deck & structural roof trusses
  const ceilingGeo = trackGeo(new THREE.PlaneGeometry(14.8, 38.0));
  ceilingGeo.rotateX(Math.PI / 2);
  const ceiling = new THREE.Mesh(ceilingGeo, darkCastIronMat);
  ceiling.position.set(0, 9.15, 0);
  group.add(ceiling);

  const trussGeo = trackGeo(new THREE.BoxGeometry(14.2, 0.38, 0.24));
  const trusses = new THREE.InstancedMesh(trussGeo, dadoSteelMat, 7);
  for (let i = 0; i < 7; i++) {
    dummy.position.set(0, 8.92, -15.0 + i * 5.0);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    trusses.setMatrixAt(i, dummy.matrix);
  }
  trusses.computeBoundingSphere();
  group.add(trusses);

  // =========================================================================
  // 7. Dedicated Cool Precision Studio Lighting Rig for Robotics Workcell
  // =========================================================================
  const hemiLight = new THREE.HemisphereLight(0xdceeff, 0x1a222d, 0.85);
  const keyLight = new THREE.DirectionalLight(0xf6faff, 2.65);
  keyLight.position.set(3.4, 8.6, 4.2);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 1.0;
  keyLight.shadow.camera.far = 22.0;
  const d = 3.4;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.bias = -0.0005;

  const rimLight = new THREE.DirectionalLight(0x9bd0ff, 1.05);
  rimLight.position.set(-4.6, 6.2, -5.8);

  const accentOrangeLight = new THREE.PointLight(0xff8c38, 2.8, 12.0, 1.5);
  accentOrangeLight.position.set(-3.2, 2.4, -2.1);

  const accentCyanLight = new THREE.PointLight(0x38bdf8, 3.0, 12.0, 1.5);
  accentCyanLight.position.set(3.2, 2.4, -2.1);

  const lights: THREE.Light[] = [hemiLight, keyLight, rimLight, accentOrangeLight, accentCyanLight];
  for (const l of lights) group.add(l);

  // =========================================================================
  // 8. Smooth Joint Kinematics Update
  // =========================================================================
  let simTime = 0;
  let curYaw = 0;
  let curShoulder = -0.34;
  let curElbow = 0.62;
  let curWrist = -0.28;
  let curGrip = 0.045;

  function update(dt: number, state: RoboticsArenaUpdateState) {
    simTime += dt;

    // Update status LEDs (White = crisp ivory/cyan, Black = cobalt blue, Check/Mate = crimson)
    if (state.isGameOver || state.inCheck) {
      tableStatusLedMat.color.setHex(0xef4444);
      tableStatusLedMat.emissive.setHex(0xef4444);
      robotStatusLedMat.color.setHex(state.isGameOver ? 0xf59e0b : 0xef4444);
      robotStatusLedMat.emissive.setHex(state.isGameOver ? 0xf59e0b : 0xef4444);
    } else if (state.turn === 'b') {
      tableStatusLedMat.color.setHex(0x38bdf8);
      tableStatusLedMat.emissive.setHex(0x38bdf8);
      robotStatusLedMat.color.setHex(0x38bdf8);
      robotStatusLedMat.emissive.setHex(0x38bdf8);
    } else {
      tableStatusLedMat.color.setHex(0xe2e8f0);
      tableStatusLedMat.emissive.setHex(0xcbd5e1);
      robotStatusLedMat.color.setHex(0x22c55e);
      robotStatusLedMat.emissive.setHex(0x22c55e);
    }

    // Desired arm pose: poised cleanly above Black's back edge, aiming toward active move or gentle idle scan
    let targetYaw = 0;
    let targetShoulder = -0.34;
    let targetElbow = 0.64;
    let targetWrist = -0.32;
    let targetGrip = 0.048;

    if (state.targetCoord && (state.turn === 'b' || state.isAIThinking || state.isAnimatingMove)) {
      const worldX = (state.targetCoord.c - 3.5) * BOARD_SQ_SIZE;
      const worldZ = (state.targetCoord.r - 3.5) * BOARD_SQ_SIZE;
      const dz = Math.max(0.85, worldZ - (-2.28));
      targetYaw = Math.max(-0.62, Math.min(0.62, Math.atan2(worldX, dz)));
      const reachNorm = Math.max(0, Math.min(1, (dz - 0.9) / 2.6));
      targetShoulder = -0.24 + reachNorm * 0.22;
      targetElbow = 0.70 - reachNorm * 0.24;
      targetWrist = -0.44 + reachNorm * 0.10;
      targetGrip = state.isAnimatingMove ? 0.026 : 0.052;
    } else if (!state.reducedMotion && !state.isGameOver) {
      targetYaw = Math.sin(simTime * 0.55) * 0.11;
      targetShoulder = -0.35 + Math.sin(simTime * 0.9) * 0.025;
      targetElbow = 0.64 + Math.cos(simTime * 0.9) * 0.025;
      targetWrist = -0.30;
      targetGrip = 0.048;
    }

    const dampK = state.reducedMotion ? 16 : 4.8;
    curYaw = THREE.MathUtils.damp(curYaw, targetYaw, dampK, dt);
    curShoulder = THREE.MathUtils.damp(curShoulder, targetShoulder, dampK, dt);
    curElbow = THREE.MathUtils.damp(curElbow, targetElbow, dampK, dt);
    curWrist = THREE.MathUtils.damp(curWrist, targetWrist, dampK, dt);
    curGrip = THREE.MathUtils.damp(curGrip, targetGrip, dampK * 1.4, dt);

    yawGroup.rotation.y = curYaw;
    shoulderGroup.rotation.x = curShoulder;
    elbowGroup.rotation.x = curElbow;
    wristGroup.rotation.x = curWrist;
    leftFinger.position.x = -curGrip;
    rightFinger.position.x = curGrip;
  }

  function applyQuality(quality: 'low' | 'medium' | 'high') {
    accentOrangeLight.visible = quality !== 'low';
    accentCyanLight.visible = quality !== 'low';
  }

  function dispose() {
    for (const g of disposables.geometries) g.dispose();
    for (const m of disposables.materials) m.dispose();
    for (const t of disposables.textures) t.dispose();
  }

  return {
    group,
    lights,
    update,
    applyQuality,
    dispose,
  };
}
