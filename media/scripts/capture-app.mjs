// Captures the actual local app. It never starts a session, adjudicates, signs or resets.
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { browserExecutable } from './runtime.mjs';

const url=process.env.COUNTERCLAIM_APP_URL||'http://127.0.0.1:5178/';
const stage=process.argv[process.argv.indexOf('--stage')+1]||'preview';
const pixelScale=stage==='artifact'?5:2;
if(!['freeze','verdict','artifact','final','preview'].includes(stage))throw new Error('Use --stage freeze, verdict, artifact, final or preview');
const folder=path.resolve(stage==='preview'?'out/ui-preview':'public/footage');
await mkdir(folder,{recursive:true});
const browser=await puppeteer.launch({executablePath:browserExecutable,headless:true});
try{
 const page=await browser.newPage();
 await page.setViewport({width:1920,height:1080,deviceScaleFactor:pixelScale});
 await page.goto(url,{waitUntil:'networkidle0'});
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
 const demo=await page.evaluate(async()=>{const r=await fetch('/api/demo');if(!r.ok)throw new Error('Demo API not ready');const d=await r.json();return d.demo||d;});
 if(stage==='freeze'&&!['session_open','judging'].includes(demo.phase))throw new Error('Capture frozen pre-verdict evidence only after a real session opens. Actual phase: '+demo.phase);
 if(stage==='verdict'&&(demo.phase!=='verdict_ready'||!demo.adjudication?.receiptHash))throw new Error('Capture the actual persisted verdict before co-signing. Actual phase: '+demo.phase);
 if(stage==='artifact'&&!demo.deliverables?.some(m=>m.id==='regression-tests'&&m.evidence))throw new Error('Actual frozen regression-tests artifact unavailable');
 if(stage==='final'&&(demo.phase!=='settled'||!demo.adjudication?.receiptHash||!demo.signatures?.buyer||!demo.signatures?.seller))throw new Error('Final capture needs the genuine settled proof and both signatures. Actual phase: '+demo.phase);
 const targets=stage==='freeze'?[['agreement','agreement-panel'],['evidence','evidence-panel']]:stage==='verdict'?[['verdict','outcome-panel']]:stage==='artifact'?[]:stage==='final'?[['proof','proof-panel'],['case-final','case-workspace']]:[['agreement-preview','agreement-panel'],['evidence-preview','evidence-panel'],['outcome-preview','outcome-panel']];
 const records=[];
 for(const [name,id] of targets){
  const element=await page.$(`[data-testid="${id}"]`);if(!element)throw new Error('Missing actual UI selector '+id);
  await element.scrollIntoView();
  const rect=await element.boundingBox();
  const filename=name+'.png';
  const file=path.join(folder,filename);
  await element.screenshot({path:file});
  records.push({src:'footage/'+filename,width:rect.width,height:rect.height,pixelScale:2,selector:`[data-testid="${id}"]`,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
 }
 if(stage==='artifact'){
  const rows=await page.$$('[data-testid="evidence-panel"] button.milestone');
  const row=rows.at(-1);await row.scrollIntoView();await row.click();
  await page.waitForSelector('dialog[open] .evidence-document');
  const element=await page.$('dialog[open] .evidence-document');
  const artifact=await page.$eval('dialog[open] .evidence-document p',p=>p.textContent);
  if(artifact!==demo.deliverables.find(m=>m.id==='regression-tests').evidence)throw new Error('Visible artifact differs from the actual frozen artifact');
  const rect=await element.boundingBox();await element.screenshot({path:path.join(folder,'artifact.png')});
  records.push({src:'footage/artifact.png',width:rect.width,height:rect.height,pixelScale,selector:'Actual native Automated tests evidence dialog',artifactTextSha256:createHash('sha256').update(artifact).digest('hex'),sha256:createHash('sha256').update(await readFile(path.join(folder,'artifact.png'))).digest('hex')});
  const after=await page.evaluate(async()=>{const r=await fetch('/api/demo');const d=await r.json();return d.demo||d;});
  if(after.phase!==demo.phase||after.session.id!==demo.session.id)throw new Error('Case changed during read-only artifact capture');
 }
 if(stage==='verdict'){
  const element=await page.$('[data-testid="outcome-panel"] .split-graphic');
  await element.scrollIntoView();const rect=await element.boundingBox();
  await element.screenshot({path:path.join(folder,'allocation.png')});
  records.push({src:'footage/allocation.png',width:rect.width,height:rect.height,pixelScale:2,selector:'Native actual proposed split',sha256:createHash('sha256').update(await readFile(path.join(folder,'allocation.png'))).digest('hex')});
 }
 if(stage==='final'){
  const rect=await page.$eval('[data-testid="outcome-panel"]',element=>{const start=element.querySelector('.signatures');const end=element.querySelector('.outcome-boundary');if(!start||!end)throw new Error('Native signature section unavailable');start.scrollIntoView({block:'center'});const a=start.getBoundingClientRect(),b=end.getBoundingClientRect();return{x:a.x+window.scrollX-20,y:a.y+window.scrollY-20,width:a.width+40,height:b.bottom-a.y+40};});
  await page.screenshot({path:path.join(folder,'closure.png'),clip:rect});
  records.push({src:'footage/closure.png',width:rect.width,height:rect.height,pixelScale:2,selector:'Native signature section through zero-allocations note',sha256:createHash('sha256').update(await readFile(path.join(folder,'closure.png'))).digest('hex')});
 }
 const manifest={stage,actualPhase:demo.phase,caseId:demo.caseId??null,sessionId:demo.session?.id||null,receiptHash:demo.adjudication?.receiptHash||null,url,observedAt:new Date().toISOString(),actionsPerformed:'Read-only app capture; no coordinator mutation',captures:records};
 await writeFile(path.join(folder,stage+'-capture.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify(manifest,null,2));
}finally{await browser.close();}
