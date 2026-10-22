// A shared in-page viewer reads the current flower's rendered image and attribution.
export function initImageViewer(){
 const dialog=document.createElement('dialog');
 dialog.id='image-viewer';dialog.setAttribute('aria-labelledby','image-viewer-title');
 dialog.innerHTML=`<header><h2 id="image-viewer-title"></h2><button type="button" class="image-viewer-close" aria-label="关闭放大图片" autofocus>×</button></header><div class="image-viewer-canvas"><img alt=""></div><div class="image-viewer-caption"></div>`;
 document.body.append(dialog);
 const photo=dialog.querySelector('img'),caption=dialog.querySelector('.image-viewer-caption');
 let trigger=null,previousOverflow='';
 function open(button,artwork){
  const source=button.querySelector('img');trigger=button;
  photo.src=source.currentSrc||source.src;photo.alt=source.alt;
  dialog.querySelector('h2').textContent=document.querySelector(artwork?'#artwork-title':'.reference-head h3').textContent;
  caption.replaceChildren();
  const nodes=artwork?[document.querySelector('.artwork-figure figcaption')]:[document.querySelector('.reference-caption'),document.querySelector('.credit')];
  for(const node of nodes){const clone=node.cloneNode(true);clone.removeAttribute('id');clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));caption.append(clone);}
  previousOverflow=document.documentElement.style.overflow;
  document.documentElement.style.overflow='hidden';dialog.showModal();
 }
 for(const [selector,artwork] of [['.reference-photo',false],['#artwork-image-link',true]]){
  document.querySelector(selector).addEventListener('click',event=>{event.preventDefault();open(event.currentTarget,artwork);});
 }
 dialog.querySelector('button').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{
  if(event.target!==dialog)return;
  const r=dialog.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
 });
 dialog.addEventListener('close',()=>{document.documentElement.style.overflow=previousOverflow;trigger?.focus({preventScroll:true});});
}
