import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { createSpecimenModel } from './flower-models.js?v=narcissus-bud-7';
import { disposePetalTextures } from './petal-surface.js?v=narcissus-bud-7';

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
export function createFlowerView(container, onManualRotate = () => {}) {
  const scene = new THREE.Scene();
  scene.background = null;
  const camera = new THREE.PerspectiveCamera(34, 1, .03, 40);
  camera.position.set(.35, 1.9, 5.1);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor('#ffffff', 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', '放大的桂花三维模型。拖动旋转，滚轮或双指缩放；聚焦后用方向键旋转。');
  container.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, .08, .08);
  controls.enableDamping = true;
  controls.dampingFactor = .075;
  controls.enablePan = false;
  controls.minDistance = 2.8;
  controls.maxDistance = 9;
  controls.minPolarAngle = .08;
  controls.maxPolarAngle = Math.PI - .08;
  controls.autoRotateSpeed = .6;
  controls.update();

  const ambient=new THREE.HemisphereLight('#fffaf5', '#c6c3bc', 1.65);scene.add(ambient);
  const key = new THREE.DirectionalLight('#fff9f2', 2.65);
  key.position.set(-3, 4, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: .1, far: 15 });
  key.shadow.normalBias = .012;
  key.shadow.bias = -.00008;
  key.shadow.radius = 5;
  key.shadow.blurSamples = 8;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#f4f7ff', 2.0);
  fill.position.set(3, -3, 5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#fff5e7', 1.65);
  rim.position.set(-1, 2, -3);
  scene.add(rim);

  let activeSpecies = 'osmanthus';
  let activeModel = createSpecimenModel(activeSpecies);
  scene.add(activeModel.group);
  const setBloom = value => { activeModel.setBloom(value); renderer.shadowMap.needsUpdate = true; };
  let visible = true, disposed = false, lastRender = 0;
  let cameraTween = null;
  let handOrbit=null;
  const handOffset=new THREE.Vector3(),handSphere=new THREE.Spherical();
  function beginHandRotation(){
    cameraTween=null;controls.autoRotate=false;
    handSphere.setFromVector3(handOffset.copy(camera.position).sub(controls.target));
    handOrbit={theta:handSphere.theta,phi:handSphere.phi,radius:handSphere.radius,last:performance.now()};
  }
  function endHandRotation(){handOrbit=null;}
  function setView(view = 'front', immediate = false) {
    const layered=['peony','china-rose','chrysanthemum','lotus','camellia'].includes(activeSpecies);
    const views = { front: layered ? [.35, -3.3, 4.4] : [.25,-.6,5.4], side: [5.2, -.8, .9], back: [-.35, -.8, -5.4] };
    handOrbit=null;controls.autoRotate = false;
    const end = new THREE.Vector3(...(views[view] || views.front));
    if (immediate) { camera.position.copy(end); controls.target.set(0, .08, .08); controls.update(); cameraTween = null; }
    else cameraTween = { start: camera.position.clone(), end, time: performance.now() };
  }
  controls.addEventListener('start', () => { cameraTween = null; handOrbit=null; onManualRotate(); });
  renderer.domElement.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault(); cameraTween = null; handOrbit=null; onManualRotate();
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    if (event.key === 'ArrowLeft') spherical.theta -= .12;
    if (event.key === 'ArrowRight') spherical.theta += .12;
    if (event.key === 'ArrowUp') spherical.phi = Math.max(.08, spherical.phi - .12);
    if (event.key === 'ArrowDown') spherical.phi = Math.min(Math.PI - .08, spherical.phi + .12);
    camera.position.copy(new THREE.Vector3().setFromSpherical(spherical).add(controls.target)); controls.update();
  });
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(17)) * Math.max(1, .95 / camera.aspect)));
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  function frame(now) {
    if (disposed) return;
    requestAnimationFrame(frame);
    if (!visible || document.hidden || now - lastRender < 1000 / 45) return;
    lastRender = now;
    if (cameraTween) {
      const t = clamp((now - cameraTween.time) / 850, 0, 1);
      // 在球面上移动相机，避免正背切换时穿过花心。
      const from = new THREE.Spherical().setFromVector3(cameraTween.start.clone().sub(controls.target));
      const to = new THREE.Spherical().setFromVector3(cameraTween.end.clone().sub(controls.target));
      let angleDelta = to.theta - from.theta;
      if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
      if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
      const e = t * t * (3 - 2 * t);
      camera.position.copy(new THREE.Vector3().setFromSpherical(new THREE.Spherical(lerp(from.radius,to.radius,e),lerp(from.phi,to.phi,e),from.theta+angleDelta*e)).add(controls.target));
      if (t >= 1) cameraTween = null;
    }
    if(handOrbit){
      handSphere.setFromVector3(handOffset.copy(camera.position).sub(controls.target));
      const alpha=1-Math.exp(-Math.min(100,now-handOrbit.last)/65);handOrbit.last=now;
      handSphere.theta+=Math.round((handOrbit.theta-handSphere.theta)/(Math.PI*2))*Math.PI*2;
      handSphere.theta+=(handOrbit.theta-handSphere.theta)*alpha;
      handSphere.phi+=(handOrbit.phi-handSphere.phi)*alpha;
      handSphere.radius=handOrbit.radius;
      camera.position.copy(handOffset.setFromSpherical(handSphere).add(controls.target));
    }
    controls.update(); renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  return {
    setBloom, setView, beginHandRotation, endHandRotation,
    rotateByHand(dx,dy){
      if(!handOrbit)beginHandRotation();
      handOrbit.theta-=dx*Math.PI*2;
      handOrbit.phi=clamp(handOrbit.phi+dy*Math.PI,.2,Math.PI-.2);
    },
    setSpecies(id, name) {
      const delicate=['narcissus','plum-blossom','orchid','azalea','osmanthus'].includes(id);
      ambient.intensity=delicate?1.05:1.65;fill.intensity=delicate?.95:2.0;key.intensity=delicate?2.9:2.65;
      if (id !== activeSpecies) {
        scene.remove(activeModel.group); activeModel.dispose();
        activeModel = createSpecimenModel(id); activeSpecies = id;
        scene.add(activeModel.group);
        renderer.shadowMap.needsUpdate = true;
      }
      renderer.domElement.setAttribute('aria-label', `放大的${name}三维模型。拖动旋转，滚轮或双指缩放；聚焦后用方向键旋转。`);
    },
    setVisible(value) { visible = value; if (value) resize(); },
    setAutoRotate(value) { cameraTween = null; controls.autoRotate = value; },
    dispose() { disposed = true; observer.disconnect(); controls.dispose(); const geometries = new Set(), materials = new Set(); scene.traverse(o => { if(o.geometry) geometries.add(o.geometry); if(o.material) materials.add(o.material); }); geometries.forEach(g=>g.dispose()); materials.forEach(m=>{disposePetalTextures(m);m.dispose();}); key.shadow.dispose(); renderer.dispose(); renderer.domElement.remove(); },
  };
}
