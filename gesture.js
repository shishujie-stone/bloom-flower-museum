import {createPinchRotation} from './pinch-rotation.js';
import {handOpenness,calibratedOpenness,smoothOpenness,HAND_CONNECTIONS} from './hand-math.js';

export function initGestures({prepare,onBloom,onRotate,onRotationStart,onRotationEnd,onModeChange,getBloom}){
  const $=s=>document.querySelector(s);
  const panel=$('#gesture-panel'),mouse=$('#mouse-mode'),hand=$('#gesture-mode');
  const start=$('#gesture-start'),stop=$('#gesture-stop'),video=$('#gesture-video');
  const overlay=$('#gesture-overlay'),ctx=overlay.getContext('2d'),placeholder=$('#gesture-placeholder');
  const status=$('#gesture-status'),closedButton=$('#calibrate-closed'),openButton=$('#calibrate-open');
  const preview=$('.gesture-preview'),stage=$('#stage'),home=document.createComment('camera-preview-home');
  preview.before(home);
  let selected=false,running=false,starting=false,worker=null,stream=null,run=0,frame=0,busy=false;
  let latestRaw=null,lastSeen=0,target=getBloom(),value=target,lastSent=0,lastPaint=0,lastVideo=-1;
  const pinch=createPinchRotation();let rotating=false,holdUntil=0,resumeUntil=0;
  let closed=null,open=null,cancelReady=null,workerTimer=null;
  const supported=()=>window.isSecureContext&&!!navigator.mediaDevices?.getUserMedia&&'Worker'in window&&'OffscreenCanvas'in window&&'createImageBitmap'in window&&'WebAssembly'in window;
  const action=$('#gesture-action');
  function actionState(mode,text){
    action.dataset.mode=mode;if(action.textContent!==text)action.textContent=text;
    $('#control-hint').textContent=text;
  }
  const setStatus=message=>{if(status.textContent!==message)status.textContent=message;};
  function calibrationButtons(enabled){closedButton.disabled=openButton.disabled=!enabled;}
  function clearPreview(){ctx.clearRect(0,0,overlay.width,overlay.height);}
  function draw(points){
    clearPreview();if(!points)return;
    const w=overlay.width,h=overlay.height;ctx.lineWidth=2;ctx.strokeStyle='#d9e6b5';
    for(const[a,b]of HAND_CONNECTIONS){ctx.beginPath();ctx.moveTo(points[a].x*w,points[a].y*h);ctx.lineTo(points[b].x*w,points[b].y*h);ctx.stroke();}
    ctx.fillStyle='#fff2bd';for(const point of points){ctx.beginPath();ctx.arc(point.x*w,point.y*h,3,0,Math.PI*2);ctx.fill();}
  }
  function release(){
    pinch.reset();rotating=false;resumeUntil=0;onRotationEnd?.();
    actionState("idle","摄像头已关闭 · 开启后体验张合与旋转");
    ++run;running=starting=false;cancelAnimationFrame(frame);frame=0;
    clearTimeout(workerTimer);workerTimer=null;
    cancelReady?.(new Error('cancelled'));cancelReady=null;
    worker?.terminate();worker=null;busy=false;
    stream?.getTracks().forEach(track=>track.stop());stream=null;video.pause();video.srcObject=null;
    latestRaw=null;lastSeen=0;calibrationButtons(false);clearPreview();
    placeholder.hidden=false;video.hidden=true;stop.hidden=true;start.hidden=false;start.disabled=false;start.textContent='开启摄像头';
    home.parentNode.insertBefore(preview,home.nextSibling);panel.classList.remove('camera-running');
    $('#gesture-camera-state').textContent='摄像头已关闭';
  }
  function leave(){
    release();selected=false;panel.hidden=true;mouse.setAttribute('aria-pressed','true');hand.setAttribute('aria-pressed','false');
    onModeChange(false);$('#control-hint').textContent='拖动旋转，滑动控制绽放。';
  }
  function fail(message){release();setStatus(message);}
  async function enter(){
    if(selected)return;
    selected=true;target=value=getBloom();panel.hidden=false;mouse.setAttribute('aria-pressed','false');hand.setAttribute('aria-pressed','true');onModeChange(true);
    $('#gesture-meter').value=value;$('#gesture-value').textContent=`${Math.round(value*100)}%`;
    $('#control-hint').textContent='张合控制花瓣；拇指食指捏合后移动，旋转花朵。';
    setStatus(supported()?'点击开启摄像头，再将一只手放入画面。':'此浏览器暂不支持手势识别，请使用新版浏览器或返回鼠标互动。');
    start.disabled=!supported();
    try{if(!await prepare()){leave();}}catch{leave();}
  }
  function initializeWorker(id){
    return new Promise((resolve,reject)=>{
      cancelReady=reject;
      worker=new Worker(new URL('./hand-worker.js',import.meta.url));
      workerTimer=setTimeout(()=>reject(new Error('model-timeout')),30000);
      worker.onerror=()=>{if(id!==run)return;if(starting)reject(new Error('engine'));else fail('手势识别暂时中断，请重新开启摄像头。');};
      worker.onmessage=({data})=>{
        if(id!==run)return;
        if(data.type==='ready'){clearTimeout(workerTimer);cancelReady=null;resolve();}
        else if(data.type==='error'){if(starting)reject(new Error('engine'));else fail('手势识别暂时中断，请重新开启摄像头。');}
        else if(data.type==='result'){
          busy=false;
          const movement=pinch.update(data.landmarks,data.world);
          if(movement.held){
            if(!rotating){target=value=getBloom();onRotationStart?.();}
            rotating=true;holdUntil=performance.now()+220;lastSeen=performance.now();
            latestRaw=null;calibrationButtons(false);draw(data.landmarks);
            onRotate?.(movement.dx,movement.dy);
            actionState('rotate','旋转中 · 花瓣开合已锁定 · 松开恢复开合控制');
            $('#gesture-camera-state').textContent='旋转中 · 花瓣已锁定';
            setStatus('捏住左右移动可转一周，上下移动调整俯仰；松开停止。');
            return;
          }
          if(rotating){rotating=false;onRotationEnd?.();holdUntil=performance.now()+220;resumeUntil=performance.now()+2200;}
          const raw=handOpenness(data.world||data.landmarks);
          if(raw===null){actionState('idle','未检测到手掌 · 保持当前花姿');draw(null);latestRaw=null;calibrationButtons(false);$('#gesture-camera-state').textContent='未检测到手掌 · 保持花姿';setStatus('没有检测到完整手掌，花朵会保持当前姿态。');return;}
          latestRaw=raw;lastSeen=performance.now();target=calibratedOpenness(raw,closed,open);
          draw(data.landmarks);calibrationButtons(true);
          const resumed=performance.now()<resumeUntil;
          actionState('bloom',resumed?'已恢复开合控制 · 张开或合拢手掌':'开合控制中 · 张合控制花瓣 · 捏住移动可旋转');
          $('#gesture-camera-state').textContent=resumed?'已恢复开合控制':`开合控制 · ${Math.round(target*100)}%`;
          setStatus(target<.16?'已识别 · 手掌合拢，花苞收拢':target>.82?'已识别 · 手掌张开，花朵舒展':'已识别 · 缓缓张合，花随手动');
        }
      };
      worker.postMessage({type:'init'});
    });
  }
  async function tick(now){
    if(!running)return;frame=requestAnimationFrame(tick);
    if(now-lastPaint>=1000/30){
      const dt=lastPaint?now-lastPaint:33;lastPaint=now;
      if(!rotating&&now>=holdUntil&&latestRaw!==null&&now-lastSeen<700){
        const next=smoothOpenness(value,target,dt);
        if(Math.abs(next-value)>.001||next===0||next===1){value=next;onBloom(value);$('#gesture-value').textContent=`${Math.round(value*100)}%`;$('#gesture-meter').value=value;}
      }
    }
    if(busy||now-lastSent<85||video.readyState<2||video.currentTime===lastVideo)return;
    const id=run;busy=true;lastSent=now;lastVideo=video.currentTime;
    try{
      const bitmap=await createImageBitmap(video);
      if(id!==run||!running){bitmap.close();return;}
      worker.postMessage({type:'frame',timestamp:now,bitmap},[bitmap]);
    }catch{if(id===run)fail('摄像头画面暂时不可用，请重新开启。');}
  }
  async function begin(){
    if(starting||running||!selected)return;
    if(!supported()){setStatus('此浏览器暂不支持手势识别，请返回鼠标互动。');return;}
    const id=++run;starting=true;start.disabled=true;stop.hidden=false;start.textContent='正在准备…';
    setStatus('正在准备手势识别，首次载入请稍候…');
    try{
      await initializeWorker(id);if(id!==run)return;
      setStatus('请在浏览器中允许摄像头，仅用于本地手势识别。');
      const camera=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:20}}});
      if(id!==run){camera.getTracks().forEach(track=>track.stop());return;}
      stream=camera;video.srcObject=stream;
      for(const track of stream.getVideoTracks())track.addEventListener('ended',()=>{if(id===run)fail('摄像头已断开，可重新开启或返回鼠标互动。');});
      video.hidden=false;placeholder.hidden=true;await video.play();if(id!==run)return;
      running=true;starting=false;lastSent=lastPaint=lastSeen=0;lastVideo=-1;target=value=getBloom();
      start.hidden=true;stop.hidden=false;$('#gesture-camera-state').textContent='摄像头已开启 · 本地识别';
      stage.append(preview);panel.classList.add('camera-running');
      stage.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
      actionState('idle','等待手掌 · 张合控制花瓣，捏住移动控制旋转');
      setStatus('将一只手放入画面，手掌朝向镜头。');frame=requestAnimationFrame(tick);
    }catch(error){
      if(id!==run)return;
      const message=error.name==='NotAllowedError'?'摄像头未获允许。可在地址栏开启权限后重试，或返回鼠标互动。':error.name==='NotFoundError'?'没有找到摄像头，请连接摄像头或返回鼠标互动。':error.name==='NotReadableError'?'摄像头可能正被其他应用使用，请关闭占用后重试。':error.message==='model-timeout'?'手势资源载入较慢，请检查网络后重试。':'手势识别暂未能启动，请重试或返回鼠标互动。';
      fail(message);
    }
  }
  function calibrate(which){
    if(latestRaw===null||performance.now()-lastSeen>700)return;
    if(which==='closed')closed=latestRaw;else open=latestRaw;
    if(closed!==null&&open!==null&&open-closed<.15){closed=open=null;$('#calibration-note').textContent='两个姿势太接近。请先合拢，再充分张开，重新记住。';return;}
    $('#calibration-note').textContent=closed!==null&&open!==null?'已记住你的张合范围。':which==='closed'?'已记住合拢，请张开手并记住张开。':'已记住张开，请合拢手并记住合拢。';
  }
  hand.addEventListener('click',enter);mouse.addEventListener('click',leave);
  start.addEventListener('click',begin);stop.addEventListener('click',()=>{release();setStatus('摄像头已关闭，点击开启可继续。');});
  $('#gesture-mini-stop').addEventListener('click',()=>{release();setStatus('摄像头已关闭，点击开启可继续。');});
  closedButton.addEventListener('click',()=>calibrate('closed'));openButton.addEventListener('click',()=>calibrate('open'));
  $('#calibrate-reset').addEventListener('click',()=>{closed=open=null;$('#calibration-note').textContent='动作不够灵敏时，可以记住你的合拢与张开姿势。';});
  $('#gesture-back').addEventListener('click',leave);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&(running||starting)){release();setStatus('离开页面时已关闭摄像头，回来后可重新开启。');}});
  window.addEventListener('pagehide',release);
  return{leave,get selected(){return selected;},get value(){return value;}};
}
