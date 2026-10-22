import * as THREE from './vendor/three.module.js';
import { makePetalMaterial, disposePetalTextures } from './petal-surface.js?v=narcissus-bud-7';

const { clamp, lerp } = THREE.MathUtils;
const TAU = Math.PI * 2;
const v3 = (x,y,z) => new THREE.Vector3(x,y,z);

function disposeGroup(group) {
  const geometries = new Set(), materials = new Set();
  group.traverse(mesh => {
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => {disposePetalTextures(m);m.dispose();});
}
function standard(color, roughness=.7) {
  return new THREE.MeshStandardMaterial({color,roughness,side:THREE.DoubleSide});
}
function rod(parent, a, b, radius, material) {
  const delta = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),7),material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(v3(0,1,0),delta.normalize());
  mesh.castShadow = true; parent.add(mesh); return mesh;
}
function sphere(parent, position, radius, material, scale=[1,1,1]) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius,12,8),material);
  mesh.position.copy(position); mesh.scale.fromArray(scale); mesh.castShadow = true; parent.add(mesh); return mesh;
}
function tubeMesh(profile, material, count=32) {
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),count),material);
  mesh.rotation.x = Math.PI/2;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

// 独立花瓣保留有机差异；先计算闭合/开放端点，开合时只插值，避免逐帧重建细节。
function addPetal(group, spec, material) {
  const rows=spec.rows || 56, cols=spec.cols || 28;
  const count=(rows+1)*(cols+1), position=new Float32Array(count*3);
  const closed=new Float32Array(position.length), opened=new Float32Array(position.length);
  const colors=new Float32Array(position.length), uv=new Float32Array(count*2), indices=[];
  const seed=spec.seed ?? (spec.angle || 0)*2.17+1.43;
  const variation=Math.sin(seed*12.91);
  const base=new THREE.Color(spec.baseColor || '#ffe2da');
  const tip=new THREE.Color(spec.tipColor || '#ed6594');
  const spot=new THREE.Color('#8a2441');
  const length=(spec.length || 1.1)*(1+.035*variation),width=(spec.width || .42)*(1+.06*Math.sin(seed*7.3));
  const root=spec.root ?? .025, bend=spec.bend ?? (spec.cup || 0)*2.0;
  const phase=seed*3.7;
  for(let r=0;r<=rows;r++) for(let c=0;c<=cols;c++) {
    const u=r/rows, v=c/cols*2-1, index=r*(cols+1)+c;
    // Cosine spacing resolves the rounded base/tip and avoids the old pointed, faceted petal ends.
    const t=(1-Math.cos(Math.PI*u))/2;
    const outline=Math.pow(Math.max(0,Math.sin(Math.PI*t)),spec.outlinePower ?? (spec.pointed ? .82 : .43));
    const widthShape=outline*(.84+.27*t)*(1+(spec.tipFullness || 0)*(t-.4))*(1+.045*v*Math.sin(phase));
    const edge=Math.abs(v);
    const closedR=.075*(1-t)+(spec.budRadius || .34)*Math.sin(Math.PI*t);
    const angular=spec.sectorHalfAngle ? v*spec.sectorHalfAngle : v*(spec.closedAngle || .75)+.06*t*variation;
    closed.set([closedR*Math.sin(angular),closedR*Math.cos(angular),.10+(spec.budLength || 1.12)*t],index*3);
    let radial=root+length*(Math.abs(bend)<.001?t:Math.sin(bend*t)/bend);
    let depth=(spec.z ?? .10)+length*(Math.abs(bend)<.001?0:(1-Math.cos(bend*t))/bend);
    const hook=spec.hook || 0;
    radial-=hook*.16*Math.pow(t,6);
    depth+=hook*.17*Math.pow(t,5)+(spec.reflex || 0)*Math.pow(t,4);
    const edgeWave=(spec.ruffle || .008)*(Math.sin(v*12+phase+t*5)+.36*Math.sin(v*23-phase))*Math.pow(t,1.6)*Math.pow(edge,1.8)*outline;
    const edgeBend=(spec.edgeCurl ?? .06)*v*v*outline*(1+(spec.basalCup || 0)*(1-t)**2);
    const broadFold=(spec.fold ?? .016)*Math.sin(v*5+phase+t*3)*outline*edge;
    const asymmetry=.025*variation*v*Math.sin(Math.PI*t);
    const tipSweep=.03*Math.sin(phase)*t*t;
    const crossBend=spec.crossBend ?? .65;
    const petalWidth=width*widthShape*(1+(spec.ruffle || .008)*1.6*Math.sin(t*25+phase)*Math.pow(edge,2));
    let x=Math.sin(v*crossBend)/Math.sin(crossBend)*petalWidth+tipSweep;
    radial-=(1-Math.cos(v*crossBend))*petalWidth;
    radial+=.012*Math.sin(phase+v*9)*Math.pow(edge,3)*Math.sin(Math.PI*t);
    depth+=(spec.ridge || 0)*Math.exp(-v*v*14)*Math.sin(Math.PI*t)
      +(spec.pleat || 0)*Math.sin(v*18+Math.sin(t*5+phase)*.5)*outline*(.3+.7*edge)
      +edgeBend+edgeWave+broadFold+asymmetry+v*width*outline*(spec.overlap ?? .28);
    // Keep sparse petals inside disjoint radial sectors, including during interpolation.
    // A smooth width bound prevents the broad basal edges from crossing their neighbours.
    if(spec.sectorHalfAngle){
      const limit=Math.max(.001,radial)*Math.tan(spec.sectorHalfAngle);
      x=x/Math.pow(1+Math.pow(x/limit,8),1/8);
    }
    const twist=(spec.twist || 0)*t;
    opened.set([x*Math.cos(twist)-radial*Math.sin(twist),radial*Math.cos(twist)+x*Math.sin(twist),depth],index*3);
    const pigment=clamp(Math.pow(t,1.55)*.84+Math.pow(edge,3)*t*.13,0,1);
    const color=base.clone().lerp(tip,spec.rootPigment ? 1-Math.exp(-t*6) : pigment);
    if(spec.edgeTint)color.lerp(new THREE.Color(spec.edgeTint),Math.pow(edge,5)*.15);
    color.multiplyScalar(1+.025*Math.sin(phase)+.018*Math.cos(v*24+t*5));
    if(spec.spots && t>.25 && t<.85) {
      const spots=Math.sin(t*61+v*9)*Math.cos(v*27-t*5);
      const mask=clamp((spots-.65)*8,0,1)*(1-Math.pow(edge,3));
      color.lerp(spot,mask*.86);
    }
    colors.set([color.r,color.g,color.b],index*3);uv.set([c/cols,t],index*2);
    if(r<rows&&c<cols){const a=index,b=a+1,d=a+cols+1,e=d+1;indices.push(a,b,d,b,e,d);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(position,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(indices);
  const mesh=new THREE.Mesh(geometry,material);mesh.rotation.z=(spec.angle || 0)+.035*variation;
  mesh.name=spec.name || 'petal';
  if(spec.whorl!==undefined)mesh.userData.whorl=spec.whorl;
  mesh.castShadow=true;mesh.receiveShadow=false;group.add(mesh);
  let last=-1;
  return {mesh,update(value){
    const t=clamp((value-(spec.delay || 0))/(1-(spec.delay || 0)),0,1),p=t*t*(3-2*t);
    if(Math.abs(last-p)<.00001)return;last=p;
    if(spec.whorl!==undefined){
      // Rounded, tapered bud endpoint replaces the old open-ended cylinder.
      // Restore the separated broad whorls smoothly as the flower opens.
      for(let i=0;i<position.length;i+=3){
        const x=opened[i],y=opened[i+1],r=Math.hypot(x,y);
        const row=Math.floor(i/3/(cols+1)),col=(i/3)%(cols+1);
        const u=(1-Math.cos(Math.PI*row/rows))/2;
        const v=col/cols*2-1;
        const budRadius=(.075*(1-u)+.30*Math.sin(Math.PI*u))*(spec.whorl? .90:1);
        const angle=v*.60+.025*u*variation;

        position[i]=lerp(budRadius*Math.sin(angle),x,p);
        position[i+1]=lerp(budRadius*Math.cos(angle),y,p);
        position[i+2]=lerp(.08+1.12*u-spec.whorl*.035*u,.08+.12*Math.sin(Math.PI*r/1.3)-.10*r*r,p)
          +spec.whorl*.115*p+(opened[i+2]-(spec.z??.10))*.30*p;
      }
    }else for(let i=0;i<position.length;i++)position[i]=lerp(closed[i],opened[i],p);
    geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();
    // At collapsed end rows all vertices share a pole. Use the adjacent row normal instead of a zero normal.
    const n=geometry.attributes.normal;
    for(const r of [0,rows]){
      const averaged=new THREE.Vector3();
      for(let c=0;c<=cols;c++){
        const adjacent=(r===0?1:rows-1)*(cols+1)+c;
        averaged.add(new THREE.Vector3(n.getX(adjacent),n.getY(adjacent),n.getZ(adjacent)));
      }
      averaged.normalize();
      for(let c=0;c<=cols;c++)n.setXYZ(r*(cols+1)+c,averaged.x,averaged.y,averaged.z);
    }
    n.needsUpdate=true;geometry.computeBoundingSphere();
  }};
}

function leafSurface(parent,{length=.85,width=.22,angle=0,position=[0,0,0],strap=false,serrate=false}={}) {
  const rows=44,cols=16,vertices=[],colors=[],uv=[],indices=[];
  const dark=new THREE.Color('#254a24'),light=new THREE.Color('#6e8e43');
  for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++){
    const u=r/rows,v=c/cols*2-1;
    const outline=Math.sin(Math.PI*u)**(strap?.72:.78);
    const tooth=serrate?1+.025*Math.sin(u*125):1;
    const x=v*width*outline*tooth;
    const z=.11*Math.sin(Math.PI*u)-.10*u*u+.08*Math.abs(v)*outline;
    vertices.push(x,length*u,z);
    const main=Math.exp(-Math.abs(v)*65);
    const sideVein=Math.pow(.5+.5*Math.cos(u*75-Math.abs(v)*11),24)*.22;
    const color=dark.clone().lerp(light,.28+main*.42+sideVein);
    colors.push(color.r,color.g,color.b);uv.push(c/cols,u);
    const i=r*(cols+1)+c;
    if(r<rows&&c<cols)indices.push(i,i+1,i+cols+1,i+1,i+cols+2,i+cols+1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new THREE.MeshPhysicalMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.5,specularIntensity:.35});
  const leaf=new THREE.Mesh(geometry,material);leaf.name='veined-leaf';leaf.rotation.z=angle;leaf.position.fromArray(position);leaf.castShadow=leaf.receiveShadow=true;parent.add(leaf);
  return leaf;
}

function support(group, {woody=false,sepals=5,longSepals=false,leaves=false,strap=false,thorn=false,receptacleZ=-.09,sepalZ=-.1,neckTop=.16}={}) {
  const green=standard('#7b925e'),wood=standard(woody?'#79583e':'#829566');
  const curve=new THREE.CatmullRomCurve3([v3(.15,-1.40,-.62),v3(.08,-.85,-.44),v3(.02,-.30,-.24),v3(0,0,-.04)]);
  const stem=new THREE.Mesh(new THREE.TubeGeometry(curve,20,woody?.052:.04,8,false),wood);
  stem.name=woody?'woody-stem':'flower-stalk';stem.castShadow=true;group.add(stem);
  sphere(group,v3(0,0,receptacleZ),.17,green,[1,1,.65]);
  // Bridge the receptacle to petal bases; side views must not show a floating flower head.
  const neck=sphere(group,v3(0,0,(receptacleZ+neckTop)/2),.085,green,[1,1,(neckTop-receptacleZ)/.17]);
  neck.name='floral-neck';
  const sepalMat=standard('#879c63');
  for(let i=0;i<sepals;i++) {
    const shape=new THREE.Shape();shape.moveTo(0,.04);
    const len=longSepals?.58:.32;
    shape.bezierCurveTo(-.10,.12,-.12,len*.7,0,len);
    shape.bezierCurveTo(.12,len*.7,.10,.12,0,.04);
    const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape,10),sepalMat);
    mesh.rotation.z=i*TAU/sepals+.3;mesh.position.z=sepalZ;group.add(mesh);
  }
  if(leaves) {
    for(const sign of [-1,1])leafSurface(group,{length:.88,width:.23,angle:sign*1.05,position:[sign*.03,-.72,-.35],serrate:true});
  }
  if(strap) {
    for(const sign of [-1,1])leafSurface(group,{length:1.24,width:.07,angle:sign*.75,position:[sign*.03,-1.10,-.44],strap:true});
  }
  if(thorn) {
    const anchor=curve.getPoint(.35),direction=v3(1,.35,0).normalize();
    const mesh=new THREE.Mesh(new THREE.ConeGeometry(.035,.12,12),wood);
    mesh.name='stem-prickle';
    mesh.position.copy(anchor).addScaledVector(direction,.085);
    mesh.quaternion.setFromUnitVectors(v3(0,1,0),direction);
    mesh.castShadow=true;group.add(mesh);
  }
}

