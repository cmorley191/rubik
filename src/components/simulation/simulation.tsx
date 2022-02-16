import * as React from "react";

import * as THREE from "three";
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import * as helveticaJson from 'three/examples/fonts/helvetiker_regular.typeface.json';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

import { Arrangement, Color, COLORS, inspectSide, Orientation, range, Side, SpacesSettings, standardOrientation, toLetter, toShade } from "../../core";

type PieceObject = {
  mesh: THREE.Mesh;
  orientation: Orientation;
}
type PuzzlePieces = PieceObject[/*x*/][/*y*/][/*z*/];

type SpaceState = {
  color: Color;
  highlighted: boolean;
}
type PuzzleState = SpaceState[/*side*/][/*space*/];  // space is 0 through degree^2, ordered left-to-right and top-to-bottom

const GRAY = toShade({ color: null, highlighted: false });
const BLACK = new THREE.Color(0, 0, 0);

function buildPieces(degree: number, pieceRadius: number): PuzzlePieces {
  const pieces: PuzzlePieces = [];

  for (let x = 0; x < degree; x++) {
    pieces.push([]);
    for (let y = 0; y < degree; y++) {
      pieces[x].push([]);
      for (let z = 0; z < degree; z++) {
        const geometry = new THREE.BoxGeometry(pieceRadius, pieceRadius, pieceRadius).toNonIndexed();
        const material = new THREE.MeshBasicMaterial({ vertexColors: true });
        const cube = new THREE.Mesh(geometry, material);
        const geo = new THREE.EdgesGeometry(cube.geometry);
        const mat = new THREE.LineBasicMaterial({ color: BLACK, linewidth: 1 });
        const wireframe = new THREE.LineSegments(geo, mat);
        wireframe.renderOrder = 1; // make sure wireframes are rendered 2nd
        cube.add(wireframe);

        const position = new THREE.Vector3(x, y, z).addScalar(-(degree - 1) / 2).multiplyScalar(pieceRadius);
        cube.position.set(position.x, position.y, position.z);

        pieces[x][y].push({ mesh: cube, orientation: standardOrientation });
      }
    }
  }

  return pieces;
}

function paintPieces(degree: number, pieces: PuzzlePieces, state: PuzzleState) {
  for (let z = 0; z < degree; z++) {
    for (let y = 0; y < degree; y++) {
      for (let x = 0; x < degree; x++) {
        const unorientedColors: THREE.Color[] = [];

        if (x == degree - 1) unorientedColors.push(toShade(state[Side.Right][(degree - y) * degree - 1 - z]))
        else unorientedColors.push(GRAY);

        if (x == 0) unorientedColors.push(toShade(state[Side.Left][(degree - 1 - y) * degree + z]))
        else unorientedColors.push(GRAY);

        if (y == degree - 1) unorientedColors.push(toShade(state[Side.Up][z * degree + x]))
        else unorientedColors.push(GRAY);

        if (y == 0) unorientedColors.push(toShade(state[Side.Down][(degree - 1 - z) * degree + x]))
        else unorientedColors.push(GRAY);

        if (z == degree - 1) unorientedColors.push(toShade(state[Side.Front][(degree - 1 - y) * degree + x]))
        else unorientedColors.push(GRAY);

        if (z == 0) unorientedColors.push(toShade(state[Side.Back][(degree - y) * degree - 1 - x]))
        else unorientedColors.push(GRAY);

        const colors = range(0, 5).map(side => unorientedColors[inspectSide(side, pieces[x][y][z].orientation)]);

        const cube = pieces[x][y][z].mesh;

        const colorValues = [];
        const colorsPerFace = 6; // 3 vertices per triangle, 2 triangles per face
        for (let i = 0; i < 6; i++) {
          const color = colors[i];
          for (let j = 0; j < colorsPerFace; j++) colorValues.push(color.r, color.g, color.b);
        }
        cube.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorValues, 3));
      }
    }
  }
}


export interface SimulationProps {
  degree: number;
}

export interface SimulationState {
  cameraDistance: number; // distance from origin
  puzzle: PuzzleState;
}

export class Simulation extends React.Component<SimulationProps, SimulationState> {
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  readonly renderer: THREE.WebGLRenderer;

  readonly puzzle: THREE.Group;
  readonly pieces: PuzzlePieces;
  readonly refCube: THREE.Mesh;

