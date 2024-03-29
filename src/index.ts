import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import * as helveticaJson from 'three/examples/fonts/helvetiker_regular.typeface.json';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import * as Solution from './solution';
import { Side, Axis, getUnitVector, Color, COLORS, toShade, Rotation, AnimationTickResult, Animation, Arrangement, printArrangement, rotateArrangement, Move, getAxis, toRotation, MoveType, toNotation, standardOrientation, transform, toLetter, SpacesSettings, Orientation, inspectSide, locateSide, deepCopy, range, opposite, reverse } from './core';

const GRAY = toShade(null);
const BLACK = new THREE.Color(0, 0, 0);

const DEGREE = (() => { // 3x3? 4x4? nxn?
  const defaultDegree = 3;
  const res = new URLSearchParams(window.location.search).get('s');
  if (res == null) return defaultDegree;
  const parsed = parseInt(res);
  if (parsed == NaN || parsed < 1) return defaultDegree;
  return parsed;
})();

const cubeRadius = 0.4;
const maxFPS = 1000;
const minFrameInterval = 1 / maxFPS * 1000;

function buildCubes(degree: number = DEGREE): THREE.Mesh[/*x*/][/*y*/][/*z*/] {
  const cubes: THREE.Mesh[][][] = [];

  for (let x = 0; x < degree; x++) {
    cubes.push([]);
    for (let y = 0; y < degree; y++) {
      cubes[x].push([]);
      for (let z = 0; z < degree; z++) {
        const geometry = new THREE.BoxGeometry(cubeRadius, cubeRadius, cubeRadius).toNonIndexed();
        const material = new THREE.MeshBasicMaterial({ vertexColors: true });
        const cube = new THREE.Mesh(geometry, material);
        const geo = new THREE.EdgesGeometry(cube.geometry);
        const mat = new THREE.LineBasicMaterial({ color: BLACK, linewidth: 1 });
        const wireframe = new THREE.LineSegments(geo, mat);
        wireframe.renderOrder = 1; // make sure wireframes are rendered 2nd
        cube.add(wireframe);

        const position = new THREE.Vector3(x, y, z).addScalar(-(degree - 1) / 2).multiplyScalar(cubeRadius);
        cube.position.set(position.x, position.y, position.z);

        cubes[x][y].push(cube);
      }
    }
  }
  return cubes;
}

function colorCubes(cubes: THREE.Mesh[][][], arr: Arrangement, cubeOrientations: Orientation[][][], highlighted: SpacesSettings = null, degree: number = DEGREE) {
  const getShade = (side: Side, space: number) => toShade(arr[side][space], highlighted != null ? highlighted[side][space] : null);

  for (let z = 0; z < degree; z++) {
    for (let y = 0; y < degree; y++) {
      for (let x = 0; x < degree; x++) {
        const unorientedColors: THREE.Color[] = [];

        if (x == degree - 1) unorientedColors.push(getShade(Side.Right, (degree - y) * degree - 1 - z))
        else unorientedColors.push(GRAY);

        if (x == 0) unorientedColors.push(getShade(Side.Left, (degree - 1 - y) * degree + z))
        else unorientedColors.push(GRAY);

        if (y == degree - 1) unorientedColors.push(getShade(Side.Up, z * degree + x))
        else unorientedColors.push(GRAY);

        if (y == 0) unorientedColors.push(getShade(Side.Down, (degree - 1 - z) * degree + x))
        else unorientedColors.push(GRAY);

        if (z == degree - 1) unorientedColors.push(getShade(Side.Front, (degree - 1 - y) * degree + x))
        else unorientedColors.push(GRAY);

        if (z == 0) unorientedColors.push(getShade(Side.Back, (degree - y) * degree - 1 - x))
        else unorientedColors.push(GRAY);

        const colors =
          [Side.Right, Side.Left, Side.Up, Side.Down, Side.Front, Side.Back]
            .map(s => unorientedColors[inspectSide(s, cubeOrientations[x][y][z])]);

        const cube = cubes[x][y][z];

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

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const cameraRotationalAngle = -20; // facing rotation around y-axis (clockwise) (degrees)
const cameraPolarAngle = -15; // facing rotation around x-axis (degrees)
const cameraRadius = 3 + (cubeRadius * DEGREE); // distance from origin
const cameraPosition = new THREE.Spherical(cameraRadius, (90 + cameraPolarAngle) * Math.PI / 180, -cameraRotationalAngle * Math.PI / 180);
camera.position.setFromSpherical(cameraPosition);
camera.rotation.x = -(Math.PI / 2 - cameraPosition.phi);
camera.rotation.y = cameraPosition.theta;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
let canvas = renderer.domElement;
document.body.appendChild(canvas);
function getCanvasCoords(clientX: number, clientY: number) {
  const rendererRect = renderer.domElement.getBoundingClientRect();
  return {
    x: (clientX - rendererRect.left) / (rendererRect.right - rendererRect.left) * 2 - 1,
    y: -(clientY - rendererRect.top) / (rendererRect.bottom - rendererRect.top) * 2 + 1
  };
}

const arrangement: Arrangement = []
const highlighted: SpacesSettings = []
for (let side = 0; side < 6; side++) {
  const colors = [];
  const highlights = [];
  for (let space = 0; space < DEGREE * DEGREE; space++) {
    colors.push(COLORS[side]);
    highlights.push(false);
  }
  arrangement.push(colors);
  highlighted.push(highlights);
}
printArrangement(arrangement, DEGREE);

const cubes = buildCubes();
const cubeOrientations: Orientation[][][] = [];
for (let i = 0; i < DEGREE; i++) {
  cubeOrientations.push([]);
  for (let j = 0; j < DEGREE; j++) {
    cubeOrientations[i].push([]);
    for (let k = 0; k < DEGREE; k++) cubeOrientations[i][j].push(standardOrientation);
  }
}

colorCubes(cubes, arrangement, cubeOrientations);
const puzzle = new THREE.Group();
scene.add(puzzle);
for (let i = 0; i < DEGREE; i++) for (let j = 0; j < DEGREE; j++) for (let k = 0; k < DEGREE; k++) {
  const cube = cubes[i][j][k];
  puzzle.add(cube);
}

function buildRefCube() {
  const cubeArr = buildCubes(1);
  const cube = cubeArr[0][0][0];
  colorCubes(cubeArr, COLORS.map(c => [c]), [[[standardOrientation]]], null, 1);
  cube.translateY(cubeRadius * DEGREE * 1.5);
  cube.scale.set(0.1 + 0.1 * DEGREE, 0.1 + 0.1 * DEGREE, 0.1 + 0.1 * DEGREE);

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
        text.position.y = sign * cubeRadius / 2;
        text.position.x = -(text_box.max.x - text_box.min.x) / 2;
        text.position.z = sign * (text_box.max.y - text_box.min.y) / 2;
      } break;
      case Side.Front:
      case Side.Back: {
        const sign = side == Side.Front ? 1 : -1;
        if (side == Side.Back) { text.rotation.y = Math.PI; }
        text.position.z = sign * cubeRadius / 2;
        text.position.x = -sign * (text_box.max.x - text_box.min.x) / 2;
        text.position.y = -(text_box.max.y - text_box.min.y) / 2
      } break;
      case Side.Left:
      case Side.Right: {
        const sign = side == Side.Right ? 1 : -1;
        text.rotation.y = sign * Math.PI / 2;
        text.position.x = sign * cubeRadius / 2;
        text.position.z = sign * (text_box.max.x - text_box.min.x) / 2;
        text.position.y = -(text_box.max.y - text_box.min.y) / 2;
      } break;
      default:
        return;
    }

    cube.add(text);
  });

  return cube;
}
const refCube = buildRefCube();
puzzle.add(refCube);



