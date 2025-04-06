import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshPhongMaterial, Scene, Vector3 } from "three";
import { CORNER_ARRAY, EDGE_ARRAY, TRIANGLE_TABLE } from "./marchingConstants";
import { removeMeshAndDispose } from "./utils";

export class VoxelGrid {
  resolution: number;
  size: Vector3;
  isovalue: number;
  position: Vector3;

  grid: number[][][] = [];

  meshVertexes: Vector3[] = [];
  mesh: Mesh | undefined;

  /**
   * Creates a new voxel grid/scalar field.
   * @param {number} resolution - The amount of grid points per square unit of space.
   * @param {Vector3} size - A Vector3 to represent the width, length, and height of the grid in 3D space.
   * @param {number} isovalue - A number representing where the isosurface will be placed.
   *                  Any voxel grid values above this isovalue will be inside the surface, and any values below this value will be outside the surface.
   * @param {Vector3} position - A Vector3 defining the origin of the grid.
   */
  constructor(resolution: number, size: Vector3, isovalue: number, position: Vector3) {
    this.resolution = resolution;
    this.size = size.clone();
    this.isovalue = isovalue;
    this.position = position.clone();

    this.initializeGrid();
  }

  initializeGrid() {
    this.grid = Array.from({ length: this.size.x * this.resolution }, () =>
      Array.from({ length: this.size.y * this.resolution }, () => Array(this.size.z * this.resolution).fill(-1)),
    );

    this.grid[(this.size.x / 2) * this.resolution][(this.size.y / 2) * this.resolution][(this.size.z / 2) * this.resolution] = 1;
    this.grid[(this.size.x / 2) * this.resolution + 1][(this.size.y / 2) * this.resolution][(this.size.z / 2) * this.resolution] = 1;
    this.grid[(this.size.x / 2) * this.resolution + 2][(this.size.y / 2) * this.resolution][(this.size.z / 2) * this.resolution] = 1;
    this.grid[(this.size.x / 2) * this.resolution + 2][(this.size.y / 2) * this.resolution - 1][(this.size.z / 2) * this.resolution] = 1;
    this.grid[(this.size.x / 2) * this.resolution + 2][(this.size.y / 2) * this.resolution - 2][(this.size.z / 2) * this.resolution] = 1;
    this.grid[(this.size.x / 2) * this.resolution + 2][(this.size.y / 2) * this.resolution - 3][(this.size.z / 2) * this.resolution] = 1;
    this.grid[(this.size.x / 2) * this.resolution + 3][(this.size.y / 2) * this.resolution][(this.size.z / 2) * this.resolution] = 1;
    this.grid[(this.size.x / 2) * this.resolution + 4][(this.size.y / 2) * this.resolution][(this.size.z / 2) * this.resolution] = 1;
  }

  // Axes are:
  //
  //      y
  //      |     z
  //      |   /
  //      | /
  //      +----- x
  //
  // Vertex and edge layout:
  //
  //            6             7
  //            +-------------+               +-----6-------+
  //          / |           / |             / |            /|
  //        /   |         /   |          11   7         10   5
  //    2 +-----+-------+  3  |         +------2------+     |
  //      |   4 +-------+-----+ 5       |     +-----4-+-----+
  //      |   /         |   /           3   8         1   9
  //      | /           | /             | /           | /
  //    0 +-------------+ 1             +------0------+

  /**
   * "March" through the grid, sampling one cube at a time. Use this sample to index the triangle table so we know what triangles to draw.
   */
  private marchCubes(): void {
    this.meshVertexes = [];

    //not using forEachVoxel cause we want to skip the last index in each direction ( - 1) to avoid index out of bounds errors while sampling cube corners
    for (let x = 0; x < this.size.x * this.resolution - 1; x++) {
      for (let y = 0; y < this.size.y * this.resolution - 1; y++) {
        for (let z = 0; z < this.size.z * this.resolution - 1; z++) {
          let cubeConfigByte = 0;
          for (const [i, corner] of CORNER_ARRAY.entries()) {
            if (this.grid[x + corner.x][y + corner.y][z + corner.z] > this.isovalue) {
              //look up bitwise operations and bit shifting to understand this
              //it looks more confusing that it is, all we're doing is setting individual bits
              //in a byte to 1 when the corresponding cube corner is inside the isosurface
              //resulting in a byte looking like 00000101 meaning corner 0 and and 2 are inside the surface
              //we can later use this byte to index the triangle table to get our triangles
              cubeConfigByte |= 1 << i;
            }
          }

          const triangles = TRIANGLE_TABLE[cubeConfigByte];

          let i = 0;
          while (i < triangles.length) {
            if (triangles[i] === -1) {
              break;
            }

            const edgeIndex1 = triangles[i];
            const edgeIndex2 = triangles[i + 1];
            const edgeIndex3 = triangles[i + 2];

            const edge1 = EDGE_ARRAY[edgeIndex1];
            const edge2 = EDGE_ARRAY[edgeIndex2];
            const edge3 = EDGE_ARRAY[edgeIndex3];

            function createScaledVector(point: Vector3, resolution: number) {
              return new Vector3(point.x / resolution, point.y / resolution, point.z / resolution);
            }

            function getEdgeMidpoint(edge: Vector3[], resolution: number) {
              const v1 = createScaledVector(edge[0], resolution);
              const v2 = createScaledVector(edge[1], resolution);
              return v1.add(v2).multiplyScalar(0.5);
            }

            const vertex1 = getEdgeMidpoint(edge1, this.resolution);
            const vertex2 = getEdgeMidpoint(edge2, this.resolution);
            const vertex3 = getEdgeMidpoint(edge3, this.resolution);

            this.meshVertexes.push(
              new Vector3(x / this.resolution, y / this.resolution, z / this.resolution).add(vertex1),
              new Vector3(x / this.resolution, y / this.resolution, z / this.resolution).add(vertex2),
              new Vector3(x / this.resolution, y / this.resolution, z / this.resolution).add(vertex3),
            );

            //edges are always in pairs of 3, triangles.
            i += 3;
          }
        }
      }
    }
  }

  public render(scene: Scene) {
    if (this.mesh) removeMeshAndDispose(scene, this.mesh);

    this.marchCubes();
    try {
      this.generateMesh();
      scene.add(this.mesh!);
    } catch (error) {
      console.log(error);
    }
  }

  private generateMesh() {
    if (this.meshVertexes.length % 3 !== 0) {
      throw "meshVertexes array length must be a multiple of 3.";
    }

    const geometry = new BufferGeometry();
    const positions = new Float32Array(this.meshVertexes.length * 3);

    for (let i = 0; i < this.meshVertexes.length; i++) {
      positions[i * 3] = this.meshVertexes[i].x;
      positions[i * 3 + 1] = this.meshVertexes[i].y;
      positions[i * 3 + 2] = this.meshVertexes[i].z;
    }

    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    const material = new MeshPhongMaterial({ color: 0x00ff00, side: DoubleSide });

    this.mesh = new Mesh(geometry, material);
  }

  forEachVoxel(callback: (x: number, y: number, z: number) => void): void {
    for (let currX = 0; currX < this.size.x * this.resolution; currX++) {
      for (let currY = 0; currY < this.size.y * this.resolution; currY++) {
        for (let currZ = 0; currZ < this.size.z * this.resolution; currZ++) {
          callback(currX / this.resolution, currY / this.resolution, currZ / this.resolution);
        }
      }
    }
  }
}
