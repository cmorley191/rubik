import * as React from "react";
import { useRef, useState } from "react";
import * as ReactDOM from 'react-dom';
import { Canvas, ReactThreeFiber, useFrame, useThree } from '@react-three/fiber';
import { EmotionJSX } from "@emotion/react/types/jsx-namespace";

import * as THREE from "three";
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import * as helveticaJson from 'three/examples/fonts/helvetiker_regular.typeface.json';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

import { Arrangement, Axis, Color, COLORS, inspectSide, Orientation, range, Rotation, Side, SpacesSettings, standardOrientation, toLetter, toShade } from "../../core";
import { BoxBufferGeometry, BoxGeometry, BufferGeometry, Euler, Float32BufferAttribute, MeshBasicMaterial, PerspectiveCamera } from "three";
import { ceilPowerOfTwo } from "three/src/math/MathUtils";

const helvetica = (() => {
  const loader = new FontLoader();
  return loader.parse(helveticaJson);
})();

function positionToSpace(degree: number, side: Side, pos: { x: number, y: number, z: number }) {
  const [col, row] = (() => {
    switch (side) {
      case Side.Right: return [degree - 1 - pos.z, degree - 1 - pos.y];
      case Side.Left: return [pos.z, degree - 1 - pos.y];
      case Side.Up: return [pos.x, pos.z];
      case Side.Down: return [pos.x, degree - 1 - pos.z];
      case Side.Front: return [pos.x, degree - 1 - pos.y];
      default: // back
        return [degree - 1 - pos.x, degree - 1 - pos.y];
    }
  })();

  return { side: side, space: row * degree + col };
}

function spaceToPosition(degree: number, { side, space }: { side: Side, space: number }) {
  const [row, col] = [Math.floor(space / degree), space % degree];
  switch (side) {
    case Side.Right: return { x: degree - 1, y: degree - 1 - row, z: degree - 1 - col };
    case Side.Left: return { x: 0, y: degree - 1 - row, z: col };
    case Side.Up: return { x: col, y: degree - 1, z: row };
    case Side.Down: return { x: col, y: 0, z: degree - 1 - row };
    case Side.Front: return { x: col, y: degree - 1 - row, z: degree - 1 };
    case Side.Back: return { x: degree - 1 - col, y: degree - 1 - row, z: 0 };
  }
}

function positionsEqual(pos1: { x: number, y: number, z: number }, pos2: { x: number, y: number, z: number }) {
  return (pos1 == pos2) || (pos1 != null && pos2 != null && pos1.x == pos2.x && pos1.y == pos2.y && pos1.z == pos2.z);
}

type PieceBasicProps = {
  mesh: THREE.Mesh;
}

type PuzzleColors = Color[/*side*/][/*space*/];  // space is 0 through degree^2, ordered left-to-right and top-to-bottom

type Animation = {
  rotation: Rotation;
  speed: number;
}

type AnimationState = {
  animation: Animation;
  progress: number; // 0.0 to 1.0
}

const GRAY = toShade({ color: null, highlighted: false });
const BLACK = new THREE.Color(0, 0, 0);

