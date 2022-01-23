import * as THREE from 'three';
import * as Solution from './solution';
import { Side, Axis, getUnitVector, Color, COLORS, toShade, Rotation, AnimationTickResult, Animation, Arrangement, printArrangement, rotateArrangement, Move, getAxis, toRotation, MoveType, toNotation, standardOrientation, transform } from './core';


const GRAY = new THREE.Color(.25, .25, .25);
const BLACK = new THREE.Color(0, 0, 0);

const DEGREE = 4; // 3x3? 4x4? nxn?

const cubeRadius = 0.4;
const maxFPS = 1000;
const minFrameInterval = 1 / maxFPS * 1000;


function buildCube(colors: THREE.Color[]) {
  const geometry = new THREE.BoxGeometry(cubeRadius, cubeRadius, cubeRadius).toNonIndexed();
  const colorValues = [];
  const colorsPerFace = 6; // 3 vertices per triangle, 2 triangles per face
  for (let i = 0; i < 6; i++) {
    const color = colors[i];
    for (let j = 0; j < colorsPerFace; j++) colorValues.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorValues, 3));

  const material = new THREE.MeshBasicMaterial({ vertexColors: true });
  const cube = new THREE.Mesh(geometry, material);
  const geo = new THREE.EdgesGeometry(cube.geometry);
  const mat = new THREE.LineBasicMaterial({ color: BLACK, linewidth: 1 });
  const wireframe = new THREE.LineSegments(geo, mat);
  wireframe.renderOrder = 1; // make sure wireframes are rendered 2nd
  cube.add(wireframe);
  return cube
}

function buildCubes(arr: Arrangement): THREE.Mesh[/*x*/][/*y*/][/*z*/] {
  const cubes: THREE.Mesh[][][] = [];
  for (let x = 0; x < DEGREE; x++) {
    const layer = [];
    for (let y = 0; y < DEGREE; y++) layer.push([]);
    cubes.push(layer);
  }

  for (let z = 0; z < DEGREE; z++) {
    for (let y = 0; y < DEGREE; y++) {
      for (let x = 0; x < DEGREE; x++) {
        const colors: THREE.Color[] = [];

        if (x == DEGREE - 1) colors.push(toShade(arr[Side.Right][(DEGREE - y) * DEGREE - 1 - z]))
        else colors.push(GRAY);

        if (x == 0) colors.push(toShade(arr[Side.Left][(DEGREE - 1 - y) * DEGREE + z]))
        else colors.push(GRAY);

        if (y == DEGREE - 1) colors.push(toShade(arr[Side.Up][z * DEGREE + x]))
        else colors.push(GRAY);

        if (y == 0) colors.push(toShade(arr[Side.Down][(DEGREE - 1 - z) * DEGREE + x]))
        else colors.push(GRAY);

        if (z == DEGREE - 1) colors.push(toShade(arr[Side.Front][(DEGREE - 1 - y) * DEGREE + x]))
        else colors.push(GRAY);

        if (z == 0) colors.push(toShade(arr[Side.Back][(DEGREE - y) * DEGREE - 1 - x]))
        else colors.push(GRAY);

        const cube = buildCube(colors);

        const position = new THREE.Vector3(x, y, z).addScalar(-(DEGREE - 1) / 2).multiplyScalar(cubeRadius);
        cube.position.set(position.x, position.y, position.z);

        cubes[x][y][z] = cube;
      }
    }
  }
  return cubes;
}


const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const cameraRotationalAngle = -20; // facing rotation around y-axis (clockwise)
const cameraPolarAngle = -15; // facing rotation around x-axis
const cameraRadius = 4 + (cubeRadius * DEGREE);
const cameraPosition = new THREE.Spherical(cameraRadius, (90 + cameraPolarAngle) * Math.PI / 180, -cameraRotationalAngle * Math.PI / 180);
camera.position.setFromSpherical(cameraPosition);
camera.rotation.x = -(Math.PI / 2 - cameraPosition.phi);
camera.rotation.y = cameraPosition.theta;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth - 100, window.innerHeight - 100);
let canvas = renderer.domElement;
document.body.appendChild(canvas);


