import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FRANKA_VISUAL_URL, normalizeFrankaVisual } from '../src/arenas/frankaVisual.js';

function demoFranka() {
  const root = new THREE.Group();
  for (let index = 1; index <= 7; index += 1) {
    const joint = new THREE.Group();
    joint.name = 'link' + index;
    root.add(joint);
  }
  const hand = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1, 0.1),
    new THREE.MeshBasicMaterial(),
  );
  hand.name = 'hand';
  hand.position.set(0, 1, 0);
  root.add(hand);
  return root;
}

test('Franka uses the versioned, source-preserving public asset', () => {
  assert.equal(FRANKA_VISUAL_URL, '/assets/glb/franka-panda-visual-v2.glb');
});

test('Franka keeps all seven articulated joints and stays outside playable tiles', () => {
  const root = normalizeFrankaVisual({ scene: demoFranka() });
  assert.equal(root.userData.iamVisualOnly, true);
  for (let index = 1; index <= 7; index += 1) {
    assert.ok(root.getObjectByName('link' + index));
  }
  assert.ok(root.getObjectByName('hand'));
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  assert.ok(bounds.min.x > 1.1, 'robot must remain outside the playable board');
  assert.ok(bounds.max.y <= 1.66, 'robot height should remain within the workcell scale');
});

test('a malformed Franka asset fails closed without changing the chess board', () => {
  assert.throws(
    () => normalizeFrankaVisual({ scene: new THREE.Group() }),
    /franka_visual_missing_joints/,
  );
});