function getMousedSpace(clientX: number, clientY: number): { side: Side, space: number } | null {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(getCanvasCoords(clientX, clientY), camera);

  const intersections = [];

  for (let x = 0; x < DEGREE; x++) for (let y = 0; y < DEGREE; y++) for (let z = 0; z < DEGREE; z++) {
    const cube = cubes[x][y][z];
    const cubeIntersections = raycaster.intersectObject(cube);
    if (cubeIntersections.length > 0) {
      for (let i = 0; i < cubeIntersections.length; i++) {
        if (cubeIntersections[i].faceIndex != null) {
          intersections.push({
            pos: { x, y, z },
            face: cubeIntersections[i].faceIndex,
            distance: cubeIntersections[i].distance
          });
        }
      }
    }
  }

  if (intersections.length == 0) return null;

  intersections.sort((int1, int2) => int1.distance - int2.distance);
  const intersection = intersections[0];

  let side = Math.floor(intersection.face / 2);
  if (side < 0 || side >= 6) return null;
  side = inspectSide(side, cubeOrientations[intersection.pos.x][intersection.pos.y][intersection.pos.z]);

  const [sideX, sideY] = (() => {
    switch (side) {
      case Side.Right: return [DEGREE - 1 - intersection.pos.z, DEGREE - 1 - intersection.pos.y];
      case Side.Left: return [intersection.pos.z, DEGREE - 1 - intersection.pos.y];
      case Side.Up: return [intersection.pos.x, intersection.pos.z];
      case Side.Down: return [intersection.pos.x, DEGREE - 1 - intersection.pos.z];
      case Side.Front: return [intersection.pos.x, DEGREE - 1 - intersection.pos.y];
      default: // back
        return [DEGREE - 1 - intersection.pos.x, DEGREE - 1 - intersection.pos.y];
    }
  })();

  return { side, space: sideY * DEGREE + sideX };
}

function connectLayers(axis: Axis) {
  const layers: THREE.Group[] = [];
  for (let iLayer = 0; iLayer < DEGREE; iLayer++) {
    const layer = new THREE.Group();
    puzzle.add(layer);
    layers.push(layer);

    for (let j = 0; j < DEGREE; j++) for (let k = 0; k < DEGREE; k++) {
      const cube = (() => {
        switch (axis) {
          case Axis.X: return cubes[iLayer][j][k];
          case Axis.Y: return cubes[j][iLayer][k];
          default: return cubes[j][k][iLayer];
        }
      })();

      puzzle.remove(cube)
      layer.add(cube);
    }
  }

  return layers;
}

function separateLayers(layers: THREE.Group[]) {
  const puzzleRot = new THREE.Quaternion();
  puzzle.getWorldQuaternion(puzzleRot);
  puzzle.rotation.set(0, 0, 0);

  const cubeData = [];
  for (let i = 0; i < DEGREE; i++) for (let j = 0; j < DEGREE; j++) for (let k = 0; k < DEGREE; k++) {
    const cube = cubes[i][j][k];
    const pos = new THREE.Vector3();
    const rot = new THREE.Quaternion();
    cube.getWorldPosition(pos);
    cube.getWorldQuaternion(rot);
    cubeData.push({ pos, rot });
  }

  layers.forEach(layer => puzzle.remove(layer));

  let cubeDataCounter = 0;
  for (let i = 0; i < DEGREE; i++) for (let j = 0; j < DEGREE; j++) for (let k = 0; k < DEGREE; k++) {
    const cube = cubes[i][j][k];
    puzzle.add(cube);
    cube.position.copy(cubeData[cubeDataCounter].pos);
    cube.quaternion.copy(cubeData[cubeDataCounter].rot);
    cubeDataCounter++;
  }

  puzzle.quaternion.copy(puzzleRot);
}





