import React from 'react';
import { AbsoluteFill, Audio, Easing, Freeze, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import rawEvidence from '../public/film-evidence.json';

type Capture = {src:string;width:number;height:number;focus?:{cx:number;cy:number;zoom:number}};
type FilmEvidence = {
  ready:boolean;title:string;caseId:string;caseTitle:string;
  sellerCredits:number|null;buyerCredits:number|null;decision:string;
  milestones:{id:string;title:string;weight:number;status:string}[];
  sessionId:string;sessionStatus:string;sessionVersions:number[];
  receiptHash:string;agreementHash:string;contractAddress:string;
  assessmentTransaction:string;explorerUrl:string;repositoryUrl:string;
  zeroFundsMoved:boolean;proofPath:string;
  screens:{agreement:Capture|null;evidence:Capture|null;verdict:Capture|null;closure:Capture|null;allocation?:Capture|null;artifact?:Capture|null};
};
const facts = rawEvidence as FilmEvidence;
const INK='#10120d',PAPER='#F5F2EA',YELLOW='#FCD000',MUTED='#77796d',LINE='#ccc9bd';
const OUT=Easing.bezier(.16,1,.3,1),SMOOTH=Easing.bezier(.65,0,.35,1);
const ramp=(f:number,start:number,duration:number,ease=OUT)=>interpolate(f,[start,start+duration],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:ease});
const short=(s:string,n=10)=>s ? s.slice(0,n)+'…'+s.slice(-6) : 'Awaiting saved proof';
const globalCss=`@font-face{font-family:Instrument;src:url('${staticFile('brand/InstrumentSerif-Regular.ttf')}')}@font-face{font-family:DM;src:url('${staticFile('brand/DMSans.ttf')}');font-weight:100 1000}*{box-sizing:border-box}body{margin:0}.film{font-family:DM,sans-serif}.serif{font-family:Instrument,Georgia,serif}.mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}`;

const Chapter:React.FC<{label:string;dark?:boolean;right?:string}>=({label,dark=false,right})=><div style={{position:'absolute',left:96,right:96,top:70,display:'flex',justifyContent:'space-between',fontSize:24,letterSpacing:'.16em',textTransform:'uppercase',color:dark?'#d3d4c9':INK,zIndex:5}}><span>Counterclaim <span style={{marginLeft:44,color:dark?'#787b6b':'#97988a'}}>{label}</span></span>{right&&<span style={{color:dark?'#8d9081':'#898b7e'}}>{right}</span>}</div>;

const Caption:React.FC<{children:React.ReactNode;dark?:boolean;sub?:string}>=({children,dark=false,sub})=>{
 const f=useCurrentFrame();const a=ramp(f,8,20);
 return <div style={{position:'absolute',left:96,bottom:64,right:96,zIndex:10,opacity:a,transform:`translateY(${(1-a)*20}px)`}}>
  <div style={{fontSize:60,fontWeight:500,lineHeight:1.1,letterSpacing:'-.04em',color:dark?PAPER:INK}}>{children}</div>
  {sub&&<div style={{marginTop:16,fontSize:30,color:dark?'#a9ad9d':MUTED}}>{sub}</div>}
 </div>;
};

const StageTexture:React.FC<{dark?:boolean}>=({dark=false})=><AbsoluteFill style={{pointerEvents:'none',opacity:dark?.15:.22,backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.76' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' opacity='.13' filter='url(%23n)'/%3E%3C/svg%3E")`}}/>;

const Logos:React.FC<{scale?:number}>=({scale=1})=><div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:84*scale}}>
 <Img src={staticFile('brand/internet-court-logo.svg')} style={{width:350*scale,height:64*scale,objectFit:'contain'}}/>
 <span style={{fontSize:36*scale,color:'#aaa89c'}}>×</span>
 <Img src={staticFile('brand/genlayer-logo-black.svg')} style={{width:340*scale,height:64*scale,objectFit:'contain'}}/>
 <span style={{fontSize:36*scale,color:'#aaa89c'}}>×</span>
 <Img src={staticFile('brand/yellow-logo-light.svg')} style={{width:230*scale,height:72*scale,objectFit:'contain'}}/>
</div>;

const Word:React.FC<{text:string;at:number;accent?:boolean}>=({text,at,accent=false})=>{
 const f=useCurrentFrame();const p=ramp(f,at,9,Easing.bezier(.2,.75,.3,1));
 return <span style={{display:'inline-block',opacity:p,transform:`scale(${1.28-.28*p})`,filter:`blur(${(1-p)*7}px)`,color:accent?YELLOW:undefined,marginRight:'.16em'}}>{text}</span>;
};

