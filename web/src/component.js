
class Component extends DCLogic {
  constructor(p){ super(p);
    const ls=(k,d)=>{ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v);}catch(e){ return d; } };
    this.state={step:1,query:'',origin:null,bundle:null,db:null,err:'',w:ls('sb.w',{pay:1,speed:1,safe:1}),plans:ls('sb.plans',{}),plan:null,saved:[],why:false,how:false,copied:false,showAll:false,rv:1,tilt:{x:0,y:0}};
    this.rm=typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._bomCache={}; this._oCache=null; this._oKey=null; }
  get motion(){ return !this.rm&&(this.props.motion??true); }
  reveal(){ clearInterval(this._rf); clearTimeout(this._rt); if(!this.motion){ this.setState({rv:1}); return; } const t0=Date.now(), dur=1100;
    this._rf=setInterval(()=>{ const p=Math.min(1,(Date.now()-t0)/dur), e=1-Math.pow(1-p,3); this.setState({rv:e}); if(p>=1) clearInterval(this._rf); },16);
    this._rt=setTimeout(()=>{ clearInterval(this._rf); this.setState({rv:1}); },dur+80); }
  onMove=e=>{ if(!this.motion) return; const x=e.clientX/window.innerWidth-0.5, y=e.clientY/window.innerHeight-0.5; this.setState({tilt:{x,y}}); }
  componentWillUnmount(){ clearInterval(this._rf); clearTimeout(this._rt); window.removeEventListener('mousemove',this.onMove); }
  componentDidMount(){ window.addEventListener('mousemove',this.onMove); this.reveal();
    const j=p=>fetch('./data/'+p).then(r=>{ if(!r.ok) throw new Error('data'); return r.json(); });
    Promise.all([j('occupations.json'),j('config.json'),j('skills.json')])
      .then(([occs,cfg,skills])=>this.setState({db:{occs,cfg,skills}}))
      .catch(()=>this.setState({err:'Could not load the dataset. Refresh to retry.'})); }
  persist(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
  fmt(n){ return (n>=0?'+':'−')+'$'+Math.abs(Math.round(n)).toLocaleString('en-US'); }
  fmtPay(m){ return (m&&m.floor?'≥':'')+this.fmt(m.pay); }
  goStep(n){ this.setState({step:n,rv:this.motion?0:1}); this.reveal(); try{ window.scrollTo({top:0,behavior:'auto'}); }catch(e){} }
  lerpN(n){ return Math.round(n*this.state.rv); }
  fmtPayRv(m){ return (m&&m.floor?'≥':'')+this.fmt(m.pay*this.state.rv); }
  loadSoc(soc){ const db=this.state.db; if(!db) return;
    fetch('./data/origins/'+soc+'.json').then(r=>{ if(!r.ok) throw new Error('x'); return r.json(); })
      .then(bundle=>{ this.setState({origin:soc,bundle,query:db.occs[soc].display_title,err:'',plan:null,why:false,showAll:false}); this.goStep(2); })
      .catch(()=>this.setState({err:"We couldn't analyze that occupation — it may lack wage or skill data."})); }
  zonePrep(z){ return {1:'Little or no preparation',2:'Weeks to months',3:'1–2 years',4:'2–4 years',5:'4+ years'}[Math.round(z)]||'Varies'; }
  zoneMonths(z){ return {1:1,2:3,3:12,4:30,5:48}[Math.round(z)]||6; }
  certFor(name){ const n=' '+name.toLowerCase()+' ';
    const CERTS=[
      [/tableau/, 'Tableau', 'https://www.tableau.com/learn/certification'],
      [/power bi|powerbi/, 'Microsoft', 'https://learn.microsoft.com/en-us/credentials/browse/?terms=power%20bi'],
      [/microsoft (excel|word|office|access|outlook|powerpoint|project|azure|dynamics|sharepoint|teams|visio|sql server)/, 'Microsoft', null],
      [/\bsas\b/, 'SAS', 'https://www.sas.com/en_us/certification.html'],
      [/amazon web services|\baws\b/, 'AWS', 'https://aws.amazon.com/certification/'],
      [/google analytics|google ads/, 'Google', 'https://skillshop.withgoogle.com/'],
      [/google cloud/, 'Google Cloud', 'https://cloud.google.com/learn/certification'],
      [/salesforce/, 'Salesforce', 'https://trailhead.salesforce.com/credentials'],
      [/\boracle\b|peoplesoft|mysql|\bjava\b/, 'Oracle', 'https://education.oracle.com/certification'],
      [/\bcisco\b/, 'Cisco', 'https://www.cisco.com/site/us/en/learn/training-certifications/certifications/index.html'],
      [/comptia/, 'CompTIA', 'https://www.comptia.org/certifications'],
      [/adobe|photoshop|illustrator|indesign|acrobat|premiere|after effects/, 'Adobe', 'https://certification.adobe.com/'],
      [/autodesk|autocad|\brevit\b|fusion 360|inventor/, 'Autodesk', 'https://www.autodesk.com/certification'],
      [/\bpython\b/, 'Python Institute', 'https://pythoninstitute.org/certification'],
      [/arcgis|\besri\b/, 'Esri', 'https://www.esri.com/training/certification/'],
      [/matlab/, 'MathWorks', 'https://www.mathworks.com/services/training/certification.html'],
      [/solidworks/, 'SolidWorks', 'https://www.solidworks.com/solidworks-certification-program'],
      [/kubernetes|\blinux\b/, 'Linux Foundation', 'https://training.linuxfoundation.org/certification/'],
      [/\bibm\b|spss/, 'IBM', 'https://www.ibm.com/training/credentials'],
      [/quickbooks/, 'Intuit', 'https://quickbooks.intuit.com/accountants/training-certification/'],
      [/\bunity\b/, 'Unity', 'https://unity.com/products/unity-certifications'],
      [/servicenow/, 'ServiceNow', 'https://www.servicenow.com/services/training-and-certification.html'],
    ];
    for(const [re,vendor,url] of CERTS){ if(re.test(n)) return {vendor,href:url||('https://learn.microsoft.com/en-us/credentials/browse/?terms='+encodeURIComponent(name))}; }
    return null; }

  // ---- Built-in PDF writer (no libraries, no server) -------------------
  // Writes a real PDF 1.4 file byte by byte: vector header band, stat row,
  // gap bars, checklist boxes, per-page footer. Standard Helvetica fonts
  // (no embedding); text widths measured via canvas for clean wrapping.
  makePlanPdf(d){
    const W=595.28,Hh=841.89,M=48,FOOT=44;
    const ACC='0.925 0.188 0.075', INK='0.125 0.118 0.114', GRAY='0.42 0.40 0.39', LGRAY='0.88 0.87 0.86', WHITE='1 1 1';
    let ctx=null; try{ ctx=document.createElement('canvas').getContext('2d'); }catch(e){}
    const wOf=(t,size,bold)=>{ if(!ctx) return t.length*size*0.52;
      ctx.font=(bold?'bold ':'')+size+'px Helvetica, Arial, sans-serif'; return ctx.measureText(t).width; };
    const sane=t=>String(t==null?'':t).replace(/\u2265/g,'>= ').replace(/[\u2013\u2014\u2212]/g,'-').replace(/\u2192/g,'->')
      .replace(/[\u00b7\u2022]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"')
      .replace(/\u2610/g,'[ ]').replace(/\u2611/g,'[x]').replace(/[^\x20-\x7e\u00bb]/g,'');
    const esc=t=>sane(t).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/\u00bb/g,'\\273');
    const N=v=>(Math.round(v*100)/100).toString();
    const pages=[]; let ops=[]; let y=0;
    const openPage=()=>{ ops=[]; pages.push(ops); y=M; };
    const rect=(x,yy,w,h,c)=>ops.push(`${c} rg ${N(x)} ${N(Hh-yy-h)} ${N(w)} ${N(h)} re f`);
    const box=(x,yy,sz,done)=>{ ops.push(`${GRAY} RG 0.9 w ${N(x)} ${N(Hh-yy-sz)} ${N(sz)} ${N(sz)} re S`);
      if(done){ ops.push(`${ACC} RG 1.4 w ${N(x+1.6)} ${N(Hh-yy-sz+3)} m ${N(x+sz/2)} ${N(Hh-yy-sz+1.4)} l ${N(x+sz-1)} ${N(Hh-yy-1.4)} l S`); } };
    const text=(t,x,yy,size,o2)=>{ const b=o2&&o2.bold, c=(o2&&o2.color)||INK;
      ops.push(`BT /${b?'F2':'F1'} ${N(size)} Tf ${c} rg ${N(x)} ${N(Hh-yy)} Td (${esc(t)}) Tj ET`); };
    const rtext=(t,xr,yy,size,o2)=>text(t,xr-wOf(sane(t),size,o2&&o2.bold),yy,size,o2);
    const wrap=(t,size,bold,maxw)=>{ const words=sane(t).split(/\s+/).filter(Boolean); const out=[]; let cur='';
      for(const w of words){ const cand=cur?cur+' '+w:w; if(wOf(cand,size,bold)<=maxw||!cur) cur=cand; else { out.push(cur); cur=w; } }
      if(cur) out.push(cur); return out; };
    const need=h=>{ if(y+h>Hh-M-FOOT) openPage(); };
    const para=(t,x,size,o2,maxw,lh)=>{ const lines=wrap(t,size,o2&&o2.bold,maxw||W-M-x);
      for(const ln of lines){ need(lh||size*1.45); y+=lh||size*1.45; text(ln,x,y,size,o2); } };
    const section=t=>{ need(46); y+=34; text(t,M,y,12.5,{bold:true}); y+=7; rect(M,y,26,2.2,ACC); };

    openPage();
    // Header band
    rect(0,0,W,112,ACC); y=0;
    text('SKILLBRIDGE  -  MY CAREER PLAN',M,26,8.5,{bold:true,color:WHITE});
    let ty=50; for(const ln of wrap(d.pair,19,true,W-2*M).slice(0,2)){ text(ln,M,ty,19,{bold:true,color:WHITE}); ty+=24; }
    text('Generated '+d.printedOn+'  -  computed from US public data (O*NET, BLS OEWS)  -  not career advice',M,ty+2,8,{color:'1 0.85 0.81'});
    y=112;
    // Stat row
    const cw=(W-2*M)/4; const stats=[['PAY CHANGE',d.pay+'/yr',true],['ESTIMATED TIME',d.time,false],['SKILLS TO CLOSE',d.skills,false],['TYPICAL ENTRY',d.license,false]];
    y+=26; stats.forEach((st,i)=>{ const x=M+i*cw; text(st[0],x,y,7,{color:GRAY});
      const vlines=wrap(st[1],st[2]?15:10.5,true,cw-14).slice(0,2);
      vlines.forEach((vl,k)=>text(vl,x,y+16+k*12,st[2]?15:10.5,{bold:true,color:st[2]?ACC:INK})); });
    y+=44; rect(M,y,W-2*M,1,LGRAY);
    if(d.aiLine){ y+=16; text(d.aiLine,M,y,8.5,{color:GRAY}); }
    if(d.floorNote){ y+=13; text(d.floorNote,M,y,8.5,{color:GRAY}); }
    // 1 - learn from scratch
    section('1  -  Skills to learn from scratch');
    if(!d.acquire.length){ y+=20; text('Nothing to learn from scratch - every key skill is already in your profile at some level.',M,y,9.5,{color:GRAY}); }
    for(const a of d.acquire){ need(40); y+=22; text(a.name,M,y,10,{bold:true});
      text(a.lv+'  (O*NET 0-100 scale)',M+wOf(sane(a.name),10,true)+10,y,8.5,{color:GRAY});
      y+=9; rect(M,y-5,170,4,LGRAY); rect(M,y-5,Math.max(6,170*a.pct),4,ACC);
      text('course search: '+a.url,M+184,y-0.5,7.5,{color:GRAY}); }
    // 2 - upgrade
    section('2  -  Skills to upgrade on the job');
    y+=8; para(d.upgrade.length?d.upgrade.join('  -  '):'Nothing to upgrade.',M,9.5,{color:INK},W-2*M,14);
    // 3 - already have
    section('3  -  Skills already at the required level ('+d.have.length+')');
    y+=8; para(d.have.join(', ')+'.',M,8.5,{color:GRAY},W-2*M,12);
    // 4 - tools
    section('4  -  Tools & certifications employers expect');
    if(!d.tech.length){ y+=20; text('No specific tools listed by O*NET for this occupation.',M,y,9.5,{color:GRAY}); }
    for(const t2 of d.tech){ need(30); y+=19; text(t2.name,M,y,10,{bold:true});
      y+=12; text(t2.label+':  '+t2.href,M+12,y,7.5,{color:GRAY}); }
    if(d.techGeneric){ need(24); y+=16; para(d.techGeneric,M,8,{color:GRAY},W-2*M,11); }
    // 5 - checklist
    section('5  -  Checklist');
    for(const ms of d.milestones){ need(26); y+=19; box(M,y-8,9,ms.done);
      const lines=wrap(ms.title,9.5,false,W-2*M-140); text(lines[0],M+18,y,9.5,{color:ms.done?GRAY:INK});
      rtext(ms.date,W-M,y,9.5,{bold:true}); let k=1; for(;k<lines.length;k++){ need(13); y+=13; text(lines[k],M+18,y,9.5,{color:ms.done?GRAY:INK}); } }
    // Footers
    pages.forEach((pops,i)=>{ const save=ops; ops=pops;
      rect(M,Hh-M-FOOT+12,W-2*M,0.8,LGRAY);
      text('Sources: O*NET (USDOL/ETA, CC BY 4.0) - BLS OEWS national medians - education from BLS EP or O*NET ETE - AIOE - OpenAI "GPTs are GPTs" - Microsoft "Working with AI".',M,Hh-M-FOOT+26,6.8,{color:GRAY});
      text('Wages are national medians; ">=" marks a government floor. Profiles describe the typical job holder, not you. Analysis of public data - not career advice.',M,Hh-M-FOOT+36,6.8,{color:GRAY});
      rtext('Page '+(i+1)+' of '+pages.length,W-M,Hh-M-FOOT+36,7.5,{color:GRAY});
      ops=save; });
    // Assemble the file
    const objs=[]; const add=s2=>{ objs.push(s2); return objs.length; };
    add('<< /Type /Catalog /Pages 2 0 R >>'); add('PAGES_PLACEHOLDER');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids=[];
    for(const pops of pages){ const cs=pops.join('\n');
      const pid=add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${N(W)} ${N(Hh)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${objs.length+2} 0 R >>`);
      add(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`); kids.push(pid+' 0 R'); }
    objs[1]=`<< /Type /Pages /Kids [ ${kids.join(' ')} ] /Count ${pages.length} >>`;
    let out='%PDF-1.4\n'; const offs=[0];
    objs.forEach((o3,i)=>{ offs.push(out.length); out+=(i+1)+' 0 obj\n'+o3+'\nendobj\n'; });
    const xr=out.length; out+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';
    for(let i=1;i<=objs.length;i++) out+=String(offs[i]).padStart(10,'0')+' 00000 n \n';
    out+=`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`;
    const blob=new Blob([out],{type:'application/pdf'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=d.filename;
    document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); }

  srcPcts(exp){ const out=[]; if(exp){ if(exp.msft!=null)out.push(['Microsoft Research — observed Copilot use',exp.msft]);
      if(exp.aioe!=null)out.push(['AIOE — ability-based',exp.aioe]); if(exp.openai!=null)out.push(['OpenAI — task-based',exp.openai]); } return out; }
  rng(exp){ const v=this.srcPcts(exp).map(x=>Math.round(x[1]*100)); return v.length?[Math.min(...v),Math.max(...v)]:[0,0]; }
  ord(n){ const v=n%100; if(v>=11&&v<=13) return n+'th'; return n+(['th','st','nd','rd'][n%10]||'th'); }
  bom(fromSoc,toSoc){ const key=fromSoc+':'+toSoc, C=this._bomCache; if(C[key]) return C[key];
    const db=this.state.db, ov=db.skills[fromSoc]||{}, tv=db.skills[toSoc]||{}, cfg=db.cfg.bom;
    const tiers={have:[],upgrade:[],acquire:[]};
    for(const skill of Object.keys(tv).sort()){ const tIm=tv[skill][0]; if(tIm<cfg.relevant_importance_min) continue;
      const oLv=(ov[skill]||[0,0])[1], tLv=tv[skill][1], gap=Math.max(0,tLv-oLv);
      const e={skill,o:Math.round(oLv*100),t:Math.round(tLv*100),wg:gap*tIm};
      if(oLv>=tLv-cfg.transferable_tolerance) tiers.have.push(e);
      else if(oLv>=cfg.upgrade_floor_ratio*tLv) tiers.upgrade.push(e); else tiers.acquire.push(e); }
    for(const k in tiers) tiers[k].sort((a,b)=>b.wg-a.wg);
    C[key]=tiers; return tiers; }
  buildOrigin(){ const S=this.state; if(!S.bundle||!S.db) return null;
    if(this._oKey===S.bundle) return this._oCache;
    const db=S.db, b=S.bundle, ox=db.occs[b.origin.soc_code];
    const gMin=Math.min(...b.transitions.map(t=>t.skill_gap)), gMax=Math.max(...b.transitions.map(t=>t.skill_gap)), gSpan=Math.max(0.0001,gMax-gMin);
    const moves=b.transitions.map(t=>{ const tgt=db.occs[t.to_soc]||{}; const z=tgt.job_zone||3; const edu=tgt.education||null;
      return {id:t.to_soc,title:t.to_title,eff:(t.skill_gap-gMin)/gSpan,pay:t.wage_delta,g:t.pareto?1:0,rng:this.rng(tgt.exposure),agree:!!(tgt.exposure&&tgt.exposure.agreement),
        months:this.zoneMonths(z),time:this.zonePrep(z),req:edu&&edu.typical_education?edu.typical_education:null,
        license:edu&&edu.typical_education?edu.typical_education:'Not tracked — check your state’s rules',floor:!!tgt.wage_is_floor,tech:tgt.tech||[],employment:tgt.employment||0,zone:z}; });
    const o={soc:b.origin.soc_code,title:ox.display_title,wage:ox.wage_median,floor:!!ox.wage_is_floor,zone:Math.round(ox.job_zone||0),n:b.transitions.length,rng:this.rng(ox.exposure),srcs:this.srcPcts(ox.exposure),moves,
      routes:(b.paths||[]).map(r=>({hops:r.hops.map(hp=>hp.title),gain:r.cumulative_wage_delta,floor:!!(r.hops[r.hops.length-1]||{}).wage_is_floor,time:(r.hops.length-1)+(r.hops.length===2?' step':' steps')}))};
    this._oKey=b; this._oCache=o; return o; }
  renderVals(){
    const S=this.state, db=S.db, cfgMeta=db?(db.cfg.meta||{}):{};
    const o=this.buildOrigin();
    const frontier=o?o.moves.filter(m=>m.g):[], posFrontier=frontier.filter(m=>m.pay>0);
    const hasMoves=posFrontier.length>0, noMoves=!!o&&!hasMoves;
    const origMid=o&&o.rng?(o.rng[0]+o.rng[1])/2:70;
    const maxPay=Math.max(1,...posFrontier.map(m=>m.pay));
    const mid=m=>(m.rng[0]+m.rng[1])/2;
    const score=m=>S.w.pay*(m.pay/maxPay)+S.w.speed*(1-m.eff)+S.w.safe*Math.max(0,Math.min(1,(origMid-mid(m))/40+0.5));
    const ranked=[...posFrontier].sort((a,b)=>score(b)-score(a));
    const best=ranked[0]||{};
    const aiDown=m=>mid(m)<origMid;
    const toggleSave=m=>()=>this.setState(s=>({saved:s.saved.includes(m.id)?s.saved.filter(x=>x!==m.id):[...s.saved,m.id]}));
    const popTag=m=>m.employment>=200000?'Big field':m.employment>=50000?'Mid-size field':'Smaller field';
    const openings=m=>'≈'+Math.round(m.employment).toLocaleString('en-US')+' people hold this job in the US';
    const planMove=m=>()=>{ this.setState({plan:m.id,copied:false}); this.goStep(4); };
    const rangeText=m=>`${m.rng[0]}–${this.ord(m.rng[1])}`;
    const agreeText=m=>(aiDown(m)?'Lower than yours today':'Higher than yours today')+' · '+(m.agree?'sources agree':'sources disagree');
    const wl=v=>v<1?'less':v>1?'more':'normal';
    const h=React.createElement, rv=S.rv, motion=this.motion, spd=this.props.orbitSpeed??1;
    // 3D logo cube — six flat faces in the accent ramp
    const face=(tf,bg)=>h('div',{style:{position:'absolute',inset:0,background:bg,transform:tf}});
    const logoCube=h('div',{style:{width:16,height:16,perspective:120,flex:'none'}},h('div',{style:{width:16,height:16,position:'relative',transformStyle:'preserve-3d',animation:motion?`sbcube ${9/spd}s linear infinite`:'none',transform:motion?undefined:'rotateX(-20deg) rotateY(35deg)'}},
      face('translateZ(8px)','var(--color-accent)'),face('rotateY(90deg) translateZ(8px)','var(--color-accent-600)'),face('rotateY(180deg) translateZ(8px)','var(--color-accent)'),face('rotateY(-90deg) translateZ(8px)','var(--color-accent-600)'),face('rotateX(90deg) translateZ(8px)','var(--color-accent-400)'),face('rotateX(-90deg) translateZ(8px)','var(--color-accent-800)')));
    // Hero lattice — a tilted modular grid of moves: pillars rise with pay, one white "you" marker
    const seed=n=>{ const x=Math.sin(n*99.7)*43758.5; return x-Math.floor(x); };
    const cells=[]; const N=6, cs=54;
    for(let r=0;r<N;r++) for(let c=0;c<N;c++){ const i=r*N+c, you=(r===3&&c===1), red=!you&&seed(i+7)<0.28, z=you?0:red?24+seed(i+3)*110:0;
      cells.push(h('div',{key:i,style:{position:'absolute',left:c*cs,top:r*cs,width:cs-6,height:cs-6,transformStyle:'preserve-3d'}},
        h('div',{style:{position:'absolute',inset:0,border:'1px solid var(--color-neutral-400)',background:you?'var(--color-text)':red?'var(--color-accent-200)':'transparent'}}),
        red?h('div',{style:{position:'absolute',left:10,top:10,right:10,bottom:10,background:'var(--color-accent)','--z':z+'px',transform:`translateZ(${z}px)`,animation:motion?`sbbob ${5+seed(i)*4}s ease-in-out ${-seed(i+1)*6}s infinite`:'none',boxShadow:'var(--shadow-md)'}}):null,
        you?h('div',{style:{position:'absolute',left:14,top:14,right:14,bottom:14,background:'var(--color-bg)',transform:'translateZ(2px)',animation:motion?'sbpulse 2s ease-in-out infinite':'none'}}):null)); }
    const heroLattice=h('div',{style:{position:'absolute',inset:0,transformStyle:'preserve-3d',transform:`rotateY(${S.tilt.x*8}deg) rotateX(${-S.tilt.y*6}deg)`,transition:'transform .6s ease-out'}},
      h('div',{style:{position:'absolute',left:'50%',top:'50%',width:N*cs,height:N*cs,marginLeft:-N*cs/2,marginTop:-N*cs/2+40,transformStyle:'preserve-3d',animation:motion?`sblat ${70/spd}s linear infinite`:'none',transform:motion?undefined:'rotateX(58deg) rotateZ(35deg)'}},...cells));
    const bestCard=best.id?{title:best.title,pay:this.fmtPayRv(best),time:best.time,rangeText:rangeText(best),agreeText:agreeText(best),popTag:popTag(best),openings:openings(best),plan:planMove(best),
      explain:`Of your ${o.n} realistic moves, this one best matches your priorities (pay ${wl(S.w.pay)}, speed ${wl(S.w.speed)}, AI safety ${wl(S.w.safe)}). It pays ${this.fmtPay(best)} a year more than the national median for your job, needs ${best.time.toLowerCase()} of preparation, and its AI exposure is ${aiDown(best)?'lower':'higher'} than yours today.`}:{};
    // steps
    const canMoves=!!o, canPlan=!!S.plan;
    const stepDefs=[['1','Your job','What you do today'],['2','Priorities','What matters to you'],['3','Your moves','Ranked and explained'],['4','Your plan','Skills, tools, dates']];
    const steps=stepDefs.map((d,i)=>{ const n=i+1, active=S.step===n, enabled=n===1||(n<=3&&canMoves)||(n===4&&canPlan);
      return {n:d[0],label:d[1],sub:d[2],disabled:!enabled,go:()=>this.goStep(n),
        style:`text-align:left;background:none;border:0;border-top:${active?'4px solid var(--color-accent)':'4px solid transparent'};margin-top:-2px;padding:18px 20px 18px 0;display:flex;flex-direction:column;gap:6px;min-width:0;font:inherit;color:inherit;cursor:${enabled?'pointer':'default'};opacity:${enabled||active?1:.4};border-right:${i<3?'2px solid var(--color-divider)':'0'};${i>0?'padding-left:20px':''}`,
        numStyle:`color:${active?'var(--color-accent)':'inherit'}`}; });
    // priorities
    const setW=(k,v)=>()=>{ const w={...S.w,[k]:v}; this.persist('sb.w',w); this.setState({w}); };
    const prio=(k,title,desc)=>{ const v=S.w[k]; return {name:'sb-'+k,title,desc,isLow:v<1,isMid:v===1,isHigh:v>1,setLow:setW(k,0.5),setMid:setW(k,1),setHigh:setW(k,1.5)}; };
    const prios=[prio('pay','Pay gain','How much the move raises your yearly pay, using national median wages.'),prio('speed','Speed','How little you would need to retrain — moves closer to your current skills score higher.'),prio('safe','AI safety','How much the move lowers your exposure to AI, across three independent indices.')];
    // search
    const allTitles=db?(this._titles||(this._titles=Object.values(db.occs).filter(x=>x.servable).map(x=>x.display_title).sort())):[];
    const doSearch=q=>{ const toks=q.trim().toLowerCase().split(/\s+/).filter(Boolean); if(!toks.length) return null; let bestHit=null,bestScore=0;
      for(const x of Object.values(db.occs)){ const hay=(x.title+' '+x.display_title).toLowerCase(); const hits=toks.filter(t=>hay.includes(t)).length; if(!hits) continue;
        const sc=hits*1e12+(x.servable?1e11:0)+(x.employment||0); if(sc>bestScore){ bestScore=sc; bestHit=x; } } return bestHit; };
    const submit=e=>{ e.preventDefault(); if(!db){ this.setState({err:'Still loading the dataset — one second.'}); return; }
      const hit=doSearch(S.query); if(!hit){ this.setState({err:"We couldn't match that job title — try a broader one."}); return; }
      if(!hit.servable){ this.setState({err:`'${hit.display_title}' can't be analyzed: ${hit.excluded_reason}.`}); return; } this.loadSoc(hit.soc_code); };
    const demo2=cfgMeta.no_move_example||null;
    // chart
    const all=o?o.moves:[]; const payAbs=Math.max(1,...all.map(m=>Math.abs(m.pay)));
    const zero=62;
    const points=all.map((p,i)=>{ const g=!!p.g, bst=p.id===best.id, sz=g?14:9;
      return {title:p.title,tip:`${p.title} · ${this.fmtPay(p)}/yr · ${p.time}`,plan:planMove(p),labelled:bst,
        style:`position:absolute;left:calc(${Math.min(97,4+p.eff*92)}% - ${sz/2}px);top:calc(${zero-p.pay*rv/payAbs*(zero-6)}% - ${sz/2}px);width:${sz}px;height:${sz}px;padding:0;border:${bst?'2px solid var(--color-text)':'0'};box-sizing:border-box;background:${g?'var(--color-accent)':'var(--color-neutral-400)'};cursor:pointer;z-index:${bst?3:g?2:1};animation:${motion?`sbpop .5s cubic-bezier(.22,1,.36,1) ${.3+i*.05}s backwards${bst?', sbring 2.2s ease-out 1.2s infinite':''}`:'none'}`,
        labelStyle:`position:absolute;${p.eff>0.5?'right:20px;text-align:right':'left:20px'};top:-4px;font-size:12px;font-weight:600;white-space:nowrap;width:max-content;max-width:260px;overflow:hidden;text-overflow:ellipsis;color:var(--color-text);background:var(--color-bg);padding:1px 6px`}; });
    // table rows
    const tableMoves=S.showAll?[...ranked,...all.filter(m=>!posFrontier.includes(m)).sort((a,b)=>b.pay-a.pay)]:ranked;
    const rows=tableMoves.map((m,i)=>({rowStyle:motion?`animation:sbin .5s cubic-bezier(.22,1,.36,1) ${.4+Math.min(i,10)*.06}s backwards`:'',title:m.title,isBest:m.id===best.id,pay:this.fmtPay(m),payColor:m.pay>=0?'var(--color-text)':'var(--color-neutral-600)',time:m.time,rangeText:rangeText(m),dir:aiDown(m)?'↓ lower':'↑ higher',popTag:popTag(m),plan:planMove(m),
      dot:`width:10px;height:10px;flex:none;background:${m.g?'var(--color-accent)':'var(--color-neutral-400)'}`}));
    // alternatives
    const altRows=[]; if(o){ const feas=o.moves;
      const safer=feas.filter(m=>mid(m)<origMid-5&&m.pay>=-(o.wage||1)*0.05).sort((a,b)=>mid(a)-mid(b))[0];
      if(safer) altRows.push({label:'Lower AI exposure, similar or better pay',title:safer.title,note:`−${Math.round(origMid-mid(safer))} pts AI exposure`});
      const nearest=feas.filter(m=>m.pay>=0&&(!safer||m.id!==safer.id)).sort((a,b)=>a.eff-b.eff)[0];
      if(nearest) altRows.push({label:'Adjacent role, least retraining',title:nearest.title,note:nearest.time});
      if(!altRows.length) altRows.push({label:'No lower-exposure alternative clears the bar',title:'Your current role holds up well in this data',note:''}); }
    // plan
    const dm=o?o.moves.find(m=>m.id===S.plan):null; const dt=dm?this.bom(o.soc,dm.id):null;
    let drawer={};
    if(dm&&dt){ const plan=S.plans[dm.id]||{}; const now=new Date();
      const ym=mo=>{ const d=new Date(now.getFullYear(),now.getMonth()+Math.round(mo),1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); };
      const wgMax=Math.max(0.0001,...dt.acquire.map(a=>a.wg));
      const acquire=dt.acquire.map(a=>({skill:a.skill,levels:a.o+' → '+a.t,href:'https://www.classcentral.com/search?q='+encodeURIComponent(a.skill),w:Math.round(a.wg/wgMax*100)+'%'}));
      const haveNames=dt.have.map(x=>x.skill), upgradeNames=dt.upgrade.map(x=>x.skill);
      const items=[...dt.acquire.map((a,i)=>({k:'a'+i,title:'Learn '+a.skill,mo:dm.months*(i+1)/(dt.acquire.length+1)})),
        ...(upgradeNames.length?[{k:'up',title:'Upgrade '+upgradeNames.slice(0,2).join(' & ')+(upgradeNames.length>2?' +'+(upgradeNames.length-2):'')+' on the job',mo:dm.months*0.8}]:[]),
        {k:'lic',title:'Check your state’s license or certification rules for '+dm.title,mo:dm.months*0.9},{k:'apply',title:'Apply for '+dm.title+' roles',mo:dm.months}];
      const savePlan=p=>{ const plans={...S.plans,[dm.id]:p}; this.persist('sb.plans',plans); this.setState({plans}); };
      const milestones=items.map(it=>{ const st=plan[it.k]||{}; const done=!!st.done; return {title:it.title,done,box:done?'☑':'☐',date:st.date||ym(it.mo),style:done?'color:var(--color-neutral-600);text-decoration:line-through':'',toggle:()=>savePlan({...plan,[it.k]:{...st,done:!done}}),setDate:e=>savePlan({...plan,[it.k]:{...st,date:e.target.value}})}; });
      const doneN=milestones.filter(m=>m.done).length;
      const mailBody=`My SkillBridge plan%0A${o.title} → ${dm.title}%0APay: ${this.fmtPay(dm)}/yr · ${dm.time}%0ASkills to learn: ${dt.acquire.map(a=>a.skill).join(', ')||'none'}%0A${location.href}`;
      // Distinctive tools first ('same certifications everywhere' fix):
      // the pipeline flags tools listed by most occupations as generic;
      // those collapse into one quiet line instead of six Office rows.
      const techAll=dm.tech||[];
      const techDistinct=techAll.filter(t=>!t.generic), techGen=techAll.filter(t=>t.generic);
      const techPick=(techDistinct.length?techDistinct:techAll).slice(0,6);
      const techRows=techPick.map(t=>{ const cert=this.certFor(t.name); return {name:t.name,hotDot:t.hot?'display:inline-block;width:8px;height:8px;background:var(--color-accent);flex:none':'display:inline-block;width:8px;height:8px;flex:none',linkLabel:cert?`${cert.vendor} certification →`:'Find courses →',href:cert?cert.href:'https://www.classcentral.com/search?q='+encodeURIComponent(t.name)}; });
      const techGenericLine=(techDistinct.length&&techGen.length)?('Plus everyday office software most jobs list: '+techGen.slice(0,5).map(t=>t.name).join(', ')+'.'):'';
      const claudePrompt=`I'm exploring a career move with SkillBridge AI, which computes everything from real public data (O*NET, BLS OEWS, three AI-exposure indices). Reason only from these computed facts plus general career knowledge, and do not invent statistics:
- Current job: ${o.title}, US median ${o.floor?'at least ':''}$${Math.round(o.wage).toLocaleString('en-US')}/yr, education zone ${o.zone} of 5.
- Target: ${dm.title}, pay change ${this.fmtPay(dm)}/yr (national medians${dm.floor?'; the target median is top-coded, so this is a floor':''}), preparation ${dm.time}.
- ${dm.req?'Typical entry education: '+dm.req+'. ':''}AI-exposure percentiles: me ${o.rng[0]}-${o.rng[1]}th today, target ${dm.rng[0]}-${dm.rng[1]}th (${dm.agree?'sources agree':'sources disagree'}).
- Skills to learn from scratch: ${dt.acquire.map(a=>a.skill).join(', ')||'none'}.
- Skills to upgrade on the job: ${upgradeNames.join(', ')||'none'}.
- Real tools/software O*NET lists for the target: ${(dm.tech||[]).slice(0,8).map(t=>t.name).join(', ')||'none listed'}.
Explain in plain language whether this move makes sense for me, sketch a realistic month-by-month plan built on those exact skills and tools, and finish with what this data cannot tell me.`;
      const total=dt.acquire.length+dt.upgrade.length+dt.have.length;
      const csvEsc=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
      const csvRows=[['type','item','detail','target date','link'],
        ...dt.acquire.map(a=>['skill to learn',a.skill,'level '+a.o+' → '+a.t,'','https://www.classcentral.com/search?q='+encodeURIComponent(a.skill)]),
        ...upgradeNames.map(u=>['skill to upgrade',u,'practice on the job','','']),
        ...techRows.map(t=>['tool / certification',t.name,t.linkLabel.replace(' →',''),'',t.href]),
        ...milestones.map(ms=>['milestone',ms.title,ms.done?'done':'open',ms.date,''])];
      const downloadCsv=()=>{ try{ const txt=csvRows.map(r=>r.map(csvEsc).join(',')).join('\r\n');
        const blob=new Blob(['\ufeff'+txt],{type:'text/csv;charset=utf-8'});
        const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
        a.download='my-plan-'+dm.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.csv';
        document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); }catch(e){} };
      const pdfDoc={pair:`${o.title} \u00bb ${dm.title}`,printedOn:new Date().toISOString().slice(0,10),
        pay:this.fmtPay(dm),time:dm.time,skills:`${dt.acquire.length+dt.upgrade.length} of ${total}`,license:dm.license,
        aiLine:`AI exposure: you ${o.rng[0]}-${o.rng[1]}th percentile today -> target ${dm.rng[0]}-${dm.rng[1]}th (${dm.agree?'sources agree':'sources disagree'}).`,
        floorNote:(o.floor||dm.floor)?'A >= figure is a government floor: exact medians above $208,000 are not published.':'',
        acquire:dt.acquire.map(a=>({name:a.skill,lv:'level '+a.o+' -> '+a.t,pct:Math.min(1,a.wg/wgMax),url:'classcentral.com/search?q='+encodeURIComponent(a.skill)})),
        upgrade:upgradeNames,have:haveNames,
        tech:techRows.map(t=>({name:t.name,label:t.linkLabel.replace(' \u2192','').replace(' ->',''),href:t.href})),
        techGeneric:techGenericLine,milestones,
        filename:'my-plan-'+dm.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.pdf'};
      const printPlan=()=>{ try{ this.makePlanPdf(pdfDoc); }catch(e){ try{ window.print(); }catch(e2){} } };
      drawer={pair:`${o.title} → ${dm.title}`,pay:this.fmtPayRv(dm),time:dm.time,skills:`${dt.acquire.length+dt.upgrade.length} of ${total}`,license:dm.license,
        intro:`Here is what the O*NET skill profiles say separates your job from this one. Of ${total} skills that matter for ${dm.title}, you already hold ${dt.have.length} at the required level, ${dt.upgrade.length} need strengthening, and ${dt.acquire.length} must be learned from scratch.`,
        acquireIntro:dt.acquire.length?`Start here — these are the biggest gaps. The bar shows how much each one matters for the target job. Levels are O*NET's 0–100 scale: yours today → what the job needs.`:'Nothing to learn from scratch — every key skill is already in your profile at some level.',
        acquire,upgradeIntro:upgradeNames.length?'You already have these, just not yet at the level the job asks for. Most people close these gaps through practice and stretch assignments rather than courses.':'Nothing to upgrade — your existing skills are either already at level or need learning from scratch.',
        upgrade:upgradeNames,have:haveNames.length?'Already at the target level: '+haveNames.join(', ')+'.':'No skills at the target level yet — the lists above are the whole path.',
        techRows,hasTech:techRows.length>0,techGenericLine,hasTechGeneric:!!techGenericLine,milestones,planDone:`${doneN} of ${milestones.length} done`,printPlan,downloadCsv,printedOn:new Date().toISOString().slice(0,10),
        mailto:`mailto:?subject=${encodeURIComponent('My career plan: '+dm.title)}&body=${mailBody}`,claudeHref:'https://claude.ai/new?q='+encodeURIComponent(claudePrompt),
        copySkills:()=>{ const txt=haveNames.concat(upgradeNames).join(', '); if(navigator.clipboard) navigator.clipboard.writeText(txt).catch(()=>{}); this.setState({copied:true}); setTimeout(()=>this.setState({copied:false}),1800); },
        save:toggleSave(dm),saveLabel:S.saved.includes(dm.id)?'Saved ✓':'Save this plan'}; }
    const hopStyle=(i,n)=>`white-space:nowrap;border:1px solid ${i===n-1?'var(--color-accent)':'var(--color-divider)'};padding:6px 12px;color:${i===0?'var(--color-neutral-700)':'var(--color-text)'};font-size:13px`;
    const bomBest=best.id?this.bom(o.soc,best.id):null;
    const whyLines=best.id&&bomBest?[
      {k:this.fmtPay(best)+'/yr',v:`Pay gain on national medians — ${Math.round(best.pay/maxPay*100)}% of the largest gain among your best trade-offs.`},
      {k:`${bomBest.have.length} of ${bomBest.have.length+bomBest.upgrade.length+bomBest.acquire.length} skills`,v:`You already hold these at the required level; ${bomBest.acquire.length} must be learned from scratch.`},
      {k:rangeText(best)+' percentile',v:`AI exposure after the move vs your ${o.rng[0]}–${o.rng[1]}th today — ${best.agree?'all three sources agree on the direction':'the sources disagree on the direction'}.`},
      {k:popTag(best),v:openings(best)+' (BLS OEWS). This is how many hold the job, not how often people switch into it.'}]:[];
    const spread=o?o.rng[1]-o.rng[0]:0;
    return {
      steps,isStep1:S.step===1,isStep2:S.step===2&&!!o,isStep3:S.step===3&&!!o,isStep4:S.step===4&&!!(dm&&dt),
      toStep1:()=>this.goStep(1),toStep2:()=>this.goStep(2),toStep3:()=>this.goStep(3),restart:e=>{ e.preventDefault(); this.goStep(1); },
      query:S.query,onType:e=>this.setState({query:e.target.value,err:''}),submit,
      demoTeller:()=>{ if(db){ this.setState({query:'Bank Teller'}); this.loadSoc('43-3071'); } },demoSurgeon:()=>{ if(db&&demo2) this.loadSoc(demo2.soc); },
      demo2Label:demo2?`${demo2.title} (no better move)`:'',hasDemo2:!!demo2,allTitles,hasErr:!!S.err,err:S.err,dataUpdated:(cfgMeta.built_at||'').slice(0,10)||'—',
      logoCube,heroLattice,
      originTitle:o?o.title:'',originWage:o?`${o.floor?'≥':''}$${this.lerpN(o.wage).toLocaleString('en-US')}`:'',originZone:o?String(o.zone):'',originN:o?String(o.n):'',
      origRange:o?`${this.lerpN(o.rng[0])}–${this.ord(this.lerpN(o.rng[1]))}`:'',origLo:o?o.rng[0]+'%':'0%',origW:o?Math.max(2,o.rng[1]-o.rng[0])+'%':'0%',
      srcRows:o?o.srcs.map(s=>({name:s[0],pct:this.ord(Math.round(s[1]*100))})):[],
      spreadNote:o?(spread>=25?`A ${spread}-point spread means the evidence is mixed — favour moves that narrow it.`:`A ${spread}-point spread — the three sources broadly agree here.`):'',
      prios,hasMoves,noMoves,
      verdict:hasMoves?`Your best realistic move is ${best.title}.`:noMoves?"No single move beats what you have.":'',
      verdictSub:o?((hasMoves?`We scored ${o.n} realistic moves on pay, retraining effort and AI risk, then ranked the best trade-offs by your priorities. Below: the recommendation explained, every move at a glance, and the full list.`:`Of ${o.n} realistic moves, none improves pay without a large retraining cost.`)+(o.floor?' Your own median wage is a government floor (≥$208k), so pay changes shown are upper bounds.':'')):'',
      best:bestCard,whyOpen:S.why,toggleWhy:()=>this.setState(s=>({why:!s.why})),whyLabel:S.why?'Hide the reasoning':'Why this move?',whyLines,
      points,zeroTop:zero+'%',rows,tableTitle:S.showAll?`All ${all.length} realistic moves`:`Your ${ranked.length} best trade-offs, ranked`,
      tableSub:S.showAll?'Grey squares are realistic but beaten by another move on every count. Sorted by pay after the ranked trade-offs.':'Ranked by your priorities. Every one is either O*NET-related to your job or among your closest skill matches.',
      toggleAll:()=>this.setState(s=>({showAll:!s.showAll})),toggleAllLabel:S.showAll?'Show best trade-offs only':`Show all ${all.length} moves`,
      hasRoutes:!!(o&&o.routes.length),routes:o?o.routes.map(r=>({gain:`${r.floor?'≥':''}${this.fmt(r.gain)}/yr · ${r.time}`,hops:r.hops.map((t,i)=>({title:t,arrowStyle:i<r.hops.length-1?'color:var(--color-neutral-600)':'display:none',style:hopStyle(i,r.hops.length)}))})):[],
      altRows,howOpen:S.how,toggleHow:()=>this.setState(s=>({how:!s.how})),howLabel:S.how?'Hide how we scored this ↑':'How we scored this ↓',
      drawer,copyLabel:S.copied?'Copied ✓':'Copy skills for my resume'
    };
  }
}