interface RotationAnimationSpec {
  rotation: Rotation
  speed?: number, // radians per second
}

function getRotateAnimation(spec: RotationAnimationSpec): Animation {
  const { rotation, speed } = { speed: 0.01, ...spec };
  const { axis, rotateLayers, doubleTurn, clockwise } = rotation;

  //console.log(`axis: ${ axis }, layer: ${ rotateLayers.join('+') }, double: ${ doubleTurn }, clockwise: ${ clockwise }, speed: ${ speed }`);

  const axisVector = getUnitVector(axis);

  const sign = clockwise ? 1 : -1;
  const target = sign * (doubleTurn ? 2 : 1) * Math.PI / 2;

  let layers: THREE.Group[];
  let progress = 0;

  return {
    setup() {
      if (rotateLayers.length == 0 || speed <= 0) return { animationDone: true, renderNeeded: false };
      layers = connectLayers(axis);
      return { animationDone: false, renderNeeded: false };
    },

    tick(elapsed) {
      const delta = sign * speed * elapsed / 1000;
      rotateLayers.forEach(iLayer => layers[iLayer].rotateOnAxis(axisVector, delta));
      progress += delta;

      const lastTick = Math.abs(progress) >= Math.abs(target);

      return { animationDone: lastTick, renderNeeded: true };
    },

    teardown() {
      // 0 progress means no animation
      if (progress != 0) {

        rotateLayers.forEach(iLayer => {
          // snap the rotation to the grid
          layers[iLayer].setRotationFromAxisAngle(axisVector, target);

          // rotate the layer in the cubes 3d array (and orientations array)
          for (let c = 0; c < Math.floor(DEGREE / 2); c++) {  // the "layers of the layer" -- the concentric "squares" that make up a layer 
            for (let k = 0; k < DEGREE - 2 * c - 1; k++) {  // the indices along an edge (-1 avoids double-counting corners)
              const coordinateCircle = [  // rotation of cubes is done in groups of 4
                { i: c, j: c + k },
                { i: c + k, j: DEGREE - 1 - c },
                { i: DEGREE - 1 - c, j: DEGREE - 1 - k - c },
                { i: DEGREE - 1 - k - c, j: c }
              ]
              if (!clockwise) coordinateCircle.reverse();

              let prevCube = null;
              let prevOr = null;
              for (let t = 0; t < (doubleTurn ? 2 : 1); t++) {  // the turn
                for (let iCC = 0; iCC < 5; iCC++) {
                  //const srcCC = coordinateCircle[(iCC + 3) % 4];
                  const cc = coordinateCircle[iCC % 4];

                  const rotateOrientation = (or: Orientation, sideCircle: Side[]) => {
                    const translate = (s: Side) => {
                      if (!sideCircle.some(s2 => s2 == s)) return s;
                      return sideCircle[(sideCircle.findIndex(s2 => s2 == s) + (clockwise ? 1 : 3)) % 4];
                    }
                    return { top: translate(or.top), front: translate(or.front) }
                  };

                  switch (axis) {
                    case Axis.X: {
                      //if (iCC != 0) console.log(`Moving(${ iLayer }, ${ srcCC.j }, ${ srcCC.i }) to(${ iLayer }, ${ cc.j }, ${ cc.i })`);
                      const tmpCube = cubes[iLayer][cc.j][cc.i];
                      if (iCC != 0) cubes[iLayer][cc.j][cc.i] = prevCube;
                      prevCube = tmpCube;
                      const tmpOr = cubeOrientations[iLayer][cc.j][cc.i];
                      if (iCC != 0) cubeOrientations[iLayer][cc.j][cc.i] = rotateOrientation(prevOr, [Side.Up, Side.Front, Side.Down, Side.Back]);
                      prevOr = tmpOr;
                      break;
                    }
                    case Axis.Y: {
                      //if (iCC != 0) console.log(`Moving(${ srcCC.i }, ${ iLayer }, ${ srcCC.j }) to(${ cc.i }, ${ iLayer }, ${ cc.j })`)
                      const tmpCube = cubes[cc.i][iLayer][cc.j];
                      if (iCC != 0) cubes[cc.i][iLayer][cc.j] = prevCube;
                      prevCube = tmpCube;
                      const tmpOr = cubeOrientations[cc.i][iLayer][cc.j];
                      if (iCC != 0) cubeOrientations[cc.i][iLayer][cc.j] = rotateOrientation(prevOr, [Side.Front, Side.Right, Side.Back, Side.Left]);
                      prevOr = tmpOr;
                      break;
                    }
                    default: {
                      //if (iCC != 0) console.log(`Moving(${ srcCC.j }, ${ srcCC.i }, ${ iLayer }) to(${ cc.j }, ${ cc.i }, ${ iLayer })`)
                      const tmpCube = cubes[cc.j][cc.i][iLayer]
                      if (iCC != 0) cubes[cc.j][cc.i][iLayer] = prevCube;
                      prevCube = tmpCube;
                      const tmpOr = cubeOrientations[cc.j][cc.i][iLayer];
                      if (iCC != 0) cubeOrientations[cc.j][cc.i][iLayer] = rotateOrientation(prevOr, [Side.Up, Side.Left, Side.Down, Side.Right]);
                      prevOr = tmpOr;
                      break;
                    }
                  }
                }
              }
            }
          }
        });

        rotateArrangement(rotation, arrangement, DEGREE);
        //printArrangement(arrangement, DEGREE);

        // finalize cube positions
        separateLayers(layers);
      }
    }
  }
}


function getDelayAnimation(delay: number): Animation {
  return {
    setup() { return { animationDone: true, renderNeeded: false, minDelay: delay }; },
    tick() { /* should not be called */ return { animationDone: true, renderNeeded: false }; },
    teardown() { }
  };
}

