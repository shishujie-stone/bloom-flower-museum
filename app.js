import { initFlowerCursor } from './flower-cursor.js?v=photo-2';
import { initImageViewer } from './image-viewer.js';
import { FLOWERS, findFlower } from './catalog.js?v=artworks-20261022';
import { KNOWLEDGE } from './knowledge.js';
import { ARTWORK_IMAGES } from './artworks.js';
import { initMusic } from './music.js';
import { initGestures } from './gesture.js?v=gesture-hints-1';
initMusic();
const updateFlowerCursor=initFlowerCursor();
const $ = selector => document.querySelector(selector);
const elements = {
  branch: $('#branch-view'), model: $('#model-view'), stage: $('#stage'),
  branchTab: $('#branch-tab'), flowerTab: $('#flower-tab'), controls: $('#bloom-controls'),
  range: $('#bloom-range'), value: $('#bloom-value'), play: $('#play-button'),
  rotate: $('#rotate-button'), reset: $('#reset-button'), observe: $('#observe-button'),
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let viewer = null, initPromise = null, mode = 'branch', bloom = 1, playing = false, animation = null, autoRotate = false, transition = 0;
let activeFlower = findFlower(new URLSearchParams(location.search).get('flower'));
let gesture=null;

function renderFlower() {
  const flower=activeFlower, reference=flower.reference;
  updateFlowerCursor(flower);
  elements.stage.dataset.flower=flower.id;
  document.title=`BLOOM · ${flower.name}初绽`;
  $('.edition').firstChild.textContent='十种名花 · 交互展厅 ';
  $('.intro .index').textContent=`${String(flower.index).padStart(2,'0')} / 10`;
  $('#page-title').innerHTML=`${flower.title[0]}<span>，</span>${flower.title[1]}<span>。</span>`;
  $('.exhibition').setAttribute('aria-label',`${flower.name}互动展台`);
  $('.stage-watermark').textContent=flower.english;
  $('#branch-button').setAttribute('aria-label',`点击${flower.name}，进入${flower.observe}`);
  const picture=$('#branch-button img');picture.src=flower.image;picture.alt=`${flower.name}白底 AI 生成形象`;
  const heading=$('.info-heading h2');heading.textContent=flower.name;
  const alias=document.createElement('span');alias.textContent=flower.alias;heading.append(alias);
  $('.info-heading .eyebrow').textContent=flower.eyebrow;
  $('.latin').textContent=flower.latin;
  $('.description').replaceChildren(...flower.description.flatMap((text,i)=>i?[document.createElement('br'),document.createTextNode(text)]:[document.createTextNode(text)]));
  const facts=document.querySelectorAll('.facts dd');
  facts[0].textContent=flower.form;facts[1].textContent=`从整体走近${flower.id==='chrysanthemum'?'花序':'单花'}`;facts[2].textContent=`${flower.type} · 放大观察`;
  $('.reference-head h3').textContent=`自然中的${flower.name}`;
  $('.reference-photo').setAttribute('aria-label',`放大真实${flower.name}照片`);
  const referenceImage=$('.reference-photo img');referenceImage.src=reference.src;referenceImage.alt=`真实${flower.name}参考照片`;
  $('.reference-caption').textContent=reference.note.split('本站版本')[0].trim()+' 参考照片与模型的园艺品种、颜色可能不同。';
  const credit=$('.credit');credit.replaceChildren();
  const author=document.createElement('a');author.href=reference.sourceUrl;author.target='_blank';author.rel='noopener';author.textContent=`${reference.author} / Wikimedia Commons`;
  const license=document.createElement('a');license.href=reference.licenseUrl;license.target='_blank';license.rel='noopener';license.textContent=reference.license;
  credit.append(author,document.createTextNode(' · '),license,document.createElement('br'),document.createTextNode(flower.id==='osmanthus'?'原照片未修改；展示框中裁切显示。':'网页版本按比例缩小；展示框中裁切显示。'));
  $('#poem-lines').replaceChildren(document.createTextNode(flower.poem[0]),document.createElement('br'),document.createTextNode(flower.poem[1]));
  $('#knowledge-lead').textContent=`读懂${flower.name}：循着诗词、历史与文物，认识花姿之外的文化。`;
  $('#poem-author').textContent=flower.poet;$('#poem-source').href=flower.poemUrl;
  const reading=KNOWLEDGE[flower.id];
  $('#poem-reading').textContent=reading[0];$('#history-reading').textContent=reading[1];$('#artwork-reading').textContent=reading[2];
  $('#history-text').textContent=flower.history;$('#history-link').href=flower.historyUrl;
  const artworkImage=ARTWORK_IMAGES[flower.id];
  const artworkPhoto=$('#artwork-image');artworkPhoto.src=artworkImage.src;artworkPhoto.alt=`${flower.artwork}，${artworkImage.displayNote}`;
  $('#artwork-image-link').setAttribute('aria-label',`放大${flower.artwork}图片`);
  $('#artwork-image-source').textContent=artworkImage.credit+' ↗';$('#artwork-image-source').href=artworkImage.sourceUrl;
  $('#artwork-image-note').textContent=artworkImage.displayNote;$('#artwork-image-rights').textContent=artworkImage.rights;
  $('#artwork-title').textContent=flower.artwork;$('#artwork-museum').textContent=flower.museum;$('#artwork-note').textContent=flower.artworkNote;$('#artwork-link').href=flower.artworkUrl;
  $('footer>a').href=flower.historyUrl;
  $('#dialog-source').href=flower.historyUrl;$('#dialog-source').textContent=`${flower.name}的资料来源`;
  document.querySelectorAll('[data-flower]').forEach(button=>{const selected=button.dataset.flower===flower.id;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));});
  $('#gallery-status').textContent=`${flower.name} · ${flower.index} / 10`;
  requestAnimationFrame(positionFlowerSelection);
}

