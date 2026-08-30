import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export const NeuralBackground: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const { viewport } = useThree();

  const isMobile = window.innerWidth < 768;
  const count = isMobile ? 60 : 140;
  const maxDist = isMobile ? 2.0 : 2.8;

  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 28;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 28;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 14 - 4;
      vel.push({
        x: (Math.random() - 0.5) * 0.012,
        y: (Math.random() - 0.5) * 0.012,
        z: (Math.random() - 0.5) * 0.008,
      });
    }
    return [pos, vel];
  }, [count]);

  const linesGeo = useMemo(() => new THREE.BufferGeometry(), []);

  useFrame((state) => {
    if (!pointsRef.current || !linesRef.current) return;
    const attr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;

    const mx = (state.pointer.x * viewport.width) / 2;
    const my = (state.pointer.y * viewport.height) / 2;
    const lines: number[] = [];

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      arr[i3]     += velocities[i].x;
      arr[i3 + 1] += velocities[i].y;
      arr[i3 + 2] += velocities[i].z;

      if (Math.abs(arr[i3])     > 14) velocities[i].x *= -1;
      if (Math.abs(arr[i3 + 1]) > 14) velocities[i].y *= -1;
      if (Math.abs(arr[i3 + 2]) > 10) velocities[i].z *= -1;

      if (!isMobile) {
        const dx = mx - arr[i3];
        const dy = my - arr[i3 + 1];
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < 5) { arr[i3] += dx * 0.006; arr[i3 + 1] += dy * 0.006; }
      }

      for (let j = i + 1; j < count; j++) {
        const j3 = j * 3;
        const dx = arr[i3] - arr[j3];
        const dy = arr[i3+1] - arr[j3+1];
        const dz = arr[i3+2] - arr[j3+2];
        if (Math.sqrt(dx*dx + dy*dy + dz*dz) < maxDist) {
          lines.push(arr[i3], arr[i3+1], arr[i3+2], arr[j3], arr[j3+1], arr[j3+2]);
        }
      }
    }
    attr.needsUpdate = true;
    linesGeo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  });

  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.04} color="#ffffff" transparent opacity={0.35} sizeAttenuation />
      </points>
      <lineSegments ref={linesRef} geometry={linesGeo}>
        <lineBasicMaterial color="#ff2222" transparent opacity={0.1} blending={THREE.AdditiveBlending} />
      </lineSegments>
    </group>
  );
};