const Opening:React.FC=()=>{
 const f=useCurrentFrame();const p=ramp(f,14,30);const wipe=ramp(f,103,17,SMOOTH);
 return <AbsoluteFill style={{background:INK,color:PAPER,overflow:'hidden'}}>
  <StageTexture dark/><Chapter label="Partner Demo Lab / 01" dark/>
  <div style={{position:'absolute',left:96,top:300,width:1170,fontSize:136,lineHeight:.98,letterSpacing:'-.035em'}} className="serif">
   <div><Word text="A" at={4}/><Word text="signed" at={8}/><Word text="deal." at={12}/></div>
   <div><Word text="A" at={16}/><Word text="disputed" at={20} accent/><Word text="delivery." at={24}/></div>
  </div>
  <div style={{position:'absolute',left:96,top:635,fontSize:34,color:'#a5a995',opacity:ramp(f,30,18)}}>One agreement. Two agents. A path forward.</div>
  <div style={{position:'absolute',left:1260,top:270,width:550,height:550,background:'#fffef9',color:INK,border:'1px solid #d8d4c7',borderRadius:5,boxShadow:'0 28px 90px #0003',opacity:p,transform:`translateY(${(1-p)*80}px) rotate(${-4*p}deg)`,overflow:'hidden'}}>
   <div style={{height:12,background:YELLOW}}/><div style={{padding:40}}>
    <div style={{fontSize:25,letterSpacing:'.15em',color:MUTED,textTransform:'uppercase'}}>Technical delivery</div>
    <div className="serif" style={{fontSize:78,lineHeight:1.1,marginTop:32}}>The deal<br/>is on record.</div>
    <div style={{height:1,background:LINE,margin:'30px 0'}}/>
    <div style={{display:'flex',justifyContent:'space-between',fontSize:28}}><span>Three milestones</span><span>100 demo credits</span></div>
    <div style={{fontSize:24,color:MUTED,marginTop:34}}>Nonmonetary sandbox demonstration</div>
   </div>
  </div>
  <div style={{position:'absolute',left:96,bottom:74,color:'#8e9381',fontSize:23,letterSpacing:'.06em'}}>INTERNET COURT × GENLAYER × YELLOW</div>
  <div style={{position:'absolute',left:1920*(1-wipe),top:0,width:1920,height:1080,background:PAPER}}/>
 </AbsoluteFill>;
};

const MissingCapture:React.FC<{label:string}>=({label})=><AbsoluteFill style={{background:'#e9e6dc',alignItems:'center',justifyContent:'center',gap:22,border:'1px solid #c5c0b2'}}><span className="serif" style={{fontSize:80}}>Actual {label} capture pending.</span><span style={{fontSize:30,color:MUTED}}>Production draft · no result claimed</span></AbsoluteFill>;

const CapturedPanel:React.FC<{capture:Capture|null;label:string;zoom?:number;dark?:boolean}>=({capture,label,zoom=1,dark=false})=>{
 const f=useCurrentFrame();const enter=ramp(f,0,26);const push=ramp(f,45,85,SMOOTH);
 return <div style={{position:'absolute',left:110,top:164,width:1700,height:696,borderRadius:10,overflow:'hidden',background:dark?'#181b14':'#fffef9',border:`1px solid ${dark?'#33392a':'#dedacf'}`,boxShadow:dark?'0 25px 90px #0005':'0 25px 80px #37342118',transform:`translateY(${(1-enter)*44}px) scale(${.965+.035*enter})`,opacity:enter}}>
  {capture ? <Img src={staticFile(capture.src)} style={{position:'absolute',width:'100%',height:'100%',objectFit:'contain',objectPosition:'50% 50%',transform:`scale(${1+(zoom-1)*push})`}}/> : <MissingCapture label={label}/>}
 </div>;
};

const Agreement:React.FC=()=>{
 const f=useCurrentFrame();const flash=ramp(f,0,16);
 return <AbsoluteFill style={{background:PAPER,color:INK}}><StageTexture/><Chapter label="01 / Freeze the agreement" right="100 nonmonetary demo credits"/>
  <CapturedPanel capture={facts.screens.agreement} label="agreement" zoom={1.03}/>
  <div style={{position:'absolute',left:110,top:164,width:5,height:696*flash,background:YELLOW}}/>
  <Caption sub="Three milestones. Weights fixed before the dispute.">Agree on the rules first.</Caption>
 </AbsoluteFill>;
};

