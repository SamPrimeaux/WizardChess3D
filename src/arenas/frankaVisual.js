import * as THREE from 'three';

export const FRANKA_VISUAL_URL = '/assets/glb/franka-panda-visual-v2.glb';

/**
 * Normalize the source-preserving Franka Panda GLB into the Robotics Workcell.
 * This is a visual simulation only: no hardware transport or physical grasp.
 */
export function normalizeFrankaVisual(gltf) {
  const root = gltf?.scene;
  if (!root?.getObjectByName) throw new Error('franka_visual_missing_scene');

  const joints = Array.from({ length: 7 }, (_, i) => root.getObjectByName('link' + (i + 1)));
  if (joints.some((joint) => !joint) || !root.getObjectByName('hand')) {
    throw new Error('franka_visual_missing_joints');
  }

  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const dimensions = bounds.getSize(new THREE.Vector3());
  if (bounds.isEmpty() || !Number.isFinite(dimensions.y) || dimensions.y <= 0) {
    throw new Error('franka_visual_invalid_bounds');
  }

  // The model remains outside the playable board, behind the black army.
  const scale = 1.65 / dimensions.y;
  const center = bounds.getCenter(new THREE.Vector3());
  root.scale.multiplyScalar(scale);
  root.position.set(
    1.9 - center.x * scale,
    -bounds.min.y * scale,
    -1.65 - center.z * scale,
  );
  root.name = 'MeauxGames Franka Panda visual opponent';
  root.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = /^(link0_0|link2|link4_0|link6_0|hand_0)$/.test(child.name);
      child.receiveShadow = false;
    }
  });
  root.userData.iamVisualOnly = true;
  return root;
}