function stamens(parent, {count=40,radius=.27,height=.42,base=.13,filament='#f6d375',anther='#d9a52d',antherSize=.024,spread=.05,style=true,filled=false}={}) {
  const group=new THREE.Group();group.name='flower-center';parent.add(group);
  const fm=standard(filament),am=standard(anther);
  for(let i=0;i<count;i++) {
    const theta=i*2.39996322973;
    const r=radius*(filled ? .22+.78*Math.sqrt((i+.5)/count) : .72+.28*Math.sin(i*3.1)**2);
    const h=height*(.86+.14*Math.cos(i*1.8));
    const start=v3(Math.cos(theta)*r*.76,Math.sin(theta)*r*.76,base);
    const end=v3(Math.cos(theta)*(r+spread),Math.sin(theta)*(r+spread),base+h);
    const stamen=new THREE.Group();stamen.name='stamen';group.add(stamen);
    const middle=start.clone().lerp(end,.54);middle.x+=Math.cos(theta)*.025;middle.y+=Math.sin(theta)*.025;
    const filamentCurve=new THREE.QuadraticBezierCurve3(start,middle,end);
    const stalk=new THREE.Mesh(new THREE.TubeGeometry(filamentCurve,9,.0055,5,false),fm);stalk.castShadow=true;stamen.add(stalk);
    for(const sign of [-1,1]){
      const pollen=end.clone();pollen.x+=sign*antherSize*.36;
      sphere(stamen,pollen,antherSize*.68,am,[.58,1.2,.65]);
    }

  }
  if(style) {
    const sm=standard('#a7a465');rod(group,v3(0,0,base),v3(0,0,base+height*.9),.012,sm);
    sphere(group,v3(0,0,base+height*.9),.025,sm);
  }
  return group;
}

