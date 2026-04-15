import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import * as THREE from "three";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "error";

const stateColors: Record<OrbState, [number, number, number]> = {
  idle: [0.0, 0.8, 1.0],
  listening: [0.0, 1.0, 0.6],
  thinking: [0.5, 0.3, 1.0],
  speaking: [0.0, 0.9, 1.0],
  error: [1.0, 0.2, 0.2],
};

function CoreOrb({ state }: { state: OrbState }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Vector3(...stateColors.idle) },
      uIntensity: { value: 0.5 },
    }),
    []
  );

  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform float uTime;
    uniform float uIntensity;
    
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      
      float displacement = sin(position.x * 4.0 + uTime * 2.0) * 
                          sin(position.y * 4.0 + uTime * 1.5) * 
                          sin(position.z * 4.0 + uTime * 1.8) * 
                          uIntensity * 0.15;
      
      vec3 newPos = position + normal * displacement;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
    }
  `;

  const fragmentShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform vec3 uColor;
    uniform float uTime;
    uniform float uIntensity;
    
    void main() {
      float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.5);
      vec3 glow = uColor * (0.6 + fresnel * 1.5);
      
      float pulse = 0.85 + sin(uTime * 2.0) * 0.15 * uIntensity;
      glow *= pulse;
      
      float inner = smoothstep(0.0, 0.6, 1.0 - fresnel) * 0.3;
      glow += uColor * inner;
      
      float alpha = fresnel * 0.9 + 0.3;
      gl_FragColor = vec4(glow, alpha);
    }
  `;

  useFrame((_, delta) => {
    if (!materialRef.current || !meshRef.current) return;
    
    materialRef.current.uniforms.uTime.value += delta;
    
    const target = stateColors[state];
    const current = materialRef.current.uniforms.uColor.value;
    current.x += (target[0] - current.x) * 3 * delta;
    current.y += (target[1] - current.y) * 3 * delta;
    current.z += (target[2] - current.z) * 3 * delta;
    
    const intensityTarget = state === "idle" ? 0.3 : state === "listening" ? 0.8 : state === "thinking" ? 1.0 : state === "speaking" ? 0.7 : 0.5;
    const u = materialRef.current.uniforms.uIntensity;
    u.value += (intensityTarget - u.value) * 3 * delta;
    
    const scaleTarget = state === "listening" ? 1.1 : state === "thinking" ? 0.95 : state === "speaking" ? 1.05 : 1.0;
    const s = meshRef.current.scale;
    s.x += (scaleTarget - s.x) * 3 * delta;
    s.y = s.x;
    s.z = s.x;
    
    meshRef.current.rotation.y += delta * (state === "thinking" ? 0.8 : 0.15);
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1.2, 12]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function ParticleRing({ state }: { state: OrbState }) {
  const ref = useRef<THREE.Points>(null);
  const count = 120;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = 1.8 + Math.random() * 0.3;
      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
      pos[i * 3 + 2] = Math.sin(angle) * r;
    }
    return pos;
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const speed = state === "thinking" ? 1.5 : state === "listening" ? 0.8 : 0.3;
    ref.current.rotation.y += delta * speed;
    ref.current.rotation.x = Math.sin(Date.now() * 0.001) * 0.1;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color={state === "error" ? "#ff4444" : "#00d4ff"}
        transparent
        opacity={0.7}
        sizeAttenuation
      />
    </points>
  );
}

function OuterRing({ state }: { state: OrbState }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.z += delta * (state === "thinking" ? 0.5 : 0.1);
  });

  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[2.0, 0.01, 8, 64]} />
      <meshBasicMaterial
        color={state === "error" ? "#ff4444" : "#00d4ff"}
        transparent
        opacity={state === "idle" ? 0.15 : 0.35}
      />
    </mesh>
  );
}

export default function JarvisOrb({ state = "idle" }: { state?: OrbState }) {
  return (
    <div className="relative w-full h-full">
      {/* Background glow */}
      <div
        className="absolute inset-0 rounded-full blur-3xl opacity-20 transition-colors duration-1000"
        style={{
          background: state === "error"
            ? "radial-gradient(circle, rgba(255,50,50,0.4) 0%, transparent 70%)"
            : state === "thinking"
            ? "radial-gradient(circle, rgba(120,60,255,0.4) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(0,212,255,0.4) 0%, transparent 70%)",
        }}
      />
      <Canvas camera={{ position: [0, 0, 4.5], fov: 50 }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.1} />
        <CoreOrb state={state} />
        <ParticleRing state={state} />
        <OuterRing state={state} />
      </Canvas>
    </div>
  );
}
