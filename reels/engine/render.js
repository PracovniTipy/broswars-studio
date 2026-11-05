// node render.js spec.json out.mp4   (spuštěno z libovolné složky)
const {chromium}=require('playwright');const {spawnSync,spawn}=require('child_process');const fs=require('fs'),path=require('path');
(async()=>{const specPath=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);const only=process.argv[4];
const spec=JSON.parse(fs.readFileSync(specPath,'utf8'));const FPS=30;
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
await p.goto('file://'+path.join(__dirname,'engine.html'));
const total=await p.evaluate(s=>build(s),spec);
await p.evaluate(()=>Promise.all([...document.querySelectorAll('video')].map(v=>new Promise(r=>{if(v.readyState>=2)return r();v.addEventListener('loadeddata',r,{once:true});setTimeout(r,8000)}))));
await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
if(only){for(const t of only.split(',')){await p.evaluate(x=>render(x),+t);await p.screenshot({path:out.replace(/\.mp4$/,'')+'_'+t+'.jpg',type:'jpeg',quality:85});}await b.close();return;}
const tmp=out+'.v.mp4';
const ff=spawn('ffmpeg',['-loglevel','error','-y','-f','image2pipe','-framerate',''+FPS,'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-r',''+FPS,tmp],{stdio:['pipe','ignore','inherit']});
const N=Math.round(total*FPS);
for(let f=0;f<N;f++){await p.evaluate(x=>render(x),f/FPS);const buf=await p.screenshot({type:'jpeg',quality:90});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));}
ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();
const m=spec.music;const tmp2=out+'.tmp.mp4';
if(m){const mp=path.resolve(path.dirname(specPath),m.src);
 const r=spawnSync('ffmpeg',['-loglevel','error','-y','-i',tmp,'-ss',''+(m.ss||0),'-i',mp,'-filter_complex',`[1:a]atrim=0:${total},asetpts=N/SR/TB,afade=t=in:d=0.3,afade=t=out:st=${(total-1.2).toFixed(2)}:d=1.2,loudnorm=I=-14:TP=-1.5,aresample=44100[a]`,'-map','0:v','-map','[a]','-c:v','libx264','-preset','veryfast','-crf','21','-maxrate','4.5M','-bufsize','9M','-g','60','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-ar','44100','-movflags','+faststart','-shortest',tmp2],{stdio:'inherit'});
 if(r.status!==0)process.exit(1);}
else spawnSync('ffmpeg',['-loglevel','error','-y','-i',tmp,'-c:v','libx264','-crf','21','-maxrate','4.5M','-bufsize','9M','-movflags','+faststart',tmp2]);
fs.renameSync(tmp2,out);fs.unlinkSync(tmp);console.log('OK',out,total+'s');})();
