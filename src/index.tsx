import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import * as helveticaJson from 'three/examples/fonts/helvetiker_regular.typeface.json';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from './components/app';

import * as Solution from './solution';
import { Side, Axis, getUnitVector, Color, COLORS, toShade, Rotation, AnimationTickResult, Animation, Arrangement, printArrangement, rotateArrangement, Move, getAxis, toRotation, MoveType, toNotation, standardOrientation, transform, toLetter, SpacesSettings, Orientation, inspectSide, locateSide, deepCopy, range } from './core';

const DEGREE = (() => { // 3x3? 4x4? nxn?
  const defaultDegree = 3;
  const res = new URLSearchParams(window.location.search).get('s');
  if (res == null) return defaultDegree;
  const parsed = parseInt(res);
  if (parsed == NaN || parsed < 1) return defaultDegree;
  return parsed;
})();

ReactDOM.render((<App degree={DEGREE} />), document.getElementById('root'));