const arrangement: Arrangement = []
for (let side = 0; side < 6; side++) {
  const colors = [];
  for (let space = 0; space < DEGREE * DEGREE; space++) colors.push(COLORS[side]);
  arrangement.push(colors);
}
printArrangement(arrangement, DEGREE);

const cubes = buildCubes(arrangement);
const puzzle = new THREE.Group();
scene.add(puzzle);
for (let i = 0; i < DEGREE; i++) for (let j = 0; j < DEGREE; j++) for (let k = 0; k < DEGREE; k++) puzzle.add(cubes[i][j][k])

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

  //console.log(`axis: ${axis}, layer: ${rotateLayers.join('+')}, double: ${doubleTurn}, clockwise: ${clockwise}, speed: ${speed}`);

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

          // rotate the layer in the cubes 3d array
          for (let c = 0; c < Math.floor(DEGREE / 2); c++) {  // the "layers of the layer" -- the concentric "squares" that make up a layer 
            for (let k = 0; k < DEGREE - 2 * c - 1; k++) {  // the indices along an edge (-1 avoids double-counting corners)
              const coordinateCircle = [  // rotation of cubes is done in groups of 4
                { i: c, j: c + k },
                { i: c + k, j: DEGREE - 1 - c },
                { i: DEGREE - 1 - c, j: DEGREE - 1 - k - c },
                { i: DEGREE - 1 - k - c, j: c }
              ]
              if (!clockwise) coordinateCircle.reverse();

              let prev = null;
              for (let t = 0; t < (doubleTurn ? 2 : 1); t++) {  // the turn
                for (let iCC = 0; iCC < 5; iCC++) {
                  //const srcCC = coordinateCircle[(iCC + 3) % 4];
                  const cc = coordinateCircle[iCC % 4];

                  switch (axis) {
                    case Axis.X: {
                      //if (iCC != 0) console.log(`Moving (${iLayer}, ${srcCC.j}, ${srcCC.i}) to (${iLayer}, ${cc.j}, ${cc.i})`);
                      const tmp = cubes[iLayer][cc.j][cc.i];
                      if (iCC != 0) cubes[iLayer][cc.j][cc.i] = prev;
                      prev = tmp;
                      break;
                    }
                    case Axis.Y: {
                      //if (iCC != 0) console.log(`Moving (${srcCC.i}, ${iLayer}, ${srcCC.j}) to (${cc.i}, ${iLayer}, ${cc.j})`)
                      const tmp = cubes[cc.i][iLayer][cc.j];
                      if (iCC != 0) cubes[cc.i][iLayer][cc.j] = prev;
                      prev = tmp;
                      break;
                    }
                    default: {
                      //if (iCC != 0) console.log(`Moving (${srcCC.j}, ${srcCC.i}, ${iLayer}) to (${cc.j}, ${cc.i}, ${iLayer})`)
                      const tmp = cubes[cc.j][cc.i][iLayer]
                      if (iCC != 0) cubes[cc.j][cc.i][iLayer] = prev;
                      prev = tmp;
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

const animations: Animation[] = [];

function getSolutionAnimation(followup: Animation | null = null): Animation {
  return {
    setup() {
      printArrangement(arrangement, DEGREE);
      console.log('solution:');
      const moveGen = Solution.solve(arrangement, DEGREE);
      while (true) {
        const nextMove = moveGen.next();
        if (nextMove.done == true) break;
        const moveString = toNotation(transform(nextMove.value, standardOrientation), DEGREE);
        console.log(moveString);
        animations.push(
          extendAnimation(
            getRotateAnimation({
              rotation: toRotation(nextMove.value, DEGREE),
              speed: 10,
            }),
            () => { console.log(moveString); }));
      }
      animations.push(extendAnimation(getDelayAnimation(2000), () => { console.log('Solved!') }));
      //if (followup != null) animations.push(followup);
      console.log('solution queued up');

      return { animationDone: true, renderNeeded: false, minDelay: 3000 };
    },
    tick() { return { animationDone: true, renderNeeded: false } },
    teardown() { },
  }
}

let lastShuffleMove: Move | null = null;
let lastShuffleRotation: Rotation | null = null;
function getShuffleAnimation(count: number, speed: number = undefined, delay: number = undefined, firstInstance: boolean = true, originalCount: number = 0): Animation {
  //const skipMiddle = (iLayer: number) => (iLayer < Math.floor(DEGREE / 2)) ? iLayer : iLayer + 1;

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
        if (firstInstance) console.log('shuffling');
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

        const spec = { rotation: toRotation(move, DEGREE), speed };
        animations.push(extendAnimation(getRotateAnimation(spec), () => { console.log(toNotation(move, DEGREE)); }));
        lastShuffleMove = move;
        lastShuffleRotation = spec.rotation;

        animations.push(getShuffleAnimation(count - 1, speed, delay, false, Math.max(count, originalCount)));
      }

      return { animationDone: true, renderNeeded: false, minDelay: (firstInstance) ? 1000 : delay };
    },

    tick(_) {
      // should never be called.
      return { animationDone: true, renderNeeded: false }
    },

    teardown() {
      if (count <= 0) {
        animations.push(getSolutionAnimation(getShuffleAnimation(Math.max(count, originalCount), speed, delay, true)));
        console.log('shuffled!');
      }
    }
  }
}



animations.push(getShuffleAnimation(100, 60));
//animations.push(getShuffleAnimation(500, 50 * (DEGREE - 1), 9));

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
function render() { renderer.render(scene, camera); frameCount++; lastFrameTime = Date.now(); }
function loopFps() {
  const now = Date.now();
  const elapsed = now - lastFpsCheck;
  console.log(`fps: ${Math.floor(frameCount * 10000 / elapsed)}`);
  lastFpsCheck = now;
  frameCount = 0;
}
setInterval(loopFps, 10000);

let mainDown = false, alternateDown = false, mouseX = 0, mouseY = 0;
const mouseSpeed = 6 / 500; // radians per pixel
canvas.addEventListener('mousedown', function (evt) {
  evt.preventDefault();
  if (evt.button == 0) mainDown = true;
  if (evt.button == 1) alternateDown = true;
  mouseX = evt.clientX;
  mouseY = evt.clientY;
}, false);
canvas.addEventListener('mouseup', function (evt) {
  evt.preventDefault();
  if (evt.button == 0) mainDown = false;
  if (evt.button == 1) alternateDown = false;
}, false);
canvas.addEventListener('mousemove', function (evt) {
  if (!mainDown && !alternateDown) { return } // is the button pressed?
  evt.preventDefault();
  const deltaX = evt.clientX - mouseX;
  const deltaY = evt.clientY - mouseY;

  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection).normalize();
  const cameraXAxis = new THREE.Vector3(-cameraDirection.z, cameraDirection.y, cameraDirection.x);
  const cameraYAxis = new THREE.Vector3(cameraDirection.x, -cameraDirection.z, cameraDirection.y);

  if (mainDown) {
    puzzle.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), deltaX * mouseSpeed);
    puzzle.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), deltaY * mouseSpeed);
  }
  if (alternateDown) {
    puzzle.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), deltaX * mouseSpeed);
  }

  requestAnimationFrame(() => {
    render();
  });

  mouseX = evt.clientX;
  mouseY = evt.clientY;
}, false);



let currentAnimation: Animation | null = null;
let lastTick = Date.now();
function animate() {
  let renderNeeded = false;
  let minDelay: number | null = null;

  if (currentAnimation == null) {
    while (animations.length > 0) {
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
      if (currentAnimation != null || animations.length > 0) animate();
      else {
        // this is the end of the script!
        console.log('Done animating.');
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
        render();
        loopAnimate();
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

render()
animate();