function positionFlowerSelection(){
  const tray=$('#flower-gallery'),selected=tray.querySelector('[aria-pressed="true"]');
  if(selected&&tray.scrollWidth>tray.clientWidth){
    const left=tray.scrollLeft+selected.getBoundingClientRect().left-tray.getBoundingClientRect().left-(tray.clientWidth-selected.clientWidth)/2;
    tray.scrollTo({left:Math.max(0,left),behavior:'instant'});
  }
}
window.addEventListener('resize',positionFlowerSelection);

function overallUI() {
  const f=activeFlower;
  elements.branch.hidden=false;elements.model.hidden=true;
  elements.branchTab.classList.add('active');elements.flowerTab.classList.remove('active');
  elements.branchTab.setAttribute('aria-pressed','true');elements.flowerTab.setAttribute('aria-pressed','false');
  elements.branchTab.innerHTML=`<span>01</span> ${f.overall}`;
  elements.flowerTab.innerHTML=`<span>02</span> ${f.observe} <em>3D</em>`;
  elements.controls.hidden=true;elements.reset.hidden=true;
  $('#interaction-choice').hidden=true;
  $('#stage-label').textContent=`01 — ${f.overall}`;$('#specimen-tag').textContent='AI 生成形象';
  $('#scale-note').textContent=`${f.overall} · 点击进入${f.observe}`;
  elements.observe.innerHTML='放大，看看这一朵 <span>↗</span>';
  elements.stage.classList.remove('entering');elements.model.classList.remove('reveal');
}

async function chooseFlower(id, {keepKnowledgePosition=false}={}) {
  const next=findFlower(id);if(next.id===activeFlower.id)return;
  // Preserve the chapter being read when earlier cards change height.
  const stickyBottom=$('#knowledge-flowers').getBoundingClientRect().bottom;
  const cards=[...document.querySelectorAll('.knowledge-card')];
  const readingCard=cards.find(card=>{const r=card.getBoundingClientRect();return r.top<=stickyBottom+48&&r.bottom>stickyBottom;});
  const readingAnchor=keepKnowledgePosition&&readingCard?readingCard:$('#story');
  const knowledgeTop=readingAnchor.getBoundingClientRect().top;
  const previousAnchor=document.documentElement.style.overflowAnchor;
  if(keepKnowledgePosition)document.documentElement.style.overflowAnchor='none';
  const wasFlower=mode==='flower';++transition;pause();setRotation(false);
  activeFlower=next;renderFlower();
  const url=new URL(location.href);url.searchParams.set('flower',next.id);url.hash='';history.replaceState(null,'',url);
  if(wasFlower&&viewer){
    // Keep the stage and controls mounted so switching never collapses the layout or interrupts a live camera.
    elements.branchTab.innerHTML=`<span>01</span> ${next.overall}`;
    elements.flowerTab.innerHTML=`<span>02</span> ${next.observe} <em>3D</em>`;
    $('#stage-label').textContent=`02 — ${next.observe}`;
    viewer.setSpecies(next.id,next.name);viewer.setView('front',true);selectView('front');viewer.setVisible(true);
    updateBloom(gesture?.selected?gesture.value:reducedMotion?1:0);
    if(!gesture?.selected&&!reducedMotion)play();
  }else{
    viewer?.setVisible(false);mode='branch';overallUI();updateBloom(1);
    if(wasFlower)await showMode('flower');
  }
  requestAnimationFrame(()=>{
    if(keepKnowledgePosition){
      window.scrollBy({top:readingAnchor.getBoundingClientRect().top-knowledgeTop,behavior:'instant'});
      requestAnimationFrame(()=>{document.documentElement.style.overflowAnchor=previousAnchor;});
      return;
    }
    const box=elements.stage.getBoundingClientRect(),rail=$('.catalog').getBoundingClientRect();
    const upper=rail.width>box.width*.8?Math.max(0,Math.min(rail.bottom,innerHeight*.4)):0;
    const center=box.top+box.height/2;
    if(center<upper+50||center>innerHeight-70)elements.stage.scrollIntoView({behavior:reducedMotion?'instant':'smooth',block:'center'});
  });
}

