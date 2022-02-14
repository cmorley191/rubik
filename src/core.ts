import * as THREE from 'three';

export enum Side {
  Right = 0,
  Left = 1,
  Up = 2,
  Down = 3,
  Front = 4,
  Back = 5
}

const sideLetters = ['R', 'L', 'U', 'D', 'F', 'B'];
export function toLetter(side: Side, upper: boolean = true) {
  return upper ? sideLetters[side] : sideLetters[side].toLowerCase();
}

export enum Axis {
  X = 0,
  Y = 1,
  Z = 2,
}

export function getUnitVector(axis: Axis) {
  switch (axis) {
    case Axis.X: return new THREE.Vector3(1, 0, 0);
    case Axis.Y: return new THREE.Vector3(0, 1, 0);
    default: return new THREE.Vector3(0, 0, 1);
  }
}
export function getSide(axis: Axis, positive: boolean): Side {
  return axis * 2 + (positive ? 0 : 1);
}
export function getAxis(side: Side): Axis {
  return Math.floor(side / 2);
}
export function isPositive(side: Side): boolean {
  return side % 2 == 0;
}

// clockwise facing positive axis
export const sideRotations: Side[/*axis*/][/*side*/] /* = resultSide */ = [
  [Side.Right, Side.Left, Side.Front, Side.Back, Side.Down, Side.Up],
  [Side.Back, Side.Front, Side.Up, Side.Down, Side.Right, Side.Left],
  [Side.Up, Side.Down, Side.Left, Side.Right, Side.Front, Side.Back],
]

export enum Color {
  White = 0,
  Yellow = 1,
  Green = 2,
  Blue = 3,
  Red = 4,
  Orange = 5,
}
export function opposite(side: Side): Side {
  return side + (((side % 2) + 1) % 2) * 2 - 1;
}
export function oppositeColor(color: Color): Color {
  // enums are lined up, just use side
  return +opposite(+color);
}
export const COLORS = [Color.White, Color.Yellow, Color.Green, Color.Blue, Color.Red, Color.Orange];
export function toShade({ color, highlighted }: { color: Color, highlighted: boolean }) {
  switch (color) {
    case Color.White: return !highlighted ? new THREE.Color(0xFFFFFF) : new THREE.Color(0xDDDDDD);
    case Color.Yellow: return !highlighted ? new THREE.Color(0xFFFF00) : new THREE.Color(0xFFD700);
    case Color.Green: return !highlighted ? new THREE.Color(0x008000) : new THREE.Color(0x32CD32);
    case Color.Blue: return !highlighted ? new THREE.Color(0x000080) : new THREE.Color(0x0000CD);
    case Color.Red: return !highlighted ? new THREE.Color(0x8B0000) : new THREE.Color(0xFF0000);
    case Color.Orange: return !highlighted ? new THREE.Color(0xFF8C00) : new THREE.Color(0xFFA500);
    default: return !highlighted ? new THREE.Color(0x404040) : new THREE.Color(0x666666);
  }
}

export interface Rotation {
  axis: Axis,
  rotateLayers: number[],
  doubleTurn: boolean,
  clockwise: boolean, // when facing in positive direction
}

export interface Orientation {
  top: Side,
  front: Side
}
export const standardOrientation = { top: Side.Up, front: Side.Front };

function isLrProper(orientation: Orientation) {
  const topAxis = getAxis(orientation.top);
  const topPos = isPositive(orientation.top);
  const frontAxis = getAxis(orientation.front);
  const frontPos = isPositive(orientation.front);
  return (frontAxis - topAxis == 1 || (topAxis == 2 && frontAxis == 0)) == (topPos == frontPos);
}
export function inspectSide(side: Side, orientation: Orientation): Side {
  switch (side) {
    case Side.Up: return orientation.top;
    case Side.Front: return orientation.front;
    case Side.Down: return opposite(orientation.top);
    case Side.Back: return opposite(orientation.front);
    default:
      const axis = (() => {
        switch (getAxis(orientation.top)) {
          case Axis.X:
            if (getAxis(orientation.front) == Axis.Y) return Axis.Z;
            else return Axis.Y;
          case Axis.Y:
            if (getAxis(orientation.front) == Axis.X) return Axis.Z;
            else return Axis.X;
          default:
            if (getAxis(orientation.front) == Axis.X) return Axis.Y;
            else return Axis.X;
        }
      })();
      return getSide(axis, (side == Side.Right) == isLrProper(orientation));
  }
}
export function locateSide(side: Side, orientation: Orientation): Side {
  if (side == orientation.top) return Side.Up;
  if (side == orientation.front) return Side.Front;
  if (side == opposite(orientation.top)) return Side.Down;
  if (side == opposite(orientation.front)) return Side.Back;
  return (isLrProper(orientation) == isPositive(side)) ? Side.Right : Side.Left;
}

