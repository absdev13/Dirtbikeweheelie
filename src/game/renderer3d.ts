import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MAX_SKID_MARKS, PX_PER_METER, WheelieSimulation } from './simulation';
import { BikeConfig, CameraViewMode, CourseConfig } from './types';

// Detect software WebGL (SwiftShader, llvmpipe, WARP) from the GPU renderer string
export const isSoftwareGl = (() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
})();

// Pre-allocated math helpers to ensure zero GC inside the per-frame render loop
const _camTargetPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _dummyObj = new THREE.Object3D();
const _tempColor = new THREE.Color();
const _skyColor = new THREE.Color();

const WORLD_SCALE = 1 / PX_PER_METER; // 1 Three.js unit = 1 meter (42 simulation px)
const ROAD_SEGMENTS = 140;
const ROAD_STEP_M = 1.6;
const ROAD_WIDTH_M = 13.5;
const PROP_COUNT = 36;
const PARTICLE_POOL_SIZE = 360;

export class WheelieRenderer3D {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public cameraMode: CameraViewMode = 'CHASE';

  private currentCourseId: string = '';
  private currentBikeId: string = '';

  // Lights
  private hemiLight!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;

  // Dynamic Terrain / Road Ribbon Mesh
  private roadGeometry!: THREE.BufferGeometry;
  private roadMesh!: THREE.Mesh;
  private roadPositions!: Float32Array;
  private roadUVs!: Float32Array;
  private streetTexture!: THREE.CanvasTexture;
  private dirtTexture!: THREE.CanvasTexture;
  private buildingWindowTexture!: THREE.CanvasTexture;
  private roadMaterial!: THREE.MeshStandardMaterial;

  // Extended Ground Apron
  private groundApronMesh!: THREE.Mesh;
  private groundApronMaterial!: THREE.MeshStandardMaterial;

  // Instanced Roadside Environment Props
  private buildingInstanced!: THREE.InstancedMesh;
  private lampPoleInstanced!: THREE.InstancedMesh;
  private lampBulbInstanced!: THREE.InstancedMesh;
  private gantryBeamInstanced!: THREE.InstancedMesh;
  private gantrySignInstanced!: THREE.InstancedMesh;
  private guardRailLeftInstanced!: THREE.InstancedMesh;
  private guardRailRightInstanced!: THREE.InstancedMesh;
  private desertRockInstanced!: THREE.InstancedMesh;
  private skidMarkInstanced!: THREE.InstancedMesh;

  // 3D Composite Bike & Articulated Rider Hierarchy
  private bikeRootGroup!: THREE.Group;
  private bikePitchGroup!: THREE.Group;
  private rearWheelGroup!: THREE.Group;
  private frontWheelGroup!: THREE.Group;
  private forkLowerGroup!: THREE.Group;
  private clutchLeverMesh!: THREE.Mesh;
  private rearRotorMat!: THREE.MeshStandardMaterial;
  private tailBrakeLightMat!: THREE.MeshStandardMaterial;
  private sparkBlockMat!: THREE.MeshStandardMaterial;
  private exhaustFlameMesh!: THREE.Mesh;
  private headlightConeMesh!: THREE.Mesh;
  private supermotoSubCage!: THREE.Group;
  private contactShadowMesh!: THREE.Mesh;

  // 3D World-Space Balance Protractor Arc next to Rear Axle
  private balanceArcGroup!: THREE.Group;
  private balanceNeedleGroup!: THREE.Group;
  private balanceNeedleMat!: THREE.MeshBasicMaterial;

  // Bike Dynamic Materials
  private primaryMat!: THREE.MeshPhysicalMaterial;
  private secondaryMat!: THREE.MeshStandardMaterial;
  private frameMat!: THREE.MeshStandardMaterial;
  private rimMatA!: THREE.MeshStandardMaterial;
  private rimMatB!: THREE.MeshStandardMaterial;

  // 3D Articulated Rider Parts
  private riderGroup!: THREE.Group;
  private riderHipGroup!: THREE.Group;
  private riderTorsoGroup!: THREE.Group;
  private riderHeadGroup!: THREE.Group;
  private riderLeftArmGroup!: THREE.Group;
  private riderRightArmGroup!: THREE.Group;
  private riderLeftLegGroup!: THREE.Group;
  private riderRightLegGroup!: THREE.Group;

  // 3D Pooled Particle InstancedMesh
  private particleInstanced!: THREE.InstancedMesh;

  // Damped Camera State
  private currentCamPos = new THREE.Vector3(-5.5, 2.4, 2.5);
  private currentLookAt = new THREE.Vector3(6, 1.2, 0);
  private lastRenderTime = performance.now();

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.shadowMap.enabled = !isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.renderer.domElement.className = 'block w-full h-full';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#070B19');
    this.scene.fog = new THREE.FogExp2('#1E1B4B', 0.009);