  constructor(props: SimulationProps) {
    super(props);

    const pieceRadius = 0.4;

    this.state = {
      cameraDistance: 3 + (pieceRadius * this.props.degree),
      puzzle: (() => {
        // solved puzzle
        const state: SpaceState[][] = [];
        for (let side = 0; side < 6; side++) {
          const sideSpaces = [];
          for (let space = 0; space < this.props.degree * this.props.degree; space++) {
            sideSpaces.push({
              color: COLORS[side],
              highlighted: false,
            });
          }
          state.push(sideSpaces);
        }
        return state;
      })()
    };

    this.scene = new THREE.Scene();

    this.camera = (() => {
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); // params are fov, etc.

      const cameraRotationalAngle = -20; // facing rotation around y-axis (clockwise) (degrees)
      const cameraPolarAngle = -15; // facing rotation around x-axis (degrees)
      const cameraPosition = new THREE.Spherical(this.state.cameraDistance, (90 + cameraPolarAngle) * Math.PI / 180, -cameraRotationalAngle * Math.PI / 180);
      camera.position.setFromSpherical(cameraPosition);
      camera.rotation.x = -(Math.PI / 2 - cameraPosition.phi);
      camera.rotation.y = cameraPosition.theta;

      return camera;
    })();

    this.renderer = (() => {
      const renderer = new THREE.WebGLRenderer({ antialias: true });

      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);

      return renderer;
    })();

    this.puzzle = new THREE.Group();
    this.scene.add(this.puzzle);

    this.pieces = (() => {  // setup and add to puzzle
      const pieces = buildPieces(this.props.degree, pieceRadius);
      paintPieces(this.props.degree, pieces, this.state.puzzle);
      for (let i = 0; i < this.props.degree; i++) for (let j = 0; j < this.props.degree; j++) for (let k = 0; k < this.props.degree; k++) {
        this.puzzle.add(pieces[i][j][k].mesh);
      }

      return pieces;
    })();

    this.refCube = (() => {  // setup and add to puzzle
      const cubeArr = buildPieces(1, pieceRadius * (0.1 + 0.1 * this.props.degree));
      const cube = cubeArr[0][0][0].mesh;

      paintPieces(1, cubeArr, COLORS.map(color => [{ color, highlighted: false }]));
      cube.translateY(pieceRadius * this.props.degree * 1.5); // place above the puzzle

      /*
       * Add side letters
       */
      const loader = new FontLoader();
      const font = loader.parse(helveticaJson);
      range(0, 5).forEach(side => {
        const text_geometry = new TextGeometry(toLetter(side), {
          font: font,
          size: 0.25,
          height: 0.001,
          curveSegments: 12,
          bevelEnabled: false,
          bevelThickness: 0.1,
          bevelSize: 0.1,
          bevelSegments: 0.1
        });
        const text_mat = new THREE.MeshBasicMaterial({ color: side == Side.Down ? 0xffffff : 0x000000 });
        const text = new THREE.Mesh(text_geometry, text_mat);

        // align the letter. Note that its position controls the bottom-left corner of the letter
        const text_box = new THREE.Box3().setFromObject(text);
        switch (side) {
          case Side.Up:
          case Side.Down: {
            const sign = side == Side.Up ? 1 : -1;
            text.rotation.x = -sign * Math.PI / 2;
            text.position.y = sign * pieceRadius / 2;
            text.position.x = -(text_box.max.x - text_box.min.x) / 2;
            text.position.z = sign * (text_box.max.y - text_box.min.y) / 2;
          } break;
          case Side.Front:
          case Side.Back: {
            const sign = side == Side.Front ? 1 : -1;
            if (side == Side.Back) { text.rotation.y = Math.PI; }
            text.position.z = sign * pieceRadius / 2;
            text.position.x = -sign * (text_box.max.x - text_box.min.x) / 2;
            text.position.y = -(text_box.max.y - text_box.min.y) / 2
          } break;
          case Side.Left:
          case Side.Right: {
            const sign = side == Side.Right ? 1 : -1;
            text.rotation.y = sign * Math.PI / 2;
            text.position.x = sign * pieceRadius / 2;
            text.position.z = sign * (text_box.max.x - text_box.min.x) / 2;
            text.position.y = -(text_box.max.y - text_box.min.y) / 2;
          } break;
          default:
            return;
        }

        cube.add(text);
      });

      return cube;
    })();
  }

  canvasRenderRequested: boolean = false;
  canvasRenderCallbacks: (() => void)[] = [];
  renderCanvasOnNextFrame(callback: () => void = null) {
    if (callback != null) this.canvasRenderCallbacks.push(callback);
    if (!this.canvasRenderRequested)
      requestAnimationFrame(() => {
        this.renderer.render(this.scene, this.camera);
        this.canvasRenderRequested = false;

        const callbacks = this.canvasRenderCallbacks;
        this.canvasRenderCallbacks = [];
        callbacks.forEach(c => c());
      });
  }

  render() {
    this.renderCanvasOnNextFrame();
    return (
      <div id="simulation">
        {this.renderer.domElement}
      </div>
    );
  }
}
