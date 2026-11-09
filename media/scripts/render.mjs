import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia, renderStill } from '@remotion/renderer';
import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { browserExecutable } from './runtime.mjs';

const root=path.resolve('.');
const out=path.join(root,'out');
await mkdir(out,{recursive:true});
let facts=JSON.parse(await readFile('public/film-evidence.json','utf8'));
const stillsOnly=process.argv.includes('--stills');
const draft=process.argv.includes('--draft');
const skipStills=process.argv.includes('--skip-stills');
if(!stillsOnly&&!draft){
 const verification=spawnSync(process.execPath,['scripts/ingest-proof.mjs',facts.proofPath||'public/recorded-demo-proof.json'],{encoding:'utf8'});
 if(verification.status!==0)throw new Error(verification.stderr||'Archived proof binding failed');
 facts=JSON.parse(await readFile('public/film-evidence.json','utf8'));
 if(!facts.ready||!facts.zeroFundsMoved||facts.sellerCredits===null||facts.buyerCredits===null)throw new Error('Final render requires genuine saved proof and zero-funds demo scope.');
 if(facts.sellerCredits+facts.buyerCredits!==100)throw new Error('Demo-credit result must preserve the frozen 100-unit total.');
 if(!facts.sessionId||!facts.receiptHash||!facts.contractAddress||!facts.assessmentTransaction||!facts.proofPath)throw new Error('Missing source-matched proof identifiers.');
 if(!facts.sessionVersions.length||!/closed/i.test(facts.sessionStatus))throw new Error('Actual closed Yellow session proof is required for this film story.');
 for(const name of ['agreement','evidence','artifact','verdict','allocation','closure']){
  const capture=facts.screens[name];if(!capture?.src)throw new Error('Missing actual '+name+' capture');
  await access(path.join(root,'public',capture.src));
 }
 await access(path.resolve(root,facts.proofPath));
}
const serveUrl=await bundle({entryPoint:path.join(root,'src/index.ts'),publicDir:path.join(root,'public'),onProgress:(p)=>{if(p===100)console.log('Bundled film source');}});
const composition=await selectComposition({serveUrl,id:'CounterclaimFilm',browserExecutable});
if(composition.durationInFrames!==1260||composition.fps!==30)throw new Error('Mission duration changed unexpectedly');
const stillFrames=[80,210,390,600,820,1010,1200];
await mkdir(path.join(out,'qa'),{recursive:true});
for(const frame of skipStills?[]:stillFrames){
 await renderStill({composition,serveUrl,frame,browserExecutable,output:path.join(out,'qa',`f${frame}.png`),imageFormat:'png',logLevel:'warn'});
 console.log('Checked-frame render',frame);
}
if(!skipStills){
 const poster=await selectComposition({serveUrl,id:'CounterclaimPoster',browserExecutable});
 await renderStill({composition:poster,serveUrl,frame:0,browserExecutable,output:path.join(out,'counterclaim-poster.png'),imageFormat:'png',logLevel:'warn'});
}
if(stillsOnly){console.log('Stills complete. This is not a completed mission film.');process.exit(0);}
const silent=path.join(out,draft?'counterclaim-draft-silent.mp4':'counterclaim-silent.mp4');
let lastPercent=-1;
await renderMedia({composition,serveUrl,codec:'h264',outputLocation:silent,browserExecutable,concurrency:1,muted:true,crf:17,pixelFormat:'yuv420p',logLevel:'warn',onProgress:({progress})=>{const percent=Math.round(progress*100);if(percent%10===0&&percent!==lastPercent){lastPercent=percent;console.log(`Video ${percent}%`);}}});
console.log('\nVideo rendered; muxing original audio.');
const ffmpeg=process.env.FFMPEG_EXECUTABLE||'C:/Users/yyzar/.codex/toolchains/motion-studio/python/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
const finalFiles=[];
for(const [name,stem] of [['counterclaim-42s.mp4','mix.flac'],['counterclaim-42s-sfx-only.mp4','sfx.flac']]){
 const file=path.join(out,draft?'draft-'+name:name);
 const command=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',silent,'-i',path.join(root,'public/audio',stem),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-t','42','-movflags','+faststart',file],{encoding:'utf8'});
 if(command.status!==0)throw new Error(command.stderr||'Audio mux failed');
 finalFiles.push({file:path.relative(root,file).replaceAll('\\','/'),sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
}
await writeFile(path.join(out,'render-record.json'),JSON.stringify({draft,frames:1260,fps:30,width:1920,height:1080,seconds:42,browser:browserExecutable,proofPath:facts.proofPath,proofReady:facts.ready,semanticResultsInvented:false,outputs:finalFiles},null,2)+'\n');
console.log(JSON.stringify(finalFiles,null,2));
