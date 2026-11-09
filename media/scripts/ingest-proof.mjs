// Build the film's small allowlisted fact record from actual saved protocol evidence.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const proofPath=path.resolve(process.argv[2]||'../proof/demo-proof.json');
const root=path.resolve('.');
const raw=await readFile(proofPath);
const proof=JSON.parse(raw.toString('utf8'));
const d=proof.demo,y=proof.yellow,g=proof.genlayer;
let priorRepository='';
try{priorRepository=JSON.parse(await readFile('public/film-evidence.json','utf8')).repositoryUrl||'';}catch{}
const insist=(condition,message)=>{if(!condition)throw new Error(message);};
const canonical=(value)=>{
 if(value===null||['string','boolean'].includes(typeof value))return JSON.stringify(value);
 if(typeof value==='number'&&Number.isSafeInteger(value))return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 throw new Error('Unexpected noncanonical evidence value');
};
const hash=(value)=>createHash('sha256').update(canonical(value)).digest('hex');
const fileHash=(value)=>createHash('sha256').update(value).digest('hex');
insist(proof.schema==='counterclaim-demo-proof-v1','Unexpected proof schema');
insist(proof.phase==='settled'&&d?.phase==='settled','Actual demo has not reached settled');
insist(proof.fundsMoved===false&&Array.isArray(proof.actualTokenAllocations)&&proof.actualTokenAllocations.length===0,'Film scope requires zero funds and zero token allocations');
insist(y?.isClosed===true&&y.phase==='CLOSED'&&d.session?.status==='closed','Actual Yellow session must be read back closed');
insist(d.signatures?.buyer===true&&d.signatures?.seller===true,'Both cooperative signatures are required');
insist(g?.executionVerified===true&&g.leaderOnly===false,'A real verified normal-consensus deployment is required');
insist(d.adjudication?.status==='complete'&&d.adjudication.finality==='FINALIZED','The recorded adjudication must be complete and finalized');
const receipt=d.receipt;
insist(receipt?.decision==='RESOLVED'&&receipt.settlement_allowed===true,'The actual persisted ruling is not resolved');
insist(hash(receipt)===d.receiptHash&&d.adjudication?.receiptHash===d.receiptHash,'Persisted receipt fingerprint mismatch');
insist(y.verdict?.receiptHash===d.receiptHash&&hash(y.verdict.receipt)===d.receiptHash,'Yellow is not bound to the same full receipt');
insist(receipt.session_id===y.appSessionId&&d.session.id===y.appSessionId,'Session identity mismatch');
insist(hash(proof.completeAgreement)===y.agreementHash&&receipt.agreement_hash===y.agreementHash,'Full agreement binding mismatch');
insist(hash(proof.completeEvidence)===y.evidenceHash&&receipt.evidence_hash===y.evidenceHash,'Full evidence binding mismatch');
insist(d.allocation?.total===100&&d.allocation.seller+d.allocation.buyer===100,'Frozen demo-credit sum changed');
const yellowAllocation={worker:receipt.allocation.seller,client:receipt.allocation.buyer,total:receipt.allocation.total,unit:'DEMO_CREDITS'};
insist(canonical(d.allocation)===canonical(receipt.allocation)&&canonical(y.proposedAllocation)===canonical(yellowAllocation),'Proposed allocation differs from the exact documented seller/worker and buyer/client mapping');
const source=await readFile(path.resolve(root,'../contracts/CounterclaimCourt.py'));
insist(fileHash(source)===g.sourceSha256,'Tracked contract differs from recorded deployment source');
const stages=y.stages||[];
insist(stages.length>=4,'Missing genuine session state sequence');
for(const stage of stages){
 insist(stage.snapshot?.appSessionId===y.appSessionId,'Yellow stage session mismatch');
 insist(Array.isArray(stage.snapshot.allocations)&&stage.snapshot.allocations.length===0,'A captured Yellow stage has token allocations');
}
const last=stages.at(-1).snapshot;
insist(last.isClosed===true&&JSON.parse(last.sessionData).verdictReference?.receiptHash===d.receiptHash,'Final Yellow state does not bind the verdict');