const gallery=$('#flower-gallery');
for(const flower of FLOWERS) {
  const button=document.createElement('button');button.type='button';button.dataset.flower=flower.id;button.setAttribute('aria-label',`选择${flower.name}`);button.setAttribute('aria-pressed','false');
  const image=document.createElement('img');image.src=flower.thumbnail;image.alt='';image.width=100;image.height=100;image.loading='lazy';
  const name=document.createElement('span');name.textContent=flower.name;
  button.append(image,name);button.addEventListener('click',()=>chooseFlower(flower.id));gallery.append(button);
}
for(const flower of FLOWERS){
  const button=document.createElement('button');
  button.type='button';button.dataset.flower=flower.id;button.textContent=flower.name;
  button.setAttribute('aria-pressed','false');
  button.addEventListener('click',()=>chooseFlower(flower.id,{keepKnowledgePosition:true}));
  $('#knowledge-flowers').append(button);
}
function setRotation(value) {
  autoRotate = value; elements.rotate.setAttribute('aria-pressed', String(value));
  elements.rotate.textContent = value ? 'Ⅱ 停止旋转' : '↻ 自动旋转';
  viewer?.setAutoRotate(value);
}
function selectView(view) {
  document.querySelectorAll('[data-view]').forEach(button => {
    const selected = button.dataset.view === view;
    button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
  });
}
function updateBloom(t) {
  bloom = Math.max(0, Math.min(1, t)); viewer?.setBloom(bloom);
  const percent = Math.round(bloom * 100);
  elements.range.value = percent;
  elements.range.style.background = `linear-gradient(to right,#a5b48c ${percent}%,#dce2d2 ${percent}%)`;
  elements.value.innerHTML = `${percent}<span>%</span>`;
  const state = percent < 20 ? '含苞' : percent < 75 ? '初绽' : '盛放';
  $('#bloom-state').textContent = state;
  $('#bloom-description').textContent = percent < 20 ? '花苞轻轻合拢，等待舒展。' : percent < 75 ? activeFlower.bloom[0] : activeFlower.bloom[1];
  elements.range.setAttribute('aria-valuetext', `${state}，绽放程度 ${percent}%`);
  if (!playing) {
    elements.play.textContent = bloom >= .999 ? '↻' : '▶';
    elements.play.setAttribute('aria-label', bloom >= .999 ? '重新播放绽放动画' : '播放绽放动画');
  }
}
function pause() {
  playing = false; if (animation !== null) cancelAnimationFrame(animation); animation = null;
  elements.play.textContent = bloom >= .999 ? '↻' : '▶';
  elements.play.setAttribute('aria-label', bloom >= .999 ? '重新播放绽放动画' : '播放绽放动画');
}
function play() {
  if (!viewer || mode !== 'flower') return;
  if (bloom >= .999) updateBloom(0);
  const from = bloom, start = performance.now(), duration = 5500 * (1 - from);
  playing = true; elements.play.textContent = 'Ⅱ'; elements.play.setAttribute('aria-label', '暂停绽放动画');
  const tick = now => {
    if (!playing) return;
    const progress = Math.min(1, (now - start) / Math.max(300, duration));
    updateBloom(from + (1 - from) * progress);
    if (progress < 1) animation = requestAnimationFrame(tick); else pause();
  };
  animation = requestAnimationFrame(tick);
}
async function initViewer() {
  if (!initPromise) initPromise = (async () => {
    try {
      const { createFlowerView } = await import('./osmanthus-view.js?v=pinch-2');
      viewer = createFlowerView($('#canvas-container'), () => { setRotation(false); selectView(null); });
      $('#model-loading').hidden = true;
      if (mode !== 'flower') viewer.setVisible(false);
      return viewer;
    } catch (error) {
      console.error('Flower renderer could not initialize:', error);
      $('#model-loading').hidden = true; $('#model-error').hidden = false;
      $('#model-instructions').hidden = true;
      elements.play.disabled = true; elements.range.disabled = true; elements.rotate.disabled = true;
      return null;
    }
  })();
  return initPromise;
}
async function showMode(next, animate = true) {
  if(next==='branch')gesture?.leave();
  if (mode === next && (next === 'branch' || viewer)) return;
  const token = ++transition;
  pause(); setRotation(false); mode = next;
  const isFlower = next === 'flower';
  elements.branchTab.classList.toggle('active', !isFlower); elements.flowerTab.classList.toggle('active', isFlower);
  elements.branchTab.setAttribute('aria-pressed', String(!isFlower)); elements.flowerTab.setAttribute('aria-pressed', String(isFlower));
  elements.controls.hidden = !isFlower; elements.reset.hidden = !isFlower;
  $('#interaction-choice').hidden=!isFlower;
  $('#stage-label').textContent = isFlower ? `02 — ${activeFlower.observe}` : `01 — ${activeFlower.overall}`;
  $('#specimen-tag').textContent = isFlower ? '交互模型 · 非实物尺寸' : 'AI 生成形象';
  $('#scale-note').textContent = isFlower ? '放大观察 · 形态简化示意' : `${activeFlower.overall} · 点击进入${activeFlower.observe}`;
  elements.observe.innerHTML = isFlower ? '回到整体，看看花姿 <span>↗</span>' : '放大，看看这一朵 <span>↗</span>';
  if (isFlower) {
    if (!reducedMotion) {
      elements.stage.classList.add('entering');
      await new Promise(resolve => setTimeout(resolve, 300));
      if (token !== transition) return;
    }
    elements.branch.hidden = true; elements.model.hidden = false;
    elements.model.classList.add('reveal'); elements.stage.classList.remove('entering');
    $('#model-loading').textContent=`正在准备一朵${activeFlower.name}…`;
    const initialized = await initViewer();
    if (!initialized || token !== transition || mode !== 'flower') return;
    viewer.setSpecies(activeFlower.id,activeFlower.name);
    viewer.setVisible(true); viewer.setView('front', true); selectView('front');
    updateBloom(gesture?.selected ? gesture.value : reducedMotion ? 1 : 0);
    if (animate && !reducedMotion && !gesture?.selected) play();
  } else {
    elements.branch.hidden = false; elements.model.hidden = true; elements.stage.classList.remove('entering');
    viewer?.setVisible(false); elements.model.classList.remove('reveal');
  }
}
elements.branchTab.addEventListener('click', () => showMode('branch'));
elements.flowerTab.addEventListener('click', () => showMode('flower'));
$('#branch-button').addEventListener('click', () => showMode('flower'));
elements.observe.addEventListener('click', () => { showMode(mode === 'branch' ? 'flower' : 'branch'); elements.stage.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' }); });
$('.brand').addEventListener('click', event => { event.preventDefault(); showMode('branch'); window.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' }); });
elements.range.addEventListener('input', event => { pause(); updateBloom(Number(event.target.value) / 100); });
elements.play.addEventListener('click', () => { if (playing) pause(); else play(); });
elements.rotate.addEventListener('click', () => { setRotation(!autoRotate); if (autoRotate) selectView(null); });
elements.reset.addEventListener('click', () => { setRotation(false); viewer?.setView('front'); selectView('front'); });
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { setRotation(false); selectView(button.dataset.view); viewer?.setView(button.dataset.view); }));
$('#error-back').addEventListener('click', () => showMode('branch'));
const fullscreen = $('#fullscreen-button');
if (!elements.stage.requestFullscreen) fullscreen.hidden = true;
fullscreen.addEventListener('click', async () => {
  try { if (!document.fullscreenElement) await elements.stage.requestFullscreen(); else await document.exitFullscreen(); }
  catch { fullscreen.hidden = true; }
});
const dialog = $('#about-dialog');
$('#about-button').addEventListener('click', () => dialog.showModal());
$('#close-about').addEventListener('click', () => dialog.close());
$('#dialog-observe').addEventListener('click', () => { dialog.close(); showMode('flower'); elements.stage.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' }); });
dialog.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { pause(); viewer?.setVisible(false); });
window.addEventListener('pageshow', () => { if(mode === 'flower') viewer?.setVisible(true); });
gesture=initGestures({
  getBloom:()=>bloom,
  onRotationStart:()=>{pause();setRotation(false);selectView(null);viewer?.beginHandRotation();},
  onRotate:(dx,dy)=>viewer?.rotateByHand(dx,dy),
  onRotationEnd:()=>viewer?.endHandRotation(),
  prepare:async()=>{pause();setRotation(false);await showMode('flower',false);return !!viewer&&mode==='flower';},
  onBloom:value=>{pause();updateBloom(value);},
  onModeChange:active=>{elements.play.disabled=elements.range.disabled=active||!$('#model-error').hidden;$('.stage-column').classList.toggle('gesture-active',active);},
});
renderFlower();overallUI();updateBloom(1);

initImageViewer();