type PuzzlePieceFunctions = {
  checkIntersection: (ray: THREE.Raycaster) => { side: Side, distance: number }[];
  setPuzzleColors: (colors: PuzzleColors) => void;
  setHighlighting: (highlightedSide?: Side) => void;
};
type PuzzlePieceProps = {
  threeProps?: EmotionJSX.IntrinsicElements['mesh'];
  degree: number;
  pieceRadius: number;
  x: number;
  y: number;
  z: number;
  puzzleColors: PuzzleColors;
  registerFunctions?: (functions: PuzzlePieceFunctions) => void;
};
const PuzzlePiece = ({ threeProps = {}, children, degree, pieceRadius, x, y, z, puzzleColors, registerFunctions = (fs => { }) }: React.PropsWithChildren<PuzzlePieceProps>) => {
  const colorsFromPuzzleColors = (state: PuzzleColors) => {
    const colors = [];
    const getColor = (space: { side: Side, space: number }) => state[space.side][space.space];

    if (x == degree - 1) colors.push(getColor(positionToSpace(degree, Side.Right, { x, y, z })));
    else colors.push(null); // becomes gray

    if (x == 0) colors.push(getColor(positionToSpace(degree, Side.Left, { x, y, z })));
    else colors.push(null);

    if (y == degree - 1) colors.push(getColor(positionToSpace(degree, Side.Up, { x, y, z })));
    else colors.push(null);

    if (y == 0) colors.push(getColor(positionToSpace(degree, Side.Down, { x, y, z })));
    else colors.push(null);

    if (z == degree - 1) colors.push(getColor(positionToSpace(degree, Side.Front, { x, y, z })));
    else colors.push(null);

    if (z == 0) colors.push(getColor(positionToSpace(degree, Side.Back, { x, y, z })));
    else colors.push(null);

    return colors;
  };

  const [colors, setColors] = useState(() => colorsFromPuzzleColors(puzzleColors));

  const colorsPerFace = 4; // apparently 4 vertices per side (default THREE is 2 triangles with 3 vertices each)

  const [highlightedSide, setHighlightedSide] = useState<Side>(null);

  const [colorValues, setColorValues] = useState(() => {
    const colorValues = [];
    for (let i = 0; i < 6; i++) {
      const color = toShade({ color: colors[i], highlighted: i == highlightedSide });
      for (let j = 0; j < colorsPerFace; j++) colorValues.push(color.r, color.g, color.b);
    }

    return new Float32Array(colorValues);
  });

  const meshRef = useRef<THREE.Mesh>();

  registerFunctions({
    checkIntersection: (ray) => {
      const intersections = [];
      if (meshRef.current) {
        const cubeIntersections = ray.intersectObject(meshRef.current);
        for (let i = 0; i < cubeIntersections.length; i++) {
          if (cubeIntersections[i].faceIndex != null) {
            intersections.push({
              side: Math.floor(cubeIntersections[i].faceIndex / 2),
              distance: cubeIntersections[i].distance
            });
          }
        }
      }
      return intersections;
    },
    setPuzzleColors: (puzzleColors) => {
      const newColors = colorsFromPuzzleColors(puzzleColors);
      let iFirstColorChanged: number | null = null;
      for (let i = 0; i < 6; i++) {
        if (newColors[i] != colors[i]) {
          iFirstColorChanged = i;
          break;
        }
      }
      if (iFirstColorChanged == null) return; // nothing changed

      setColors(newColors);
      setColorValues(currentVals => {
        const newVals = currentVals.slice(); // copy
        for (let i = iFirstColorChanged; i < 6; i++) {
          if (newColors[i] != colors[i]) {
            const color = toShade({ color: newColors[i], highlighted: i == highlightedSide });
            for (let j = i * colorsPerFace * 3; j < (i + 1) * colorsPerFace * 3;) {
              newVals[j++] = color.r;
              newVals[j++] = color.g;
              newVals[j++] = color.b;
            }
          }
        }
        return newVals;
      });
    },
    setHighlighting: (sideToHighlight) => {
      //console.log(`${x},${y},${z} Set highlighting: ${highlightedSide}`);
      if ((sideToHighlight == null && highlightedSide != null) || (sideToHighlight != null && highlightedSide != sideToHighlight)) {
        console.log(`highlighting ${highlightedSide} -> ${sideToHighlight}`);
        setColorValues(currentVals => {
          const newVals = currentVals.slice(); // copy

          if (highlightedSide != null) {
            const unhighlightedColor = toShade({ color: colors[highlightedSide], highlighted: false });
            for (let j = highlightedSide * colorsPerFace * 3; j < (highlightedSide + 1) * colorsPerFace * 3;) {
              newVals[j++] = unhighlightedColor.r;
              newVals[j++] = unhighlightedColor.g;
              newVals[j++] = unhighlightedColor.b;
            }
          }

          if (sideToHighlight != null) {
            const highlightedColor = toShade({ color: colors[sideToHighlight], highlighted: true });
            for (let j = sideToHighlight * colorsPerFace * 3; j < (sideToHighlight + 1) * colorsPerFace * 3;) {
              newVals[j++] = highlightedColor.r;
              newVals[j++] = highlightedColor.g;
              newVals[j++] = highlightedColor.b;
            }
          }

          return newVals;
        });
        setHighlightedSide(sideToHighlight);
      }
    },
  });

  const [geo, geoRef] = useState<THREE.BufferGeometry>();
  if (x == 1 && y == 0 && z == 2) useFrame(() => {
    console.log(geo.getAttribute('color').array[48]);
  });
  const [posX, posY, posZ] = [x, y, z].map(v => (v - ((degree - 1) / 2)) * pieceRadius)
  return (
    <mesh
      ref={meshRef}
      position={[posX, posY, posZ]}
      {...threeProps}
    >
      <boxBufferGeometry
        ref={geoRef}
        args={[pieceRadius, pieceRadius, pieceRadius]}
      >
        <bufferAttribute attachObject={['attributes', 'color']} array={colorValues} itemSize={3} count={colorsPerFace * 6} />
      </boxBufferGeometry>
      <meshBasicMaterial vertexColors={true} />
      <lineSegments renderOrder={1}>
        <edgesGeometry args={[geo]} />
        <lineBasicMaterial args={[{ color: BLACK, linewidth: 1 }]} />
      </lineSegments>
      {children}
    </mesh >
  );
};

