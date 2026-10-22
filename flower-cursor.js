// Small original botanical silhouettes; no background and no pointer interception.
export function initFlowerCursor(){
 const host=document.createElement('div');
 host.className='flower-cursor';host.setAttribute('aria-hidden','true');document.body.append(host);
 const media=matchMedia('(hover:hover) and (pointer:fine)');
 const hide=()=>host.classList.remove('visible');
 window.addEventListener('pointermove',event=>{
  if(!media.matches||event.pointerType!=='mouse'){hide();return;}
  const x=event.clientX+16,y=event.clientY+18;
  host.style.transform=`translate3d(${Math.min(x,innerWidth-34)}px,${Math.min(y,innerHeight-34)}px,0)`;
  host.classList.add('visible');
 },{passive:true});
 document.documentElement.addEventListener('pointerleave',hide);
 window.addEventListener('blur',hide);window.addEventListener('scroll',hide,{passive:true});
 document.addEventListener('visibilitychange',hide);media.addEventListener('change',hide);
 const image=document.createElement('img');image.alt='';image.draggable=false;host.append(image);
 return flower=>{
  host.dataset.flower=flower.id;
  image.src=flower.thumbnail;
 };
}
