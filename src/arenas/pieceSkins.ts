import * as THREE from 'three';
import type { ArenaId } from './roboticsLabArena';

export type ChessPieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
export type ChessSide = 'w' | 'b';

export interface PieceSkinSystem {
  attachAndApply: (
    root: THREE.Object3D,
    type: ChessPieceType,
    color: ChessSide,
    arenaId: ArenaId,
    pieceUserData: unknown
  ) => void;
  applyArenaToPiece: (root: THREE.Object3D, color: ChessSide, arenaId: ArenaId) => void;
  getShardMaterial: (color: ChessSide, arenaId: ArenaId) => THREE.Material;
  dispose: () => void;
}

function createEvaSuitTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle technical aerospace weave & panel seams
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 256; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(100, 116, 139, 0.34)';
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, 248, 120);
  ctx.strokeRect(4, 132, 248, 120);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

export function createPieceSkinSystem(renderer: THREE.WebGLRenderer): PieceSkinSystem {
  const maxAniso = renderer.capabilities.getMaxAnisotropy() || 8;
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  const evaSuitTex = trackTex(createEvaSuitTexture(maxAniso));

  // ---------------------------------------------------------------------------
  // Cathedral Materials (Sculpted Marble, Obsidian, Antique Gold, Forged Steel)
  // ---------------------------------------------------------------------------
  const cathedralWhiteMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe6dfd0,
      roughness: 0.34,
      metalness: 0.06,
    })
  );
  const cathedralBlackMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x222630,
      roughness: 0.28,
      metalness: 0.24,
    })
  );
  const cathedralGoldMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.26,
      metalness: 0.86,
    })
  );
  const cathedralSteelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdce4ee,
      roughness: 0.20,
      metalness: 0.88,
      emissive: 0x222832,
      emissiveIntensity: 0.25,
    })
  );

  // ---------------------------------------------------------------------------
  // Robotics / Orbital Space Astronaut Materials
  // ---------------------------------------------------------------------------
  const evaWhiteBodyMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: evaSuitTex,
      color: 0xf1f5f9,
      roughness: 0.26,
      metalness: 0.10,
      clearcoat: 0.62,
      clearcoatRoughness: 0.16,
    })
  );
  const evaBlackBodyMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: evaSuitTex,
      color: 0x2a3342,
      roughness: 0.28,
      metalness: 0.44,
      clearcoat: 0.58,
      clearcoatRoughness: 0.18,
    })
  );
  const solarGoldTrimMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xf5b82e,
      roughness: 0.18,
      metalness: 0.92,
      anisotropy: 0.6,
    })
  );
  const orbitalCopperTrimMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe68422,
      roughness: 0.20,
      metalness: 0.90,
      anisotropy: 0.55,
    })
  );
  const aerospaceTitaniumMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.22,
      metalness: 0.88,
    })
  );
  const gunmetalTitaniumMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.24,
      metalness: 0.88,
    })
  );

  // Reflective EVA helmet visors (NASA gold-iridium for White, amber-obsidian for Black)
  const whiteVisorMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xfde073,
      roughness: 0.08,
      metalness: 0.90,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      iridescence: 0.45,
      emissive: 0x3b2a06,
      emissiveIntensity: 0.28,
    })
  );
  const blackVisorMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xf97316,
      roughness: 0.08,
      metalness: 0.88,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      iridescence: 0.5,
      emissive: 0x3a1402,
      emissiveIntensity: 0.34,
    })
  );

  const evaGlassDomeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xdff4ff,
      transparent: true,
      opacity: 0.30,
      roughness: 0.06,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      depthWrite: false,
    })
  );

  const whiteTelemetryLedMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 2.1,
      roughness: 0.18,
      metalness: 0.1,
    })
  );
  const blackTelemetryLedMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.1,
      roughness: 0.18,
      metalness: 0.1,
    })
  );

  // ---------------------------------------------------------------------------
  // Shared Procedural Geometries for Astronaut Uniform Kit
  // ---------------------------------------------------------------------------
  const collarRingGeo = trackGeo(new THREE.TorusGeometry(0.16, 0.024, 10, 24));
  collarRingGeo.rotateX(Math.PI / 2);

  const wideCollarRingGeo = trackGeo(new THREE.TorusGeometry(0.185, 0.026, 10, 24));
  wideCollarRingGeo.rotateX(Math.PI / 2);

  const helmetDomeGeo = trackGeo(new THREE.SphereGeometry(0.185, 20, 16));
  const visorDomeGeo = trackGeo(
    new THREE.SphereGeometry(0.168, 20, 14, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.20, Math.PI * 0.54)
  );
  // Rotate so phi=0 points toward +Z (piece front)
  visorDomeGeo.rotateY(Math.PI / 2);

  const faceShieldBandGeo = trackGeo(
    new THREE.CylinderGeometry(0.168, 0.174, 0.14, 18, 1, true, -Math.PI * 0.38, Math.PI * 0.76)
  );

  const earPodGeo = trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 12));
  earPodGeo.rotateZ(Math.PI / 2);

  const antennaStemGeo = trackGeo(new THREE.CylinderGeometry(0.008, 0.011, 0.15, 8));
  const antennaTipGeo = trackGeo(new THREE.SphereGeometry(0.018, 10, 10));

  const packBodyGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.27, 0.12));
  const largePackBodyGeo = trackGeo(new THREE.BoxGeometry(0.29, 0.32, 0.14));
  const thrusterNozzleGeo = trackGeo(new THREE.CylinderGeometry(0.022, 0.036, 0.065, 12));
  const packStripGeo = trackGeo(new THREE.BoxGeometry(0.13, 0.024, 0.018));
  const chestPlssGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.11, 0.04));
  const chestLedGeo = trackGeo(new THREE.BoxGeometry(0.09, 0.02, 0.015));

  // Queen & King unmistakable Space Royal Crowns
  const crownBandGeo = trackGeo(new THREE.CylinderGeometry(0.16, 0.14, 0.06, 20, 1, true));
  const spireGeo = trackGeo(new THREE.ConeGeometry(0.022, 0.11, 8));
  const crownArchGeo = trackGeo(new THREE.TorusGeometry(0.145, 0.014, 8, 20, Math.PI));
  const crossVertGeo = trackGeo(new THREE.BoxGeometry(0.034, 0.14, 0.026));
  const crossHorizGeo = trackGeo(new THREE.BoxGeometry(0.105, 0.032, 0.026));
  const orbitalHaloGeo = trackGeo(new THREE.TorusGeometry(0.22, 0.012, 10, 28));
  orbitalHaloGeo.rotateX(Math.PI / 2);

  // Bishop Astrolabe Collar
  const astrolabeRingGeo = trackGeo(new THREE.TorusGeometry(0.20, 0.013, 10, 28));
  const wingFinGeo = trackGeo(new THREE.BoxGeometry(0.022, 0.24, 0.11));

  // Rook Airlock Collar & Orbital Radar Dish
  const airlockRingGeo = trackGeo(new THREE.TorusGeometry(0.315, 0.028, 10, 24));
  airlockRingGeo.rotateX(Math.PI / 2);
  const rcsPodGeo = trackGeo(new THREE.BoxGeometry(0.08, 0.16, 0.14));
  const dishPedestalGeo = trackGeo(new THREE.CylinderGeometry(0.04, 0.055, 0.08, 12));
  const dishBowlGeo = trackGeo(new THREE.SphereGeometry(0.14, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.36));

  // Knight Horse Visor & Saddle Thrusters
  const horseVisorGeo = trackGeo(new THREE.BoxGeometry(0.16, 0.05, 0.10));
  const saddlePodGeo = trackGeo(new THREE.CylinderGeometry(0.048, 0.058, 0.22, 12));
  saddlePodGeo.rotateX(Math.PI / 2);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function findBone(root: THREE.Object3D, exactName: string): THREE.Object3D | null {
    let found: THREE.Object3D | null = null;
    root.traverse((obj) => {
      if (!found && obj.name === exactName) found = obj;
    });
    return found;
  }

  function createAlignedBoneMount(
    root: THREE.Object3D,
    bone: THREE.Object3D,
    extraPitchRad = 0
  ): THREE.Group {
    root.updateMatrixWorld(true);
    const qRoot = new THREE.Quaternion();
    const qBone = new THREE.Quaternion();
    root.getWorldQuaternion(qRoot);
    bone.getWorldQuaternion(qBone);

    const mount = new THREE.Group();
    mount.name = `SpaceUniformMount_${bone.name}`;
    mount.quaternion.copy(qBone).invert().multiply(qRoot);
    if (extraPitchRad !== 0) {
      const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), extraPitchRad);
      mount.quaternion.multiply(qPitch);
    }
    bone.add(mount);
    return mount;
  }

  function buildEvaBackpack(
    trimMat: THREE.Material,
    bodyMat: THREE.Material,
    hardwareMat: THREE.Material,
    ledMat: THREE.Material,
    isHeavy = false
  ): THREE.Group {
    const pack = new THREE.Group();
    const main = new THREE.Mesh(isHeavy ? largePackBodyGeo : packBodyGeo, bodyMat);
    main.castShadow = true;
    pack.add(main);

    const frameStrip = new THREE.Mesh(packStripGeo, trimMat);
    frameStrip.position.set(0, 0.075, isHeavy ? -0.072 : -0.062);
    pack.add(frameStrip);

    const ledBar = new THREE.Mesh(packStripGeo, ledMat);
    ledBar.scale.set(0.75, 0.7, 1);
    ledBar.position.set(0, 0.025, isHeavy ? -0.074 : -0.064);
    pack.add(ledBar);

    for (const sx of [-0.075, 0.075]) {
      const nozzle = new THREE.Mesh(thrusterNozzleGeo, hardwareMat);
      nozzle.position.set(sx, isHeavy ? -0.17 : -0.145, 0.01);
      pack.add(nozzle);
    }
    return pack;
  }

  function buildSpaceUniformAttachments(
    root: THREE.Object3D,
    type: ChessPieceType,
    color: ChessSide,
    pieceUserData: unknown
  ): THREE.Group[] {
    const bodyMat = color === 'w' ? evaWhiteBodyMat : evaBlackBodyMat;
    const trimMat = color === 'w' ? solarGoldTrimMat : orbitalCopperTrimMat;
    const hardwareMat = color === 'w' ? aerospaceTitaniumMat : gunmetalTitaniumMat;
    const visorMat = color === 'w' ? whiteVisorMat : blackVisorMat;
    const ledMat = color === 'w' ? whiteTelemetryLedMat : blackTelemetryLedMat;

    const mounts: THREE.Group[] = [];

    if (type === 'pawn') {
      const head = findBone(root, 'Head');
      if (head) {
        const m = createAlignedBoneMount(root, head);
        const collar = new THREE.Mesh(collarRingGeo, trimMat);
        collar.position.set(0, 0.02, 0);
        m.add(collar);

        const dome = new THREE.Mesh(helmetDomeGeo, evaGlassDomeMat);
        dome.position.set(0, 0.14, 0.01);
        dome.renderOrder = 6;
        m.add(dome);

        const visor = new THREE.Mesh(visorDomeGeo, visorMat);
        visor.position.set(0, 0.145, 0.015);
        m.add(visor);

        for (const sx of [-1, 1]) {
          const ear = new THREE.Mesh(earPodGeo, hardwareMat);
          ear.position.set(sx * 0.165, 0.14, 0);
          m.add(ear);
        }
        const ant = new THREE.Mesh(antennaStemGeo, hardwareMat);
        ant.position.set(-0.17, 0.24, -0.03);
        m.add(ant);
        const tip = new THREE.Mesh(antennaTipGeo, ledMat);
        tip.position.set(-0.17, 0.32, -0.03);
        m.add(tip);

        mounts.push(m);
      }

      const torso = findBone(root, 'Torso');
      if (torso) {
        const m = createAlignedBoneMount(root, torso);
        const pack = buildEvaBackpack(trimMat, bodyMat, hardwareMat, ledMat, false);
        pack.position.set(0, 0.09, -0.185);
        m.add(pack);

        const chest = new THREE.Mesh(chestPlssGeo, hardwareMat);
        chest.position.set(0, 0.08, 0.165);
        m.add(chest);

        const cLed = new THREE.Mesh(chestLedGeo, ledMat);
        cLed.position.set(0, 0.09, 0.185);
        m.add(cLed);
        mounts.push(m);
      }
    } else if (type === 'rook') {
      const upper = findBone(root, 'Tower_Upper');
      if (upper) {
        const m = createAlignedBoneMount(root, upper);
        const collar = new THREE.Mesh(airlockRingGeo, trimMat);
        collar.position.set(0, 0.16, 0);
        m.add(collar);

        const frontStrip = new THREE.Mesh(packStripGeo, ledMat);
        frontStrip.scale.set(1.8, 1.0, 1.0);
        frontStrip.position.set(0, 0.05, 0.295);
        m.add(frontStrip);

        for (const sx of [-1, 1]) {
          const pod = new THREE.Mesh(rcsPodGeo, hardwareMat);
          pod.position.set(sx * 0.30, 0.14, -0.05);
          m.add(pod);

          const nozzle = new THREE.Mesh(thrusterNozzleGeo, trimMat);
          nozzle.position.set(sx * 0.30, 0.03, -0.05);
          m.add(nozzle);

          const podLed = new THREE.Mesh(antennaTipGeo, ledMat);
          podLed.position.set(sx * 0.30, 0.23, -0.05);
          m.add(podLed);
        }
        mounts.push(m);
      }

      const crown = findBone(root, 'Battlement_Crown');
      if (crown) {
        const m = createAlignedBoneMount(root, crown);
        const ped = new THREE.Mesh(dishPedestalGeo, hardwareMat);
        ped.position.set(0, 0.20, 0);
        m.add(ped);

        const dish = new THREE.Mesh(dishBowlGeo, trimMat);
        dish.position.set(0, 0.27, 0.02);
        dish.rotation.x = Math.PI * 0.72;
        m.add(dish);

        const feed = new THREE.Mesh(antennaTipGeo, ledMat);
        feed.position.set(0, 0.32, 0.08);
        m.add(feed);
        mounts.push(m);
      }
    } else if (type === 'knight') {
      const riderHead = findBone(root, 'Rider_Head');
      if (riderHead) {
        const m = createAlignedBoneMount(root, riderHead);
        const collar = new THREE.Mesh(collarRingGeo, trimMat);
        collar.scale.setScalar(0.86);
        collar.position.set(0, 0.02, 0);
        m.add(collar);

        const dome = new THREE.Mesh(helmetDomeGeo, evaGlassDomeMat);
        dome.scale.setScalar(0.88);
        dome.position.set(0, 0.145, 0.01);
        dome.renderOrder = 6;
        m.add(dome);

        const visor = new THREE.Mesh(visorDomeGeo, visorMat);
        visor.scale.setScalar(0.88);
        visor.position.set(0, 0.15, 0.015);
        m.add(visor);

        const ant = new THREE.Mesh(antennaStemGeo, hardwareMat);
        ant.position.set(-0.145, 0.23, -0.02);
        m.add(ant);
        const tip = new THREE.Mesh(antennaTipGeo, ledMat);
        tip.position.set(-0.145, 0.31, -0.02);
        m.add(tip);
        mounts.push(m);
      }

      const riderTorso = findBone(root, 'Rider_Torso');
      if (riderTorso) {
        const m = createAlignedBoneMount(root, riderTorso, -0.25);
        const pack = buildEvaBackpack(trimMat, bodyMat, hardwareMat, ledMat, false);
        pack.scale.setScalar(0.86);
        pack.position.set(0, 0.13, -0.17);
        m.add(pack);
        mounts.push(m);
      }

      const horseHead = findBone(root, 'Horse_Head');
      if (horseHead) {
        const m = createAlignedBoneMount(root, horseHead);
        const hVisor = new THREE.Mesh(horseVisorGeo, visorMat);
        hVisor.position.set(0, 0.05, 0.14);
        m.add(hVisor);
        const hBeacon = new THREE.Mesh(chestLedGeo, ledMat);
        hBeacon.position.set(0, 0.05, 0.195);
        m.add(hBeacon);
        mounts.push(m);
      }

      const horseChest = findBone(root, 'Horse_Chest');
      if (horseChest) {
        const m = createAlignedBoneMount(root, horseChest);
        for (const sx of [-1, 1]) {
          const pod = new THREE.Mesh(saddlePodGeo, hardwareMat);
          pod.position.set(sx * 0.21, 0.04, -0.06);
          m.add(pod);
          const ring = new THREE.Mesh(antennaTipGeo, ledMat);
          ring.position.set(sx * 0.21, 0.04, -0.175);
          m.add(ring);
        }
        mounts.push(m);
      }
    } else if (type === 'bishop') {
      const head = findBone(root, 'Head_Mitre');
      if (head) {
        const m = createAlignedBoneMount(root, head);
        const collar = new THREE.Mesh(collarRingGeo, trimMat);
        collar.position.set(0, 0.03, 0);
        m.add(collar);

        const shield = new THREE.Mesh(faceShieldBandGeo, visorMat);
        shield.position.set(0, 0.135, 0.015);
        m.add(shield);

        const astroRing = new THREE.Mesh(astrolabeRingGeo, trimMat);
        astroRing.position.set(0, 0.28, 0);
        astroRing.rotation.set(Math.PI * 0.36, 0, Math.PI * 0.12);
        m.add(astroRing);

        const beacon = new THREE.Mesh(antennaTipGeo, ledMat);
        beacon.scale.setScalar(1.3);
        beacon.position.set(0, 0.57, 0);
        m.add(beacon);
        mounts.push(m);
      }

      const torso = findBone(root, 'Torso');
      if (torso) {
        const m = createAlignedBoneMount(root, torso);
        const pack = buildEvaBackpack(trimMat, bodyMat, hardwareMat, ledMat, false);
        pack.position.set(0, 0.12, -0.185);
        m.add(pack);

        const chest = new THREE.Mesh(chestPlssGeo, hardwareMat);
        chest.position.set(0, 0.12, 0.155);
        m.add(chest);
        const cLed = new THREE.Mesh(chestLedGeo, ledMat);
        cLed.position.set(0, 0.13, 0.175);
        m.add(cLed);
        mounts.push(m);
      }
    } else if (type === 'queen') {
      const head = findBone(root, 'Head_Crown');
      if (head) {
        const m = createAlignedBoneMount(root, head);
        const collar = new THREE.Mesh(collarRingGeo, trimMat);
        collar.position.set(0, 0.03, 0);
        m.add(collar);

        const shield = new THREE.Mesh(faceShieldBandGeo, visorMat);
        shield.position.set(0, 0.13, 0.015);
        m.add(shield);

        // Unmistakable Queen's Multi-Spire Orbital Crown & Halo
        const crownBand = new THREE.Mesh(crownBandGeo, trimMat);
        crownBand.position.set(0, 0.36, 0);
        m.add(crownBand);

        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2;
          const spire = new THREE.Mesh(spireGeo, trimMat);
          spire.position.set(Math.sin(ang) * 0.13, 0.44, Math.cos(ang) * 0.13);
          m.add(spire);
        }

        const halo = new THREE.Mesh(orbitalHaloGeo, ledMat);
        halo.position.set(0, 0.51, 0);
        m.add(halo);
        mounts.push(m);
      }

      const torso = findBone(root, 'Torso');
      if (torso) {
        const m = createAlignedBoneMount(root, torso);
        const pack = buildEvaBackpack(trimMat, bodyMat, hardwareMat, ledMat, false);
        pack.position.set(0, 0.12, -0.185);
        m.add(pack);

        // Swept aerospace fins on EVA pack
        for (const sx of [-1, 1]) {
          const fin = new THREE.Mesh(wingFinGeo, trimMat);
          fin.position.set(sx * 0.15, 0.16, -0.22);
          fin.rotation.z = sx * -0.26;
          fin.rotation.y = sx * 0.22;
          m.add(fin);
        }

        const chest = new THREE.Mesh(chestPlssGeo, hardwareMat);
        chest.position.set(0, 0.12, 0.155);
        m.add(chest);
        const cLed = new THREE.Mesh(chestLedGeo, ledMat);
        cLed.position.set(0, 0.13, 0.175);
        m.add(cLed);
        mounts.push(m);
      }
    } else if (type === 'king') {
      const head = findBone(root, 'Head_Crown');
      if (head) {
        const m = createAlignedBoneMount(root, head);
        const collar = new THREE.Mesh(wideCollarRingGeo, trimMat);
        collar.position.set(0, 0.03, 0);
        m.add(collar);

        // Sleek EVA face shield + arched royal space crown + unmistakable King cross finial
        const shield = new THREE.Mesh(faceShieldBandGeo, visorMat);
        shield.scale.set(1.06, 1.04, 1.06);
        shield.position.set(0, 0.145, 0.02);
        m.add(shield);

        const crownBand = new THREE.Mesh(crownBandGeo, trimMat);
        crownBand.scale.set(1.12, 1.15, 1.12);
        crownBand.position.set(0, 0.39, 0);
        m.add(crownBand);

        const arch1 = new THREE.Mesh(crownArchGeo, trimMat);
        arch1.position.set(0, 0.41, 0);
        m.add(arch1);

        const arch2 = new THREE.Mesh(crownArchGeo, trimMat);
        arch2.position.set(0, 0.41, 0);
        arch2.rotation.y = Math.PI / 2;
        m.add(arch2);

        const orbitalRing = new THREE.Mesh(orbitalHaloGeo, ledMat);
        orbitalRing.scale.setScalar(1.05);
        orbitalRing.position.set(0, 0.44, 0);
        m.add(orbitalRing);

        const crossV = new THREE.Mesh(crossVertGeo, trimMat);
        crossV.position.set(0, 0.60, 0);
        m.add(crossV);

        const crossH = new THREE.Mesh(crossHorizGeo, trimMat);
        crossH.position.set(0, 0.62, 0);
        m.add(crossH);

        const crownJewel = new THREE.Mesh(antennaTipGeo, ledMat);
        crownJewel.position.set(0, 0.62, 0.022);
        m.add(crownJewel);

        mounts.push(m);
      }

      const torso = findBone(root, 'Torso');
      if (torso) {
        const m = createAlignedBoneMount(root, torso);
        const pack = buildEvaBackpack(trimMat, bodyMat, hardwareMat, ledMat, true);
        pack.position.set(0, 0.11, -0.215);
        m.add(pack);

        const chest = new THREE.Mesh(chestPlssGeo, hardwareMat);
        chest.scale.set(1.18, 1.12, 1.15);
        chest.position.set(0, 0.13, 0.185);
        m.add(chest);
        const cLed = new THREE.Mesh(chestLedGeo, ledMat);
        cLed.scale.set(1.2, 1.15, 1);
        cLed.position.set(0, 0.14, 0.21);
        m.add(cLed);
        mounts.push(m);
      }
    }

    for (const m of mounts) {
      m.traverse((obj) => {
        obj.userData.isSpaceUniform = true;
        obj.userData.piece = pieceUserData;
        if ((obj as THREE.Mesh).isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
    }

    return mounts;
  }

  function applyArenaToPiece(root: THREE.Object3D, color: ChessSide, arenaId: ArenaId): void {
    const isRobotics = arenaId === 'robotics';

    const bodyMat = isRobotics
      ? color === 'w'
        ? evaWhiteBodyMat
        : evaBlackBodyMat
      : color === 'w'
      ? cathedralWhiteMat
      : cathedralBlackMat;

    const trimMat = isRobotics
      ? color === 'w'
        ? solarGoldTrimMat
        : orbitalCopperTrimMat
      : cathedralGoldMat;

    const weaponMat = isRobotics
      ? color === 'w'
        ? aerospaceTitaniumMat
        : gunmetalTitaniumMat
      : cathedralSteelMat;

    root.traverse((child) => {
      if (child.userData && child.userData.isSpaceUniform) {
        child.visible = isRobotics;
        return;
      }
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (!mesh.userData.skinSlot) {
        const mName = ((mesh.material as THREE.Material | undefined)?.name || '').toLowerCase();
        if (mName.includes('gold') || mName.includes('trim') || mName.includes('bronze') || mName.includes('glow')) {
          mesh.userData.skinSlot = 'trim';
        } else if (mName.includes('steel')) {
          mesh.userData.skinSlot = 'weapon';
        } else {
          mesh.userData.skinSlot = 'body';
        }
      }

      if (mesh.userData.skinSlot === 'trim') {
        mesh.material = trimMat;
      } else if (mesh.userData.skinSlot === 'weapon') {
        mesh.material = weaponMat;
      } else {
        mesh.material = bodyMat;
      }
    });
  }

  function attachAndApply(
    root: THREE.Object3D,
    type: ChessPieceType,
    color: ChessSide,
    arenaId: ArenaId,
    pieceUserData: unknown
  ): void {
    // Capture original skinSlot before attaching space accessories
    root.traverse((child) => {
      const nm = child.name || '';
      if (nm.includes('Icosphere') || nm.includes('glTF_not_exported')) {
        child.visible = false;
        return;
      }
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        const mName = ((mesh.material as THREE.Material | undefined)?.name || '').toLowerCase();
        if (mName.includes('gold') || mName.includes('trim') || mName.includes('bronze') || mName.includes('glow')) {
          mesh.userData.skinSlot = 'trim';
        } else if (mName.includes('steel')) {
          mesh.userData.skinSlot = 'weapon';
        } else {
          mesh.userData.skinSlot = 'body';
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    buildSpaceUniformAttachments(root, type, color, pieceUserData);
    applyArenaToPiece(root, color, arenaId);
  }

  function getShardMaterial(color: ChessSide, arenaId: ArenaId): THREE.Material {
    if (arenaId === 'robotics') {
      return color === 'w' ? evaWhiteBodyMat : evaBlackBodyMat;
    }
    return color === 'w' ? cathedralWhiteMat : cathedralBlackMat;
  }

  function dispose(): void {
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    for (const t of textures) t.dispose();
  }

  return {
    attachAndApply,
    applyArenaToPiece,
    getShardMaterial,
    dispose,
  };
}
