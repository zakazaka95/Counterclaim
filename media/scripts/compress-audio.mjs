import {spawnSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const ffmpeg=process.env.FFMPEG_EXECUTABLE||'C:/Users/yyzar/.codex/toolchains/motion-studio/python/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
const manifest=JSON.parse(await readFile('AUDIO-PROVENANCE.json','utf8'));
manifest.losslessTransport=[];
for(const name of ['score','sfx','mix']){
 const source=path.resolve('public/audio/'+name+'.wav');const target=path.resolve('public/audio/'+name+'.flac');
 const result=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',source,'-c:a','flac','-compression_level','8',target],{encoding:'utf8'});
 if(result.status!==0)throw new Error(result.stderr||'FLAC encoding failed');
 manifest.losslessTransport.push({file:'public/audio/'+name+'.flac',source:'public/audio/'+name+'.wav',sha256:createHash('sha256').update(await readFile(target)).digest('hex')});
}
await writeFile('AUDIO-PROVENANCE.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Original stems saved as lossless FLAC for a self-contained editable film.');
