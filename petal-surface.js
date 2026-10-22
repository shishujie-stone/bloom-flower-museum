import * as THREE from './vendor/three.module.js';

// Botanical microstructure is expressed in UV space, so it stays attached while petals open.
// DataTextures work without a canvas or an external asset request.
export function makePetalMaterial(species) {
  const w=256,h=512;
  const delicate=['narcissus','plum-blossom','orchid','azalea','osmanthus'].includes(species);
  const pigment=new Uint8Array(w*h*4),height=new Uint8Array(w*h*4),roughness=new Uint8Array(w*h*4);
  const parallel=['lotus','narcissus','orchid','chrysanthemum'].includes(species);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const u=x/(w-1)*2-1,v=y/(h-1),i=(y*w+x)*4;
    const hash=Math.sin(x*127.1+y*311.7)*43758.5453;
    const grain=hash-Math.floor(hash);
    const warp=u*(parallel?1:1+.30*v)+.015*Math.sin(v*12+u*4);
    const fine=Math.pow(.5+.5*Math.cos(warp*175+Math.sin(v*20)*.5),16);
    const major=Math.pow(.5+.5*Math.cos(warp*51+Math.sin(v*7)),22);
    const branches=parallel?0:Math.pow(.5+.5*Math.cos(u*68-v*130),22)*.30;
    const branching=Math.pow(.5+.5*Math.cos(u*54+Math.abs(Math.sin(v*18))*2-v*35),20);
    const vein=(fine*.34+major*.45+branches+(species==='plum-blossom'?branching*.35:0))*Math.sin(Math.PI*v)**.35;
    const shade=clampByte(252-vein*(delicate?19:33)-(1-grain)*(delicate?4:7));
    pigment.set([shade,shade,shade,255],i);
    const relief=clampByte(128+vein*50+(grain-.5)*22);
    height.set([relief,relief,relief,255],i);
    const matte=clampByte(232+grain*18-vein*9);roughness.set([matte,matte,matte,255],i);
  }
  const texture=data=>{
    const map=new THREE.DataTexture(data,w,h,THREE.RGBAFormat);
    map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;
    map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;
    map.generateMipmaps=true;map.anisotropy=4;map.needsUpdate=true;return map;
  };
  const map=texture(pigment);map.colorSpace=THREE.SRGBColorSpace;
  const bump=texture(height);
  const material=new THREE.MeshPhysicalMaterial({
    color:'#fff',vertexColors:true,side:THREE.DoubleSide,
    map,bumpMap:bump,bumpScale:species==='osmanthus'?.003:.006,
    roughnessMap:texture(roughness),roughness:delicate?.94:species==='camellia'?.76:.87,metalness:0,
    ior:1.38,specularIntensity:delicate?.12:.17,sheen:delicate?.32:.20,
    sheenColor:new THREE.Color('#ffe9df'),sheenRoughness:1,
  });
  material.shadowSide=THREE.DoubleSide;
  // A restrained thin-tissue scattering term softens the unlit side without making petals glassy.
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      vec3 tissueLight = normalize((viewMatrix * vec4(-3.0,4.0,4.5,0.0)).xyz);
      float throughPetal = pow(max(0.0,dot(-normal,tissueLight)),2.0);
      reflectedLight.indirectDiffuse += diffuseColor.rgb * (0.05 + throughPetal * 0.24);
    `);
  };
  material.customProgramCacheKey=()=> 'bloom-thin-tissue-v1';
  return material;
}
function clampByte(n){return Math.max(0,Math.min(255,Math.round(n)));}
export function disposePetalTextures(material){
  const maps=new Set([material.map,material.bumpMap,material.roughnessMap].filter(Boolean));
  maps.forEach(texture=>texture.dispose());
}