export const SPECIMEN_IDS=['plum-blossom','peony','chrysanthemum','orchid','china-rose','azalea','camellia','lotus','osmanthus','narcissus'];

export function createSpecimenModel(id) {
  if(!SPECIMEN_IDS.includes(id))throw new RangeError(`Unknown flower: ${id}`);
  const group=new THREE.Group(); group.rotation.z=-.10;group.name=id;
  const petals=[], centers=[];
  const material=makePetalMaterial(id);
  const petal=spec=>{const p=addPetal(group,spec,material);petals.push(p);return p;};
  const layers=(definitions,common)=>definitions.forEach((layer,index)=>{
    for(let i=0;i<layer.count;i++)petal({...common,...layer,
      // Small deterministic differences keep dense whorls from looking stamped out.
      bend:(layer.bend ?? 0)+(common.organic || 0)*Math.sin(i*2.39+index*1.7),
      z:(layer.z ?? .10)+(common.organic || 0)*.12*Math.cos(i*1.73+index),
      twist:(layer.twist || 0)+(common.organic || 0)*.25*Math.sin(i*3.1+index),
      budRadius:(common.budRadius||.33)-index*.025,
      budLength:(common.budLength||1.12)-index*.04,
      closedAngle:layer.closedAngle??Math.PI/layer.count*1.01,
      seed:i*1.71+index*3.13,angle:i*TAU/layer.count+index*.57+(layer.offset||0),delay:layer.delay??index*.045,name:`petal-layer-${index+1}`});
  });
  let baseSupport={};
  switch(id) {
    case 'plum-blossom':
      layers([{count:5,length:1.08,width:.57,bend:.38,closedAngle:.72}],{baseColor:'#df789b',tipColor:'#fce0e5',rootPigment:true,edgeTint:'#e691b2',outlinePower:.34,ruffle:.016,edgeCurl:.075,fold:.020,pleat:.004,reflex:-.13,overlap:.12,twist:.045});
      centers.push(stamens(group,{count:46,radius:.25,height:.40,filament:'#e9afbf',anther:'#d9ac45',spread:.19}));
      baseSupport={woody:true,sepals:5};break;
    case 'peony':
      layers([{count:10,length:1.30,width:.55,bend:.24,reflex:-.18},{count:10,length:1.20,width:.55,z:.13,bend:.68},{count:9,length:1.04,width:.50,z:.15,bend:1.02},{count:7,length:.86,width:.45,z:.18,bend:1.30}],{baseColor:'#ffe0d4',tipColor:'#e83c83',ruffle:.052,edgeCurl:.09,fold:.028,pleat:.006,overlap:.10,organic:.16,budRadius:.43});
      centers.push(stamens(group,{count:100,filled:true,radius:.24,height:.46,base:.22,antherSize:.018,spread:.04}));
      for(let i=0;i<3;i++) {
        const t=i*TAU/3;const carpel=new THREE.Group();
        sphere(carpel,v3(.10*Math.cos(t),.10*Math.sin(t),.42),.09,standard('#b4ba7d'),[.65,.65,1.8]);
        sphere(carpel,v3(.10*Math.cos(t),.10*Math.sin(t),.57),.042,standard('#b95d76'),[1,.7,.4]);
        group.add(carpel);centers.push(carpel);
      }
      baseSupport={woody:true,sepals:5,leaves:true};break;
    case 'chrysanthemum':
      layers([{count:25,length:1.35,width:.105,bend:-.15,hook:1.6},{count:23,length:1.25,width:.11,z:.13,bend:.22,hook:1.4},{count:21,length:1.12,width:.11,z:.17,bend:.60,hook:1.5},{count:18,length:.98,width:.105,z:.20,bend:1.05,hook:1.5},{count:15,length:.80,width:.10,z:.24,bend:1.48,hook:1.3},{count:12,length:.61,width:.085,z:.28,bend:1.85,hook:1.1},{count:9,length:.38,width:.075,z:.32,bend:2.0,hook:.8}],{baseColor:'#edb627',tipColor:'#ffe894',edgeCurl:.060,ridge:-.009,overlap:.08,organic:.13,budRadius:.36,rows:42,cols:14,fold:.006,ruffle:.004});
      {
        const disk=new THREE.Group();disk.name='disc-florets';
        const dm=standard('#dfad34');
        for(let i=0;i<45;i++) {
          const t=i*2.3999632,r=.17*Math.sqrt(i/45);
          sphere(disk,v3(r*Math.cos(t),r*Math.sin(t),.36+.06*(1-r/.17)),.023,dm,[1,1,1.7]);
        }
        group.add(disk);centers.push(disk);
      }
      baseSupport={sepals:12,leaves:true};break;
    case 'orchid':
      for(let i=0;i<3;i++)petal({angle:i*TAU/3,length:i?1.24:1.35,width:i?.32:.37,pointed:true,outlinePower:.73,baseColor:'#edf0bd',tipColor:'#94b23d',bend:i?.12:.30,reflex:-.12,ridge:.026,edgeCurl:.045,fold:.014,overlap:.08,twist:i===1?-.055:i===2?.055:0,closedAngle:.9,name:'orchid-sepal'});
      for(const sign of [-1,1])petal({angle:sign*1.02,length:.88,width:.34,pointed:true,outlinePower:.61,baseColor:'#f1f1c8',tipColor:'#adc65a',bend:.52,reflex:-.12,ridge:.022,edgeCurl:.065,fold:.016,overlap:.06,twist:sign*.10,z:.19,delay:.10,name:'orchid-lateral-petal'});
      petal({angle:Math.PI,length:.78,width:.28,outlinePower:.44,tipFullness:.35,baseColor:'#f6e7a1',tipColor:'#fff8db',bend:.45,reflex:-.18,z:.29,edgeCurl:.12,basalCup:1.6,overlap:.025,ridge:.018,fold:.018,ruffle:.016,spots:true,delay:.16,name:'orchid-labellum'});
      {
        const column=new THREE.Group();column.name='orchid-column';
        sphere(column,v3(0,.03,.31),.12,standard('#f0e8b0'),[.70,1,1.25]);
        sphere(column,v3(0,.10,.44),.08,standard('#ead57c'),[1,.6,.7]);
        group.add(column);centers.push(column);
      }
      baseSupport={sepals:0,strap:true};break;
    case 'china-rose':
      layers([{count:8,length:1.29,width:.58,bend:.22,reflex:-.15},{count:8,length:1.16,width:.56,z:.14,bend:.72,twist:.08},{count:7,length:1.03,width:.52,z:.18,bend:1.14,twist:.14},{count:6,length:.88,width:.44,z:.23,bend:1.52,twist:.28},{count:5,length:.69,width:.35,z:.28,bend:1.50,twist:.40},{count:4,length:.48,width:.24,z:.34,bend:1.60,twist:.60},{count:3,length:.28,width:.15,z:.40,bend:1.66,twist:.85},{count:3,length:.15,width:.10,z:.45,bend:1.5,twist:1.0,root:0}],{baseColor:'#ffe2ce',tipColor:'#ee689a',root:.02,edgeCurl:.08,ruffle:.022,fold:.019,overlap:.12,organic:.10,budRadius:.40});
      baseSupport={woody:true,sepals:5,longSepals:true,leaves:true,thorn:true};break;
    case 'azalea':
      for(let i=0;i<5;i++)petal({angle:i*TAU/5,length:i===0?1.28:1.19,width:i===0?.66:.64,outlinePower:.35,tipFullness:.28,z:-.17,bend:.66,reflex:-.18,root:.07,edgeCurl:.075,fold:.024,pleat:.006,overlap:.10,ruffle:.034,twist:Math.sin(i*2.1)*.04,baseColor:'#e8527a',tipColor:'#f3538e',spots:i===0,closedAngle:.8,name:'funnel-corolla-lobe'});
      { const throat=tubeMesh([[.05,-.30],[.07,-.23],[.11,-.18],[.17,-.14],[.24,-.10],[.32,-.055]],standard('#e45c8c',.9),64);throat.receiveShadow=false;group.add(throat); }
      sphere(group,v3(0,0,.035),.14,standard('#c55776'),[1,1,.16]);
      centers.push(stamens(group,{count:10,radius:.14,height:.74,base:.03,filament:'#f2a7b8',anther:'#864e47',antherSize:.03,spread:.19,style:false}));
      {
        const style=new THREE.Group();const sm=standard('#e9a5a9');
        rod(style,v3(0,0,.05),v3(.08,.08,.91),.012,sm);sphere(style,v3(.08,.08,.91),.032,standard('#b6a96c'));group.add(style);centers.push(style);
      }
      baseSupport={sepals:5,leaves:true,receptacleZ:-.34,sepalZ:-.32};break;
    case 'camellia':
      layers([{count:7,length:1.25,width:.63,bend:.30},{count:6,length:1.06,width:.58,z:.15,bend:.88}],{baseColor:'#e94548',tipColor:'#bb122d',edgeCurl:.070,ruffle:.013,fold:.019,overlap:.12,organic:.10,budRadius:.40});
      centers.push(stamens(group,{count:125,filled:true,radius:.28,height:.57,base:.18,filament:'#fff1bb',anther:'#e2b846',spread:.02,antherSize:.025}));
      baseSupport={woody:true,sepals:7,leaves:true};break;
    case 'lotus':
      layers([{count:9,length:1.37,width:.44,bend:.40,reflex:-.12},{count:8,length:1.25,width:.45,z:.10,bend:.95},{count:7,length:1.09,width:.41,z:.14,bend:1.35},{count:5,length:.88,width:.34,z:.17,bend:1.65}],{baseColor:'#fff1c9',tipColor:'#df528d',pointed:true,edgeCurl:.055,ridge:.014,fold:.012,overlap:.12,organic:.08,budRadius:.43,budLength:1.3});
      centers.push(stamens(group,{count:105,radius:.32,height:.38,base:.19,filament:'#fff0bc',anther:'#dfb442',style:false,spread:.02,antherSize:.021}));
      {
        const receptacle=new THREE.Group();receptacle.name='lotus-receptacle';
        const cone=new THREE.Mesh(new THREE.CylinderGeometry(.235,.15,.28,48,1,false),standard('#e2cf69'));cone.rotation.x=Math.PI/2;cone.position.z=.37;cone.castShadow=cone.receiveShadow=true;receptacle.add(cone);
        const pitMat=standard('#9c9b4f'),stigmaMat=standard('#bba24c');
        for(let i=0;i<13;i++) {
          const angle=i*2.399963,r=.205*Math.sqrt(i/13);
          sphere(receptacle,v3(r*Math.cos(angle),r*Math.sin(angle),.515),.025,pitMat,[1,1,.22]);
          sphere(receptacle,v3(r*Math.cos(angle),r*Math.sin(angle),.526),.013,stigmaMat,[1,1,.4]);
        }
        group.add(receptacle);centers.push(receptacle);
      }
      baseSupport={sepals:4};break;
    case 'osmanthus':
      for(let i=0;i<4;i++)petal({angle:i*TAU/4,length:.94,width:.43,outlinePower:.32,tipFullness:.55,root:.10,z:.16,bend:.30,reflex:-.14,edgeCurl:.09,basalCup:.7,fold:.008,ruffle:.003,overlap:.035,ridge:-.012,twist:Math.sin(i*1.9)*.035,baseColor:'#edb32c',tipColor:'#ffdc78',closedAngle:.87,budRadius:.32,budLength:.95,delay:i*.025,sectorHalfAngle:.66,name:'corolla-lobe-'+(i+1)});
      { const throat=tubeMesh([[.075,-.16],[.10,-.08],[.14,.04],[.20,.10],[.25,.13]],standard('#e9b03e',.9),64);throat.receiveShadow=false;group.add(throat); }
      sphere(group,v3(0,0,.045),.12,standard('#dcaa37'),[1,1,.14]);
      centers.push(stamens(group,{count:2,radius:.09,height:.20,base:.04,filament:'#f6c64d',anther:'#c18a21',antherSize:.024,spread:0}));
      baseSupport={sepals:4,neckTop:.03};break;
    case 'narcissus':
      for(let i=0;i<6;i++)petal({angle:i*TAU/6+(i%2)*.035,length:i%2?1.0:1.08,width:i%2?.33:.39,root:.20,whorl:i%2,z:.08+(i%2)*.035,baseColor:'#eee9ca',tipColor:'#fffefa',rootPigment:true,bend:.24,reflex:-.20,edgeCurl:.08,pointed:true,outlinePower:.68,fold:.022,ridge:.026,pleat:.004,ruffle:.018,overlap:.12,twist:Math.sin(i*2.7)*.075,closedAngle:.6,name:'narcissus-tepal'});
      {
        const corona=new THREE.Group();corona.name='cup-corona';
        const profile=[];
        for(let j=0;j<=24;j++){const t=j/24;profile.push([.15+.06*t+.055*t**4,.10+.27*t]);}
        for(let j=24;j>=0;j--){const t=j/24;profile.push([.139+.06*t+.055*t**4,.10+.27*t]);}
        const cup=tubeMesh(profile,standard('#efc447',.88),96);
        const points=cup.geometry.attributes.position;
        for(let i=0;i<points.count;i++){
          const x=points.getX(i),y=points.getY(i),z=points.getZ(i);
          const edge=clamp((y-.19)/.17,0,1),wave=Math.sin(Math.atan2(z,x)*10);
          const scale=1+(.025+.045*edge)*wave+.012*Math.sin(Math.atan2(z,x)*21)*edge;
          points.setXYZ(i,x*scale,y+.018*wave*edge,z*scale);
        }
        points.needsUpdate=true;cup.geometry.computeVertexNormals();
        corona.add(cup);group.add(corona);centers.push(corona);
      }
      centers.push(stamens(group,{count:6,radius:.09,height:.10,base:.13,antherSize:.02,style:true,spread:0}));
      const throat=new THREE.Group();throat.name='corona-throat';
      sphere(throat,v3(0,0,.125),.18,standard('#dfb947',.9),[1,1,.16]);group.add(throat);centers.push(throat);
      baseSupport={sepals:0,strap:true};break;
  }
  support(group,baseSupport);
  let last=-1;
  function setBloom(value) {
    if(!Number.isFinite(value))throw new RangeError('Bloom must be finite');
    const t=clamp(value,0,1);if(Math.abs(last-t)<.00001)return;last=t;
    petals.forEach(p=>p.update(t));
    const centerScale=lerp(.03,1,clamp((t-.12)/.62,0,1));
    centers.forEach(c=>{c.scale.setScalar(centerScale);c.visible=t>.12;});
  }
  setBloom(1);
  group.userData={species:id,petalCount:petals.length,representation:id==='chrysanthemum'?'capitulum':'flower'};
  return {group,setBloom,dispose(){disposeGroup(group);}};
}