type PuzzleFunctions = {
  checkIntersection: (ray: THREE.Raycaster) => { side: Side, space: number, distance: number },
  setPuzzleColors: (colors: PuzzleColors, changedSpaces?: { side: Side, space: number }[]) => void,
  setHighlighting: (highlightedSpace?: { side: Side, space: number }) => void,
};
type PuzzleProps = {
  threeProps?: EmotionJSX.IntrinsicElements['group'],
  degree: number,
  pieceRadius: number,
  state: PuzzleColors,
  animationState?: AnimationState,
  registerFunctions?: (functions: PuzzleFunctions) => void;
}
const Puzzle = ({ threeProps = {}, children, degree, pieceRadius, state, animationState, registerFunctions = (fs => { }) }: React.PropsWithChildren<PuzzleProps>) => {
  const pieceList: EmotionJSX.Element[] = [];
  const pieceGrid: { piece: EmotionJSX.Element, functions: React.MutableRefObject<PuzzlePieceFunctions> }[][][] = [];
  let keyCounter = 0;

  for (let x = 0; x < degree; x++) {
    pieceGrid.push([]);
    for (let y = 0; y < degree; y++) {
      pieceGrid[x].push([]);
      for (let z = 0; z < degree; z++) {
        pieceGrid[x][y].push({ piece: null, functions: useRef<PuzzlePieceFunctions>(null) });

        const piece = <PuzzlePiece
          key={keyCounter++}
          degree={degree}
          pieceRadius={pieceRadius}
          x={x} y={y} z={z}
          puzzleColors={state}
          registerFunctions={(fs) => { pieceGrid[x][y][z].functions.current = fs; }}
        />
        pieceList.push(piece);
        pieceGrid[x][y][z].piece = piece;
      }
    }
  }

  const [highlightedSpace, setHighlightedSpace] = useState<{ side: Side, space: number }>(null);

  registerFunctions({
    checkIntersection: function (ray) {
      const intersections = [];
      for (let x = 0; x < degree; x++) for (let y = 0; y < degree; y++) for (let z = 0; z < degree; z++) {
        if (pieceGrid[x][y][z].functions.current != null) {
          intersections.push(...pieceGrid[x][y][z].functions.current.checkIntersection(ray).map(i => ({ pos: { x, y, z }, ...i })));
        }
      }

      if (intersections.length == 0) return null;

      intersections.sort((int1, int2) => int1.distance - int2.distance);
      const intersection = intersections[0];

      const [sideX, sideY] = (() => {
        switch (intersection.side) {
          case Side.Right: return [degree - 1 - intersection.pos.z, degree - 1 - intersection.pos.y];
          case Side.Left: return [intersection.pos.z, degree - 1 - intersection.pos.y];
          case Side.Up: return [intersection.pos.x, intersection.pos.z];
          case Side.Down: return [intersection.pos.x, degree - 1 - intersection.pos.z];
          case Side.Front: return [intersection.pos.x, degree - 1 - intersection.pos.y];
          default: // back
            return [degree - 1 - intersection.pos.x, degree - 1 - intersection.pos.y];
        }
      })();

      return { side: intersection.side, space: sideY * degree + sideX, distance: intersection.distance };
    },

    setPuzzleColors: function (colors, changedSpaces) {
      if (changedSpaces == null) {
        for (let x = 0; x < degree; x++) for (let y = 0; y < degree; y++) for (let z = 0; z < degree; z++) {
          if (pieceGrid[x][y][z].functions.current != null) {
            pieceGrid[x][y][z].functions.current.setPuzzleColors(colors);
          }
        }
      } else {
        const changedPositions = new Set(changedSpaces.map(space => spaceToPosition(degree, space)));
        changedPositions.forEach(pos => {
          if (pieceGrid[pos.x][pos.y][pos.z].functions.current != null) {
            pieceGrid[pos.x][pos.y][pos.z].functions.current.setPuzzleColors(colors);
          }
        });
      }
    },

    setHighlighting: function (newHighlightedSpace) {
      if (highlightedSpace == newHighlightedSpace) return;
      const pos = highlightedSpace == null ? null : spaceToPosition(degree, highlightedSpace);
      const newPos = newHighlightedSpace == null ? null : spaceToPosition(degree, newHighlightedSpace);
      if (newPos != null && pieceGrid[newPos.x][newPos.y][newPos.z].functions.current != null) {
        pieceGrid[newPos.x][newPos.y][newPos.z].functions.current.setHighlighting(newHighlightedSpace.side);
      }
      if (pos != null && !positionsEqual(pos, newPos) && pieceGrid[pos.x][pos.y][pos.z].functions.current != null) {
        pieceGrid[pos.x][pos.y][pos.z].functions.current.setHighlighting(null);
      }
      setHighlightedSpace(newHighlightedSpace);
    }
  });

  const piecesOrLayers = (() => {
    if (animationState == null) {
      return pieceList;
    } else {
      const rotation = (() => {
        const rotationDistance =
          animationState.progress
          * (animationState.animation.rotation.doubleTurn ? Math.PI : Math.PI / 2)
          * (animationState.animation.rotation.clockwise ? -1 : 1);
        switch (animationState.animation.rotation.axis) {
          case Axis.X:
            return new Euler(rotationDistance, 0, 0);
          case Axis.Y:
            return new Euler(0, rotationDistance, 0);
          case Axis.Z:
            return new Euler(0, 0, rotationDistance);
        }
      })();

      const layers: EmotionJSX.Element[] = [];
      for (let i = 0; i < degree; i++) {
        const layerPieces: EmotionJSX.Element[] = [];
        for (let j = 0; j < degree; j++) {
          for (let k = 0; k < degree; k++) {
            switch (animationState.animation.rotation.axis) {
              case Axis.X:
                layerPieces.push(pieceGrid[i][j][k].piece);
                break;
              case Axis.Y:
                layerPieces.push(pieceGrid[j][i][k].piece);
                break;
              case Axis.Z:
                layerPieces.push(pieceGrid[j][k][i].piece);
                break;
            }
          }
        }

        if (animationState.animation.rotation.rotateLayers.includes(i)) {
          layers.push(
            <group key={keyCounter++}
              rotation={rotation}
            >
              {layerPieces}
            </group>
          );
        } else {
          layers.push(
            <group key={keyCounter++}>
              {layerPieces}
            </group>
          );
        }
      }

      return layers;
    }
  })();

  return (
    <group key={keyCounter++} {...threeProps}>
      {piecesOrLayers}
      {children}
    </group>
  );
}