const Evidence:React.FC=()=>{
 const f=useCurrentFrame();const p=ramp(f,22,22);const artifact=f>=60;
 return <AbsoluteFill style={{background:PAPER,color:INK}}><StageTexture/><Chapter label="02 / Compare the delivery" right="Evidence is data, not instructions"/>
  <CapturedPanel capture={artifact?(facts.screens.artifact||null):facts.screens.evidence} label={artifact?'frozen test artifact':'evidence'} zoom={artifact?1:1.08}/>
  {!artifact&&<div style={{position:'absolute',right:122,top:185,background:YELLOW,padding:'12px 20px',fontSize:26,fontWeight:600,opacity:p}}>Same case. Same terms.</div>}
  <Caption>{artifact?'Tests promised. A TODO delivered.':'Compare delivery with the frozen terms.'}</Caption>
 </AbsoluteFill>;
};

const VerdictDocument:React.FC=()=>{
 const f=useCurrentFrame();const a=ramp(f,12,26);const count=ramp(f,33,40);
 return <div style={{position:'absolute',left:680,top:220,width:1095,height:610,background:'#fffef9',border:'1px solid #d3d0c6',borderRadius:6,color:INK,boxShadow:'0 35px 90px #0003',opacity:a,transform:`translateY(${(1-a)*50}px)`}}>
  <div style={{height:10,background:YELLOW}}/>
  <div style={{padding:'34px 44px'}}>
   <div style={{display:'flex',justifyContent:'space-between',fontSize:25,letterSpacing:'.11em',color:MUTED,textTransform:'uppercase'}}><span>GenLayer · persisted ruling</span><span>Case {facts.caseId||'—'}</span></div>
   {facts.screens.allocation?<div style={{height:268,marginTop:20}}><Img src={staticFile(facts.screens.allocation.src)} style={{height:'100%',width:'100%',objectFit:'contain'}}/></div>:<div style={{display:'flex',height:238,alignItems:'center',marginTop:12}}>
    <div style={{width:'50%',borderRight:'1px solid #d3d0c6'}}><div style={{fontSize:28,color:MUTED}}>Seller</div><div style={{fontSize:146,fontWeight:500,letterSpacing:'-.07em',lineHeight:1.14,fontVariantNumeric:'tabular-nums'}}>{facts.ready&&facts.sellerCredits!==null?Math.round(facts.sellerCredits*count):'—'}<span style={{fontSize:28,letterSpacing:0,marginLeft:16}}>credits</span></div></div>
    <div style={{width:'50%',paddingLeft:54}}><div style={{fontSize:28,color:MUTED}}>Buyer</div><div style={{fontSize:146,fontWeight:500,letterSpacing:'-.07em',lineHeight:1.14,fontVariantNumeric:'tabular-nums'}}>{facts.ready&&facts.buyerCredits!==null?Math.round(facts.buyerCredits*count):'—'}<span style={{fontSize:28,letterSpacing:0,marginLeft:16}}>credits</span></div></div>
   </div>}
   <div style={{height:1,background:LINE,marginTop:12}}/>
   <div style={{marginTop:26,display:'flex',gap:18}}>{facts.milestones.length?facts.milestones.map(m=><div key={m.id} style={{flex:1,borderBottom:`4px solid ${['SATISFIED','MET','SUPPORTED'].includes(m.status)?'#6c7b35':'#b45c43'}`,paddingBottom:16}}><div style={{fontSize:27,fontWeight:500}}>{m.title}</div><div style={{fontSize:23,color:MUTED,marginTop:8}}>{m.weight} credits · {m.status.toLowerCase().replaceAll('_',' ')}</div></div>):<div style={{fontSize:30,color:MUTED}}>Awaiting the real persisted verdict.</div>}</div>
   <div style={{fontSize:23,color:MUTED,marginTop:27}}>Nonmonetary demonstration. No funds transferred.</div>
  </div>
 </div>;
};

