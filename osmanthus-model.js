import * as THREE from './vendor/three.module.js';
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
export function createOsmanthusModel() {
  const flower = new THREE.Group();
  flower.rotation.z = -.13;

  const petals = [];
  const petalMaterial = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', vertexColors: true, roughness: .59, metalness: 0,
    side: THREE.DoubleSide, sheen: .12, sheenColor: new THREE.Color('#fff3cc'),
    sheenRoughness: .8, clearcoat: .025, clearcoatRoughness: .8,
  });
  const longitudinal = 48, across = 30;
  const baseColor = new THREE.Color('#efbb53'), tipColor = new THREE.Color('#ffe29a');
  for (let petal = 0; petal < 4; petal++) {
    const count = (longitudinal + 1) * (across + 1);
    const vertices = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const indices = [];
    for (let r = 0; r <= longitudinal; r++) {
      const u = r / longitudinal;
      for (let c = 0; c <= across; c++) {
        const v = c / across * 2 - 1;
        const vein = Math.cos(v * 45 + Math.sin(u * 2) * 1.5) * .005;
        const color = baseColor.clone().lerp(tipColor, Math.min(1, u * 1.4));
        color.multiplyScalar(1 + vein);
        const index = r * (across + 1) + c;
        colors.set([color.r, color.g, color.b], index * 3);
        if (r < longitudinal && c < across) {
          const a = index, b = index + 1, d = index + across + 1, e = d + 1;
          indices.push(a, d, b, b, d, e);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, petalMaterial);
    mesh.rotation.z = petal * Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `corolla-lobe-${petal + 1}`;
    flower.add(mesh);
    petals.push(mesh);
  }

  const tubeMaterial = new THREE.MeshStandardMaterial({ color: '#e8b342', roughness: .67, side: THREE.DoubleSide });
  const tubePoints = [new THREE.Vector2(.075, -.16), new THREE.Vector2(.10, -.08), new THREE.Vector2(.12, .05), new THREE.Vector2(.17, .19), new THREE.Vector2(.20, .24)];
  const tube = new THREE.Mesh(new THREE.LatheGeometry(tubePoints, 40), tubeMaterial);
  tube.rotation.x = Math.PI / 2;
  tube.castShadow = tube.receiveShadow = true;
  tube.name = 'short-corolla-tube';
  flower.add(tube);

  const stemMaterial = new THREE.MeshStandardMaterial({ color: '#81905a', roughness: .82 });
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(.10, -.35, -1.15), new THREE.Vector3(.04, -.11, -.75),
    new THREE.Vector3(0, -.02, -.35), new THREE.Vector3(0, 0, -.1),
  ]);
  const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 30, .045, 10, false), stemMaterial);
  stem.castShadow = stem.receiveShadow = true;
  stem.name = 'pedicel';
  flower.add(stem);
  const calyx = new THREE.Mesh(new THREE.SphereGeometry(.15, 24, 16), stemMaterial);
  calyx.scale.set(1, 1, .55); calyx.position.z = -.14;
  calyx.name = 'calyx'; flower.add(calyx);
  for (let i = 0; i < 4; i++) {
    const sepalShape = new THREE.Shape();
    sepalShape.moveTo(0, .04); sepalShape.bezierCurveTo(-.10, .10, -.09, .23, 0, .30);
    sepalShape.bezierCurveTo(.09, .23, .10, .10, 0, .04);
    const sepal = new THREE.Mesh(new THREE.ShapeGeometry(sepalShape, 16), new THREE.MeshStandardMaterial({ color: '#a1a361', roughness: .9, side: THREE.DoubleSide }));
    sepal.rotation.z = i * Math.PI / 2 + .4;
    sepal.position.z = -.13;
    sepal.castShadow = true; flower.add(sepal);
  }

  // 桂花仅有两枚雄蕊，每枚花药用两个药室表现，不增加雄蕊数量。
  const flowerCenter = new THREE.Group(); flower.add(flowerCenter);
  const antherMaterial = new THREE.MeshStandardMaterial({ color: '#c78f23', roughness: .9 });
  const filamentMaterial = new THREE.MeshStandardMaterial({ color: '#f6ce66', roughness: .85 });
  function rod(start, end, radius, material) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 10), material);
    mesh.position.copy(start).add(end).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return mesh;
  }
  for (const sign of [-1, 1]) {
    const stamen = new THREE.Group(); stamen.name = `stamen-${sign < 0 ? 1 : 2}`;
    stamen.add(rod(new THREE.Vector3(sign * .08, .015, .03), new THREE.Vector3(sign * .09, .02, .24), .012, filamentMaterial));
    for (const cell of [-1, 1]) {
      const anther = new THREE.Mesh(new THREE.SphereGeometry(.027, 16, 12), antherMaterial);
      anther.position.set(sign * .09 + cell * .019, .02, .24);
      anther.scale.set(.7, 1.35, .72); stamen.add(anther);
    }
    flowerCenter.add(stamen);
  }
  const pistilMaterial = new THREE.MeshStandardMaterial({ color: '#a6a34f', roughness: .8 });
  const pistil = rod(new THREE.Vector3(0, -.025, -.01), new THREE.Vector3(0, -.025, .21), .013, pistilMaterial);
  pistil.name = 'pistil'; flowerCenter.add(pistil);
  const stigma = new THREE.Mesh(new THREE.SphereGeometry(.022, 14, 10), pistilMaterial);
  stigma.position.set(0, -.025, .21); flowerCenter.add(stigma);

  let bloom = -1;
  function setBloom(value) {
    const t = clamp(value, 0, 1);
    if (Math.abs(bloom - t) < .00001) return;
    bloom = t;
    petals.forEach((mesh, i) => {
      const progress = clamp(t * 1.075 - i * .025, 0, 1);
      const p = progress * progress * (3 - 2 * progress);
      const attribute = mesh.geometry.getAttribute('position');
      for (let row = 0; row <= longitudinal; row++) {
        const u = row / longitudinal;
        const oval = Math.pow(Math.max(0, Math.sin(Math.PI * u)), .52);
        const radius = .15 + 1.15 * u;
        const width = (.475 + .012 * Math.sin(i + 1)) * oval;
        const closedRadius = .105 * (1 - u) + .32 * Math.sin(Math.PI * u);
        for (let column = 0; column <= across; column++) {
          const v = column / across * 2 - 1;
          const x = lerp(closedRadius * Math.sin(v * .87), v * width, p);
          const y = lerp(closedRadius * Math.cos(v * .87), radius + .014 * Math.sin(u * 4 + i), p);
          const closedZ = .20 + .94 * u;
          const openZ = .23 + .09 * Math.sin(u * Math.PI) - .14 * u * u + .085 * v * v * oval;
          const rib = .001 * Math.cos(v * 45 + Math.sin(u * 2)) * Math.sin(Math.PI * u);
          attribute.setXYZ(row * (across + 1) + column, x, y, lerp(closedZ, openZ, p) + rib);
        }
      }
      attribute.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      mesh.geometry.computeBoundingSphere();
    });
    flowerCenter.scale.setScalar(lerp(.06, 1, clamp((t - .12) / .60, 0, 1)));
    flowerCenter.visible = t > .14;
  }
  setBloom(1);
  return {group: flower, setBloom};
}
