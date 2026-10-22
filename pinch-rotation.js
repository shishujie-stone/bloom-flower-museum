// Hysteresis prevents noisy pinch distances from alternating interaction modes.
export function createPinchRotation(){
 let held=false,anchor=null;
 const reset=()=>{held=false;anchor=null;};
 return {reset,update(points,world){
  if(!points||points.length!==21||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))){reset();return {held:false,lost:true,dx:0,dy:0};}
  const p=world?.length===21?world:points;
  const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
  const palm=d(p[5],p[17]);
  if(palm<1e-5){reset();return {held:false,lost:true,dx:0,dy:0};}
  const ratio=d(p[4],p[8])/palm;
  const next=ratio<(held?.43:.27);
  const center={x:1-(points[4].x+points[8].x)/2,y:(points[4].y+points[8].y)/2};
  if(!next){const released=held;reset();return {held:false,released,dx:0,dy:0};}
  const started=!held;held=true;
  let dx=anchor?center.x-anchor.x:0,dy=anchor?center.y-anchor.y:0;anchor=center;
  // Reject reacquisition/identity jumps instead of whipping the camera around.
  if(Math.hypot(dx,dy)>.18)dx=dy=0;
  return {held:true,started,dx,dy};
 }};
}