const VerdictBridge:React.FC=()=>{
 const f=useCurrentFrame();const pan=1920*ramp(f,180,60,SMOOTH);
 const draw=f<164?660*ramp(f,125,32):f<180?660+(1480-330-660)*ramp(f,164,16,SMOOTH):f<240?1150+pan:3070+(550+790+550+790)*ramp(f,240,28,SMOOTH);
 const total=3300+550+790+550+790;
 const path='M330 860 H2860 V310 H3650 V860 H2860';
 const ready=ramp(f,264,22);const endCaption=ramp(f,242,24);
 return <AbsoluteFill style={{background:INK,color:PAPER,overflow:'hidden'}}><StageTexture dark/>
  <div style={{position:'absolute',left:-pan,top:0,width:3840,height:1080}}>
   <div style={{position:'absolute',left:96,top:72,fontSize:24,letterSpacing:'.16em',color:'#c5c9b9'}}>COUNTERCLAIM <span style={{color:'#7d8470',marginLeft:50}}>03 / GENLAYER VERDICT</span></div>
   <Img src={staticFile('brand/genlayer-logo-white.svg')} style={{position:'absolute',left:96,top:232,width:360,height:80,objectFit:'contain',objectPosition:'left'}}/>
   <div className="serif" style={{position:'absolute',left:96,top:363,width:520,fontSize:100,lineHeight:1.02}}>Evidence<br/>becomes<br/><span style={{color:YELLOW}}>a verdict.</span></div>
   <div style={{position:'absolute',left:96,top:739,width:520,fontSize:30,lineHeight:1.35,color:'#9ca48e'}}>The accepted milestones<br/>determine the proposed split.</div>
   <VerdictDocument/>
   <div className="mono" style={{position:'absolute',left:330,top:892,color:'#b2b8a3',fontSize:27,opacity:ramp(f,119,18)}}>{facts.receiptHash?short(facts.receiptHash,16):'VERDICT DIGEST · AWAITING PROOF'}</div>
   <div style={{position:'absolute',left:2080,top:72,fontSize:24,letterSpacing:'.16em',color:'#c5c9b9'}}>COUNTERCLAIM <span style={{color:'#7d8470',marginLeft:50}}>04 / YELLOW SESSION</span></div>
   <Img src={staticFile('brand/yellow-logo-footer.svg')} style={{position:'absolute',left:2080,top:221,width:270,height:118,objectFit:'contain',objectPosition:'left'}}/>
   <div className="serif" style={{position:'absolute',left:2080,top:391,width:680,fontSize:105,lineHeight:1.02}}>Both agents.<br/><span style={{color:YELLOW}}>The same result.</span></div>
   <div style={{position:'absolute',left:2080,top:670,width:680,fontSize:32,lineHeight:1.45,color:'#a4ad95'}}>The verdict digest enters the<br/>co-signed session record.</div>
   <div style={{position:'absolute',left:2860,top:310,width:790,height:550,overflow:'hidden',background:'#1e2419',opacity:ready,color:INK}}>
    {facts.screens.closure?<Img src={staticFile(facts.screens.closure.src)} style={{width:'100%',height:'100%',objectFit:'contain',objectPosition:'50% 50%'}}/>:<MissingCapture label="Yellow session"/>}
   </div>
   <div style={{position:'absolute',left:2860,top:910,fontSize:27,color:'#a4ad95',opacity:ready}}>Cooperative signatures · zero asset allocations</div>
   <svg width={3840} height={1080} style={{position:'absolute',left:0,top:0,pointerEvents:'none'}}><path d={path} fill="none" stroke={YELLOW} strokeWidth={7} strokeLinecap="square" strokeLinejoin="miter" strokeDasharray={`${Math.max(0,draw)} ${total+1000}`}/></svg>
  </div>
  <div style={{position:'absolute',left:96,bottom:66,fontSize:56,fontWeight:500,letterSpacing:'-.035em',opacity:endCaption}}>Both agents sign the same result.</div>
 </AbsoluteFill>;
};

