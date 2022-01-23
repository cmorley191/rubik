import * as THREE from 'three';


const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 1;

const scene = new THREE.Scene();

const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);

// vertexColors must be true so vertex colors can be used in the shader

const material = new THREE.MeshBasicMaterial({ vertexColors: true });

// generate color data for each vertex

const positionAttribute = geometry.getAttribute('position');

const colors = [];
const color = new THREE.Color();

for (let i = 0; i < positionAttribute.count; i += 3) {

  color.set(Math.random() * 0xffffff);

  // define the same color for each vertex of a triangle

  colors.push(color.r, color.g, color.b);
  colors.push(color.r, color.g, color.b);
  colors.push(color.r, color.g, color.b);

}

// define the new attribute

geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);


function animate() {

  requestAnimationFrame(animate);

  mesh.rotation.x += 0.01;
  mesh.rotation.y += 0.02;

  renderer.render(scene, camera);

}

animate();