    this.camera = new THREE.PerspectiveCamera(58, width / height, 0.15, 280);
    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentLookAt);

    // Studio Environment Reflection (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    this.initTextures();
    this.initLighting();
    this.initRoadAndScenery();
    this.initCompositeBikeAndRider();
    this.initWorldBalanceArc();
    this.initParticleSystem();

    if (!isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  public setSize(width: number, height: number) {
    if (width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public setCameraMode(mode: CameraViewMode) {
    this.cameraMode = mode;
  }

  public cycleCameraMode(): CameraViewMode {
    const order: CameraViewMode[] = ['CHASE', 'SIDE_3D', 'HELMET_POV', 'LOW_HERO'];
    const next = order[(order.indexOf(this.cameraMode) + 1) % order.length];
    this.cameraMode = next;
    return next;
  }

  private initTextures() {
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    // 1. Procedural Multi-Lane Street Asphalt Texture with Stunt Curbs & Lane Markings
    const streetCanvas = document.createElement('canvas');
    streetCanvas.width = 512;
    streetCanvas.height = 512;
    const sCtx = streetCanvas.getContext('2d')!;
    sCtx.fillStyle = '#1E2330';
    sCtx.fillRect(0, 0, 512, 512);

    // Fine asphalt aggregate micro-texture
    for (let i = 0; i < 5500; i++) {
      const gx = Math.random() * 512;
      const gy = Math.random() * 512;
      sCtx.fillStyle =
        Math.random() > 0.5 ? 'rgba(255,255,255,0.038)' : 'rgba(0,0,0,0.07)';
      sCtx.fillRect(gx, gy, 2, 2);
    }

    // Subtle dark rubber lane wear tracks
    sCtx.fillStyle = 'rgba(10, 14, 20, 0.25)';
    sCtx.fillRect(0, 120, 512, 55);
    sCtx.fillRect(0, 335, 512, 55);

    // White outer shoulder lines
    sCtx.fillStyle = 'rgba(248, 250, 252, 0.9)';
    sCtx.fillRect(0, 26, 512, 8);
    sCtx.fillRect(0, 478, 512, 8);

    // Red/White Stunt Curb rumble strips on edges
    for (let x = 0; x < 512; x += 64) {
      sCtx.fillStyle = (x / 64) % 2 === 0 ? '#EF4444' : '#F8FAFC';
      sCtx.fillRect(x, 4, 64, 15);
      sCtx.fillRect(x, 493, 64, 15);
    }

    // Dashed white sub-lane dividers
    sCtx.fillStyle = 'rgba(226, 232, 240, 0.55)';
    for (let x = 0; x < 512; x += 128) {
      sCtx.fillRect(x + 24, 144, 56, 5);
      sCtx.fillRect(x + 24, 362, 56, 5);
    }

    // Center double-yellow / dashed highway stripe
    sCtx.fillStyle = '#FACC15';
    for (let x = 0; x < 512; x += 128) {
      sCtx.fillRect(x + 14, 246, 82, 7);
      sCtx.fillRect(x + 14, 258, 82, 7);
    }

    this.streetTexture = new THREE.CanvasTexture(streetCanvas);
    this.streetTexture.colorSpace = THREE.SRGBColorSpace;
    this.streetTexture.wrapS = THREE.RepeatWrapping;
    this.streetTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.streetTexture.anisotropy = maxAnisotropy;

    // 2. Procedural Dirt Motocross Trail Texture
    const dirtCanvas = document.createElement('canvas');
    dirtCanvas.width = 512;
    dirtCanvas.height = 512;
    const dCtx = dirtCanvas.getContext('2d')!;
    dCtx.fillStyle = '#9A4422';
    dCtx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 5500; i++) {
      const gx = Math.random() * 512;
      const gy = Math.random() * 512;
      dCtx.fillStyle =
        Math.random() > 0.5 ? 'rgba(255,220,180,0.06)' : 'rgba(30,12,5,0.09)';
      dCtx.fillRect(gx, gy, 3, 2);
    }
    dCtx.fillStyle = 'rgba(40, 18, 8, 0.24)';
    dCtx.fillRect(0, 200, 512, 34);
    dCtx.fillRect(0, 275, 512, 34);

    this.dirtTexture = new THREE.CanvasTexture(dirtCanvas);
    this.dirtTexture.colorSpace = THREE.SRGBColorSpace;
    this.dirtTexture.wrapS = THREE.RepeatWrapping;
    this.dirtTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.dirtTexture.anisotropy = maxAnisotropy;

    // 3. Procedural Illuminated Skyscraper Window Grid Texture
    const bldgCanvas = document.createElement('canvas');
    bldgCanvas.width = 256;
    bldgCanvas.height = 512;
    const bCtx = bldgCanvas.getContext('2d')!;
    bCtx.fillStyle = '#0B1120';
    bCtx.fillRect(0, 0, 256, 512);

    for (let wy = 16; wy < 490; wy += 22) {
      for (let wx = 14; wx < 240; wx += 26) {
        const lit = ((wx * 13 + wy * 7) % 11) > 3;
        if (lit) {
          bCtx.fillStyle =
            (wx + wy) % 7 === 0
              ? '#FF5500'
              : (wx + wy) % 5 === 0
              ? '#38BDF8'
              : (wx + wy) % 3 === 0
              ? '#FDE047'
              : '#FEF08A';
          bCtx.fillRect(wx, wy, 15, 13);
        } else {
          bCtx.fillStyle = '#172033';
          bCtx.fillRect(wx, wy, 15, 13);
        }
      }
    }

    this.buildingWindowTexture = new THREE.CanvasTexture(bldgCanvas);
    this.buildingWindowTexture.colorSpace = THREE.SRGBColorSpace;
    this.buildingWindowTexture.wrapS = THREE.RepeatWrapping;
    this.buildingWindowTexture.wrapT = THREE.RepeatWrapping;
    this.buildingWindowTexture.anisotropy = maxAnisotropy;
  }

  private initLighting() {
    this.hemiLight = new THREE.HemisphereLight('#93C5FD', '#1E293B', 0.9);
    this.hemiLight.position.set(0, 40, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight('#FFF7ED', 2.3);
    this.dirLight.position.set(18, 28, 16);
    this.dirLight.castShadow = !isSoftwareGl;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    const d = 15;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.camera.near = 2;
    this.dirLight.shadow.camera.far = 70;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    this.rimLight = new THREE.DirectionalLight('#38BDF8', 0.95);
    this.rimLight.position.set(-14, 12, -16);
    this.scene.add(this.rimLight);
    this.scene.add(this.rimLight.target);
  }

  private initRoadAndScenery() {
    // 1. Dynamic 3D Road / Terrain Ribbon Geometry
    const vertexCount = (ROAD_SEGMENTS + 1) * 2;
    this.roadPositions = new Float32Array(vertexCount * 3);
    this.roadUVs = new Float32Array(vertexCount * 2);
    const indices: number[] = [];

    for (let i = 0; i < ROAD_SEGMENTS; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }

    this.roadGeometry = new THREE.BufferGeometry();
    this.roadGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.roadPositions, 3)
    );
    this.roadGeometry.setAttribute(
      'uv',
      new THREE.BufferAttribute(this.roadUVs, 2)
    );
    this.roadGeometry.setIndex(indices);

    this.roadMaterial = new THREE.MeshStandardMaterial({
      map: this.streetTexture,
      roughness: 0.68,
      metalness: 0.1,
    });

    this.roadMesh = new THREE.Mesh(this.roadGeometry, this.roadMaterial);
    this.roadMesh.receiveShadow = !isSoftwareGl;
    this.roadMesh.frustumCulled = false;
    this.scene.add(this.roadMesh);

    // 2. Wide Surround Apron Plane
    const apronGeo = new THREE.PlaneGeometry(440, 280);
    apronGeo.rotateX(-Math.PI / 2);
    this.groundApronMaterial = new THREE.MeshStandardMaterial({
      color: '#0B0F19',
      roughness: 0.92,
      metalness: 0.05,
    });
    this.groundApronMesh = new THREE.Mesh(apronGeo, this.groundApronMaterial);
    this.groundApronMesh.position.y = -0.15;
    this.groundApronMesh.receiveShadow = !isSoftwareGl;
    this.scene.add(this.groundApronMesh);

    // 3. Instanced Skyscrapers (Street Maps)
    const bldgGeo = new THREE.BoxGeometry(1, 1, 1);
    bldgGeo.translate(0, 0.5, 0);
    const bldgMat = new THREE.MeshStandardMaterial({
      map: this.buildingWindowTexture,
      roughness: 0.32,
      metalness: 0.48,
    });
    this.buildingInstanced = new THREE.InstancedMesh(
      bldgGeo,
      bldgMat,
      PROP_COUNT * 2
    );
    this.buildingInstanced.frustumCulled = false;
    this.scene.add(this.buildingInstanced);

    // 4. Instanced Highway Streetlights
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 6.4, 8);
    poleGeo.translate(0, 3.2, 0);
    const poleMat = new THREE.MeshStandardMaterial({
      color: '#475569',
      roughness: 0.4,
      metalness: 0.8,
    });
    this.lampPoleInstanced = new THREE.InstancedMesh(
      poleGeo,
      poleMat,
      PROP_COUNT * 2
    );
    this.lampPoleInstanced.frustumCulled = false;
    this.scene.add(this.lampPoleInstanced);

    const bulbGeo = new THREE.BoxGeometry(0.48, 0.14, 1.15);
    const bulbMat = new THREE.MeshBasicMaterial({ color: '#FEF08A' });
    this.lampBulbInstanced = new THREE.InstancedMesh(
      bulbGeo,
      bulbMat,
      PROP_COUNT * 2
    );
    this.lampBulbInstanced.frustumCulled = false;
    this.scene.add(this.lampBulbInstanced);

    // 5. Overhead Highway Sign Gantries spanning across the street
    const gantryBeamGeo = new THREE.BoxGeometry(0.28, 0.35, ROAD_WIDTH_M + 2.2);
    const gantryBeamMat = new THREE.MeshStandardMaterial({
      color: '#64748B',
      roughness: 0.38,
      metalness: 0.82,
    });
    this.gantryBeamInstanced = new THREE.InstancedMesh(
      gantryBeamGeo,
      gantryBeamMat,
      PROP_COUNT
    );
    this.gantryBeamInstanced.frustumCulled = false;
    this.scene.add(this.gantryBeamInstanced);

    const gantrySignGeo = new THREE.BoxGeometry(0.16, 1.35, 5.8);
    const gantrySignMat = new THREE.MeshStandardMaterial({
      color: '#065F46',
      emissive: '#047857',
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    this.gantrySignInstanced = new THREE.InstancedMesh(
      gantrySignGeo,
      gantrySignMat,
      PROP_COUNT
    );
    this.gantrySignInstanced.frustumCulled = false;
    this.scene.add(this.gantrySignInstanced);

    // 6. Instanced Highway Guardrails
    const railGeo = new THREE.BoxGeometry(4.2, 0.55, 0.18);
    railGeo.translate(0, 0.35, 0);
    const railMat = new THREE.MeshStandardMaterial({
      color: '#94A3B8',
      roughness: 0.45,
      metalness: 0.7,
    });
    this.guardRailLeftInstanced = new THREE.InstancedMesh(
      railGeo,
      railMat,
      PROP_COUNT
    );
    this.guardRailRightInstanced = new THREE.InstancedMesh(
      railGeo,
      railMat,
      PROP_COUNT
    );
    this.guardRailLeftInstanced.frustumCulled = false;
    this.guardRailRightInstanced.frustumCulled = false;
    this.scene.add(this.guardRailLeftInstanced);
    this.scene.add(this.guardRailRightInstanced);

    // 7. Instanced Desert Boulders / Canyon Spires (Dirt Maps)
    const rockGeo = new THREE.DodecahedronGeometry(1, 1);
    rockGeo.translate(0, 0.45, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: '#9A3412',
      roughness: 0.88,
      metalness: 0.05,
    });
    this.desertRockInstanced = new THREE.InstancedMesh(
      rockGeo,
      rockMat,
      PROP_COUNT * 2
    );
    this.desertRockInstanced.frustumCulled = false;
    this.scene.add(this.desertRockInstanced);

    // 8. 3D Persistent Rubber Burnout Skid Marks & Glowing Scrape Trails
    const skidGeo = new THREE.PlaneGeometry(0.55, 0.22);
    skidGeo.rotateX(-Math.PI / 2);
    const skidMat = new THREE.MeshBasicMaterial({
      color: '#FFFFFF',
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.skidMarkInstanced = new THREE.InstancedMesh(
      skidGeo,
      skidMat,
      MAX_SKID_MARKS
    );
    this.skidMarkInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.skidMarkInstanced.frustumCulled = false;
    for (let i = 0; i < MAX_SKID_MARKS; i++) {
      _dummyObj.position.set(0, -100, 0);
      _dummyObj.scale.setScalar(0.001);
      _dummyObj.updateMatrix();
      this.skidMarkInstanced.setMatrixAt(i, _dummyObj.matrix);
      this.skidMarkInstanced.setColorAt(i, _tempColor.set('#090D16'));
    }
    this.scene.add(this.skidMarkInstanced);
  }

  private initWorldBalanceArc() {
    // 3D Holographic Wheelie Balance Protractor floating beside the rear wheel!
    this.balanceArcGroup = new THREE.Group();
    this.balanceArcGroup.position.set(0, 0.39, 0.52);
    this.bikeRootGroup.add(this.balanceArcGroup);

    // Background 0..95° track arc
    const bgArcGeo = new THREE.TorusGeometry(
      1.15,
      0.018,
      8,
      36,
      (95 * Math.PI) / 180
    );
    const bgArcMat = new THREE.MeshBasicMaterial({
      color: '#334155',
      transparent: true,
      opacity: 0.55,
    });
    this.balanceArcGroup.add(new THREE.Mesh(bgArcGeo, bgArcMat));

    // Green Sweet Spot Zone Arc (54°..82°)
    const sweetSpanRad = (28 * Math.PI) / 180;
    const sweetArcGeo = new THREE.TorusGeometry(1.15, 0.032, 8, 24, sweetSpanRad);
    const sweetArcMat = new THREE.MeshBasicMaterial({ color: '#10B981' });
    const sweetArcMesh = new THREE.Mesh(sweetArcGeo, sweetArcMat);
    sweetArcMesh.rotation.z = (54 * Math.PI) / 180;
    this.balanceArcGroup.add(sweetArcMesh);

    // Amber 12 O'Clock Scrape Zone Arc (82°..95°)
    const scrapeSpanRad = (13 * Math.PI) / 180;
    const scrapeArcGeo = new THREE.TorusGeometry(1.15, 0.036, 8, 16, scrapeSpanRad);
    const scrapeArcMat = new THREE.MeshBasicMaterial({ color: '#F59E0B' });
    const scrapeArcMesh = new THREE.Mesh(scrapeArcGeo, scrapeArcMat);
    scrapeArcMesh.rotation.z = (82 * Math.PI) / 180;
    this.balanceArcGroup.add(scrapeArcMesh);

    // Live Rotating 3D Angle Pointer Needle
    this.balanceNeedleGroup = new THREE.Group();
    this.balanceNeedleMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
    const needleGeo = new THREE.BoxGeometry(0.32, 0.035, 0.035);
    needleGeo.translate(1.08, 0, 0);
    const needleMesh = new THREE.Mesh(needleGeo, this.balanceNeedleMat);
    this.balanceNeedleGroup.add(needleMesh);
    this.balanceArcGroup.add(this.balanceNeedleGroup);
  }

  private initCompositeBikeAndRider() {
    this.bikeRootGroup = new THREE.Group();
    this.scene.add(this.bikeRootGroup);

    // Contact Shadow Disc under the bike
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const shCtx = shadowCanvas.getContext('2d')!;
    const grad = shCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    shCtx.fillStyle = grad;
    shCtx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);

    const contactGeo = new THREE.PlaneGeometry(2.8, 1.3);
    contactGeo.rotateX(-Math.PI / 2);
    const contactMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.68,
    });
    this.contactShadowMesh = new THREE.Mesh(contactGeo, contactMat);
    this.contactShadowMesh.position.set(0.7, 0.03, 0);
    this.bikeRootGroup.add(this.contactShadowMesh);

    // Pitch Group pivots around the Rear Wheel Axle!
    this.bikePitchGroup = new THREE.Group();
    this.bikeRootGroup.add(this.bikePitchGroup);

    // Shared PBR Materials for Bike
    this.primaryMat = new THREE.MeshPhysicalMaterial({
      color: '#FF5500',
      roughness: 0.2,
      metalness: 0.15,
      clearcoat: 0.95,
      clearcoatRoughness: 0.1,
    });

    this.secondaryMat = new THREE.MeshStandardMaterial({
      color: '#1E293B',
      roughness: 0.72,
      metalness: 0.12,
    });

    this.frameMat = new THREE.MeshStandardMaterial({
      color: '#EAB308',
      roughness: 0.28,
      metalness: 0.82,
    });

    this.rimMatA = new THREE.MeshStandardMaterial({
      color: '#38BDF8',
      roughness: 0.18,
      metalness: 0.9,
    });

    this.rimMatB = new THREE.MeshStandardMaterial({
      color: '#F8FAFC',
      roughness: 0.18,
      metalness: 0.9,
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: '#F1F5F9',
      roughness: 0.1,
      metalness: 0.96,
    });

    const engineAlloyMat = new THREE.MeshStandardMaterial({
      color: '#475569',
      roughness: 0.4,
      metalness: 0.84,
    });

    const tireRubberMat = new THREE.MeshStandardMaterial({
      color: '#111318',
      roughness: 0.84,
      metalness: 0.06,
    });

    this.rearRotorMat = new THREE.MeshStandardMaterial({
      color: '#94A3B8',
      roughness: 0.28,
      metalness: 0.88,
      emissive: '#FF4500',
      emissiveIntensity: 0,
    });

    this.tailBrakeLightMat = new THREE.MeshStandardMaterial({
      color: '#EF4444',
      emissive: '#EF4444',
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });

    this.sparkBlockMat = new THREE.MeshStandardMaterial({
      color: '#CBD5E1',
      roughness: 0.25,
      metalness: 0.9,
      emissive: '#FEF08A',
      emissiveIntensity: 0,
    });

    // 1. Rear & Front 3D Wheel Assemblies
    const buildWheelAssembly = (isRear: boolean): THREE.Group => {
      const wg = new THREE.Group();

      const tireGeo = new THREE.TorusGeometry(0.39, 0.135, 16, 32);
      const tireMesh = new THREE.Mesh(tireGeo, tireRubberMat);
      tireMesh.castShadow = !isSoftwareGl;
      wg.add(tireMesh);

      const rimHalfGeoA = new THREE.TorusGeometry(0.28, 0.044, 10, 20, Math.PI);
      wg.add(new THREE.Mesh(rimHalfGeoA, this.rimMatA));

      const rimHalfGeoB = new THREE.TorusGeometry(0.28, 0.044, 10, 20, Math.PI);
      rimHalfGeoB.rotateZ(Math.PI);
      wg.add(new THREE.Mesh(rimHalfGeoB, this.rimMatB));

      const hubGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.18, 12);
      hubGeo.rotateX(Math.PI / 2);
      wg.add(new THREE.Mesh(hubGeo, engineAlloyMat));

      const spokeGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.54, 6);
      for (let i = 0; i < 6; i++) {
        const sp = new THREE.Mesh(spokeGeo, chromeMat);
        sp.rotation.z = (i * Math.PI) / 6;
        wg.add(sp);
      }

      const rotorGeo = new THREE.CylinderGeometry(
        isRear ? 0.19 : 0.23,
        isRear ? 0.19 : 0.23,
        0.015,
        18
      );
      rotorGeo.rotateX(Math.PI / 2);
      const rotorMesh = new THREE.Mesh(
        rotorGeo,
        isRear ? this.rearRotorMat : chromeMat
      );
      rotorMesh.position.z = isRear ? 0.095 : -0.095;
      wg.add(rotorMesh);

      return wg;
    };

    this.rearWheelGroup = buildWheelAssembly(true);
    this.bikePitchGroup.add(this.rearWheelGroup);

    this.frontWheelGroup = buildWheelAssembly(false);
    this.frontWheelGroup.position.set(1.82, 0, 0);
    this.bikePitchGroup.add(this.frontWheelGroup);

    // 2. Dual-Sided Box Swingarm & Rear Coil-Over Shock
    const swingarmBeamGeo = new THREE.BoxGeometry(0.76, 0.075, 0.045);
    for (const side of [-1, 1]) {
      const beam = new THREE.Mesh(swingarmBeamGeo, engineAlloyMat);
      beam.position.set(0.36, 0.12, side * 0.13);
      beam.rotation.z = 0.28;
      beam.castShadow = !isSoftwareGl;
      this.bikePitchGroup.add(beam);
    }

    const shockGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.44, 10);
    const shockMesh = new THREE.Mesh(shockGeo, this.primaryMat);
    shockMesh.position.set(0.52, 0.42, 0);
    shockMesh.rotation.z = -0.32;
    this.bikePitchGroup.add(shockMesh);

    // 3. Engine Crankcase, Cylinder Head & Exhaust System + Backfire Flame Cone
    const crankcaseGeo = new THREE.BoxGeometry(0.48, 0.38, 0.28);
    const crankcaseMesh = new THREE.Mesh(crankcaseGeo, engineAlloyMat);
    crankcaseMesh.position.set(0.84, 0.36, 0);
    crankcaseMesh.castShadow = !isSoftwareGl;
    this.bikePitchGroup.add(crankcaseMesh);

    const cylinderGeo = new THREE.CylinderGeometry(0.14, 0.15, 0.32, 12);
    const cylinderMesh = new THREE.Mesh(cylinderGeo, chromeMat);
    cylinderMesh.position.set(0.92, 0.62, 0);
    cylinderMesh.rotation.z = -0.22;
    this.bikePitchGroup.add(cylinderMesh);

    const headerGeo = new THREE.CylinderGeometry(0.036, 0.032, 0.95, 10);
    headerGeo.rotateZ(Math.PI / 2);
    const headerMesh = new THREE.Mesh(headerGeo, chromeMat);
    headerMesh.position.set(0.45, 0.66, 0.16);
    headerMesh.rotation.z = -0.14;
    this.bikePitchGroup.add(headerMesh);

    const mufflerGeo = new THREE.CylinderGeometry(0.068, 0.062, 0.52, 12);
    mufflerGeo.rotateZ(Math.PI / 2);
    const mufflerMesh = new THREE.Mesh(mufflerGeo, this.secondaryMat);
    mufflerMesh.position.set(-0.22, 0.78, 0.17);
    mufflerMesh.rotation.z = -0.18;
    this.bikePitchGroup.add(mufflerMesh);

    // 3D Exhaust Backfire / Nitro Flame Cone at Silencer Tip!
    const flameGeo = new THREE.ConeGeometry(0.075, 0.55, 10);
    flameGeo.rotateZ(Math.PI / 2);
    const flameMat = new THREE.MeshBasicMaterial({
      color: '#38BDF8',
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.exhaustFlameMesh = new THREE.Mesh(flameGeo, flameMat);
    this.exhaustFlameMesh.position.set(-0.68, 0.85, 0.17);
    this.exhaustFlameMesh.rotation.z = -0.18;
    this.exhaustFlameMesh.visible = false;
    this.bikePitchGroup.add(this.exhaustFlameMesh);

    // 4. Twin-Spar Perimeter Frame
    const sparGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.96, 8);
    for (const side of [-1, 1]) {
      const spar = new THREE.Mesh(sparGeo, this.frameMat);
      spar.position.set(0.96, 0.64, side * 0.15);
      spar.rotation.z = -0.82;
      this.bikePitchGroup.add(spar);
    }

    // 5. Inverted USD Front Forks, Triple Clamps, Handlebars & Clutch Lever
    this.forkLowerGroup = new THREE.Group();
    this.bikePitchGroup.add(this.forkLowerGroup);

    const upperForkGeo = new THREE.CylinderGeometry(0.044, 0.04, 0.64, 10);
    const lowerForkGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.56, 10);

    for (const side of [-1, 1]) {
      const upperFork = new THREE.Mesh(upperForkGeo, this.frameMat);
      upperFork.position.set(1.44, 0.82, side * 0.13);
      upperFork.rotation.z = 0.44;
      this.bikePitchGroup.add(upperFork);

      const lowerFork = new THREE.Mesh(lowerForkGeo, chromeMat);
      lowerFork.position.set(1.66, 0.34, side * 0.13);
      lowerFork.rotation.z = 0.44;
      this.forkLowerGroup.add(lowerFork);
    }

    const barGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.86, 10);
    barGeo.rotateX(Math.PI / 2);
    const barMesh = new THREE.Mesh(barGeo, chromeMat);
    barMesh.position.set(1.28, 1.14, 0);
    this.bikePitchGroup.add(barMesh);

    const gripGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.18, 10);
    gripGeo.rotateX(Math.PI / 2);
    for (const side of [-1, 1]) {
      const grip = new THREE.Mesh(gripGeo, this.secondaryMat);
      grip.position.set(1.28, 1.14, side * 0.36);
      this.bikePitchGroup.add(grip);
    }

    const leverGeo = new THREE.BoxGeometry(0.08, 0.02, 0.16);
    this.clutchLeverMesh = new THREE.Mesh(leverGeo, chromeMat);
    this.clutchLeverMesh.position.set(1.34, 1.14, -0.32);
    this.bikePitchGroup.add(this.clutchLeverMesh);

    // 6. Sculpted Tank, Seat, Tail Fender + LED Brake Light + Headlight Cone
    const tankGeo = new THREE.BoxGeometry(0.68, 0.28, 0.34);
    const tankMesh = new THREE.Mesh(tankGeo, this.primaryMat);
    tankMesh.position.set(0.95, 0.86, 0);
    tankMesh.rotation.z = -0.14;
    tankMesh.castShadow = !isSoftwareGl;
    this.bikePitchGroup.add(tankMesh);

    const seatGeo = new THREE.BoxGeometry(0.76, 0.12, 0.26);
    const seatMesh = new THREE.Mesh(seatGeo, this.secondaryMat);
    seatMesh.position.set(0.34, 0.84, 0);
    seatMesh.rotation.z = -0.08;
    this.bikePitchGroup.add(seatMesh);

    const tailGeo = new THREE.BoxGeometry(0.62, 0.07, 0.22);
    const tailMesh = new THREE.Mesh(tailGeo, this.primaryMat);
    tailMesh.position.set(-0.34, 0.9, 0);
    tailMesh.rotation.z = -0.16;
    this.bikePitchGroup.add(tailMesh);

    // LED Tail / Rear Brake Light
    const tailLightGeo = new THREE.BoxGeometry(0.06, 0.045, 0.16);
    const tailLightMesh = new THREE.Mesh(tailLightGeo, this.tailBrakeLightMat);
    tailLightMesh.position.set(-0.62, 0.91, 0);
    this.bikePitchGroup.add(tailLightMesh);

    // Front Number Plate / Supermoto LED Headlight Mask + Volumetric Beam Cone
    const maskGeo = new THREE.BoxGeometry(0.14, 0.32, 0.28);
    const maskMesh = new THREE.Mesh(maskGeo, this.primaryMat);
    maskMesh.position.set(1.42, 0.96, 0);
    maskMesh.rotation.z = 0.38;
    this.bikePitchGroup.add(maskMesh);

    const headlightLensGeo = new THREE.BoxGeometry(0.04, 0.12, 0.18);
    const headlightLensMat = new THREE.MeshBasicMaterial({ color: '#E0F2FE' });
    const headlightLens = new THREE.Mesh(headlightLensGeo, headlightLensMat);
    headlightLens.position.set(1.48, 0.95, 0);
    headlightLens.rotation.z = 0.38;
    this.bikePitchGroup.add(headlightLens);

    // 3D Volumetric Headlight Beam Cone
    const beamConeGeo = new THREE.ConeGeometry(0.85, 3.8, 16, 1, true);
    beamConeGeo.rotateZ(Math.PI / 2);
    beamConeGeo.translate(1.9, 0, 0);
    const beamConeMat = new THREE.MeshBasicMaterial({
      color: '#BAE6FD',
      transparent: true,
      opacity: 0.085,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.headlightConeMesh = new THREE.Mesh(beamConeGeo, beamConeMat);
    this.headlightConeMesh.position.set(1.48, 0.95, 0);
    this.headlightConeMesh.rotation.z = -0.18;
    this.bikePitchGroup.add(this.headlightConeMesh);

    const frontFenderGeo = new THREE.BoxGeometry(0.48, 0.05, 0.18);
    const frontFender = new THREE.Mesh(frontFenderGeo, this.primaryMat);
    frontFender.position.set(1.62, 0.74, 0);
    frontFender.rotation.z = -0.22;
    this.bikePitchGroup.add(frontFender);

    // 7. Supermoto 12 O'Clock Steel Stunt Sub-Cage & Titanium Spark Block
    this.supermotoSubCage = new THREE.Group();
    const cageTubeGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8);
    cageTubeGeo.rotateZ(Math.PI / 2);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(cageTubeGeo, chromeMat);
      rail.position.set(-0.46, 0.86, side * 0.12);
      rail.rotation.z = -0.2;
      this.supermotoSubCage.add(rail);
    }
    const crossBarGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8);
    crossBarGeo.rotateX(Math.PI / 2);
    const crossBar = new THREE.Mesh(crossBarGeo, chromeMat);
    crossBar.position.set(-0.68, 0.92, 0);
    this.supermotoSubCage.add(crossBar);
    this.bikePitchGroup.add(this.supermotoSubCage);

    const sparkBlockGeo = new THREE.BoxGeometry(0.12, 0.08, 0.24);
    const sparkBlockMesh = new THREE.Mesh(sparkBlockGeo, this.sparkBlockMat);
    sparkBlockMesh.position.set(-0.66, 0.92, 0);
    this.bikePitchGroup.add(sparkBlockMesh);

    // 8. 3D Articulated Stunt Rider
    this.initArticulatedRider(chromeMat);
  }

  private initArticulatedRider(chromeMat: THREE.Material) {
    this.riderGroup = new THREE.Group();
    this.bikePitchGroup.add(this.riderGroup);

    const pantsMat = new THREE.MeshStandardMaterial({
      color: '#0F172A',
      roughness: 0.78,
      metalness: 0.08,
    });

    const armorMat = new THREE.MeshStandardMaterial({
      color: '#1E293B',
      roughness: 0.45,
      metalness: 0.4,
    });

    const helmetShellMat = new THREE.MeshPhysicalMaterial({
      color: '#F8FAFC',
      roughness: 0.16,
      metalness: 0.15,
      clearcoat: 1.0,
    });

    const goggleIridiumMat = new THREE.MeshStandardMaterial({
      color: '#38BDF8',
      roughness: 0.08,
      metalness: 0.95,
    });

    this.riderHipGroup = new THREE.Group();
    this.riderHipGroup.position.set(0.32, 0.95, 0);
    this.riderGroup.add(this.riderHipGroup);

    const pelvisMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.18, 0.32),
      pantsMat
    );
    this.riderHipGroup.add(pelvisMesh);

    this.riderTorsoGroup = new THREE.Group();
    this.riderTorsoGroup.position.set(0.06, 0.12, 0);
    this.riderHipGroup.add(this.riderTorsoGroup);

    const torsoMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.52, 0.36),
      this.primaryMat
    );
    torsoMesh.position.set(0, 0.26, 0);
    torsoMesh.castShadow = !isSoftwareGl;
    this.riderTorsoGroup.add(torsoMesh);

    const chestRigMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.29, 0.36, 0.39),
      armorMat
    );
    chestRigMesh.position.set(0.02, 0.3, 0);
    this.riderTorsoGroup.add(chestRigMesh);

    this.riderHeadGroup = new THREE.Group();
    this.riderHeadGroup.position.set(0.06, 0.64, 0);
    this.riderTorsoGroup.add(this.riderHeadGroup);

    const helmetMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.185, 16, 16),
      helmetShellMat
    );
    helmetMesh.scale.set(1.12, 1.0, 0.95);
    helmetMesh.castShadow = !isSoftwareGl;
    this.riderHeadGroup.add(helmetMesh);

    const chinMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.12, 0.22),
      this.primaryMat
    );
    chinMesh.position.set(0.11, -0.06, 0);
    this.riderHeadGroup.add(chinMesh);

    const visorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.03, 0.24),
      this.primaryMat
    );
    visorMesh.position.set(0.14, 0.12, 0);
    visorMesh.rotation.z = -0.18;
    this.riderHeadGroup.add(visorMesh);

    const goggleMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.085, 0.25),
      goggleIridiumMat
    );
    goggleMesh.position.set(0.16, 0.02, 0);
    this.riderHeadGroup.add(goggleMesh);

    const buildArm = (side: number): THREE.Group => {
      const armG = new THREE.Group();
      armG.position.set(0.06, 0.46, side * 0.23);

      const upperArm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.048, 0.34, 8),
        this.primaryMat
      );
      upperArm.position.set(0.15, -0.04, side * 0.04);
      upperArm.rotation.z = 1.15;
      armG.add(upperArm);

      const forearm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.046, 0.04, 0.34, 8),
        helmetShellMat
      );
      forearm.position.set(0.42, -0.06, side * 0.06);
      forearm.rotation.z = 1.42;
      armG.add(forearm);

      return armG;
    };

    this.riderLeftArmGroup = buildArm(-1);
    this.riderRightArmGroup = buildArm(1);
    this.riderTorsoGroup.add(this.riderLeftArmGroup);
    this.riderTorsoGroup.add(this.riderRightArmGroup);

    const buildLeg = (side: number): THREE.Group => {
      const legG = new THREE.Group();
      legG.position.set(0, -0.04, side * 0.15);

      const thigh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.072, 0.058, 0.4, 8),
        pantsMat
      );
      thigh.position.set(0.16, -0.14, side * 0.03);
      thigh.rotation.z = 0.88;
      legG.add(thigh);

      const shinBoot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.062, 0.055, 0.42, 8),
        armorMat
      );
      shinBoot.position.set(0.2, -0.44, side * 0.04);
      shinBoot.rotation.z = -0.25;
      legG.add(shinBoot);

      const bootSole = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.07, 0.1),
        chromeMat
      );
      bootSole.position.set(0.2, -0.64, side * 0.04);
      legG.add(bootSole);

      return legG;
    };

    this.riderLeftLegGroup = buildLeg(-1);
    this.riderRightLegGroup = buildLeg(1);
    this.riderHipGroup.add(this.riderLeftLegGroup);
    this.riderHipGroup.add(this.riderRightLegGroup);
  }

  private initParticleSystem() {
    const pGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const pMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
    this.particleInstanced = new THREE.InstancedMesh(
      pGeo,
      pMat,
      PARTICLE_POOL_SIZE
    );
    this.particleInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleInstanced.frustumCulled = false;

    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      _dummyObj.position.set(0, -100, 0);
      _dummyObj.scale.setScalar(0.001);
      _dummyObj.updateMatrix();
      this.particleInstanced.setMatrixAt(i, _dummyObj.matrix);
      this.particleInstanced.setColorAt(i, _tempColor.set('#FFFFFF'));
    }
    this.scene.add(this.particleInstanced);
  }

  private syncCourseAndBikeAppearance(
    course: CourseConfig,
    bike: BikeConfig
  ) {
    if (this.currentCourseId !== course.id) {
      this.currentCourseId = course.id;
      const isStreet = course.environmentType === 'STREET';

      _skyColor.set(course.skyBottom);
      this.scene.background = _skyColor.clone();
      this.scene.fog = new THREE.FogExp2(
        course.skyBottom,
        isStreet ? 0.009 : 0.0085
      );

      this.hemiLight.color.set(course.horizonGlow);
      this.hemiLight.groundColor.set(course.groundSubsoil);

      this.roadMaterial.map = isStreet ? this.streetTexture : this.dirtTexture;
      this.roadMaterial.roughness = isStreet ? 0.65 : 0.92;
      this.roadMaterial.needsUpdate = true;

      this.groundApronMaterial.color.set(
        isStreet ? course.groundSubsoil : course.mountainNear
      );

      this.buildingInstanced.visible = isStreet;
      this.lampPoleInstanced.visible = isStreet;
      this.lampBulbInstanced.visible = isStreet;
      this.gantryBeamInstanced.visible = isStreet;
      this.gantrySignInstanced.visible = isStreet;
      this.guardRailLeftInstanced.visible = isStreet;
      this.guardRailRightInstanced.visible = isStreet;
      this.desertRockInstanced.visible = !isStreet;
      (
        this.desertRockInstanced.material as THREE.MeshStandardMaterial
      ).color.set(course.groundSurface);
    }

    if (this.currentBikeId !== bike.id) {
      this.currentBikeId = bike.id;
      const isSupermoto = bike.tireStyle === 'SUPERMOTO_SLICK';

      this.primaryMat.color.set(bike.primaryColor);
      this.secondaryMat.color.set(bike.secondaryColor);
      this.frameMat.color.set(bike.frameColor);
      this.rimMatA.color.set(bike.rimColor);
      this.rimMatB.color.set(isSupermoto ? bike.primaryColor : bike.rimColor);
      this.supermotoSubCage.visible = isSupermoto;
    }
  }

  private updateRoadAndScenery(sim: WheelieSimulation, bikeWorldX: number) {
    const startX = bikeWorldX - 24;
    const isStreet = sim.course.environmentType === 'STREET';

    // 1. Update Road / Terrain Ribbon Vertices
    for (let i = 0; i <= ROAD_SEGMENTS; i++) {
      const wx = startX + i * ROAD_STEP_M;
      const simX = wx * PX_PER_METER;
      const simY = sim.getTerrainHeight(simX);
      const wy = (420 - simY) * WORLD_SCALE;

      const idx = i * 6;
      this.roadPositions[idx] = wx;
      this.roadPositions[idx + 1] = wy;
      this.roadPositions[idx + 2] = -ROAD_WIDTH_M * 0.5;

      this.roadPositions[idx + 3] = wx;
      this.roadPositions[idx + 4] = wy;
      this.roadPositions[idx + 5] = ROAD_WIDTH_M * 0.5;

      const uvIdx = i * 4;
      const u = wx * 0.14;
      this.roadUVs[uvIdx] = u;
      this.roadUVs[uvIdx + 1] = 0;
      this.roadUVs[uvIdx + 2] = u;
      this.roadUVs[uvIdx + 3] = 1;
    }

    this.roadGeometry.attributes.position.needsUpdate = true;
    this.roadGeometry.attributes.uv.needsUpdate = true;
    this.roadGeometry.computeVertexNormals();

    this.groundApronMesh.position.x = bikeWorldX + 60;

    // 2. Update Instanced Scenery Props along X
    const propSpacing = 6.5;
    const baseIndex = Math.floor((bikeWorldX - 25) / propSpacing);

    for (let i = 0; i < PROP_COUNT; i++) {
      const worldSlot = baseIndex + i;
      const propX = worldSlot * propSpacing;
      const simY = sim.getTerrainHeight(propX * PX_PER_METER);
      const groundY = (420 - simY) * WORLD_SCALE;
      const hash = Math.abs(Math.sin(worldSlot * 12.9898) * 43758.5453);

      if (isStreet) {
        _dummyObj.position.set(propX, groundY, -ROAD_WIDTH_M * 0.5 - 0.3);
        _dummyObj.rotation.set(0, 0, 0);
        _dummyObj.scale.set(1, 1, 1);
        _dummyObj.updateMatrix();
        this.guardRailLeftInstanced.setMatrixAt(i, _dummyObj.matrix);

        _dummyObj.position.set(propX, groundY, ROAD_WIDTH_M * 0.5 + 0.3);
        _dummyObj.updateMatrix();
        this.guardRailRightInstanced.setMatrixAt(i, _dummyObj.matrix);

        // Overhead Highway Gantry Arch every 6th slot
        if (worldSlot % 6 === 0 && worldSlot > 0) {
          _dummyObj.position.set(propX, groundY + 6.3, 0);
          _dummyObj.scale.set(1, 1, 1);
          _dummyObj.updateMatrix();
          this.gantryBeamInstanced.setMatrixAt(i, _dummyObj.matrix);

          _dummyObj.position.set(propX + 0.12, groundY + 6.3, 0);
          _dummyObj.updateMatrix();
          this.gantrySignInstanced.setMatrixAt(i, _dummyObj.matrix);
        } else {
          _dummyObj.position.set(0, -100, 0);
          _dummyObj.scale.setScalar(0.001);
          _dummyObj.updateMatrix();
          this.gantryBeamInstanced.setMatrixAt(i, _dummyObj.matrix);
          this.gantrySignInstanced.setMatrixAt(i, _dummyObj.matrix);
        }

        for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
          const side = sideIdx === 0 ? -1 : 1;
          const bIdx = i * 2 + sideIdx;
          const bWidth = 5.5 + ((hash * (sideIdx + 1)) % 4.5);
          const bDepth = 6.0 + ((hash * 3) % 5.0);
          const bHeight = 14 + ((hash * (7 + sideIdx * 5)) % 36);
          const zOffset = side * (ROAD_WIDTH_M * 0.5 + 6.5 + (hash % 4));

          _dummyObj.position.set(propX, groundY - 0.2, zOffset);
          _dummyObj.rotation.set(0, 0, 0);
          _dummyObj.scale.set(bWidth, bHeight, bDepth);
          _dummyObj.updateMatrix();
          this.buildingInstanced.setMatrixAt(bIdx, _dummyObj.matrix);

          if (worldSlot % 2 === 0) {
            const poleZ = side * (ROAD_WIDTH_M * 0.5 + 0.8);
            _dummyObj.position.set(propX, groundY, poleZ);
            _dummyObj.scale.set(1, 1, 1);
            _dummyObj.updateMatrix();
            this.lampPoleInstanced.setMatrixAt(bIdx, _dummyObj.matrix);

            _dummyObj.position.set(propX, groundY + 6.3, poleZ - side * 0.65);
            _dummyObj.scale.set(1, 1, 1);
            _dummyObj.updateMatrix();
            this.lampBulbInstanced.setMatrixAt(bIdx, _dummyObj.matrix);
          } else {
            _dummyObj.position.set(0, -100, 0);
            _dummyObj.scale.setScalar(0.001);
            _dummyObj.updateMatrix();
            this.lampPoleInstanced.setMatrixAt(bIdx, _dummyObj.matrix);
            this.lampBulbInstanced.setMatrixAt(bIdx, _dummyObj.matrix);
          }
        }
      } else {
        for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
          const side = sideIdx === 0 ? -1 : 1;
          const rIdx = i * 2 + sideIdx;
          const zDist = ROAD_WIDTH_M * 0.5 + 2.8 + ((hash * (sideIdx + 2)) % 14);
          const rScaleXZ = 1.6 + ((hash * 5) % 4.5);
          const rScaleY = 1.2 + ((hash * 11) % 6.8);

          _dummyObj.position.set(propX, groundY - 0.3, side * zDist);
          _dummyObj.rotation.set(0, hash % Math.PI, 0);
          _dummyObj.scale.set(rScaleXZ, rScaleY, rScaleXZ);
          _dummyObj.updateMatrix();
          this.desertRockInstanced.setMatrixAt(rIdx, _dummyObj.matrix);
        }
      }
    }

    if (isStreet) {
      this.buildingInstanced.instanceMatrix.needsUpdate = true;
      this.lampPoleInstanced.instanceMatrix.needsUpdate = true;
      this.lampBulbInstanced.instanceMatrix.needsUpdate = true;
      this.gantryBeamInstanced.instanceMatrix.needsUpdate = true;
      this.gantrySignInstanced.instanceMatrix.needsUpdate = true;
      this.guardRailLeftInstanced.instanceMatrix.needsUpdate = true;
      this.guardRailRightInstanced.instanceMatrix.needsUpdate = true;
    } else {
      this.desertRockInstanced.instanceMatrix.needsUpdate = true;
    }

    // 3. Update 3D Persistent Tire Skid Marks & Titanium Scrape Trails
    for (let i = 0; i < MAX_SKID_MARKS; i++) {
      const s = sim.skidMarks[i];
      if (!s || !s.active || s.worldX < bikeWorldX - 35) {
        _dummyObj.position.set(0, -100, 0);
        _dummyObj.scale.setScalar(0.001);
        _dummyObj.updateMatrix();
        this.skidMarkInstanced.setMatrixAt(i, _dummyObj.matrix);
        continue;
      }

      _dummyObj.position.set(
        s.worldX - (s.isScrapeSpark ? 0.62 : 0),
        s.worldY + 0.025,
        s.worldZ
      );
      _dummyObj.rotation.set(0, 0, 0);
      _dummyObj.scale.set(1, 1, s.isScrapeSpark ? 0.55 : 1.0);
      _dummyObj.updateMatrix();
      this.skidMarkInstanced.setMatrixAt(i, _dummyObj.matrix);

      const scrapeTrailColor =
        sim.dailyState.activeCosmetic === 'CYAN_SPARKS'
          ? '#22D3EE'
          : sim.dailyState.activeCosmetic === 'PLASMA_FLAME'
          ? '#C084FC'
          : '#FBBF24';
      _tempColor.set(s.isScrapeSpark ? scrapeTrailColor : '#090D16');
      this.skidMarkInstanced.setColorAt(i, _tempColor);
    }
    this.skidMarkInstanced.instanceMatrix.needsUpdate = true;
    if (this.skidMarkInstanced.instanceColor) {
      this.skidMarkInstanced.instanceColor.needsUpdate = true;
    }
  }

  private updateBikeAndRiderPose(
    sim: WheelieSimulation,
    bikeWorldX: number,
    bikeWorldY: number
  ) {
    const wheelRadiusM = 0.39;
    const suspDropM = sim.rearComp * 0.14;

    this.bikeRootGroup.position.set(bikeWorldX, bikeWorldY, sim.lateralZ);
    this.contactShadowMesh.position.set(0.75 * Math.cos(sim.angle), 0.02, 0);
    this.contactShadowMesh.scale.set(
      Math.max(0.45, 1.0 - sim.angle * 0.35),
      1,
      1
    );

    // Update 3D World-Space Balance Protractor Arc next to rear axle
    this.balanceArcGroup.visible =
      sim.inWheelie && !sim.isCrashed && this.cameraMode !== 'HELMET_POV';
    if (this.balanceArcGroup.visible) {
      this.balanceNeedleGroup.rotation.z = sim.angle;
      this.balanceNeedleMat.color.set(
        sim.isScraping ? '#FBBF24' : sim.inSweetSpot ? '#10B981' : '#FFFFFF'
      );
    }

    // Rear axle pitch + 3D lateral swerve roll angle!
    this.bikePitchGroup.position.set(0, wheelRadiusM - suspDropM * 0.35, 0);
    this.bikePitchGroup.rotation.set(
      sim.isCrashed ? 0.85 : sim.rollAngle,
      -sim.vz * 0.035,
      sim.angle
    );

    // Spin 3D Wheels
    this.rearWheelGroup.rotation.z = -sim.rearWheelSpinAngle;
    this.frontWheelGroup.rotation.z = -sim.frontWheelSpinAngle;

    // Front Fork Compression
    const forkOffset = -sim.frontComp * 0.12;
    this.forkLowerGroup.position.set(forkOffset * 0.4, forkOffset, 0);

    // Animated Clutch Lever pull
    this.clutchLeverMesh.rotation.y = sim.clutchPulled ? -0.45 : -0.1;

    // Glowing Rear Brake Rotor, LED Tail Light & Titanium Spark Block (+ Daily Reward Cosmetic)
    const activeCosmetic = sim.dailyState.activeCosmetic;
    this.rearRotorMat.emissiveIntensity = sim.rearBrakeHeat * 2.5;
    this.tailBrakeLightMat.emissiveIntensity =
      sim.rearBrakeHeat > 0.05 ? 4.2 : 0.85;
    this.sparkBlockMat.color.set(
      activeCosmetic === 'GOLD_TRIM' ? '#FACC15' : '#CBD5E1'
    );
    this.sparkBlockMat.emissive.set(
      activeCosmetic === 'CYAN_SPARKS'
        ? '#22D3EE'
        : activeCosmetic === 'PLASMA_FLAME'
        ? '#C084FC'
        : '#FEF08A'
    );
    this.sparkBlockMat.emissiveIntensity = sim.isScraping ? 3.5 : 0;

    // 3D Exhaust Backfire / Nitro Flame Cone
    this.exhaustFlameMesh.visible = sim.exhaustFlameIntensity > 0.08;
    if (this.exhaustFlameMesh.visible) {
      const fScale =
        (0.6 + Math.random() * 0.65) *
        sim.exhaustFlameIntensity *
        (sim.boostActive ? 1.45 : 1.0);
      this.exhaustFlameMesh.scale.set(fScale, 1, 1);
      (this.exhaustFlameMesh.material as THREE.MeshBasicMaterial).color.set(
        activeCosmetic === 'PLASMA_FLAME'
          ? '#C084FC'
          : sim.boostActive
          ? '#38BDF8'
          : '#FB923C'
      );
    }

    // Update 3D Articulated Rider Stunt Poses
    if (sim.isCrashed) {
      const ragWorldX = sim.ragdollX * WORLD_SCALE;
      const ragWorldY = (420 - sim.ragdollY) * WORLD_SCALE;
      this.riderGroup.position.set(
        ragWorldX - bikeWorldX,
        ragWorldY - bikeWorldY,
        0.35
      );
      this.riderGroup.rotation.set(
        sim.ragdollAngle * 0.5,
        0.4,
        -sim.ragdollAngle
      );
      return;
    }

    // Hide rider head in 1st-person HELMET_POV so visor never clips camera
    this.riderHeadGroup.visible = this.cameraMode !== 'HELMET_POV';

    this.riderGroup.position.set(0, 0, 0);
    this.riderGroup.rotation.set(0, 0, 0);

    const leanShift = sim.riderLean * 0.18;
    const squashM = sim.riderSquash * 0.18;

    // Reset default limb offsets & rotations
    this.riderHipGroup.position.set(0.32 + leanShift * 0.6, 0.95 - squashM, 0);
    this.riderTorsoGroup.rotation.set(0, 0, -0.38 - sim.riderLean * 0.28);
    this.riderHeadGroup.rotation.set(0, 0, 0.25 - sim.angle * 0.35);

    this.riderLeftArmGroup.rotation.set(0, 0, 0);
    this.riderRightArmGroup.rotation.set(0, 0, 0);
    this.riderLeftLegGroup.position.set(0, -0.04, -0.15);
    this.riderRightLegGroup.position.set(0, -0.04, 0.15);
    this.riderLeftLegGroup.rotation.set(0, 0, 0);
    this.riderRightLegGroup.rotation.set(0, 0, 0);

    // 1. Apply Persistent Pre-Wheelie & Mid-Wheelie Stunt Stance (Foot / Knee on Seat, Sub-Cage, Tank)
    if (sim.riderStance === 'KNEE_ON_SEAT') {
      // Left knee/shin planted on the seat cushion, right boot covering rear brake
      this.riderHipGroup.position.set(0.24 + leanShift * 0.5, 1.16 - squashM, 0);
      this.riderTorsoGroup.rotation.set(0, 0, -0.26 - sim.riderLean * 0.25);
      this.riderLeftLegGroup.position.set(-0.08, 0.16, -0.14);
      this.riderLeftLegGroup.rotation.set(0.18, 0, -1.05);
      this.riderRightLegGroup.position.set(0.06, -0.08, 0.15);
      this.riderRightLegGroup.rotation.set(0, 0, 0.12);
    } else if (sim.riderStance === 'FOOT_ON_SEAT') {
      // Both boots planted tall on top of the seat (Seat Stand)
      this.riderHipGroup.position.set(0.22 + leanShift * 0.45, 1.44 - squashM, 0);
      this.riderTorsoGroup.rotation.set(0, 0, -0.14 - sim.riderLean * 0.22);
      this.riderLeftLegGroup.position.set(-0.04, 0.08, -0.13);
      this.riderRightLegGroup.position.set(-0.04, 0.08, 0.13);
      this.riderLeftLegGroup.rotation.set(0, 0, -0.48);
      this.riderRightLegGroup.rotation.set(0, 0, -0.48);
    } else if (sim.riderStance === 'SUBCAGE_LOCK') {
      // Left boot locked back into the 12 o'clock steel sub-cage, right foot on rear brake
      this.riderHipGroup.position.set(0.14 + leanShift * 0.45, 1.2 - squashM, 0);
      this.riderTorsoGroup.rotation.set(0, 0, -0.24 - sim.riderLean * 0.24);
      this.riderLeftLegGroup.position.set(-0.22, 0.04, -0.14);
      this.riderLeftLegGroup.rotation.set(0, 0, -1.18);
      this.riderRightLegGroup.position.set(0.12, -0.06, 0.15);
      this.riderRightLegGroup.rotation.set(0, 0, 0.34);
    } else if (sim.riderStance === 'HIGH_CHAIR') {
      // Sitting on the fuel tank / handlebars with boots draped over the front plate
      this.riderHipGroup.position.set(0.84 + leanShift * 0.35, 1.15 - squashM, 0);
      this.riderTorsoGroup.rotation.set(0, 0, -0.48 - sim.riderLean * 0.2);
      this.riderLeftLegGroup.position.set(0.18, 0.04, -0.16);
      this.riderRightLegGroup.position.set(0.18, 0.04, 0.16);
      this.riderLeftLegGroup.rotation.set(0.18, 0.15, 1.22);
      this.riderRightLegGroup.rotation.set(-0.18, -0.15, 1.22);
    }

    // 2. Layer Dynamic Flair Tricks on top of the active Stance
    if (sim.activeTrick === 'ONE_HANDER' || sim.activeTrick === 'COASTER') {
      this.riderLeftArmGroup.rotation.set(-0.45, 0, 1.68);
    } else if (sim.activeTrick === 'SEAT_STAND') {
      this.riderHipGroup.position.set(0.24, 1.46, 0);
      this.riderTorsoGroup.rotation.set(0, 0, -0.12);
      this.riderLeftLegGroup.rotation.set(0, 0, -0.48);
      this.riderRightLegGroup.rotation.set(0, 0, -0.48);
      this.riderLeftArmGroup.rotation.set(-0.35, 0, 1.55);
    } else if (sim.activeTrick === 'NAC_NAC') {
      this.riderRightLegGroup.rotation.set(0.88, 0.38, -1.38);
    } else if (sim.activeTrick === 'BAR_HOP') {
      // Handlebar Foot Plant!
      this.riderHipGroup.position.set(0.65, 1.28, 0);
      this.riderTorsoGroup.rotation.set(0, 0, -0.62);
      this.riderLeftLegGroup.rotation.set(0, 0, 0.95);
      this.riderRightLegGroup.rotation.set(0, 0, 0.95);
    } else if (sim.activeTrick === 'FENDER_SCRAPE' && sim.riderStance === 'NORMAL') {
      this.riderHipGroup.position.set(0.18, 0.9, 0);
      this.riderTorsoGroup.rotation.set(0, 0, -0.58);
    }
  }

  private updateParticles3D(sim: WheelieSimulation) {
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = sim.particles[i];
      if (!p || !p.active) {
        _dummyObj.position.set(0, -100, 0);
        _dummyObj.scale.setScalar(0.001);
        _dummyObj.updateMatrix();
        this.particleInstanced.setMatrixAt(i, _dummyObj.matrix);
        continue;
      }

      const px = p.x * WORLD_SCALE;
      const py = Math.max(0.04, (420 - p.y) * WORLD_SCALE);
      const pz = p.z + ((i % 9) - 4) * 0.03;
      const lifeRatio = Math.max(0.1, p.life / p.maxLife);
      const scale =
        p.size * 0.22 * (p.kind === 'smoke' ? 1.8 - lifeRatio * 0.6 : lifeRatio);

      _dummyObj.position.set(px, py, pz);
      _dummyObj.scale.setScalar(scale);
      _dummyObj.updateMatrix();
      this.particleInstanced.setMatrixAt(i, _dummyObj.matrix);

      _tempColor.set(p.color.startsWith('rgba') ? '#CBD5E1' : p.color);
      this.particleInstanced.setColorAt(i, _tempColor);
    }

    this.particleInstanced.instanceMatrix.needsUpdate = true;
    if (this.particleInstanced.instanceColor) {
      this.particleInstanced.instanceColor.needsUpdate = true;
    }
  }

  private updateCameraAndLights(
    sim: WheelieSimulation,
    bikeWorldX: number,
    bikeWorldY: number,
    dt: number,
    width: number
  ) {
    const isMobile = width < 640;
    const speedFactor = Math.min(1, sim.vx / 520);
    const wheelieLift = Math.sin(sim.angle) * 1.1;
    const bikeZ = sim.lateralZ;

    // 360° 3D Garage Showroom Camera when browsing Bikes & Maps!
    if (sim.gameState === 'GARAGE_MENU') {
      const orbitAngle = performance.now() * 0.00055;
      const radius = isMobile ? 4.8 : 3.9;
      _camTargetPos.set(
        bikeWorldX + 0.9 + Math.cos(orbitAngle) * radius * 0.75,
        bikeWorldY + 1.55 + Math.sin(orbitAngle * 2) * 0.2,
        bikeZ + 2.4 + Math.sin(orbitAngle) * 1.4
      );
      _camLookTarget.set(
        bikeWorldX + 0.5,
        bikeWorldY + 1.05 + wheelieLift * 0.35,
        bikeZ
      );
    } else if (this.cameraMode === 'CHASE') {
      const backDist = isMobile ? 5.6 : 4.7;
      const sideOffset = isMobile ? 2.4 : 2.15;
      const heightOffset = (isMobile ? 2.45 : 2.15) + wheelieLift * 0.25;

      _camTargetPos.set(
        bikeWorldX - backDist - speedFactor * 0.65,
        bikeWorldY + heightOffset,
        bikeZ + sideOffset
      );
      _camLookTarget.set(
        bikeWorldX + 5.2 + speedFactor * 2.2,
        bikeWorldY + 1.1 + wheelieLift * 0.45,
        bikeZ - 0.2
      );
    } else if (this.cameraMode === 'SIDE_3D') {
      const sideDist = isMobile ? 7.4 : 6.0;
      _camTargetPos.set(
        bikeWorldX + 0.4,
        bikeWorldY + 1.8 + wheelieLift * 0.2,
        bikeZ + sideDist
      );
      _camLookTarget.set(
        bikeWorldX + 1.4,
        bikeWorldY + 1.05 + wheelieLift * 0.35,
        bikeZ
      );
    } else if (this.cameraMode === 'HELMET_POV') {
      const cosA = Math.cos(sim.angle);
      const sinA = Math.sin(sim.angle);
      const localEyeX = 0.48;
      const localEyeY = 1.66;
      const worldEyeX = bikeWorldX + localEyeX * cosA - localEyeY * sinA;
      const worldEyeY = bikeWorldY + 0.38 + localEyeX * sinA + localEyeY * cosA;

      _camTargetPos.set(worldEyeX, worldEyeY, bikeZ);
      _camLookTarget.set(
        worldEyeX + 14 * cosA,
        worldEyeY + 4.4 * sinA - 0.5,
        bikeZ + sim.vz * 0.8
      );
    } else {
      // LOW_HERO Scrape Cam
      _camTargetPos.set(
        bikeWorldX - 3.0,
        bikeWorldY + 0.78,
        bikeZ + 1.45
      );
      _camLookTarget.set(
        bikeWorldX + 3.2,
        bikeWorldY + 1.3 + wheelieLift * 0.5,
        bikeZ
      );
    }

    if (sim.shakeTrauma > 0.01) {
      const shake = sim.shakeTrauma * sim.shakeTrauma * 0.22;
      _camTargetPos.x += (Math.random() - 0.5) * shake;
      _camTargetPos.y += (Math.random() - 0.5) * shake;
      _camTargetPos.z += (Math.random() - 0.5) * shake;
    }

    const dampLambda = this.cameraMode === 'HELMET_POV' ? 26 : 11;
    this.currentCamPos.x = THREE.MathUtils.damp(
      this.currentCamPos.x,
      _camTargetPos.x,
      dampLambda,
      dt
    );
    this.currentCamPos.y = THREE.MathUtils.damp(
      this.currentCamPos.y,
      _camTargetPos.y,
      dampLambda,
      dt
    );
    this.currentCamPos.z = THREE.MathUtils.damp(
      this.currentCamPos.z,
      _camTargetPos.z,
      dampLambda,
      dt
    );

    this.currentLookAt.x = THREE.MathUtils.damp(
      this.currentLookAt.x,
      _camLookTarget.x,
      dampLambda + 4,
      dt
    );
    this.currentLookAt.y = THREE.MathUtils.damp(
      this.currentLookAt.y,
      _camLookTarget.y,
      dampLambda + 4,
      dt
    );
    this.currentLookAt.z = THREE.MathUtils.damp(
      this.currentLookAt.z,
      _camLookTarget.z,
      dampLambda + 4,
      dt
    );

    const targetFov =
      this.cameraMode === 'HELMET_POV'
        ? 68 + speedFactor * 10 + (sim.boostActive ? 8 : 0)
        : 55 +
          speedFactor * 9 +
          (sim.isScraping ? 4 : 0) +
          (sim.boostActive ? 7 : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
      this.camera.updateProjectionMatrix();
    }

    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentLookAt);

    this.dirLight.position.set(bikeWorldX + 14, bikeWorldY + 24, bikeZ + 14);
    this.dirLight.target.position.set(bikeWorldX + 2, bikeWorldY, bikeZ);
    this.dirLight.target.updateMatrixWorld();

    this.rimLight.position.set(bikeWorldX - 12, bikeWorldY + 10, bikeZ - 14);
    this.rimLight.target.position.set(bikeWorldX, bikeWorldY + 1, bikeZ);
    this.rimLight.target.updateMatrixWorld();
  }

  public render(sim: WheelieSimulation, width: number, height: number) {
    const now = performance.now();
    const dt = Math.min(
      0.05,
      Math.max(0.001, (now - this.lastRenderTime) / 1000)
    );
    this.lastRenderTime = now;

    this.syncCourseAndBikeAppearance(sim.course, sim.bike);

    const bikeWorldX = sim.x * WORLD_SCALE;
    const bikeWorldY = (420 - sim.y) * WORLD_SCALE;

    this.updateRoadAndScenery(sim, bikeWorldX);
    this.updateBikeAndRiderPose(sim, bikeWorldX, bikeWorldY);
    this.updateParticles3D(sim);
    this.updateCameraAndLights(sim, bikeWorldX, bikeWorldY, dt, width);

    this.renderer.render(this.scene, this.camera);
  }

  public dispose() {
    this.streetTexture.dispose();
    this.dirtTexture.dispose();
    this.buildingWindowTexture.dispose();
    this.roadGeometry.dispose();
    this.roadMaterial.dispose();
    this.groundApronMaterial.dispose();
    this.renderer.dispose();
  }
}