const frozen=JSON.parse(await readFile('public/footage/freeze-capture.json','utf8'));
const verdictCapture=JSON.parse(await readFile('public/footage/verdict-capture.json','utf8'));
const artifactCapture=JSON.parse(await readFile('public/footage/artifact-capture.json','utf8'));
const final=JSON.parse(await readFile('public/footage/final-capture.json','utf8'));
insist(frozen.sessionId===y.appSessionId&&['session_open','judging'].includes(frozen.actualPhase),'Pre-verdict footage belongs to a different case');
insist(final.actualPhase==='settled'&&final.sessionId===y.appSessionId&&final.receiptHash===d.receiptHash,'Final footage does not match the actual outcome');
insist(verdictCapture.actualPhase==='verdict_ready'&&verdictCapture.sessionId===y.appSessionId&&verdictCapture.receiptHash===d.receiptHash,'Verdict footage does not match the actual persisted outcome');
insist(artifactCapture.sessionId===y.appSessionId&&artifactCapture.receiptHash===d.receiptHash,'Artifact footage belongs to another case');
const shownArtifact=artifactCapture.captures.find(c=>c.src==='footage/artifact.png');
const testArtifact=proof.completeEvidence.find(e=>e.milestone_id==='regression-tests');
insist(shownArtifact?.artifactTextSha256===fileHash(Buffer.from(testArtifact.content,'utf8')),'Visible test artifact differs from the complete frozen evidence');
const captureList=[...frozen.captures,...verdictCapture.captures,...artifactCapture.captures,...final.captures];
for(const capture of captureList)insist(fileHash(await readFile(path.join(root,'public',capture.src)))===capture.sha256,'Captured UI file changed: '+capture.src);
const find=(name)=>{const capture=captureList.find(c=>c.src==='footage/'+name+'.png');insist(Boolean(capture),'Missing actual '+name+' capture');return{src:capture.src,width:capture.width,height:capture.height};};
const facts={ready:true,title:'Counterclaim',caseId:String(d.caseId),caseTitle:d.agreement.title,
 sellerCredits:d.allocation.seller,buyerCredits:d.allocation.buyer,decision:receipt.decision,
 milestones:proof.completeAgreement.milestones.map(m=>({id:m.id,title:m.title,weight:m.weight,status:receipt.milestones.find(r=>r.id===m.id)?.status||'UNCERTAIN'})),
 sessionId:y.appSessionId,sessionStatus:'CLOSED',sessionVersions:stages.map(s=>Number(s.snapshot.version)),
 receiptHash:d.receiptHash,agreementHash:y.agreementHash,contractAddress:g.address,
 assessmentTransaction:d.adjudication.transactionHash,explorerUrl:d.adjudication.explorerUrl,
 repositoryUrl:process.env.COUNTERCLAIM_REPOSITORY_URL||priorRepository,zeroFundsMoved:true,
 proofPath:'public/recorded-demo-proof.json',originalProofPath:path.relative(root,proofPath).replaceAll('\\','/'),proofSha256:fileHash(raw),sourceSha256:g.sourceSha256,
 screens:{agreement:find('agreement'),evidence:find('evidence'),artifact:find('artifact'),verdict:find('verdict'),allocation:find('allocation'),closure:find('closure')}};
await writeFile('public/recorded-demo-proof.json',raw);
await writeFile('public/film-evidence.json',JSON.stringify(facts,null,2)+'\n');
await writeFile('public/footage/film-source-record.json',JSON.stringify({proofPath:facts.proofPath,proofSha256:facts.proofSha256,sourceSha256:g.sourceSha256,sessionId:y.appSessionId,receiptHash:d.receiptHash,preVerdictCapture:frozen,verdictCapture,artifactCapture,finalCapture:final},null,2)+'\n');
console.log(JSON.stringify({ready:true,caseId:facts.caseId,sessionId:facts.sessionId,versions:facts.sessionVersions,creditSplit:[facts.sellerCredits,facts.buyerCredits],sourceProof:facts.proofPath,actualScreens:Object.keys(facts.screens)},null,2));
