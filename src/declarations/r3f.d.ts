import { ReactThreeFiber } from "@react-three/fiber";
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      textGeometry: ReactThreeFiber.BufferGeometryNode<TextGeometry, typeof TextGeometry>;
    }
  }
}