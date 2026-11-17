'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  CheckCircle2,
  Compass,
  GitBranch,
  Infinity as InfinityIcon,
  Layers,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useTelemetryStream } from '../../hooks/useTelemetryStream';

export type TemporalHorizon = 'PAST_ARCHIVE' | 'PRESENT_EXECUTION' | 'FUTURE_PREEMPTIVE';

export interface UnifiedEngineNode {
  engineId: string;
  name: string;
  subsystem: string;
  timelineAnchor: TemporalHorizon;
  coherenceScore: number;
  residualLatencyNs: number;
  entropyDissolvedPct: number;
  stateDigest: string;
  status: 'SINGULARITY_LOCKED' | 'CONVERGING';
}

export interface OmnitemporalTimelineStream {
  streamId: string;
  cycleEpoch: number;
  globalCoherenceIndex: number;
  dissolvedLatencyMs: number;
  entropyIndex: number;
  zeroDefectActive: boolean;
  eternalStateHash: string;
  horizons: {
    pastRootHash: string;
    presentRootHash: string;
    futureRootHash: string;
  };
  convergedEnginesCount: number;
  totalIntegratedEngines: number;
  engines: UnifiedEngineNode[];
  timestamp: number;
}

export interface ConvergenceEvent {
  eventId: string;
  triggerVector: string;
  timelineSpanYears: number;
  dissolvedLatencyMs: number;
  entropyBefore: number;
  entropyAfter: number;
  convergedEnginesCount: number;
  akashaProofHash: string;
  status: 'ETERNAL_HARMONY';
  timestamp: number;
}

export interface ConvergenceFieldDimension {
  id: string;
  label: string;
  horizon: TemporalHorizon;
  phaseRad: number;
  amplitude: number;
  frequencyHz: number;
  coherence: number;
}

interface AkashaStudioProps {
  canManageInfra?: boolean;
  canViewLogs?: boolean;
}

const _vec3 = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

const HOLOGRAPHIC_AURA_VERTEX = /* glsl */ `
  varying vec3 vNormalDir;
  varying vec3 vViewDir;
  varying vec3 vLocalPos;
  uniform float uTime;

  void main() {
    vLocalPos = position;
    float ripple = sin(position.y * 4.5 + uTime * 2.1) * cos(position.x * 3.8 - uTime * 1.4) * 0.035;
    vec3 displaced = position + normal * ripple;
    vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
    vNormalDir = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const HOLOGRAPHIC_AURA_FRAGMENT = /* glsl */ `
  varying vec3 vNormalDir;
  varying vec3 vViewDir;
  varying vec3 vLocalPos;
  uniform float uTime;
  uniform float uCoherence;
  uniform vec3 uPrimaryColor;
  uniform vec3 uAccentColor;

  void main() {
    float fresnel = pow(1.0 - max(dot(normalize(vNormalDir), normalize(vViewDir)), 0.0), 2.4);
    float band = 0.5 + 0.5 * sin(vLocalPos.y * 12.0 - uTime * 3.2);
    vec3 col = mix(uPrimaryColor, uAccentColor, band * 0.65 + fresnel * 0.35);
    float alpha = clamp((0.18 + fresnel * 0.72) * uCoherence, 0.0, 0.85);
    gl_FragColor = vec4(col * (1.1 + fresnel * 0.5), alpha);
  }