export enum MoveType {
  CW, CCW, Double
}
export function reverse(type: MoveType) {
  switch (type) {
    case MoveType.CW: return MoveType.CCW;
    case MoveType.CCW: return MoveType.CW;
    default: return MoveType.Double;
  }
}

export interface Depth {
  depth: number,
  thick: boolean,
}
export interface Move {
  side: Side,
  type: MoveType,
  layer?: Depth
  orientation: Orientation
}
export function toNotation(move: Move, degree: number) {
  if ((degree != 2 && degree != 3 && degree != 4) || move.layer?.depth > 2) return "";
  const typeNotation = (move.type == MoveType.CW) ? "" : (move.type == MoveType.CCW) ? "'" : 2;
  const soloEdge = move.layer === undefined || move.layer.depth == 1;
  if (soloEdge || !move.layer.thick) {
    return toLetter(move.side, soloEdge) + typeNotation;
  } else {
    return toLetter(move.side, true) + toLetter(move.side, false) + typeNotation;
  }
}

export function transform(move: Move, orientation: Orientation): Move {
  return {
    side: locateSide(inspectSide(move.side, move.orientation), orientation),
    type: move.type,
    layer: move.layer,
    orientation: orientation,
  };
}
export function toRotation(move: Move, degree: number): Rotation {
  const standardMove = transform(move, standardOrientation);
  const layers = [];
  if (standardMove.layer === undefined || standardMove.layer.depth == 1 || !standardMove.layer.thick) layers.push(isPositive(standardMove.side) ? degree - (standardMove.layer?.depth ?? 1) : (standardMove.layer?.depth ?? 1) - 1);
  else { for (let k = 0; k < standardMove.layer.depth; k++) layers.push(isPositive(standardMove.side) ? degree - 1 - k : k); }
  return {
    axis: getAxis(standardMove.side),
    rotateLayers: layers,
    doubleTurn: standardMove.type == MoveType.Double,
    clockwise: (isLrProper(standardMove.orientation) != isPositive(standardMove.side) || move.type == MoveType.Double) ? standardMove.type == MoveType.CW : standardMove.type == MoveType.CCW,
  };
}

export interface AnimationTickResult {
  animationDone: boolean,  // indicates to stop ticking and immediately call teardown
  renderNeeded: boolean,
  minDelay?: number,  // request a specific delay before the next tick or next animation (teardown called first)
}

export interface Animation {
  setup: () => AnimationTickResult;
  tick: (elapsed: number) => AnimationTickResult;
  teardown: () => void;
}

export type Arrangement = Color[/*side*/][/*space (0-9, left-to-right and top-to-bottom*/];
export type SpacesSettings = boolean[/*side*/][/*space*/];

export function deepCopy(arr: Arrangement) {
  const copy = []
  for (let i = 0; i < 6; i++) {
    copy.push(arr[i].slice());
  }
  return copy;
}

export function getStandardSideOrientation(side: Side): Orientation {
  const top = (() => {
    switch (side) {
      case Side.Up: return Side.Back;
      case Side.Down: return Side.Front;
      default: return Side.Up;
    }
  })();
  return { top, front: side };
}

