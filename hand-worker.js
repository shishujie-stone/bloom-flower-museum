// Classic worker: the official WASM loader uses importScripts; inference stays off the UI thread.
let detector=null;
self.onmessage=async({data})=>{
  if(data.type==='init'){
    try{
      const {FilesetResolver,HandLandmarker}=await import('./vendor/mediapipe/vision_bundle.mjs');
      const wasm=await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm',self.location.href).href);
      detector=await HandLandmarker.createFromOptions(wasm,{
        baseOptions:{modelAssetPath:new URL('./assets/models/hand_landmarker.task',self.location.href).href,delegate:'CPU'},
        canvas:new OffscreenCanvas(640,480),runningMode:'VIDEO',numHands:1,
        minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.55,
      });
      self.postMessage({type:'ready'});
    }catch(error){self.postMessage({type:'error',message:String(error.message||error)});}
  }else if(data.type==='frame'){
    try{
      if(!detector)throw new Error('Hand detector is not ready');
      const result=detector.detectForVideo(data.bitmap,data.timestamp);
      self.postMessage({type:'result',landmarks:result.landmarks[0]||null,world:result.worldLandmarks[0]||null});
    }catch(error){self.postMessage({type:'error',message:String(error.message||error)});}
    finally{data.bitmap?.close();}
  }
};