function extendAnimation(an: Animation, preSetup: () => void = undefined, preTick: (elapsed: number) => void = undefined, preTeardown: () => void = undefined) {
  return {
    setup() {
      if (preSetup != null) preSetup();
      return an.setup();
    },
    tick(elapsed: number) {
      if (preTick != null) preTick(elapsed);
      return an.tick(elapsed);
    },
    teardown() {
      if (preTeardown != null) preTeardown();
      an.teardown();
    }
  }
}

let animations: Animation[] = [];
let currentAnimation: Animation | null = null;
let paused: boolean = false;
let lastTick = Date.now();

function swapControlsSrcWithSolution() {
  const controlsEle = document.getElementById('controls');
  const controlsRefSolutionEle = document.getElementById('controls_ref_solution');
  const swapControlsSrc = controlsEle.getAttribute('src');
  controlsEle.setAttribute('src', controlsRefSolutionEle.getAttribute('src'));
  controlsRefSolutionEle.setAttribute('src', swapControlsSrc);
}

let undoSolutionAnimations: { undo: Animation, redo: Animation }[] = [];
let arrangementNeedsNewSolution = true;
function getSolutionAnimation(startPaused: boolean = undefined, followup: Animation | null = null): Animation {
  return {
    setup() {
      printArrangement(arrangement, DEGREE);
      console.log('solution:');

      const solutionEle = document.getElementById('solution_text');
      Array.from(document.getElementsByClassName('solution')).forEach(element => (element as HTMLElement).style.pointerEvents = 'auto');

      const validationArrangement = deepCopy(arrangement);
      let moveCount = 0;
      let solved = false;

      try {
        const moveGen = Solution.solve(arrangement, DEGREE);

        solutionEle.innerHTML = ': <br />';
        let headers: { text: string, level: number }[] = [];
        let headerLevel = -1;
        const halftab = "&ensp;";
        const tab = `${halftab}${halftab}`;
        const sectionBreakText = (id: number) => `<div id="solution_section_break_${id}" style="height:13px;" ></div>`;
        let indent = tab;
        let moveLineStarted = false;
        let moveLineCount = 0;
        let moveLineWideCount = 0;  // 3-character (except thin "'" chars) notations like "Dd2"
        let headerCount = 0;
        let sectionBreak = false;
        let sectionBreakCount = 0;

        while (moveCount < 2000) {  // no cube we have solve instructions for takes this long.
          const nextMove = moveGen.next();
          if (nextMove.done == true) {
            solved = true;
            break;
          }
          const nextMoveValue = nextMove.value;
          if ("text" in nextMoveValue) {
            while (headerLevel != -1 && nextMoveValue.level <= headerLevel) {
              headers.pop();
              if (headers.length == 0) headerLevel = -1;
              else headerLevel = headers[headers.length - 1].level;
            }
            if (nextMoveValue.text != '') {
              headers.push(nextMoveValue);
              headerLevel = nextMoveValue.level;
              moveLineStarted = false;
            }
            else {
              headerLevel = nextMoveValue.level - 1;
              headerLevel = -1;
              indent = "";
              for (let i = 0; i < nextMoveValue.level; i++) indent += tab;
              if (!sectionBreak) { solutionEle.innerHTML += sectionBreakText(sectionBreakCount); sectionBreakCount++; }
              sectionBreak = true;
              moveLineCount = 0;
              moveLineWideCount = 0;
              moveLineStarted = false;
            }
          } else {
            const iMove = moveCount;
            moveCount++;

            let printedHeader = false;
            if (headers.length != 0) {
              printedHeader = true;
              if (!sectionBreak) { solutionEle.innerHTML += sectionBreakText(sectionBreakCount); sectionBreakCount++; }

              let notFirstHeader = false;
              headers.forEach((header, index) => {
                if (header.level == 1) printArrangement(validationArrangement, DEGREE);
                indent = "";
                for (let i = 0; i < header.level; i++) indent += tab;
                console.log(header.text);
                const lastHeader = index == headers.length - 1;
                solutionEle.innerHTML += `${notFirstHeader ? '<br />' : ''}${indent}<span${lastHeader ? ` id="solution_header_${headerCount}"` : ''}>${header.text}</span>`;
                if (lastHeader) {
                  headerCount += 1;
                }
                notFirstHeader = true;
                indent += tab;
              });
              headers = [];
            }


            if (printedHeader || !moveLineStarted || moveLineCount == 8 || (moveLineWideCount >= 2 && moveLineCount == 4) || (moveLineWideCount >= 3 && moveLineCount > 4)) {
              if (!sectionBreak || printedHeader) solutionEle.innerHTML += `<br />`;
              solutionEle.innerHTML += `${indent}`;
              moveLineStarted = true;
              moveLineCount = 0;
              moveLineWideCount = 0;
            }
            moveLineCount++;
            sectionBreak = false;

            const moveString = toNotation(transform(nextMoveValue, standardOrientation), DEGREE);
            if (moveString.replace("'", "").length >= 3) moveLineWideCount++;
            solutionEle.innerHTML += `<span class="solution_step" id="solution_step_${iMove}">${moveString}</span>`;
            console.log(moveString);

            const rotation = toRotation(nextMoveValue, DEGREE);
            rotateArrangement(rotation, validationArrangement, DEGREE);
            const moveHeaderId = headerCount - 1;
            const moveSectionBreakId = sectionBreakCount;
            let getAnimation: (() => Animation) = null;
            let getUndoAnimation: (() => Animation) = null;
            getAnimation = (
              () => extendAnimation(
                getRotateAnimation({ rotation, speed: 10 }),
                () => {
                  console.log(moveString);
                  const element = document.getElementById(`solution_step_${iMove}`);
                  element.scrollIntoView({ block: 'nearest' });
                  document.getElementById(`solution_header_${moveHeaderId}`).scrollIntoView({ block: 'nearest' });
                  document.getElementById(`solution_section_break_${moveSectionBreakId}`).scrollIntoView({ block: 'nearest' });
                  element.scrollIntoView({ block: 'nearest' });
                },
                undefined,
                () => {
                  undoSolutionAnimations.push({ undo: getUndoAnimation(), redo: getAnimation() });

                  // teardown this move's highlighting
                  const element = document.getElementById(`solution_step_${iMove}`);
                  element.style.color = '';
                  if (iMove + 1 < moveCount) { // moveCount is non-const; will have the full moveCount by the time this lambda is called
                    // set up next move's highlighting
                    const nextElement = document.getElementById(`solution_step_${iMove + 1}`);
                    nextElement.style.color = 'red';
                    // no way to know whether next move is after under a new header or not;
                    //  hacky alternative to scroll it into view is to scroll current move since header would be between current and next move
                    nextElement.scrollIntoView({ block: 'nearest' });
                    document.getElementById(`solution_header_${moveHeaderId}`).scrollIntoView({ block: 'nearest' });
                    element.scrollIntoView({ block: 'nearest' });
                    document.getElementById(`solution_section_break_${moveSectionBreakId}`).scrollIntoView({ block: 'nearest' });
                    nextElement.scrollIntoView({ block: 'nearest' });
                  }
                  else {
                    // scroll all the way down (scroll last move to top of view) to show there's no more moves
                    element.scrollIntoView({ block: 'start' });
                  }
                }
              )
            );
            getUndoAnimation = (
              () => extendAnimation(
                getRotateAnimation({ rotation: { ...rotation, clockwise: !rotation.clockwise }, speed: 10 }),
                () => {
                  // setup this move's highlighting
                  const element = document.getElementById(`solution_step_${iMove}`);
                  element.style.color = 'red';
                  element.scrollIntoView({ block: 'nearest' });
                  document.getElementById(`solution_header_${moveHeaderId}`).scrollIntoView({ block: 'nearest' });
                  document.getElementById(`solution_section_break_${moveSectionBreakId}`).scrollIntoView({ block: 'nearest' });
                  element.scrollIntoView({ block: 'nearest' });
                  if (iMove + 1 < moveCount) { // moveCount is non-const; will have the full moveCount by the time this lambda is called
                    // teardown next move's highlighting
                    document.getElementById(`solution_step_${iMove + 1}`).style.color = '';
                  }
                },
                undefined,
                () => {
                }
              )
            );

            animations.push(getAnimation());
            // setup first move's highlighting since there wasn't a previous teardown to do so
            if (iMove == 0) {
              const element = document.getElementById(`solution_step_${iMove}`);
              element.style.color = 'red';
              element.scrollIntoView({ block: 'end' }); // scroll all the way up (scroll first move to bottom of view)
            }
          }
        }
      } catch (err) {
        console.error(`Encountered error while solving: ${err}`);
        solved = false;
      }

      // validate
      if (solved) {
        for (let side = 0; side < 6; side++) {
          for (let space = 0; space < DEGREE * DEGREE; space++) {
            if (validationArrangement[side][space] != side) {
              solved = false;
              break;
            }
          }
        }
        if (!solved) console.log('validation failed.');
        printArrangement(validationArrangement, DEGREE);
      }

      if (!solved) {
        while (animations.length != 0) animations.pop();
        if (solutionEle.innerHTML.includes("Solution")) swapControlsSrcWithSolution();
        solutionEle.innerHTML = `Can't solve.<br/>(is the arrangement correct?)`;
        return { animationDone: true, renderNeeded: false };
      }

      if (!solutionEle.innerHTML.includes("Solution")) swapControlsSrcWithSolution();
      solutionEle.innerHTML = `<span id="solution_top_header">Solution (${moveCount} moves)</span>${solutionEle.innerHTML}`;

      animations.push(extendAnimation(getDelayAnimation(250), () => { console.log('Solved!') }));
      //if (followup != null) animations.push(followup);
      console.log(`solution queued up(${moveCount} moves)`);

      if (startPaused) animations.unshift(getPauseAnimation());
      return { animationDone: true, renderNeeded: false, /*minDelay: 1500*/ };
    },
    tick() { return { animationDone: true, renderNeeded: false } },
    teardown() { },
  }
}