export function toOrdinal(n: number) {
  if (n >= 11 && n <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function itemList(items: string[]) {
  if (items.length == 0) return "";
  if (items.length == 1) return items[0];
  const first = [...items]
  const last = first.pop();
  return `${first.join(", ")} and ${last}`;
}

export function range(start: number, end: number) {
  const nums = [];
  for (let i = start; i <= end; i++) nums.push(i);
  return nums;
}

export function printArrangement(arr: Arrangement, degree: number) {
  const toLetter = (color: Color) => {
    switch (color) {
      case Color.White: return "W";
      case Color.Yellow: return "Y";
      case Color.Green: return "G";
      case Color.Blue: return "B";
      case Color.Red: return "R";
      default: return "O";
    }
  }

  let lineCounter = 1;
  let line = "";
  const printOutlier = (side: Side) => {
    for (let y = 0; y < degree; y++) {
      line = `${lineCounter}. `.padStart(4);
      for (let x = 0; x < degree; x++) {
        line += "  ";
      }
      line += "  "; // border
      for (let x = 0; x < degree; x++) {
        line += toLetter(arr[side][y * degree + x]) + " ";
      }
      console.log(line);
      lineCounter++;
    }
  };
  const printOutlierBorder = () => {
    line = `${lineCounter}. `.padStart(4);
    for (let x = 0; x < degree; x++) line += "  ";
    line += "   ";
    for (let x = 0; x < degree; x++) line += "- ";
    console.log(line);
    lineCounter++;
  }

  printOutlier(Side.Up);
  printOutlierBorder();
  for (let y = 0; y < degree; y++) {
    line = line = `${lineCounter}. `.padStart(4);
    [Side.Left, Side.Front, Side.Right, Side.Back].forEach(side => {
      for (let x = 0; x < degree; x++) {
        line += toLetter(arr[side][y * degree + x]) + " ";
      }
      line += "| ";
    });
    console.log(line);
    lineCounter++;
  }
  printOutlierBorder();
  printOutlier(Side.Down);
}

export function rotateArrangement(rotation: Rotation, arrangement: Arrangement, degree: number) {
  const { axis, rotateLayers, doubleTurn, clockwise } = rotation;

  const faceRotation = (side: Side, clockwise: boolean) => {
    const target = arrangement[side];

    for (let c = 0; c < Math.floor(degree / 2); c++) {
      for (let k = 0; k < degree - 2 * c - 1; k++) {
        const spaceCircle = [
          (degree * c + c) + k,
          (degree * (c + 1) - 1 - c) + (degree * k),
          (degree * (degree - c) - 1 - c) - k,
          (degree * (degree - 1 - c) + c) - (degree * k),
        ]
        if (!clockwise) spaceCircle.reverse();
        let prev = null;
        for (let i = 0; i < 5; i++) {
          let tmp = target[spaceCircle[i % 4]];
          if (i != 0) target[spaceCircle[i % 4]] = prev;
          prev = tmp;
        }
        console.log();
      }
    }
  }

  rotateLayers.forEach(iLayer => {
    // elements describing the sequences of spaces for that side. i = initial value, p = increment
    let kSpecs = []
    let clockFace: Side, clockBack: Side;
    switch (axis) {
      case Axis.X:
        kSpecs = [
          { s: Side.Up, i: iLayer, p: degree },
          { s: Side.Front, i: iLayer, p: degree },
          { s: Side.Down, i: iLayer, p: degree },
          { s: Side.Back, i: degree * degree - 1 - iLayer, p: -degree }
        ];
        clockFace = Side.Left;
        clockBack = Side.Right;
        break;

      case Axis.Y:
        kSpecs = [
          { s: Side.Front, i: (degree - iLayer - 1) * degree, p: 1 },
          { s: Side.Right, i: (degree - iLayer - 1) * degree, p: 1 },
          { s: Side.Back, i: (degree - iLayer - 1) * degree, p: 1 },
          { s: Side.Left, i: (degree - iLayer - 1) * degree, p: 1 },
        ];
        clockFace = Side.Down;
        clockBack = Side.Up;
        break;

      case Axis.Z:
        kSpecs = [
          { s: Side.Up, i: iLayer * degree, p: 1 },
          { s: Side.Left, i: degree * (degree - 1) + iLayer, p: -degree },
          { s: Side.Down, i: degree * (degree - iLayer) - 1, p: -1 },
          { s: Side.Right, i: degree - iLayer - 1, p: degree },
        ]
        clockFace = Side.Back;
        clockBack = Side.Front;
        break;
    }

    if (!clockwise) kSpecs.reverse();

    for (let t = 0; t < (doubleTurn ? 2 : 1); t++) {
      if (iLayer == 0) faceRotation(clockFace, clockwise);
      if (iLayer == degree - 1) faceRotation(clockBack, !clockwise);

      let prev = [Color.White];
      kSpecs.push(kSpecs[0]);
      for (let i = 0; i < 5; i++) {
        const target = arrangement[kSpecs[i % 4].s];
        const tmp = [];
        let k = kSpecs[i % 4].i;
        for (let j = 0; j < degree; j++) {
          tmp.push(target[k]);
          if (i != 0) target[k] = prev[j];
          k += kSpecs[i % 4].p;
        }
        prev = tmp;
      }
    }
  });
}