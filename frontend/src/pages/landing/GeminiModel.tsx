import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Google Gemini 4-pointed star shape.
 * Built from two intersecting diamond/rhombus shapes to form the
 * iconic Gemini sparkle logo, extruded into 3D.
 */
function createGeminiStarGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();

  // 4-pointed star with smooth curves (Gemini sparkle)
  const outerRadius = 2.2;
  const innerRadius = 0.55;
  const points = 4;

  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      // Use quadratic curves for the smooth Gemini look
      const prevAngle = ((i - 1) * Math.PI) / points - Math.PI / 2;
      const prevRadius = (i - 1) % 2 === 0 ? outerRadius : innerRadius;
      const midAngle = (prevAngle + angle) / 2;
      const cpRadius = (prevRadius + radius) * 0.38;
      const cpX = Math.cos(midAngle) * cpRadius;
      const cpY = Math.sin(midAngle) * cpRadius;
      shape.quadraticCurveTo(cpX, cpY, x, y);
    }
  }
  // Close
  const firstAngle = -Math.PI / 2;
  const lastAngle = ((points * 2 - 1) * Math.PI) / points - Math.PI / 2;
  const midAngle = (lastAngle + firstAngle + Math.PI * 2) / 2;
  const cpR = (outerRadius + innerRadius) * 0.38;
  shape.quadraticCurveTo(
    Math.cos(midAngle) * cpR,
    Math.sin(midAngle) * cpR,
    Math.cos(firstAngle) * outerRadius,
    Math.sin(firstAngle) * outerRadius
  );

  const extrudeSettings = {
    depth: 0.5,
    bevelEnabled: true,
    bevelThickness: 0.15,
    bevelSize: 0.1,
    bevelOffset: 0,
    bevelSegments: 3,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.center();
  return geo;
}

export const GeminiModel: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.LineSegments>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const starGeo = useMemo(() => createGeminiStarGeometry(), []);
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(starGeo, 20), [starGeo]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const rotY = t * 0.2;
    const rotX = Math.sin(t * 0.12) * 0.2;

    if (meshRef.current) {
      meshRef.current.rotation.y = rotY;
      meshRef.current.rotation.x = rotX;
    }
    if (wireRef.current) {
      wireRef.current.rotation.y = rotY;
      wireRef.current.rotation.x = rotX;
    }
    if (glowRef.current) {
      glowRef.current.rotation.y = rotY;
      glowRef.current.rotation.x = rotX;
      glowRef.current.scale.setScalar(1.0 + Math.sin(t * 2) * 0.03);
    }
  });

  return (
    <group>
      {/* Inner red glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.4, 32, 32]} />
        <meshBasicMaterial color="#ff1a1a" transparent opacity={0.06} />
      </mesh>

      {/* Star body */}
      <mesh ref={meshRef} geometry={starGeo}>
        <meshStandardMaterial
          color="#1a0000"
          metalness={0.95}
          roughness={0.1}
          emissive="#ff0000"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* Red wireframe edges */}
      <lineSegments ref={wireRef} geometry={edgesGeo}>
        <lineBasicMaterial color="#ff3333" transparent opacity={0.6} />
      </lineSegments>
    </group>
  );
};