let lastShuffleMove: Move | null = null;
let lastShuffleRotation: Rotation | null = null;
function getShuffleAnimation(count: number, speed: number = undefined, solveLoop: boolean = false, delay: number = undefined, firstInstance: boolean = true, originalCount: number = null): Animation {
  //const skipMiddle = (iLayer: number) => (iLayer < Math.floor(DEGREE / 2)) ? iLayer : iLayer + 1;
  if (originalCount == null) originalCount = count;

  const permitted = (move: Move) => {
    const rot = toRotation(move, DEGREE);
    return /*(move.layer == null || move.layer.depth == 1) && */(lastShuffleMove == null || (
      (move.orientation.top != lastShuffleMove.orientation.top || move.orientation.front != lastShuffleMove.orientation.front)
      || ((move.layer == null || move.layer.depth <= Math.floor(DEGREE / 2))
        && (rot.axis != lastShuffleRotation.axis
          || (
            !rot.rotateLayers.some(iLayer => lastShuffleRotation.rotateLayers.some(jLayer => jLayer == iLayer))
            && move.type != lastShuffleMove.type
          )))
    ));
  };

  return {
    setup() {
      if (count != null && count > 0) {
        if (firstInstance) {
          console.log('shuffling');
          const solutionEle = document.getElementById('solution_text');
          if (solutionEle.innerHTML.includes("Solution")) swapControlsSrcWithSolution();
          solutionEle.innerHTML = "";
          Array.from(document.getElementsByClassName('solution')).forEach(element => (element as HTMLElement).style.pointerEvents = 'none');
        }


        let move: Move;
        do {
          move = {
            side: Math.floor(Math.random() * 6),
            type: Math.random() < 0.2 ? MoveType.Double : Math.floor(Math.random() * 2),
            layer: {
              depth: Math.floor(Math.random() * Math.floor(DEGREE / 2)) + 1,
              thick: Math.random() < 0.5 - (.05 * DEGREE)
            },
            orientation: { top: Side.Up, front: Side.Front },
          }
        } while (!permitted(move));

        const spec = {
          rotation: toRotation(move, DEGREE),
          speed: Math.max(Math.min(speed, 5), 5 + (speed - 5) * (1 / (1 + Math.pow(10, -7 * (-0.15 + Math.min(count, originalCount - count) / originalCount)))))
        };
        animations.push(extendAnimation(getRotateAnimation(spec), () => { console.log(toNotation(move, DEGREE)); }));
        lastShuffleMove = move;
        lastShuffleRotation = spec.rotation;

        animations.push(getShuffleAnimation(count - 1, speed, solveLoop, delay, false, Math.max(count, originalCount)));
      }

      return { animationDone: true, renderNeeded: false, minDelay: (firstInstance && delay != null) ? 1000 : delay };
    },

    tick(_) {
      // should never be called.
      return { animationDone: true, renderNeeded: false }
    },

    teardown() {
      if (count <= 0) {
        if (solveLoop) animations.push(getSolutionAnimation(false, getShuffleAnimation(Math.max(count, originalCount), speed, solveLoop, delay, true)));
        console.log('shuffled!');
      }
    }
  }
}

