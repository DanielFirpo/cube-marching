import { Mesh, Scene } from "three";

export async function removeMeshAndDispose(scene: Scene, mesh: Mesh) {
  scene.remove(mesh);

  if (mesh.geometry) {
    mesh.geometry.dispose();
  }

  if (mesh.material) {
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => material.dispose());
    } else {
      mesh.material.dispose();
    }
  }
}
