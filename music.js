import {MUSIC_TRACKS} from './music-catalog.js';

export function initMusic(){
  const audio=document.querySelector('#background-music');
  const play=document.querySelector('#music-play');
  const volume=document.querySelector('#music-volume'),status=document.querySelector('#music-status');
  let desired=false,loading=false,token=0;
  const saved=key=>{try{return localStorage.getItem(key);}catch{return null;}};
  const save=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
  const initial=Number(saved('bloom-music-volume')??25);
  volume.value=Number.isFinite(initial)?Math.max(0,Math.min(100,initial)):25;
  function setVolume(){audio.volume=Number(volume.value)/100;document.querySelector('#music-volume-value').textContent=`${volume.value}%`;save('bloom-music-volume',volume.value);}
  function update(message){
    play.setAttribute('aria-pressed',String(desired));play.setAttribute('aria-label',desired?'暂停赏花音乐':'播放赏花音乐');
    play.firstElementChild.textContent=desired?'Ⅱ':'♫';play.classList.toggle('playing',desired);
    document.querySelector('.music-dock').classList.toggle('is-playing',desired);
    if(message)status.textContent=message;
  }
  function setTrack(){
    const track=MUSIC_TRACKS[0];
    audio.src=track.src;
    document.querySelector('#music-credit').textContent=track.attribution;
    document.querySelector('#music-note').textContent=track.modifications;
    document.querySelector('#music-source').href=track.sourceUrl;
    const license=document.querySelector('#music-license');license.href=track.licenseUrl;license.textContent=track.license;
  }
  async function start(){
    const request=++token;desired=true;loading=true;update('正在准备琴声…');
    try{await audio.play();if(request!==token)return;loading=false;update('琴声相伴 · 循环播放');}
    catch(error){if(request!==token)return;loading=false;desired=false;update(error.name==='NotAllowedError'?'再点击一次，开启琴声':'音乐暂时未能播放，请点击重试');}
  }
  play.addEventListener('click',()=>{
    if(desired){++token;desired=false;loading=false;audio.pause();update('琴声暂歇，静赏花开');}else start();
  });
  volume.addEventListener('input',setVolume);
  audio.addEventListener('error',()=>{++token;loading=false;desired=false;update('音乐暂时未能载入，请点击重试');});
  audio.addEventListener('pause',()=>{if(!loading&&desired){desired=false;update('琴声暂歇，静赏花开');}});
  const info=document.querySelector('#music-info'),infoButton=document.querySelector('#music-info-button');
  infoButton.addEventListener('click',()=>{info.hidden=!info.hidden;infoButton.setAttribute('aria-expanded',String(!info.hidden));});
  const panel=document.querySelector('#music-panel'),toggle=document.querySelector('#music-dock-toggle'),dock=document.querySelector('.music-dock');
  function openPanel(show,restoreFocus=false){
    panel.hidden=!show;toggle.setAttribute('aria-expanded',String(show));toggle.setAttribute('aria-label',show?'收起音乐设置':'展开音乐设置');
    if(restoreFocus)toggle.focus();
  }
  toggle.addEventListener('click',()=>openPanel(panel.hidden));
  document.querySelector('#music-close').addEventListener('click',()=>openPanel(false,true));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){openPanel(false,true);}});
  document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!dock.contains(event.target))openPanel(false);});
  window.addEventListener('pagehide',()=>{++token;loading=false;desired=false;audio.pause();update('轻启一曲，伴花而开');});
  setVolume();setTrack();update();
}