`;

const FIELD_PARTICLE_VERTEX = /* glsl */ `
  attribute float aPhase;
  attribute vec3 aTint;
  varying vec3 vTint;
  varying float vPulse;
  uniform float uTime;
  uniform float uPixelRatio;

  void main() {
    vTint = aTint;
    vec3 pos = position;
    float orbit = uTime * 0.25 + aPhase;
    pos.y += sin(orbit * 1.7 + pos.x * 0.6) * 0.14;
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vPulse = 0.65 + 0.35 * sin(uTime * 2.4 + aPhase * 3.0);
    gl_PointSize = clamp((18.0 * uPixelRatio) / max(-mvPosition.z, 1.0), 2.0, 9.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FIELD_PARTICLE_FRAGMENT = /* glsl */ `
  varying vec3 vTint;
  varying float vPulse;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;
    float falloff = smoothstep(0.5, 0.05, dist);
    gl_FragColor = vec4(vTint * (1.15 * vPulse), falloff * 0.82);
  }
`;

export const AkashaStudio: React.FC<AkashaStudioProps> = ({
  canManageInfra = true,
  canViewLogs = true,
}) => {
  const [unifiedState, setUnifiedState] = useState<OmnitemporalTimelineStream | null>(null);
  const [fieldDimensions, setFieldDimensions] = useState<ConvergenceFieldDimension[]>([]);
  const [history, setHistory] = useState<ConvergenceEvent[]>([]);
  const [horizonFilter, setHorizonFilter] = useState<'ALL' | TemporalHorizon>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [triggerVector, setTriggerVector] = useState('OMNITEMPORAL_HARMONIC_COLLAPSE');
  const [timelineSpanYears, setTimelineSpanYears] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const [cameraPreset, setCameraPreset] = useState<'orbit' | 'polar' | 'horizon'>('orbit');
  const [isOrbiting, setIsOrbiting] = useState(true);
  const [webglAvailable, setWebglAvailable] = useState(true);
  const [renderModeLabel, setRenderModeLabel] = useState<'WebGL2 Post-FX' | 'WebGL2 Adaptive' | '2D Manifold'>('WebGL2 Post-FX');

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraPresetRef = useRef<'orbit' | 'polar' | 'horizon'>('orbit');
  const isOrbitingRef = useRef<boolean>(true);
  const dimensionsCountRef = useRef<number>(16);
  const coherenceRef = useRef<number>(0.9997);

  const telemetryStream = useTelemetryStream({
    enabled: typeof process === 'undefined' || process.env.NODE_ENV !== 'test',
    onEvent: (ev) => {
      if (ev.type === 'akasha_converged' && ev.payload && typeof ev.payload === 'object') {
        const payload = ev.payload as { state?: OmnitemporalTimelineStream; event?: ConvergenceEvent };
        if (payload.state) setUnifiedState(payload.state);
        if (payload.event) {
          setHistory((prev) => [payload.event!, ...prev.filter((h) => h.eventId !== payload.event!.eventId)].slice(0, 30));
        }
      }
    },
  });

  useEffect(() => {
    cameraPresetRef.current = cameraPreset;
  }, [cameraPreset]);

  useEffect(() => {
    isOrbitingRef.current = isOrbiting;
  }, [isOrbiting]);

  useEffect(() => {
    dimensionsCountRef.current = fieldDimensions.length || 16;
  }, [fieldDimensions.length]);

  useEffect(() => {
    if (unifiedState?.globalCoherenceIndex) {
      coherenceRef.current = unifiedState.globalCoherenceIndex;
    }
  }, [unifiedState?.globalCoherenceIndex]);

  const fetchAllData = useCallback(async () => {
    try {
      const [stateRes, fieldRes, historyRes] = await Promise.all([
        fetch('/api/v1/swarm/akasha/state').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/v1/swarm/akasha/field').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/v1/swarm/akasha/history').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      if (stateRes) setUnifiedState(stateRes);
      if (fieldRes?.dimensions) setFieldDimensions(fieldRes.dimensions);
      if (historyRes?.history) setHistory(historyRes.history);
    } catch (err) {
      console.error('Failed to load Akasha-Omega omnitemporal state', err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (active) {
        await fetchAllData();
      }
    };
    void run();

    const interval = setInterval(() => {
      if (active) {
        void fetchAllData();
      }
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [fetchAllData]);

  // Isolated Three.js WebGL Omnitemporal Convergence Visualizer with GLSL Shaders & Post-Processing
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const probeCanvas = document.createElement('canvas');
    let probeGl: WebGL2RenderingContext | null = null;
    try {
      probeGl = probeCanvas.getContext('webgl2');
    } catch {
      probeGl = null;
    }

    if (!probeGl) {
      const timer = setTimeout(() => {
        setWebglAvailable(false);
        setRenderModeLabel('2D Manifold');
      }, 0);
      return () => clearTimeout(timer);
    }

    const ext = probeGl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probeGl.RENDERER;
    const gpuName = String(probeGl.getParameter(param) || '');
    probeGl.getExtension('WEBGL_lose_context')?.loseContext();
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpuName);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      const timer = setTimeout(() => {
        setWebglAvailable(false);
        setRenderModeLabel('2D Manifold');
      }, 0);
      return () => clearTimeout(timer);
    }

    const pixelRatio = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const width = mount.clientWidth || 880;
    const height = mount.clientHeight || 360;
    renderer.setSize(width, height);
    renderer.setPixelRatio(pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    mount.appendChild(renderer.domElement);

    const modeTimer = setTimeout(() => {
      setRenderModeLabel(isSoftwareGl ? 'WebGL2 Adaptive' : 'WebGL2 Post-FX');
    }, 0);

    const scene = new THREE.Scene();
    const isDarkTheme = () => document.documentElement.classList.contains('dark');
    const applyThemeColors = () => {
      const dark = isDarkTheme();
      const bgHex = dark ? 0x09090b : 0xf1f5f9;
      scene.background = new THREE.Color(bgHex);
      scene.fog = new THREE.FogExp2(bgHex, dark ? 0.042 : 0.028);
    };
    applyThemeColors();

    const themeObserver = new MutationObserver(applyThemeColors);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
    camera.position.set(0, 3.2, 8.5);
    camera.lookAt(0, 0, 0);

    // 3-point balanced lighting rig
    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.9);
    keyLight.position.set(5, 8, 6);
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0x6366f1, 0x0f172a, 0.95);
    scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(0x22d3ee, 1.25);
    rimLight.position.set(-6, -3, -5);
    scene.add(rimLight);

    // Composite Procedural Akasha Singularity Assembly
    const assemblyGroup = new THREE.Group();
    scene.add(assemblyGroup);

    const coreGeo = new THREE.IcosahedronGeometry(1.12, 2);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x4f46e5,
      metalness: 0.88,
      roughness: 0.15,
      clearcoat: 1.0,
      emissive: 0x1e1b4b,
      emissiveIntensity: 0.5,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    assemblyGroup.add(coreMesh);

    // Custom GLSL Fresnel Holographic Field Shell
    const auraGeo = new THREE.SphereGeometry(1.42, 48, 48);
    const auraMat = new THREE.ShaderMaterial({
      vertexShader: HOLOGRAPHIC_AURA_VERTEX,
      fragmentShader: HOLOGRAPHIC_AURA_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uCoherence: { value: 0.9997 },
        uPrimaryColor: { value: new THREE.Color(0x6366f1) },
        uAccentColor: { value: new THREE.Color(0x22d3ee) },
      },
    });
    const auraMesh = new THREE.Mesh(auraGeo, auraMat);
    assemblyGroup.add(auraMesh);

    const cageGeo = new THREE.OctahedronGeometry(1.62, 0);
    const cageMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      metalness: 0.65,
      roughness: 0.35,
      wireframe: true,
    });
    const cageMesh = new THREE.Mesh(cageGeo, cageMat);
    assemblyGroup.add(cageMesh);

    // Three temporal horizon orbital rings
    const ringConfigs = [
      { radius: 2.35, tube: 0.032, color: 0xf59e0b, rotX: Math.PI / 3, rotZ: 0.25 },
      { radius: 3.15, tube: 0.036, color: 0x6366f1, rotX: -Math.PI / 4, rotZ: -0.35 },
      { radius: 3.95, tube: 0.032, color: 0x10b981, rotX: Math.PI / 2.2, rotZ: 0.55 },
    ];
    const rings: THREE.Mesh[] = [];
    const disposableGeos: THREE.BufferGeometry[] = [coreGeo, auraGeo, cageGeo];
    const disposableMats: THREE.Material[] = [coreMat, auraMat, cageMat];

    ringConfigs.forEach((cfg) => {
      const geo = new THREE.TorusGeometry(cfg.radius, cfg.tube, 16, 96);
      const mat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        metalness: 0.92,
        roughness: 0.18,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.set(cfg.rotX, 0, cfg.rotZ);
      assemblyGroup.add(ring);
      rings.push(ring);
      disposableGeos.push(geo);
      disposableMats.push(mat);
    });

    // Catmull-Rom timeline convergence streams
    const streamCurves = [
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-4.2, -1.4, -1.8),
        new THREE.Vector3(-1.8, 0.8, 0.9),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(2.1, -0.7, -0.8),
        new THREE.Vector3(4.2, 1.4, 1.8),
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-3.8, 1.5, 1.6),
        new THREE.Vector3(-1.5, -0.6, -0.9),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1.6, 0.7, 0.9),
        new THREE.Vector3(3.8, -1.5, -1.6),
      ]),
    ];

    streamCurves.forEach((curve, idx) => {
      const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.025, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: idx === 0 ? 0x38bdf8 : 0x34d399,
        metalness: 0.55,
        roughness: 0.3,
      });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      assemblyGroup.add(tube);
      disposableGeos.push(tubeGeo);
      disposableMats.push(tubeMat);
    });

    // InstancedMesh for 48 synchronized manifold nodes across 3 horizons
    const nodeCount = 48;
    const nodeGeo = new THREE.SphereGeometry(0.085, 12, 12);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.75,
      roughness: 0.22,
    });
    const instancedNodes = new THREE.InstancedMesh(nodeGeo, nodeMat, nodeCount);
    instancedNodes.frustumCulled = false;

    const palette = [0xf59e0b, 0x6366f1, 0x10b981];
    for (let i = 0; i < nodeCount; i++) {
      const horizonIdx = i % 3;
      const radius = ringConfigs[horizonIdx].radius;
      const angle = (i / nodeCount) * Math.PI * 2;
      _vec3.set(
        Math.cos(angle) * radius,
        Math.sin(angle * 2) * 0.45,
        Math.sin(angle) * radius
      );
      _quat.identity();
      const s = 0.85 + (i % 4) * 0.12;
      _scale.set(s, s, s);
      _mat4.compose(_vec3, _quat, _scale);
      instancedNodes.setMatrixAt(i, _mat4);
      _color.setHex(palette[horizonIdx]);
      instancedNodes.setColorAt(i, _color);
    }
    instancedNodes.instanceMatrix.needsUpdate = true;
    if (instancedNodes.instanceColor) instancedNodes.instanceColor.needsUpdate = true;
    instancedNodes.computeBoundingSphere();
    assemblyGroup.add(instancedNodes);
    disposableGeos.push(nodeGeo);
    disposableMats.push(nodeMat);

    // Volumetric Harmonic Particle Cloud via Custom GLSL Points Shader
    const particleCount = 180;
    const positions = new Float32Array(particleCount * 3);
    const phases = new Float32Array(particleCount);
    const tints = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const r = 2.0 + (i % 7) * 0.45;
      const theta = (i / particleCount) * Math.PI * 2 * 3;
      const phi = Math.sin(i * 0.47) * 0.9;
      positions[i * 3] = Math.cos(theta) * Math.cos(phi) * r;
      positions[i * 3 + 1] = Math.sin(phi) * r * 0.65;
      positions[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * r;
      phases[i] = i * 0.37;
      _color.setHex(palette[i % 3]);
      tints[i * 3] = _color.r;
      tints[i * 3 + 1] = _color.g;
      tints[i * 3 + 2] = _color.b;
    }
    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pointsGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    pointsGeo.setAttribute('aTint', new THREE.BufferAttribute(tints, 3));
    const pointsMat = new THREE.ShaderMaterial({
      vertexShader: FIELD_PARTICLE_VERTEX,
      fragmentShader: FIELD_PARTICLE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: pixelRatio },
      },
    });
    const particleCloud = new THREE.Points(pointsGeo, pointsMat);
    assemblyGroup.add(particleCloud);
    disposableGeos.push(pointsGeo);
    disposableMats.push(pointsMat);

    // GPU Post-Processing (UnrealBloomPass + BokehPass DOF) strictly gated behind !isSoftwareGl
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    let bokehPass: BokehPass | null = null;
    if (!isSoftwareGl) {
      try {
        composer = new EffectComposer(renderer);
        composer.setSize(width, height);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.38, 0.55, 0.72);
        composer.addPass(bloomPass);

        bokehPass = new BokehPass(scene, camera, {
          focus: 8.6,
          aperture: 0.00018,
          maxblur: 0.004,
        });
        composer.addPass(bokehPass);
      } catch {
        composer?.dispose();
        composer = null;
      }
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      auraMat.uniforms.uTime.value = elapsed;
      auraMat.uniforms.uCoherence.value = coherenceRef.current;
      pointsMat.uniforms.uTime.value = elapsed;

      if (isOrbitingRef.current) {
        coreMesh.rotation.y += delta * 0.45;
        coreMesh.rotation.x += delta * 0.2;
        cageMesh.rotation.y -= delta * 0.35;
        rings.forEach((ring, idx) => {
          ring.rotation.y += delta * (0.28 + idx * 0.14);
        });
        instancedNodes.rotation.y = elapsed * 0.18;
        particleCloud.rotation.y = -elapsed * 0.08;
      }

      const preset = cameraPresetRef.current;
      const targetX = preset === 'polar' ? 0.01 : preset === 'horizon' ? 7.8 : 0;
      const targetY = preset === 'polar' ? 8.6 : preset === 'horizon' ? 0.4 : 3.2;
      const targetZ = preset === 'polar' ? 0.8 : preset === 'horizon' ? 3.8 : 8.5;

      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 4.5, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 4.5, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 4.5, delta);
      camera.lookAt(0, 0, 0);

      if (composer && !isSoftwareGl) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    const handleResize = () => {
      if (!mount || disposed) return;
      const w = mount.clientWidth || 880;
      const h = mount.clientHeight || 360;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer?.setSize(w, h);
      bloomPass?.resolution.set(w, h);
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(mount);

    return () => {
      disposed = true;
      clearTimeout(modeTimer);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
      themeObserver.disconnect();
      bloomPass?.dispose();
      bokehPass?.dispose();
      composer?.dispose();
      envTarget.dispose();
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Auto-adaptive 2D Canvas Harmonic Manifold Fallback for headless/low-power WebGL-less devices
  useEffect(() => {
    if (webglAvailable) return;
    const canvas = fallbackCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let phase = 0;

    const draw = () => {
      const w = (canvas.width = canvas.clientWidth || 880);
      const h = (canvas.height = canvas.clientHeight || 360);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const colors = ['#f59e0b', '#6366f1', '#10b981'];

      if (isOrbitingRef.current) {
        phase += 0.018;
      }

      for (let rIdx = 0; rIdx < 3; rIdx++) {
        const rx = 95 + rIdx * 48;
        const ry = rx * (cameraPresetRef.current === 'polar' ? 0.88 : cameraPresetRef.current === 'horizon' ? 0.28 : 0.52);
        ctx.beginPath();
        ctx.strokeStyle = colors[rIdx];
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1.6;
        ctx.ellipse(cx, cy, rx, ry, (rIdx - 1) * 0.25, 0, Math.PI * 2);
        ctx.stroke();

        const perRing = Math.max(4, Math.floor(dimensionsCountRef.current / 3));
        for (let n = 0; n < perRing; n++) {
          const angle = phase * (rIdx % 2 === 0 ? 1 : -0.8) + (n / perRing) * Math.PI * 2;
          const x = cx + Math.cos(angle) * rx;
          const y = cy + Math.sin(angle) * ry;
          ctx.beginPath();
          ctx.globalAlpha = 0.92;
          ctx.fillStyle = colors[rIdx];
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fill();

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [webglAvailable]);

  const handleConvergeTimelines = async () => {
    if (!canManageInfra) return;
    setLoading(true);
    const previousState = unifiedState;

    try {
      await telemetryStream.dispatchOptimisticAction({
        label: 'Omnitemporal Convergence',
        applyOptimistic: () => {
          if (unifiedState) {
            setUnifiedState({
              ...unifiedState,
              cycleEpoch: unifiedState.cycleEpoch + 1,
              dissolvedLatencyMs: Number((unifiedState.dissolvedLatencyMs + 5.1).toFixed(2)),
              entropyIndex: 0,
            });
          }
        },
        execute: async () => {
          const res = await fetch('/api/v1/swarm/akasha/converge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              triggerVector,
              timelineSpanYears,
            }),
          });
          if (!res.ok) {
            throw new Error(`HTTP_${res.status}`);
          }
          const data = await res.json();
          if (data.event) {
            setActionBanner(
              `Omnitemporal convergence ${data.event.eventId} dissolved ${data.event.dissolvedLatencyMs} ms latency across ${data.event.convergedEnginesCount}/16 engines (entropy -> ${data.event.entropyAfter}).`
            );
            if (data.state) {
              setUnifiedState(data.state);
            }
            await fetchAllData();
          }
          return data;
        },
        rollback: () => {
          if (previousState) setUnifiedState(previousState);
        },
      });
    } catch {
      setActionBanner('Failed to execute omnitemporal convergence.');
    } finally {
      setLoading(false);
    }
  };

  const filteredEngines = useMemo(() => {
    const list = unifiedState?.engines || [];
    return list.filter((engine) => {
      const matchesHorizon = horizonFilter === 'ALL' || engine.timelineAnchor === horizonFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        engine.name.toLowerCase().includes(q) ||
        engine.subsystem.toLowerCase().includes(q) ||
        engine.engineId.toLowerCase().includes(q);
      return matchesHorizon && matchesQuery;
    });
  }, [unifiedState?.engines, horizonFilter, searchQuery]);

  if (!canViewLogs) {
    return (
      <div className="glass-card rounded-2xl border border-rose-500/40 p-8 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-semibold text-[var(--text-main)]">
          Akasha-Omega Studio Access Restricted
        </h2>
        <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
          Current RBAC policy lacks <code className="font-mono text-indigo-500 dark:text-indigo-400">canViewLogs</code> permission to inspect omnitemporal state streams.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[var(--text-main)]">
      {/* Studio Header */}
      <div className="glass-card chromatic-rim rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-500 dark:text-indigo-400 shrink-0">
            <InfinityIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg font-semibold tracking-tight text-[var(--text-main)]">
                Omnitemporal Consciousness Studio
              </h1>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                <Radio className="h-3 w-3 text-emerald-500" />
                {renderModeLabel}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] font-mono tabular-nums">
              <span>Akasha-Omega Core</span>
              <span aria-hidden="true">·</span>
              <span>Epoch {unifiedState?.cycleEpoch ?? 4096}</span>
              <span aria-hidden="true">·</span>
              <span>{unifiedState?.convergedEnginesCount ?? 16}/16 Engines Unified</span>
              <span aria-hidden="true">·</span>
              <span>{canManageInfra ? 'Operator Write' : 'Read-Only Audit'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => void fetchAllData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:border-indigo-500/40 text-xs font-mono text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Stream</span>
          </button>

          {canManageInfra && (
            <button
              onClick={() => void handleConvergeTimelines()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-mono font-semibold transition-all shadow-md shadow-indigo-600/25 whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Converge Timelines</span>
            </button>
          )}
        </div>
      </div>

      {/* Animated Optimistic & Convergence Feedback Banner */}
      <AnimatePresence>
        {actionBanner && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 flex items-center justify-between gap-3 text-xs font-mono text-emerald-700 dark:text-emerald-300"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{actionBanner}</span>
            </div>
            <button
              onClick={() => setActionBanner(null)}
              className="text-[11px] underline opacity-80 hover:opacity-100 shrink-0"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4 Primary KPI Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass-card chromatic-rim rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Omnitemporal Coherence</span>
            <Compass className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-semibold tabular-nums text-[var(--text-main)]">
            {unifiedState ? `${(unifiedState.globalCoherenceIndex * 100).toFixed(4)}%` : '99.9700%'}
          </div>
          <div className="mt-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
            Eternal Singularity Lock Active
          </div>
        </div>

        <div className="glass-card chromatic-rim rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Unified Platform Engines</span>
            <Layers className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-semibold tabular-nums text-[var(--text-main)]">
            {unifiedState ? `${unifiedState.convergedEnginesCount}/${unifiedState.totalIntegratedEngines}` : '16/16'}
          </div>
          <div className="mt-1 text-[11px] font-mono text-cyan-600 dark:text-cyan-400 tabular-nums">
            Past · Present · Future Horizons
          </div>
        </div>

        <div className="glass-card chromatic-rim rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Dissolved Latency</span>
            <Activity className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-semibold tabular-nums text-[var(--text-main)]">
            {unifiedState ? `${unifiedState.dissolvedLatencyMs.toFixed(2)} ms` : '142.84 ms'}
          </div>
          <div className="mt-1 text-[11px] font-mono text-amber-600 dark:text-amber-400 tabular-nums">
            0 ns Residual Execution Skew
          </div>
        </div>

        <div className="glass-card chromatic-rim rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Systemic Entropy Index</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-semibold tabular-nums text-[var(--text-main)]">
            {unifiedState ? unifiedState.entropyIndex.toFixed(4) : '0.0000'}
          </div>
          <div className="mt-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
            {unifiedState?.zeroDefectActive !== false ? 'ZERO-DEFECT OPERATIONAL STATE' : 'CONVERGING'}
          </div>
        </div>
      </div>

      {/* 3D WebGL Multidimensional Timeline Convergence Field */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-main)]">
              Multi-Dimensional Timeline Convergence Field (WebGL / Three.js)
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Real-time spatial manifold with custom GLSL Fresnel harmonics, particle instancing, and selective bloom unifying Past (Amber), Present (Indigo), and Future (Emerald).
            </p>
          </div>
          <div className="text-xs font-mono text-[var(--text-muted)] tabular-nums whitespace-nowrap shrink-0">
            Field Dimensions: {fieldDimensions.length || 16} · Stream {unifiedState?.streamId || 'akasha-stream-4096'}
          </div>
        </div>

        <div className="relative rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] overflow-hidden">
          <div
            ref={canvasMountRef}
            data-testid="akasha-webgl-viewport"
            className="w-full h-[360px]"
          />

          {!webglAvailable && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[var(--bg-canvas)]">
              <canvas
                ref={fallbackCanvasRef}
                aria-hidden="true"
                className="w-full h-full absolute inset-0 opacity-75 pointer-events-none"
              />
              <div className="relative z-10 flex flex-col items-center">
                <GitBranch className="h-8 w-8 text-indigo-500 dark:text-indigo-400 mb-2" />
                <div className="text-sm font-semibold text-[var(--text-main)]">
                  Omnitemporal Harmonic Manifold (2D Headless Projection)
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md">
                  {fieldDimensions.length || 16} convergence dimensions synchronized at 0.0000 residual entropy across Past, Present, and Future horizons.
                </p>
              </div>
            </div>
          )}

          {/* Solid surface control bar (zero CSS backdrop-filter over WebGL canvas) */}
          <div className="relative z-10 px-4 py-2.5 border-t border-[var(--border-color)] bg-[var(--bg-surface)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {(['orbit', 'polar', 'horizon'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setCameraPreset(preset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono capitalize transition-colors whitespace-nowrap shrink-0 ${
                    cameraPreset === preset
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {preset} View
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsOrbiting((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] text-xs font-mono text-[var(--text-main)] hover:border-indigo-500/40 transition-colors whitespace-nowrap shrink-0"
            >
              {isOrbiting ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{isOrbiting ? 'Pause Field' : 'Resume Field'}</span>
            </button>
          </div>
        </div>

        {/* Non-Local Horizon Merkle Roots */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3">
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
              Past Archive Root
            </div>
            <div className="mt-1 text-[var(--text-main)] truncate tabular-nums">
              {unifiedState?.horizons.pastRootHash || '0x0000000000000000'}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3">
            <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
              Present Execution Root
            </div>
            <div className="mt-1 text-[var(--text-main)] truncate tabular-nums">
              {unifiedState?.horizons.presentRootHash || '0x0000000000000000'}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3">
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              Future Preemptive Root
            </div>
            <div className="mt-1 text-[var(--text-main)] truncate tabular-nums">
              {unifiedState?.horizons.futureRootHash || '0x0000000000000000'}
            </div>
          </div>
        </div>
      </div>

      {/* Omnitemporal Convergence Trigger & Engine Matrix */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-main)]">
              Unified 16-Engine Omnitemporal Matrix
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Eternal State Hash:{' '}
              <span className="font-mono text-indigo-600 dark:text-indigo-400">
                {unifiedState?.eternalStateHash?.slice(0, 28) || 'akasha-eternal-root'}...
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter engine..."
                aria-label="Filter unified engines"
                className="pl-8 pr-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)]"
              />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)]">
              {(['ALL', 'PAST_ARCHIVE', 'PRESENT_EXECUTION', 'FUTURE_PREEMPTIVE'] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizonFilter(h)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors whitespace-nowrap shrink-0 ${
                    horizonFilter === h
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {h === 'ALL'
                    ? 'All Horizons'
                    : h === 'PAST_ARCHIVE'
                    ? 'Past'
                    : h === 'PRESENT_EXECUTION'
                    ? 'Present'
                    : 'Future'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {canManageInfra && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end pt-2 border-t border-[var(--border-color)]">
            <div>
              <label className="block text-[11px] font-mono text-[var(--text-muted)] mb-1">
                Convergence Vector
              </label>
              <input
                type="text"
                value={triggerVector}
                onChange={(e) => setTriggerVector(e.target.value)}
                aria-label="Convergence Vector"
                className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-[var(--text-muted)] mb-1">
                Timeline Span (Years)
              </label>
              <input
                type="number"
                value={timelineSpanYears}
                onChange={(e) => setTimelineSpanYears(Number(e.target.value) || 100)}
                aria-label="Timeline Span"
                className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono tabular-nums text-[var(--text-main)]"
              />
            </div>
            <button
              onClick={() => void handleConvergeTimelines()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-xs font-mono font-semibold transition-all whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Execute Singularity Harmonization</span>
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-[10px] uppercase text-[var(--text-muted)] border-b border-[var(--border-color)]">
              <tr>
                <th className="py-2.5 pr-3">Engine</th>
                <th className="py-2.5 pr-3">Subsystem</th>
                <th className="py-2.5 pr-3">Temporal Horizon</th>
                <th className="py-2.5 pr-3">Coherence</th>
                <th className="py-2.5 pr-3">Residual Latency</th>
                <th className="py-2.5 pr-3">State Digest</th>
                <th className="py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)] tabular-nums">
              {filteredEngines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[var(--text-muted)] font-sans">
                    No unified engines matched the selected horizon filter.
                  </td>
                </tr>
              ) : (
                filteredEngines.map((engine) => (
                  <tr key={engine.engineId} className="hover:bg-[var(--bg-elevated)]/60 transition-colors">
                    <td className="py-2.5 pr-3 font-semibold text-[var(--text-main)]">{engine.name}</td>
                    <td className="py-2.5 pr-3 text-[var(--text-muted)]">{engine.subsystem}</td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={
                          engine.timelineAnchor === 'PAST_ARCHIVE'
                            ? 'text-amber-600 dark:text-amber-400'
                            : engine.timelineAnchor === 'PRESENT_EXECUTION'
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }
                      >
                        {engine.timelineAnchor}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-cyan-600 dark:text-cyan-400">
                      {(engine.coherenceScore * 100).toFixed(2)}%
                    </td>
                    <td className="py-2.5 pr-3 text-[var(--text-main)]">{engine.residualLatencyNs} ns</td>
                    <td className="py-2.5 pr-3 text-[var(--text-muted)]">{engine.stateDigest}</td>
                    <td className="py-2.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                      {engine.status}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Eternal State Harmony Ledger */}
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-main)]">
          Eternal State Harmony &amp; Convergence Ledger
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-[10px] uppercase text-[var(--text-muted)] border-b border-[var(--border-color)]">
              <tr>
                <th className="py-2 pr-3">Event ID</th>
                <th className="py-2 pr-3">Trigger Vector</th>
                <th className="py-2 pr-3">Span</th>
                <th className="py-2 pr-3">Latency Dissolved</th>
                <th className="py-2 pr-3">Entropy Delta</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)] tabular-nums">
              {history.map((ev) => (
                <tr key={ev.eventId}>
                  <td className="py-2.5 pr-3 text-indigo-600 dark:text-indigo-400">{ev.eventId}</td>
                  <td className="py-2.5 pr-3 text-[var(--text-main)]">{ev.triggerVector}</td>
                  <td className="py-2.5 pr-3 text-[var(--text-muted)]">{ev.timelineSpanYears} yrs</td>
                  <td className="py-2.5 pr-3 text-amber-600 dark:text-amber-400">{ev.dissolvedLatencyMs} ms</td>
                  <td className="py-2.5 pr-3 text-cyan-600 dark:text-cyan-400">
                    {ev.entropyBefore} -&gt; {ev.entropyAfter}
                  </td>
                  <td className="py-2.5 text-emerald-600 dark:text-emerald-400 font-semibold">{ev.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