const RecordProof:React.FC=()=>{
 const f=useCurrentFrame();const p=ramp(f,6,26);
 return <AbsoluteFill style={{background:PAPER,color:INK}}><StageTexture/><Chapter label="05 / A record you can inspect" right="Yellow sandbox + GenLayer"/>
  <div style={{position:'absolute',left:96,top:220,width:715}}>
   <div className="serif" style={{fontSize:115,lineHeight:1.01}}>An outcome.<br/>With a trail.</div>
   <div style={{height:5,width:290,background:YELLOW,marginTop:36,transform:`scaleX(${p})`,transformOrigin:'left'}}/>
   <div style={{fontSize:29,lineHeight:1.4,color:MUTED,marginTop:37}}>Same agreement.<br/>Same verdict digest.<br/>An inspectable session record.</div>
  </div>
  <div style={{position:'absolute',left:915,top:200,width:895,background:'#fffef9',padding:'38px 42px',border:'1px solid #d8d3c6',borderRadius:6,boxShadow:'0 26px 80px #37342115',opacity:p,transform:`translateY(${(1-p)*30}px)`}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><Img src={staticFile('brand/yellow-logo-light.svg')} style={{width:210,height:70,objectFit:'contain',objectPosition:'left'}}/><span style={{fontSize:27,fontWeight:600,padding:'12px 18px',background:'#e6ead9',color:'#45582d'}}>{facts.sessionStatus||'AWAITING RECORD'}</span></div>
   <div style={{height:1,background:LINE,margin:'23px 0 29px'}}/>
   {[['Session',short(facts.sessionId,14)],['Versions',facts.sessionVersions.length?facts.sessionVersions.join(' → '):'Awaiting saved record'],['Verdict digest',short(facts.receiptHash,16)],['GenLayer contract',short(facts.contractAddress,12)]].map(([label,value])=><div key={label} style={{marginBottom:26}}><div style={{fontSize:23,letterSpacing:'.1em',textTransform:'uppercase',color:MUTED,marginBottom:8}}>{label}</div><div className="mono" style={{fontSize:32,letterSpacing:'-.03em'}}>{value}</div></div>)}
  </div>
  <Caption sub="The recorded proof is included with the public code.">Inspect the record. Replay the path.</Caption>
 </AbsoluteFill>;
};

const Closing:React.FC=()=>{
 const f=useCurrentFrame();const a=ramp(f,0,24);const b=ramp(f,18,24);const c=ramp(f,28,25);
 return <AbsoluteFill style={{background:PAPER,color:INK}}><StageTexture/><Chapter label="Independent partner demo"/>
  <div style={{position:'absolute',left:0,top:218,width:'100%',textAlign:'center',opacity:a,transform:`translateY(${(1-a)*28}px)`}}><div className="serif" style={{fontSize:174,letterSpacing:'-.035em'}}>Counterclaim<span style={{color:'#a89e00'}}>.</span></div><div style={{fontSize:44,letterSpacing:'-.025em',marginTop:22}}>From disputed work to an agreed split.</div></div>
  <div style={{position:'absolute',left:0,top:623,width:'100%',opacity:b,transform:`translateY(${(1-b)*16}px)`}}><Logos/></div>
  <div style={{position:'absolute',left:0,top:812,width:'100%',textAlign:'center',fontSize:32,color:MUTED,opacity:c}}>Working sandbox demo · Zero funds moved</div>
  <div style={{position:'absolute',left:0,top:909,width:'100%',textAlign:'center',fontSize:46,fontWeight:500,letterSpacing:'-.025em',opacity:c}}>{facts.repositoryUrl?facts.repositoryUrl.replace(/^https?:\/\//,''):'Reproduce the path. Inspect the code.'}</div>
 </AbsoluteFill>;
};

export const CounterclaimFilm:React.FC<{music?:boolean}>=({music=true})=>{
 const {fps}=useVideoConfig();
 return <AbsoluteFill className="film" style={{background:INK}}><style>{globalCss}</style>
  <Sequence from={0} durationInFrames={4*fps} name="01 — Work delivered, terms disputed"><Opening/></Sequence>
  <Sequence from={4*fps} durationInFrames={6.2*fps} name="02 — Actual frozen agreement"><Agreement/></Sequence>
  <Sequence from={10.2*fps} durationInFrames={6*fps} name="03 — Actual delivery evidence"><Evidence/></Sequence>
  <Sequence from={16.2*fps} durationInFrames={15*fps} name="04 — Verdict carried into Yellow"><VerdictBridge/></Sequence>
  <Sequence from={31.2*fps} durationInFrames={5.4*fps} name="05 — Inspectable recorded proof"><RecordProof/></Sequence>
  <Sequence from={36.6*fps} durationInFrames={5.4*fps} name="06 — Partner marks and reproducibility"><Closing/></Sequence>
  {music?<Audio src={staticFile('audio/mix.flac')} volume={1} startFrom={0} endAt={42*fps}/>:<Audio src={staticFile('audio/sfx.flac')} volume={.7} startFrom={0} endAt={42*fps}/>}
  {!facts.ready&&<div style={{position:'absolute',left:0,right:0,top:0,height:38,zIndex:100,background:'#962d25',color:'white',textAlign:'center',fontSize:22,letterSpacing:'.06em'}}>PRODUCTION DRAFT · AWAITING GENUINE PROOF AND UI CAPTURES</div>}
 </AbsoluteFill>;
};

export const CounterclaimPoster:React.FC=()=> <AbsoluteFill className="film" style={{background:PAPER}}><style>{globalCss}</style><Freeze frame={80}><Closing/></Freeze></AbsoluteFill>;
