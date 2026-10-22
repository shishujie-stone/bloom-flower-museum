const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));

// Dimensionless distances survive mirroring, hand rotation and changes in distance to the camera.
// Both a fist and fingers brought together close the flower; a spread, straight palm opens it.
export function handOpenness(points){
  if(!Array.isArray(points)||points.length!==21||points.some(p=>![p.x,p.y,p.z??0].every(Number.isFinite)))return null;
  const palm=distance(points[5],points[17]);if(palm<1e-5)return null;
  const extension=[5,9,13,17].reduce((sum,mcp)=>{
    const path=distance(points[mcp],points[mcp+1])+distance(points[mcp+1],points[mcp+2])+distance(points[mcp+2],points[mcp+3]);
    return sum+clamp((distance(points[mcp],points[mcp+3])/Math.max(path,1e-6)-.45)/.5);
  },0)/4;
  const spread=clamp((distance(points[8],points[20])/palm-1.08)/1.0);
  return clamp((Math.sqrt(extension)*Math.pow(spread,.7)-.08)/.86);
}
export function calibratedOpenness(raw,closed,open){
  if(!Number.isFinite(raw))return null;
  return Number.isFinite(closed)&&Number.isFinite(open)&&open-closed>=.15?clamp((raw-closed)/(open-closed)):clamp(raw);
}
export function smoothOpenness(previous,target,elapsedMs){
  const next=previous+(target-previous)*(1-Math.exp(-clamp(elapsedMs,0,160)/110));
  return target===0&&next<.008?0:target===1&&next>.992?1:next;
}
export const HAND_CONNECTIONS=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
