import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { FRANKA_MOVE_MS } from './frankaMotionTimeline';
import { FRANKA_VISUAL_URL, normalizeFrankaVisual } from './frankaVisual';

const UP = new THREE.Vector3(0, 1, 0);
const HOME = [0, -0.785, 0, -2.356, 0, 1.571, 0.785];
const LIMITS: readonly [number, number][] = [
  [-2.8973, 2.8973],
  [-1.7628, 1.7628],
  [-2.8973, 2.8973],
  [-3.0718, -0.0698],
  [-2.8973, 2.8973],
  [-0.0175, 3.7525],
  [-2.8973, 2.8973],
];

type Stage = { pose: number[]; duration: number };
type ActiveMove = {
  segments: Stage[];
  begin: number;
  initial: number[];
  resolve: (completed: boolean) => void;
};

function disposeFrankaRoot(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value && typeof value === 'object' && (value as THREE.Texture).isTexture) {
          textures.add(value as THREE.Texture);
        }
      }
    }
  });

  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

/**
 * Seven-axis Franka Panda visual opponent for the Robotics Workcell.
 * Chess rules remain authoritative; this class only animates the GLB model.
 * It does not connect to, command, or simulate physical robot hardware.
 */
export class FrankaOpponent {
  private root: THREE.Group | null = null;
  private joints: THREE.Object3D[] = [];
  private baselines: THREE.Quaternion[] = [];
  private hand: THREE.Object3D | null = null;
  private angles = [...HOME];
  private active: ActiveMove | null = null;
  private disposed = false;

  constructor(
    private readonly parent: THREE.Group,
    private readonly getSquarePosition: (square: string) => THREE.Vector3,
  ) {}

  async load(): Promise<void> {
    if (this.disposed) return;
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(FRANKA_VISUAL_URL);

    if (this.disposed) {
      disposeFrankaRoot(gltf.scene);
      return;
    }

    const root = normalizeFrankaVisual(gltf);
    const joints = Array.from({ length: 7 }, (_, index) =>
      root.getObjectByName('link' + (index + 1)),
    );
    const hand = root.getObjectByName('hand');
    if (joints.some((joint) => !joint) || !hand) {
      disposeFrankaRoot(root);
      throw new Error('Franka visual asset is missing articulated joint nodes');
    }

    this.root = root;
    this.joints = joints as THREE.Object3D[];
    this.baselines = this.joints.map((joint) => joint.quaternion.clone());
    this.hand = hand;
    this.setAngles(HOME);
    this.parent.add(root);
  }

  get ready(): boolean {
    return Boolean(this.root && !this.disposed);
  }

  private setAngles(angles: readonly number[]): void {
    this.angles = [...angles];
    for (let index = 0; index < this.joints.length; index += 1) {
      this.joints[index].quaternion
        .copy(this.baselines[index])
        .multiply(new THREE.Quaternion().setFromAxisAngle(UP, angles[index]));
    }
    this.root?.updateMatrixWorld(true);
  }

  private effector(): THREE.Vector3 {
    return this.hand!.localToWorld(new THREE.Vector3(0, 0.155, 0));
  }

  /** Bounded CCD pose fit. This is not a physics or contact solver. */
  private reach(target: THREE.Vector3, start: readonly number[]): number[] {
    const saved = [...this.angles];
    const angles = [...start];
    const started = performance.now();
    this.setAngles(angles);

    for (let iteration = 0; iteration < 8 && performance.now() - started < 20; iteration += 1) {
      if (this.effector().distanceTo(target) < 0.14) break;
      for (let index = 6; index >= 0; index -= 1) {
        const joint = this.joints[index];
        const jointPosition = joint.getWorldPosition(new THREE.Vector3());
        const axis = UP.clone()
          .applyQuaternion(joint.getWorldQuaternion(new THREE.Quaternion()))
          .normalize();
        const current = this.effector().sub(jointPosition);
        const desired = target.clone().sub(jointPosition);
        current.addScaledVector(axis, -current.dot(axis));
        desired.addScaledVector(axis, -desired.dot(axis));
        if (current.lengthSq() < 1e-8 || desired.lengthSq() < 1e-8) continue;

        current.normalize();
        desired.normalize();
        const radians = Math.atan2(axis.dot(current.clone().cross(desired)), current.dot(desired));
        angles[index] = THREE.MathUtils.clamp(
          angles[index] + radians * 0.75,
          LIMITS[index][0],
          LIMITS[index][1],
        );
        this.setAngles(angles);
      }
    }

    this.setAngles(saved);
    return angles;
  }

  /** Animate the visual arm along a chess move; chess state is already authoritative. */
  playMove(from: string, to: string): Promise<boolean> {
    if (!this.ready) return Promise.resolve(false);
    this.cancelMotion();

    const source = this.getSquarePosition(from);
    const target = this.getSquarePosition(to);
    const rise = 0.78;
    const touch = 0.12;
    let pose = [...this.angles];
    const segments: Stage[] = [];

    const targets: Array<[THREE.Vector3, number, number]> = [
      [source, rise, FRANKA_MOVE_MS.approach],
      [source, touch, FRANKA_MOVE_MS.touch],
      [source, rise, FRANKA_MOVE_MS.lift],
      [target, rise, FRANKA_MOVE_MS.transport],
      [target, touch, FRANKA_MOVE_MS.lower],
      [target, rise, FRANKA_MOVE_MS.retreat],
    ];

    for (const [square, height, duration] of targets) {
      const nextPose = this.reach(
        square.clone().add(new THREE.Vector3(0, height, 0)),
        pose,
      );
      segments.push({ pose: nextPose, duration });
      pose = nextPose;
    }
    segments.push({ pose: [...HOME], duration: FRANKA_MOVE_MS.home });

    return new Promise<boolean>((resolve) => {
      this.active = {
        segments,
        begin: performance.now(),
        initial: [...this.angles],
        resolve,
      };
    });
  }

  update(now: number): void {
    if (!this.active) return;
    const run = this.active;
    let elapsed = Math.max(0, now - run.begin);
    let from = run.initial;

    for (const stage of run.segments) {
      if (elapsed > stage.duration) {
        elapsed -= stage.duration;
        from = stage.pose;
        continue;
      }
      const progress = THREE.MathUtils.clamp(elapsed / stage.duration, 0, 1);
      const smooth = progress * progress * (3 - 2 * progress);
      this.setAngles(from.map((angle, index) => angle + (stage.pose[index] - angle) * smooth));
      return;
    }

    this.setAngles(run.segments[run.segments.length - 1].pose);
    this.active = null;
    run.resolve(true);
  }

  cancelMotion(): void {
    if (!this.active) return;
    this.active.resolve(false);
    this.active = null;
    this.setAngles(HOME);
  }

  dispose(): void {
    this.disposed = true;
    this.active?.resolve(false);
    this.active = null;
    if (this.root) {
      this.root.removeFromParent();
      disposeFrankaRoot(this.root);
    }
    this.root = null;
    this.joints = [];
    this.baselines = [];
    this.hand = null;
  }
}