function getPauseAnimation(): Animation {
  return {
    setup() {
      paused = true;
      return { animationDone: true, renderNeeded: false };
    },
    tick(_) {
      // should never be called
      return { animationDone: true, renderNeeded: false };
    },
    teardown() { }
  }
}

//animations.push(getShuffleAnimation(100, 60, true));
//animations.push(getShuffleAnimation(500, 50 * (DEGREE - 1), true, 9));

/*
[
  { side: Side.Right, type: MoveType.Double, orientation: standardOrientation },
  { side: Side.Down, type: MoveType.CW, orientation: standardOrientation },
  { side: Side.Front, type: MoveType.CCW, orientation: standardOrientation },
  { side: Side.Down, type: MoveType.Double, orientation: standardOrientation },
  { side: Side.Front, type: MoveType.Double, orientation: standardOrientation },
].forEach(a => animations.push(getRotateAnimation({ rotation: toRotation(a, DEGREE), speed: 5 })));
animations.push(getSolutionAnimation());
*/




let frameCount = 0;
let lastFpsCheck = Date.now();
let lastFrameTime = lastFpsCheck;
let renderRequested = false;
let renderCallbacks: (() => void)[] = [];
function requestRender(callback: () => void = null) {
  if (callback != null) renderCallbacks.push(callback);
  if (!renderRequested)
    requestAnimationFrame(() => {
      renderer.render(scene, camera);
      frameCount++;
      lastFrameTime = Date.now();
      renderRequested = false;

      const callbacks = renderCallbacks;
      renderCallbacks = [];
      callbacks.forEach(c => c());
    });
}
function loopFps() {
  const now = Date.now();
  const elapsed = now - lastFpsCheck;
  console.log(`fps: ${Math.floor(frameCount * 10000 / elapsed)}`);
  lastFpsCheck = now;
  frameCount = 0;
}
setInterval(loopFps, 10000);

window.addEventListener('resize', evt => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  requestRender();
});

let mainDown = false, alternateDown = false, mainPress = false, alternatePress = false,
  mouseX = 0, mouseY = 0, dragging = false, dragSrcX = 0, dragSrcY = 0, justChangedSpace: { side: Side, space: number } = null;
