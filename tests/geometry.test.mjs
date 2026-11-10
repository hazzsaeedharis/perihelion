import test from "node:test";
import assert from "node:assert/strict";
import { Group, Vector3 } from "three";
import { Observatory } from "../src/scene.js";

test("Every illustrative nucleus has finite, bounded geometry and a nonempty surface", () => {
  for (const id of ["67P", "1P", "2P"]) {
    const study = { comet: { id }, objects: new Group(), mode: "nucleus" };
    Observatory.prototype.buildNucleus.call(study);
    let triangles = 0;
    study.objects.traverse((object) => {
      if (!object.isMesh) return;
      const positions = object.geometry.attributes.position;
      triangles += positions.count / 3;
      assert.ok(positions.array.every(Number.isFinite));
      assert.ok(object.geometry.attributes.normal.array.every(Number.isFinite));
      object.geometry.computeBoundingBox();
      const size = object.geometry.boundingBox.getSize(new Vector3());
      assert.ok(size.x > 0 && size.y > 0 && size.z > 0);
      assert.ok(Math.max(size.x, size.y, size.z) < 5);
      object.geometry.dispose();
      object.material.dispose();
    });
    assert.ok(triangles > 1000, `${id} must have a visible detailed surface`);
  }
});