const RefCube = ({ degree, pieceRadius }: { degree: number, pieceRadius: number }) => {  // setup and add to puzzle
  const sideLetters = range(0, 5).map(side => {
    // Need to construct this imperatively since its position/rotation depends on a bounding box around the constructed mesh.
    // Since the ref cube never changes, there shouldn't be any issues.
    const [_, meshRef] = useState<THREE.Mesh>(() => {
      const geometry = new TextGeometry(toLetter(side), {
        font: helvetica,
        size: 0.25,
        height: 0.001,
        curveSegments: 12,
        bevelEnabled: false,
        bevelThickness: 0.1,
        bevelSize: 0.1,
        bevelSegments: 0.1
      });
      const material = new THREE.MeshBasicMaterial({ color: side == Side.Down ? 0xffffff : 0x000000 });
      const text = new THREE.Mesh(geometry, material);

      // align the letter. Note that its position controls the bottom-left corner of the letter
      const boundingBox = new THREE.Box3().setFromObject(text);
      switch (side) {
        case Side.Up:
        case Side.Down: {
          const sign = side == Side.Up ? 1 : -1;
          text.rotation.x = -sign * Math.PI / 2;
          text.position.y = sign * pieceRadius / 2;
          text.position.x = -(boundingBox.max.x - boundingBox.min.x) / 2;
          text.position.z = sign * (boundingBox.max.y - boundingBox.min.y) / 2;
        } break;
        case Side.Front:
        case Side.Back: {
          const sign = side == Side.Front ? 1 : -1;
          if (side == Side.Back) { text.rotation.y = Math.PI; }
          text.position.z = sign * pieceRadius / 2;
          text.position.x = -sign * (boundingBox.max.x - boundingBox.min.x) / 2;
          text.position.y = -(boundingBox.max.y - boundingBox.min.y) / 2
        } break;
        case Side.Left:
        case Side.Right: {
          const sign = side == Side.Right ? 1 : -1;
          text.rotation.y = sign * Math.PI / 2;
          text.position.x = sign * pieceRadius / 2;
          text.position.z = sign * (boundingBox.max.x - boundingBox.min.x) / 2;
          text.position.y = -(boundingBox.max.y - boundingBox.min.y) / 2;
        } break;
      }
      return text;
    });

    return (
      <mesh
        key={side}
        ref={meshRef}
      />
    );
  });

  const refCubePuzzleColors: PuzzleColors = range(0, 5).map(side => [side]);

  return (
    <PuzzlePiece
      threeProps={{
        position: [0, pieceRadius * degree * 1.5, 0]
      }}
      degree={1}
      pieceRadius={pieceRadius * (0.1 + 0.1 * degree)}
      x={0} y={0} z={0}
      puzzleColors={refCubePuzzleColors}
    >
      {sideLetters}
    </PuzzlePiece>
  );
};

