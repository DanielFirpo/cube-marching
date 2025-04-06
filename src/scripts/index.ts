import * as three from "three";
import { FlyControls } from "three/addons/controls/FlyControls.js";
import { VoxelGrid } from "./VoxelGrid";
import GUI from "lil-gui";

const scene = new three.Scene();
const camera = new three.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new three.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new three.BoxGeometry(1, 1, 1);
const material = new three.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new three.Mesh(geometry, material);
scene.add(cube);

//X = red, Y = green, Z = blue. Y is height
const axesHelper = new three.AxesHelper(100);
scene.add(axesHelper);

const controls = new FlyControls(camera, renderer.domElement);

camera.position.z = 20;

const grid = new VoxelGrid(4, new three.Vector3(10, 10, 10), 0, new three.Vector3(0, 0, 0));

const light = new three.DirectionalLight(0xffffff, 3);
light.position.set(0, 50, 0);
scene.add(light);

const ambientLight = new three.AmbientLight(0x404040, 0.5); // Color, intensity
scene.add(ambientLight);

const gui = new GUI();

const settings = {
  resolution: 1,
};

gui
  .add(settings, "resolution", 0, 50)
  .name("Resolution")
  .onChange((value: number) => {
    grid.resolution = value;
    grid.initializeGrid();
    grid.render(scene);
    console.log("value", value);
  });

function animate() {
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
  controls.update(0.01);
  controls.rollSpeed = 0.0;
  grid.mesh?.position.add(new three.Vector3(0, 0.01, 0));
}

renderer.setAnimationLoop(animate);

export function createDebugDot(scene: three.Scene, x: number, y: number, z: number, color = 0xff0000, size = 5) {
  const geometry = new three.BufferGeometry();
  const vertices = new Float32Array([x, y, z]);
  geometry.setAttribute("position", new three.BufferAttribute(vertices, 3));

  const material = new three.PointsMaterial({ color: color, size: size, sizeAttenuation: false });
  const points = new three.Points(geometry, material);
  scene.add(points);
  return points;
}