const cameraZAxis = new THREE.Vector3().setFromSpherical(cameraPosition).normalize();
const worldZAxis = new THREE.Vector3(0, 0, 1);
const mouseSpeed = 6 / 400; // radians per pixel
const dragThreshold = 2;
function updateMouseData(evt: MouseEvent, pressEvent: boolean) {
  const deltaX = evt.clientX - mouseX;
  const deltaY = evt.clientY - mouseY;
  mouseX = evt.clientX;
  mouseY = evt.clientY;
  if (mainDown || alternateDown) {
    const dragDeltaX = mouseX - dragSrcX;
    const dragDeltaY = mouseY - dragSrcY;
    if (dragDeltaX * dragDeltaX + dragDeltaY * dragDeltaY >= dragThreshold * dragThreshold) {
      dragging = true;
    }
  }

  const prevMainDown = mainDown;
  const prevAlternateDown = alternateDown;
  mainDown = (evt.buttons & 1) != 0;
  alternateDown = (evt.buttons & 2) != 0;
  if (!prevMainDown) mainPress = mainDown;
  if (!prevAlternateDown) alternatePress = alternateDown;
  if (!(prevMainDown || prevAlternateDown) && (mainDown || alternateDown)) {
    dragSrcX = mouseX;
    dragSrcY = mouseY;
  }
  const result = {
    deltaX, deltaY,
    mainPress: pressEvent && !prevMainDown && mainDown,
    alternatePress: pressEvent && !prevAlternateDown && alternateDown,
    mainRelease: pressEvent && mainPress && prevMainDown && !mainDown,
    alternateRelease: pressEvent && alternatePress && prevAlternateDown && !alternateDown,
    mainClick: !dragging && pressEvent && mainPress && prevMainDown && !mainDown,
    alternateClick: !dragging && pressEvent && alternatePress && prevAlternateDown && !alternateDown,
  };
  if (!mainDown && !alternateDown) dragging = false;
  return result;
}
function mouseMoveHandler(evt: MouseEvent) {
  evt.preventDefault();
  const { deltaX, deltaY } = updateMouseData(evt, false);
  let cursor = 'default';

  const mousedSpace = getMousedSpace(mouseX, mouseY);
  if (mousedSpace != null) {
    cursor = `grab`;
  }

  if (mainDown || alternateDown) {
    cursor = 'grabbing';
    const cameraXAxis = (() => {
      const spher = new THREE.Spherical().copy(cameraPosition);
      spher.theta += Math.PI / 2;
      spher.phi = Math.PI / 2;
      return new THREE.Vector3().setFromSpherical(spher).normalize();
    })();
    const cameraYAxis = (() => {
      const spher = new THREE.Spherical().copy(cameraPosition);
      spher.phi -= Math.PI / 2;
      return new THREE.Vector3().setFromSpherical(spher).normalize();
    })();
    const worldXAxis = new THREE.Vector3(1, 0, 0);
    const worldYAxis = new THREE.Vector3(0, 1, 0);

    if (mainDown) {
      puzzle.rotateOnWorldAxis(cameraYAxis, deltaX * mouseSpeed);
      puzzle.rotateOnWorldAxis(cameraXAxis, deltaY * mouseSpeed);
    }
    if (alternateDown) {
      const getAngle = (p1: { x: number, y: number }, p2: { x: number, y: number }) => {
        const { x: x1, y: y1 } = getCanvasCoords(p1.x, p1.y);
        const { x: x2, y: y2 } = getCanvasCoords(p2.x, p2.y);

        const a1 = Math.atan2(y1, x1);
        const a2 = Math.atan2(y2, x2);

        return a2 - a1;
      }

      puzzle.rotateOnWorldAxis(cameraZAxis, getAngle({ x: mouseX - deltaX, y: mouseY - deltaY }, { x: mouseX, y: mouseY }));
    }

    requestRender();
  }

  if (currentAnimation == null && (paused || animations.length == 0)) {
    const isJustChanged = mousedSpace != null && justChangedSpace != null && mousedSpace.side == justChangedSpace.side && mousedSpace.space == justChangedSpace.space;
    if (!isJustChanged) justChangedSpace = null;
    const prevHighlighted = highlighted.some(a => a.some(b => b));
    const shouldHighlight = mousedSpace != null && !dragging && !isJustChanged;
    if ((prevHighlighted && !shouldHighlight) // if we need to reset
      || (mousedSpace != null && !highlighted[mousedSpace.side][mousedSpace.space]) // or if we need to highlight something
    ) {
      for (let side = 0; side < 6; side++) for (let space = 0; space < DEGREE * DEGREE; space++) highlighted[side][space] = false;
      if (shouldHighlight) {
        highlighted[mousedSpace.side][mousedSpace.space] = true;
      }
      colorCubes(cubes, arrangement, cubeOrientations, highlighted);
      requestRender();
    }
    if (cursor != 'grabbing' && (highlighted.some(a => a.some(b => b)) || isJustChanged)) cursor = 'pointer';
  }

  renderer.domElement.style.cursor = cursor;
}
canvas.addEventListener('mousemove', mouseMoveHandler, false);
canvas.addEventListener('mousedown', function (evt) {
  evt.preventDefault();
  const data = updateMouseData(evt, true);
}, false);
canvas.addEventListener('mouseup', function (evt) {
  evt.preventDefault();
  const data = updateMouseData(evt, true);
  if ((data.mainClick || data.alternateClick)
    && currentAnimation == null && (paused || animations.length == 0)) {
    const mousedSpace = getMousedSpace(mouseX, mouseY);
    if (mousedSpace != null) {
      arrangement[mousedSpace.side][mousedSpace.space] = (arrangement[mousedSpace.side][mousedSpace.space] + (data.mainClick ? 1 : 5)) % 6;
      highlighted[mousedSpace.side][mousedSpace.space] = false;
      colorCubes(cubes, arrangement, cubeOrientations, highlighted);
      requestRender();
      arrangementNeedsNewSolution = true;
      justChangedSpace = mousedSpace;
    }
  }
  mouseMoveHandler(evt);
}, false);
canvas.addEventListener('contextmenu', evt => evt.preventDefault());