export interface SimulationProps {
  degree: number;
}

export interface SimulationState {
  cameraDistance: number; // distance from origin
  puzzle: PuzzleColors;
  currentAnimation?: AnimationState;
}

const RendererHook = () => {
  const refHook = useRef<THREE.Mesh>();
  useThree(({ gl }) => {
    if (refHook.current) {
      gl.setPixelRatio(window.devicePixelRatio);
      gl.setSize(window.innerWidth, window.innerHeight);

      // three-react-fiber fucks with these; restore them to three.js defaults:
      gl.outputEncoding = THREE.LinearEncoding;
      gl.toneMapping = THREE.NoToneMapping;
    }
  });

  return (
    <mesh ref={refHook} />
  )
};

const CameraHook = ({ state }: { state: SimulationState }) => {
  const refHook = useRef<THREE.Mesh>();
  useThree(({ camera }) => {
    if (refHook.current) {
      const cameraRotationalAngle = -20; // facing rotation around y-axis (clockwise) (degrees)
      const cameraPolarAngle = -15; // facing rotation around x-axis (degrees)
      const cameraPosition = new THREE.Spherical(state.cameraDistance, (90 + cameraPolarAngle) * Math.PI / 180, -cameraRotationalAngle * Math.PI / 180);
      camera.position.setFromSpherical(cameraPosition);
      camera.rotation.x = -(Math.PI / 2 - cameraPosition.phi);
      camera.rotation.y = cameraPosition.theta;

      (camera as PerspectiveCamera).aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
  });

  return (
    <mesh ref={refHook} />
  )
};

type MouseHandlers = {
  onMouseMove: (pointer: THREE.Raycaster) => void;
};
const MouseHandlersHook = (props: MouseHandlers) => {
  const refHook = useRef<THREE.Mesh>();
  useThree(({ gl, camera }) => {
    if (refHook.current) {
      const rendererRect = gl.domElement.getBoundingClientRect();
      const getRaycaster = (clientX: number, clientY: number) => {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({
          x: (clientX - rendererRect.left) / (rendererRect.right - rendererRect.left) * 2 - 1,
          y: -(clientY - rendererRect.top) / (rendererRect.bottom - rendererRect.top) * 2 + 1
        }, camera);
        return raycaster;
      };

      gl.domElement.addEventListener('mousemove', (evt) => {
        evt.preventDefault();
        props.onMouseMove(getRaycaster(evt.clientX, evt.clientY));
      });
    }
  });

  return (
    <mesh ref={refHook} />
  )
};

const SimulationCanvas = ({ props, state, pieceRadius }: { props: SimulationProps, state: SimulationState, pieceRadius: number }) => {
  const puzzleFunctionsRef = useRef<PuzzleFunctions>(null);

  return (
    <Canvas
      gl={{ antialias: true }}
      camera={new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)}
    >
      <RendererHook />
      <CameraHook state={state} />
      <MouseHandlersHook
        onMouseMove={(ray) => {
          if (!puzzleFunctionsRef.current) return;
          const mousedSpace = puzzleFunctionsRef.current.checkIntersection(ray);
          puzzleFunctionsRef.current.setHighlighting(mousedSpace);
        }}
      />
      <ambientLight />
      <Puzzle
        degree={props.degree}
        pieceRadius={pieceRadius}
        state={state.puzzle}
        animationState={state.currentAnimation}
        registerFunctions={(fs) => { puzzleFunctionsRef.current = fs; }}
      >
        <RefCube degree={props.degree} pieceRadius={pieceRadius} />
      </Puzzle>
    </Canvas >
  );
};

export class Simulation extends React.Component<SimulationProps, SimulationState> {
  readonly pieceRadius: number;

  /*
  readonly refCube: THREE.Mesh;
  */

  constructor(props: SimulationProps) {
    super(props);

    this.pieceRadius = 0.4;

    this.state = {
      cameraDistance: 3 + (this.pieceRadius * this.props.degree),
      puzzle: (() => {
        // solved puzzle
        const state = [];
        for (let side = 0; side < 6; side++) {
          const sideSpaces = [];
          for (let space = 0; space < this.props.degree * this.props.degree; space++) {
            sideSpaces.push(COLORS[side]);
          }
          state.push(sideSpaces);
        }
        return state;
      })(),
      currentAnimation: {
        animation: {
          rotation: {
            axis: Axis.Z,
            rotateLayers: [1],
            doubleTurn: false,
            clockwise: true
          },
          speed: 0.4
        },
        progress: 0.9
      }
    };
  }

  render() {
    return <SimulationCanvas props={this.props} state={this.state} pieceRadius={this.pieceRadius} />
  }
}