// we want only a keypress listener, but some keys are only triggered by keydown, so we need to emulate keypress.
let backspaceDown = false, leftDown = false, rightDown = false, upDown = false, downDown = false;
function keyPressHandler(evt: KeyboardEvent) {
  evt.preventDefault();
  if (!mainDown && !alternateDown && !dragging) {
    const solutionEle = document.getElementById('solution_text');
    if (currentAnimation == null && (paused || animations.length == 0)) {
      if (evt.key == 'Enter') {
        if (arrangementNeedsNewSolution) {
          arrangementNeedsNewSolution = false;
          animations = [];
          paused = false;

          // check if already solved
          let solved = true;
          for (let side = 0; side < 6; side++) {
            for (let space = 0; space < DEGREE * DEGREE; space++) {
              if (arrangement[side][space] != side) {
                solved = false;
                break;
              }
            }
          }
          if (solved) {
            if (solutionEle.innerHTML.includes("Solution")) swapControlsSrcWithSolution();
            solutionEle.innerHTML = "Already solved!";
          } else {
            const colorCount = [0, 0, 0, 0, 0, 0];
            for (let side = 0; side < 6; side++) {
              for (let space = 0; space < DEGREE * DEGREE; space++) {
                colorCount[arrangement[side][space]]++;
              }
            }
            let issueFound = false;
            let issueText = `Invalid Arrangement<br/>(need ${DEGREE * DEGREE} of each color)<br/><br/>Found:`;
            for (let i = 0; i < 6; i++) {
              if (colorCount[i] != DEGREE * DEGREE) {
                issueFound = true;
                issueText += `<br/>${colorCount[i]} ${Color[i]} space${colorCount[i] == 1 ? '' : 's'}`;
              }
            }
            if (issueFound) {
              Array.from(document.getElementsByClassName('solution')).forEach(element => (element as HTMLElement).style.pointerEvents = 'auto');
              if (solutionEle.innerHTML.includes("Solution")) swapControlsSrcWithSolution();
              solutionEle.innerHTML = issueText;
            } else {
              animations.push(getSolutionAnimation(true));
              animate();
            }
          }
        }
      } else if (evt.key == 'Backspace') {
        arrangementNeedsNewSolution = true;
        animations = [];
        animations.push(getShuffleAnimation(Math.floor(100 * Math.log(DEGREE) - 20), DEGREE * 25, false));
        paused = false;
        animate();
      } else if ((evt.key == 'Right' || evt.key == 'ArrowRight' || evt.key == 'Down' || evt.key == 'ArrowDown') && animations.length > 0) {
        animations.splice(1, 0, getPauseAnimation());
        paused = false;
        animate();
      } else if ((evt.key == 'Left' || evt.key == 'ArrowLeft' || evt.key == 'Up' || evt.key == 'ArrowUp')) {
        if (undoSolutionAnimations.length > 0) {
          let anim = undoSolutionAnimations.pop();
          animations.unshift(anim.undo, getPauseAnimation(), anim.redo);
          paused = false;
          animate();
        } else {
          document.getElementById("solution_top_header").scrollIntoView({ block: 'end' }); // scroll all the way down (scroll top header to bottom of view)
        }
      }
    }

    if ((evt.key == ' ' || evt.key == 'Spacebar') && animations.length > 0 && solutionEle.innerHTML.includes("Solution")) {
      paused = !paused;
      if (!paused) animate();
    }
  }
}
window.addEventListener('keypress', keyPressHandler);
window.addEventListener('keydown', (evt) => {
  if (evt.key == 'Backspace' && !backspaceDown) {
    keyPressHandler(evt);
    backspaceDown = true;
  } else if ((evt.key == 'Left' || evt.key == 'ArrowLeft') && !leftDown) {
    keyPressHandler(evt);
    leftDown = true;
  } else if ((evt.key == 'Right' || evt.key == 'ArrowRight') && !rightDown) {
    keyPressHandler(evt);
    rightDown = true;
  } else if ((evt.key == 'Up' || evt.key == 'ArrowUp') && !upDown) {
    keyPressHandler(evt);
    upDown = true;
  } else if ((evt.key == 'Down' || evt.key == 'ArrowDown') && !downDown) {
    keyPressHandler(evt);
    downDown = true;
  }
});
window.addEventListener('keyup', (evt) => {
  if (evt.key == 'Backspace') {
    backspaceDown = false;
  } else if (evt.key == 'Left' || evt.key == 'ArrowLeft') {
    leftDown = false;
  } else if (evt.key == 'Right' || evt.key == 'ArrowRight') {
    rightDown = false;
  } else if (evt.key == 'Up' || evt.key == 'ArrowUp') {
    upDown = false;
  } else if (evt.key == 'Down' || evt.key == 'ArrowDown') {
    downDown = false;
  }
});

canvas.addEventListener('wheel', function (evt) {
  if (evt.deltaY != 0) {
    const pos = new THREE.Spherical().setFromCartesianCoords(camera.position.x, camera.position.y, camera.position.z);
    pos.radius *= 1 + (evt.deltaY > 0 ? 0.05 : -0.05);
    camera.position.setFromSpherical(pos);
    requestRender();
  }
});

function animate() {
  let renderNeeded = false;
  let minDelay: number | null = null;

  if (currentAnimation == null) {
    while (animations.length > 0 && !paused) {
      currentAnimation = animations.shift();
      const setupResult = currentAnimation.setup();
      lastTick = Date.now();
      if (!setupResult.animationDone || setupResult.renderNeeded || setupResult.minDelay != null) {
        renderNeeded = setupResult.renderNeeded;
        if (setupResult.minDelay != null) minDelay = setupResult.minDelay;
        if (setupResult.animationDone) {
          currentAnimation.teardown();
          currentAnimation = null;
        }
        break;
      };

      currentAnimation.teardown();
      currentAnimation = null;
    }
  }

  if (currentAnimation != null) {
    const tickTime = Date.now();
    const tickResult = currentAnimation.tick(tickTime - lastTick);
    lastTick = tickTime;
    renderNeeded = renderNeeded || tickResult.renderNeeded;
    if (tickResult.minDelay) {
      if (minDelay == null) minDelay = tickResult.minDelay;
      else minDelay = Math.max(minDelay, tickResult.minDelay);
    }
    if (tickResult.animationDone) {
      currentAnimation.teardown();
      currentAnimation = null;
    }
  }

  const loopAnimate = () => {
    const callAnimate = () => {
      if (currentAnimation == null && paused) console.log('paused')
      else if (currentAnimation != null || animations.length > 0) animate();
      else {
        // this is the end of the script!
        console.log('Done animating.');
        paused = false;
      }
    };

    if (minDelay == null) callAnimate();
    else {
      setTimeout(callAnimate, minDelay);
    }
  };

  if (renderNeeded) {
    const renderWhenAvailable = () => {
      requestAnimationFrame(() => {
        requestRender(loopAnimate);
      });
    };

    const elapsed = Date.now() - lastFrameTime;
    if (elapsed < minFrameInterval) {
      setTimeout(renderWhenAvailable, minFrameInterval - elapsed)
    } else {
      renderWhenAvailable();
    }
  } else {
    loopAnimate();
  }
}

requestRender(() => {
  document.getElementById('sidebar').style.visibility = 'visible';
  animate();
});