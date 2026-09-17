
class Component extends DCLogic {
  constructor(p){ super(p);
    const ls=(k,d)=>{ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v);}catch(e){ return d; } };
    this.rm=typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.state={ang:0,drag:null,hover:false,hoverAng:0,tourAng:0,tour:-1,query:'',origin:null,bundle:null,db:null,err:'',mode:ls('sb.view','3d'),w:ls('sb.w',{pay:1,speed:1,safe:1}),plans:ls('sb.plans',{}),drawer:null,compare:[],saved:[],why:false,copied:false};
    this._bomCache={}; this._oCache=null; this._oKey=null; }
  componentDidMount(){ const t=()=>{ const S=this.state;
      if(S.tour>=0&&!this.rm){ const tgt=this.tourTarget; if(tgt!=null) this.setState(s=>({tourAng:s.tourAng+(tgt-s.tourAng)*0.06})); }
      else if(!S.drag&&!S.hover&&!this.rm&&(this.props.autoOrbit??true)) this.setState(s=>({ang:s.ang+0.25}));
      this.raf=requestAnimationFrame(t); }; this.raf=requestAnimationFrame(t);
    // Real data: everything below was precomputed by the pipeline
    // (DuckDB/dbt warehouse -> engine -> JSON export). Nothing is invented here.
    const j=p=>fetch('./data/'+p).then(r=>{ if(!r.ok) throw new Error('data'); return r.json(); });
    Promise.all([j('occupations.json'),j('config.json'),j('skills.json')])
      .then(([occs,cfg,skills])=>this.setState({db:{occs,cfg,skills}}))
      .catch(()=>this.setState({err:'Could not load the dataset. Refresh to retry.'})); }
  componentWillUnmount(){ cancelAnimationFrame(this.raf); }
  persist(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
  seed(n){ const x=Math.sin(n*99.7)*43758.5; return x-Math.floor(x); }
  fmt(n){ return (n>=0?'+':'−')+'$'+Math.abs(Math.round(n)).toLocaleString('en-US'); }
  go(id){ const el=document.getElementById(id); if(el) window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-80,behavior:this.rm?'auto':'smooth'}); }
  loadSoc(soc){ const db=this.state.db; if(!db) return;
    fetch('./data/origins/'+soc+'.json').then(r=>{ if(!r.ok) throw new Error('x'); return r.json(); })
      .then(bundle=>{ const title=db.occs[soc].display_title;
        const startTour=bundle.transitions.some(t=>t.pareto&&t.wage_delta>0)&&this.state.mode==='3d'&&!this.rm;
        this.setState({origin:soc,bundle,query:title,err:'',drawer:null,compare:[],why:false,tour:startTour?0:-1,tourAng:0});
        setTimeout(()=>this.go('results'),60); })
      .catch(()=>this.setState({err:"We couldn't analyze that occupation — it may lack wage or skill data."})); }
  // O*NET Job Zone preparation bands (official zone definitions, not estimates)
  zonePrep(z){ return {1:'zone 1 · little prep',2:'zone 2 · weeks–months prep',3:'zone 3 · 1–2 yrs prep',4:'zone 4 · 2–4 yrs prep',5:'zone 5 · 4+ yrs prep'}[Math.round(z)]||'prep varies'; }
  zoneMonths(z){ return {1:1,2:3,3:12,4:30,5:48}[Math.round(z)]||6; }
  srcPcts(exp){ const out=[]; if(exp){ if(exp.msft!=null)out.push(['Microsoft Research (observed Copilot use)',exp.msft]);
      if(exp.aioe!=null)out.push(['AIOE (ability-based)',exp.aioe]); if(exp.openai!=null)out.push(['OpenAI (task-based)',exp.openai]); } return out; }
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
    if(this._oKey===S.bundle){ return this._oCache; }
    const db=S.db, b=S.bundle, ox=db.occs[b.origin.soc_code];
    const gMin=Math.min(...b.transitions.map(t=>t.skill_gap));
    const gMax=Math.max(...b.transitions.map(t=>t.skill_gap));
    const gSpan=Math.max(0.0001,gMax-gMin);
    const moves=b.transitions.map(t=>{ const tgt=db.occs[t.to_soc]||{}; const z=tgt.job_zone||3;
      return {id:t.to_soc,title:t.to_title,eff:(t.skill_gap-gMin)/gSpan,pay:t.wage_delta,g:t.pareto?1:0,
        rng:this.rng(tgt.exposure),agree:!!(tgt.exposure&&tgt.exposure.agreement),
        months:this.zoneMonths(z),time:this.zonePrep(z),license:'Not tracked in v1 — check your state’s requirements',
        employment:tgt.employment||0,zone:z}; });
    const o={soc:b.origin.soc_code,title:ox.display_title,wage:ox.wage_median,zone:Math.round(ox.job_zone||0),
      n:b.transitions.length,rng:this.rng(ox.exposure),srcs:this.srcPcts(ox.exposure),moves,
      routes:(b.paths||[]).map(r=>({hops:r.hops.map(hp=>hp.title),gain:r.cumulative_wage_delta,time:(r.hops.length-1)+(r.hops.length===2?' step':' steps')}))};
    this._oKey=b; this._oCache=o; return o; }
  renderVals(){
    const h=React.createElement, S=this.state, accent=this.props.accent??'#ff7a59';
    const db=S.db, cfgMeta=db?(db.cfg.meta||{}):{};
    const o=this.buildOrigin();
    const frontier=o?o.moves.filter(m=>m.g):[];
    const posFrontier=frontier.filter(m=>m.pay>0);
    const hasMoves=posFrontier.length>0; const noMoves=!!o&&!hasMoves;
    const origMid=o&&o.rng?(o.rng[0]+o.rng[1])/2:70;
    // --- scoring with user priorities (frontier unchanged, recommendation moves) ---
    const maxPay=Math.max(1,...posFrontier.map(m=>m.pay));
    const mid=m=>(m.rng[0]+m.rng[1])/2;
    const score=m=>S.w.pay*(m.pay/maxPay)+S.w.speed*(1-m.eff)+S.w.safe*Math.max(0,Math.min(1,(origMid-mid(m))/40+0.5));
    const ranked=[...posFrontier].sort((a,b)=>score(b)-score(a));
    const best=ranked[0]||{}, close=posFrontier.filter(m=>m.id!==best.id).sort((a,b)=>a.eff-b.eff)[0]||{};
    const aiDown=m=>mid(m)<origMid;
    const inCmp=m=>S.compare.includes(m.id);
    const toggleCmp=m=>()=>this.setState(s=>({compare:inCmp(m)?s.compare.filter(x=>x!==m.id):s.compare.length>=3?s.compare:[...s.compare,m.id]}));
    const toggleSave=m=>()=>this.setState(s=>({saved:s.saved.includes(m.id)?s.saved.filter(x=>x!==m.id):[...s.saved,m.id]}));
    // Field size from REAL national employment (BLS OEWS) - replaces the
    // prototype's invented mobility-flow popularity (see docs/07_UI_GAP_ANALYSIS.md #11)
    const popTag=m=>m.employment>=200000?'Big field':m.employment>=50000?'Mid-size field':'Smaller field';
    const popText=m=>'≈'+Math.round(m.employment).toLocaleString('en-US')+' people hold this job in the US (BLS OEWS, May 2021)';
    const popStyle=m=>`flex:none;white-space:nowrap;font-size:11px;padding:1px 8px;border-radius:999px;border:1px solid ${m.employment>=200000?accent:'#2b332f'};color:${m.employment>=200000?accent:'#8a948e'}`;
    const bomOf=m=>this.bom(o.soc,m.id);
    const card=m=>m.id?({title:m.title,pay:this.fmt(m.pay),time:m.time,openings:'≈'+Math.round(m.employment).toLocaleString('en-US')+' employed in the US',rangeText:`${m.rng[0]}–${m.rng[1]}th`,rLo:m.rng[0]+'%',rW:Math.max(2,m.rng[1]-m.rng[0])+'%',agreeText:(aiDown(m)?'↓ lower':'↑ higher')+' · '+(m.agree?'sources agree':'sources disagree'),agreeColor:m.agree?'#8a948e':'#e0b34a',popTag:popTag(m),popText:popText(m),popStyle:popStyle(m),open:()=>this.setState({drawer:m.id,copied:false}),compare:toggleCmp(m),compareLabel:inCmp(m)?'✓ Comparing':'+ Compare',save:toggleSave(m),saveLabel:S.saved.includes(m.id)?'★ Saved':'☆ Save'}):{};
    const tab=on=>`background:${on?accent:'transparent'};color:${on?'#0b241a':'#8a948e'};border:none;border-radius:7px;padding:6px 12px;font:inherit;font-size:12px;font-weight:${on?500:400};cursor:pointer`;
    const setMode=m=>()=>{ this.persist('sb.view',m); this.setState({mode:m,tour:-1}); };
    const setW=k=>e=>{ const w={...S.w,[k]:parseFloat(e.target.value)}; this.persist('sb.w',w); this.setState({w}); };
    const wl=v=>v===0?'ignore':v<1?'low':v===1?'normal':v<2?'high':'top';
    // --- search over the real 714-occupation index ---
    const servable=db?Object.values(db.occs).filter(x=>x.servable):[];
    const allTitles=db?(this._titles||(this._titles=servable.map(x=>x.display_title).sort())):[];
    const doSearch=q=>{ const toks=q.trim().toLowerCase().split(/\s+/).filter(Boolean); if(!toks.length) return null;
      let bestHit=null,bestScore=0;
      for(const x of Object.values(db.occs)){ const hay=(x.title+' '+x.display_title).toLowerCase();
        const hits=toks.filter(t=>hay.includes(t)).length; if(!hits) continue;
        const sc=hits*1e12+(x.servable?1e11:0)+(x.employment||0);
        if(sc>bestScore){ bestScore=sc; bestHit=x; } }
      return bestHit; };
    const submit=e=>{ e.preventDefault(); if(!db){ this.setState({err:'Still loading the dataset — one second.'}); return; }
      const hit=doSearch(S.query);
      if(!hit){ this.setState({err:"We couldn't match that job title — try a broader one."}); return; }
      if(!hit.servable){ this.setState({err:`'${hit.display_title}' can't be analyzed: ${hit.excluded_reason}.`}); return; }
      this.loadSoc(hit.soc_code); };
    const demo2=cfgMeta.no_move_example||null;
    // --- hero globe (unchanged) ---
    const density=this.props.density??60, nodes=[];
    for(let i=0;i<density;i++){ const g=this.seed(i+300)<0.2, th=this.seed(i)*360, ph=(this.seed(i+700)-0.5)*140;
      nodes.push(h('div',{key:i,style:{position:'absolute',left:'50%',top:'50%',width:g?9:5,height:g?9:5,margin:g?-4.5:-2.5,borderRadius:'50%',background:g?accent:'#6f7a74',boxShadow:g?`0 0 0 4px ${accent}40`:'none',transform:`rotateY(${th}deg) rotateX(${ph}deg) translateZ(180px)`}})); }
    const heroGlobe=h('div',{style:{position:'absolute',inset:0,transformStyle:'preserve-3d',transform:`rotateX(-12deg) rotateY(${S.ang}deg)`}},
      h('div',{style:{position:'absolute',inset:40,border:`1px solid ${accent}30`,borderRadius:'50%',transform:'rotateX(78deg)'}}),
      h('div',{style:{position:'absolute',inset:90,border:'1px solid #2b332f',borderRadius:'50%',transform:'rotateX(78deg)'}}),
      h('div',{style:{position:'absolute',left:'50%',top:'50%',width:14,height:14,margin:-7,borderRadius:'50%',background:'#e8ece9',boxShadow:'0 0 30px #e8ece980'}}),...nodes);
    // --- 3D frontier + guided tour ---
    // Scene shows the ranked frontier (top 10 labeled) plus a stable sample of
    // other moves; the flat chart and list always show everything.
    const W=460,D=240;
    const labelSet=new Set(ranked.slice(0,10).map(m=>m.id));
    const sceneMoves=o?[...frontier,...o.moves.filter(m=>!m.g).filter((m,i)=>this.seed(i+11)<(60/Math.max(1,o.n-frontier.length)))]:[];
    const all=sceneMoves;
    const pos=i=>({x:(all[i].eff-0.5)*W,z:(this.seed(i+50)-0.5)*D});
    const hMax=Math.max(1,...all.map(m=>Math.abs(m.pay)));
    const tourOn=S.tour>=0&&hasMoves&&S.mode==='3d';
    const tourFocus=[null,close.id,best.id][S.tour]; const focusIdx=all.findIndex(m=>m.id===tourFocus);
    this.tourTarget=tourOn?(S.tour===0?0:(focusIdx>=0?(()=>{ const p=pos(focusIdx); return 90-Math.atan2(p.z,p.x)*180/Math.PI; })():0)):null;
    const rot=tourOn?S.tourAng:(S.hover?S.hoverAng:S.ang*0.4);
    const bars=all.map((p,i)=>{ const {x,z}=pos(i), hgt=Math.max(6,Math.abs(p.pay)/hMax*240), g=!!p.g, bst=p.id===best.id, foc=tourOn&&p.id===tourFocus, dim=tourOn&&!foc&&S.tour>0, lab=g&&labelSet.has(p.id);
      return h('div',{key:p.id||('d'+i),onClick:g?()=>this.setState({drawer:p.id,copied:false}):undefined,style:{position:'absolute',left:'50%',top:'50%',width:g?14:8,height:hgt,marginLeft:g?-7:-4,marginTop:-hgt,background:bst?accent:g?`linear-gradient(180deg,${accent},${accent}80)`:'#3b453f',opacity:dim?.25:g?1:.7,borderRadius:3,transformOrigin:'bottom center',transform:`translate3d(${x}px,${z}px,0) rotateZ(${-rot}deg) rotateX(-90deg)`,boxShadow:foc?`0 0 40px ${accent}`:bst?`0 0 28px ${accent}`:g?`0 0 14px ${accent}55`:'none',cursor:g?'pointer':'default',transition:'opacity .4s,height .5s'}},
        lab?h('div',{style:{position:'absolute',top:-20,left:'50%',transform:'translateX(-50%)',whiteSpace:'nowrap',fontSize:11,color:bst?'#0b241a':'#e8ece9',background:bst?accent:'#181d1bcc',padding:'1px 6px',borderRadius:4,fontWeight:bst?500:400}},(bst?'★ ':'')+p.title):null); });
    const youDim=tourOn&&S.tour>0;
    const frontierScene=h('div',{onMouseEnter:()=>{ if(!tourOn) this.setState({hover:true,hoverAng:rot}); },onMouseLeave:()=>this.setState({hover:false,drag:null}),onMouseDown:e=>{ if(!tourOn) this.setState({hover:true,drag:{x:e.clientX,a:rot}}); },onMouseMove:e=>{ if(S.drag) this.setState({hoverAng:S.drag.a+(e.clientX-S.drag.x)*0.5}); },onMouseUp:()=>this.setState({drag:null}),style:{position:'absolute',inset:0,transformStyle:'preserve-3d',cursor:tourOn?'default':'grab'}},
      h('div',{style:{position:'absolute',left:'54%',top:'56%',width:0,height:0,transformStyle:'preserve-3d',transform:`rotateX(62deg) rotateZ(${rot}deg)`}},
        h('div',{style:{position:'absolute',left:-W/2-40,top:-D/2-40,width:W+80,height:D+80,background:'repeating-linear-gradient(90deg,#232826 0 1px,transparent 1px 40px),repeating-linear-gradient(0deg,#232826 0 1px,transparent 1px 40px)',border:'1px solid #2b332f',borderRadius:6}}),
        h('div',{style:{position:'absolute',left:-W/2-40,top:-D/2-40,width:W+80,height:D+80,background:`radial-gradient(circle at 30% 50%,${accent}14,transparent 60%)`}}),
        h('div',{style:{position:'absolute',left:-W/2-8,top:-8,width:16,height:16,borderRadius:'50%',background:'#e8ece9',boxShadow:'0 0 24px #fff',opacity:youDim?.35:1,animation:this.rm?'none':'sbpulse 1.8s ease-out infinite'}}),
        h('div',{style:{position:'absolute',left:-W/2,top:0,width:0,height:0,transformStyle:'preserve-3d',transform:`rotateZ(${-rot}deg) rotateX(-90deg)`}},h('div',{style:{position:'absolute',left:0,bottom:14,transform:'translateX(-50%)',fontSize:11,color:'#e8ece9',background:'#181d1bcc',padding:'1px 6px',borderRadius:4,opacity:youDim?.35:1,whiteSpace:'nowrap'}},'You today')),...bars));
    const tourSteps=[
      {t:'This is you today',x:`${o?o.title:''} · median $${o&&o.wage?Math.round(o.wage).toLocaleString('en-US'):''}/yr in the US. Every pillar is a realistic move; height is pay change, distance is how much you'd retrain.`},
      {t:`Closest win: ${close.title||''}`,x:`${close.id?this.fmt(close.pay):''}/yr with the least retraining (${close.time||''}). Fast, but check the AI-exposure range on its card.`},
      {t:`Recommended: ${best.title||''}`,x:`${best.id?this.fmt(best.pay):''}/yr, ${best.time||''}, AI exposure ${best.id?best.rng[0]+'–'+best.rng[1]+'th':''}. Adjust the sliders above if your priorities differ.`}];
    const endTour=()=>this.setState(s=>({tour:-1,ang:s.tourAng/0.4}));
    // --- flat chart: ALL moves ---
    const flatAll=o?o.moves:[]; const payAbs=Math.max(1,...flatAll.map(m=>Math.abs(m.pay)));
    const flatChart=h('div',{style:{position:'absolute',inset:'16px 8px 8px 44px',borderLeft:'1px solid #2b332f',borderBottom:'1px solid #2b332f'}},
      h('div',{style:{position:'absolute',left:0,right:0,top:'60%',borderTop:'1px dashed #2b332f'}}),
      h('span',{style:{position:'absolute',left:-40,top:'58%',fontSize:11,color:'#6f7a74'}},'$0'),
      ...flatAll.map((p,i)=>{ const g=!!p.g, bst=p.id===best.id, lab=g&&labelSet.has(p.id); return h('div',{key:p.id||i,onClick:g?()=>this.setState({drawer:p.id,copied:false}):undefined,style:{position:'absolute',left:`${Math.min(98,p.eff*96)}%`,top:`${60-p.pay/payAbs*55}%`,width:g?12:7,height:g?12:7,margin:g?-6:-3.5,borderRadius:'50%',background:g?accent:'#3b453f',boxShadow:bst?`0 0 0 6px ${accent}55`:g?`0 0 0 5px ${accent}33`:'none',cursor:g?'pointer':'default'}},lab?h('span',{style:{position:'absolute',left:16,top:-4,fontSize:11,whiteSpace:'nowrap',color:'#e8ece9'}},(bst?'★ ':'')+p.title):null); }));
    // --- summit (no-better-move state) ---
    const summitScene=h('div',{style:{position:'absolute',inset:0,transformStyle:'preserve-3d',transform:'translateY(60px)'}},h('div',{style:{position:'absolute',inset:0,transformStyle:'preserve-3d',transform:`rotateX(68deg) rotateZ(${S.ang*0.4}deg)`}},
      ...[0,1,2,3,4].map(i=>h('div',{key:i,style:{position:'absolute',left:'50%',top:'50%',width:260-i*52,height:260-i*52,margin:-(130-i*26),borderRadius:'50%',border:`1px solid ${i===4?accent:'#2b332f'}`,background:i===4?`${accent}22`:'transparent',transform:`translateZ(${i*22}px)`}})),
      h('div',{style:{position:'absolute',left:'50%',top:'50%',width:16,height:16,margin:-8,borderRadius:'50%',background:'#e8ece9',boxShadow:'0 0 30px #fff',transform:'translateZ(100px)',animation:this.rm?'none':'sbpulse 1.8s ease-out infinite'}})));
    // --- alternatives (real, from the same precomputed transitions) ---
    const altRows=[];
    if(o){ const feas=o.moves;
      const safer=feas.filter(m=>mid(m)<origMid-5&&m.pay>=-(o.wage||1)*0.05).sort((a,b)=>mid(a)-mid(b))[0];
      if(safer) altRows.push({label:'Lower AI exposure, similar or better pay',title:safer.title,note:`−${Math.round(origMid-mid(safer))} pts AI →`});
      const nearest=feas.filter(m=>m.pay>=0&&(!safer||m.id!==safer.id)).sort((a,b)=>a.eff-b.eff)[0];
      if(nearest) altRows.push({label:'Adjacent role, least retraining',title:nearest.title,note:nearest.time+' →'});
      if(!altRows.length) altRows.push({label:'No lower-exposure alternative clears the bar',title:'Your current role holds up well in this data',note:''}); }
    // --- drawer ---
    const sc=0.7, layer=(z,col,label,n)=>h('div',{style:{position:'absolute',left:'50%',top:'50%',width:300*sc,height:100*sc,marginLeft:-150*sc,marginTop:-50*sc,transform:`rotateX(58deg) rotateZ(-30deg) translateZ(${z*sc}px)`,background:'#181d1b',border:`1px solid ${col}`,borderRadius:8,boxShadow:`0 0 24px ${col}33`}},h('span',{style:{position:'absolute',left:10,top:8,fontSize:12,color:col,fontWeight:500,whiteSpace:'nowrap'}},label),h('span',{style:{position:'absolute',right:10,bottom:8,fontSize:22,color:'#e8ece9',fontWeight:500}},n));
    const dm=frontier.find(m=>m.id===S.drawer)||(o?o.moves.find(m=>m.id===S.drawer):null);
    const dt=dm?bomOf(dm):null;
    const skillStack=dm&&dt?h('div',{style:{position:'absolute',inset:0,transformStyle:'preserve-3d',animation:this.rm?'none':'sbfloat 6s ease-in-out infinite'}},layer(0,'#4a5a52','You already have',String(dt.have.length)),layer(50,'#e0b34a','Needs upgrading',String(dt.upgrade.length)),layer(100,'#e05a4a','Must learn',String(dt.acquire.length))):null;
    let drawer={};
    if(dm&&dt){
      const plan=S.plans[dm.id]||{}; const now=new Date();
      const ym=(mo)=>{ const d=new Date(now.getFullYear(),now.getMonth()+Math.round(mo),1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); };
      const wgMax=Math.max(0.0001,...dt.acquire.map(a=>a.wg));
      const acquire=dt.acquire.map(a=>({skill:a.skill,levels:a.o+' → '+a.t,how:`Search courses: “${a.skill}”`,w:Math.round(a.wg/wgMax*100)+'%'}));
      const haveNames=dt.have.map(x=>x.skill), upgradeNames=dt.upgrade.map(x=>x.skill);
      const items=[...dt.acquire.map((a,i)=>({k:'a'+i,title:'Learn '+a.skill+' (search courses to find one that fits)',mo:dm.months*(i+1)/(dt.acquire.length+1)})),
        ...(upgradeNames.length?[{k:'up',title:'Upgrade '+upgradeNames.slice(0,2).join(' & ')+(upgradeNames.length>2?' +'+(upgradeNames.length-2):'')+' on the job',mo:dm.months*0.8}]:[]),
        {k:'lic',title:'Check your state’s license/certification rules for '+dm.title,mo:dm.months*0.9},
        {k:'apply',title:'Apply for '+dm.title+' roles',mo:dm.months}];
      const savePlan=p=>{ const plans={...S.plans,[dm.id]:p}; this.persist('sb.plans',plans); this.setState({plans}); };
      const milestones=items.map(it=>{ const st=plan[it.k]||{}; const done=!!st.done; return {title:it.title,done,date:st.date||ym(it.mo),style:`${done?'color:#6f7a74;text-decoration:line-through':''}`,toggle:()=>savePlan({...plan,[it.k]:{...st,done:!done}}),setDate:e=>savePlan({...plan,[it.k]:{...st,date:e.target.value}})}; });
      const doneN=milestones.filter(m=>m.done).length;
      const mailBody=`My SkillBridge escape plan%0A${o.title} → ${dm.title}%0APay: ${this.fmt(dm.pay)}/yr · ${dm.time}%0ASkills to learn: ${dt.acquire.map(a=>a.skill).join(', ')||'none'}%0A${location.href}`;
      drawer={pair:`${o.title} → ${dm.title}`,pay:this.fmt(dm.pay),aiShort:(aiDown(dm)?'AI ↓':'AI ↑')+' · '+(dm.agree?'sources agree':'sources disagree'),time:dm.time,skills:`${dt.acquire.length+dt.upgrade.length} of ${dt.acquire.length+dt.upgrade.length+dt.have.length}`,license:dm.license,acquireCount:dt.acquire.length+' skills',acquire,upgradeCount:dt.upgrade.length+' skills',upgrade:upgradeNames,have:haveNames.length?'Already at target level: '+haveNames.join(', ')+'.':'No skills at target level yet — the checklist below is the whole path.',milestones,planDone:`${doneN} of ${milestones.length} done`,mailto:`mailto:?subject=${encodeURIComponent('My career escape plan: '+dm.title)}&body=${mailBody}`,copySkills:()=>{ const txt=haveNames.concat(upgradeNames).join(', '); if(navigator.clipboard) navigator.clipboard.writeText(txt).catch(()=>{}); this.setState({copied:true}); setTimeout(()=>this.setState({copied:false}),1800); },save:toggleSave(dm),saveLabel:S.saved.includes(dm.id)?'★ Saved':'Save plan',compare:toggleCmp(dm)};
    }
    const cmpItems=S.compare.map(id=>o?o.moves.find(m=>m.id===id):null).filter(Boolean).map(m=>({title:m.title,pay:this.fmt(m.pay),time:m.time,ai:aiDown(m)?'AI ↓':'AI ↑'}));
    const hopStyle=(i,n)=>`white-space:nowrap;background:#181d1b;border:1px solid ${i===0?'#2b332f':i===n-1?accent:'#232826'};border-radius:999px;padding:5px 12px;color:${i===0?'#8a948e':'#e8ece9'}`;
    const bomBest=best.id?bomOf(best):null;
    const whyLines=best.id&&bomBest?[
      {k:this.fmt(best.pay),v:`pay gain (national median) — ${Math.round(best.pay/maxPay*100)}% of the largest gain on your frontier`},
      {k:'Effort '+best.eff.toFixed(2),v:`you already hold ${bomBest.have.length} of ${bomBest.have.length+bomBest.upgrade.length+bomBest.acquire.length} key skills at level; ${bomBest.acquire.length} must be learned from scratch`},
      {k:`${best.rng[0]}–${best.rng[1]}th`,v:`AI exposure after the move vs your ${o.rng[0]}–${o.rng[1]}th today — ${best.agree?'all sources agree on the direction':'sources disagree on the direction'}`},
      {k:popTag(best),v:popText(best)},
      {k:'Your weights',v:`pay ${wl(S.w.pay)} · speed ${wl(S.w.speed)} · AI safety ${wl(S.w.safe)} — change the sliders and this recommendation re-ranks`}]:[];
    const spread=o?o.rng[1]-o.rng[0]:0;
    return {
      accent,query:S.query,onType:e=>this.setState({query:e.target.value,err:''}),
      submit,
      demoTeller:()=>{ if(db){ this.setState({query:'Bank Teller'}); this.loadSoc('43-3071'); } },
      demoSurgeon:()=>{ if(db&&demo2) this.loadSoc(demo2.soc); },
      demo2Label:demo2?`Try: ${demo2.title} (no better move)`:'',hasDemo2:!!demo2,
      allTitles,hasErr:!!S.err,err:S.err,
      dataUpdated:(cfgMeta.built_at||'').slice(0,10)||'—',
      hasResults:!!o,hasMoves,noMoves,
      originLine:o?`YOU TODAY · ${o.title.toUpperCase()} · $${Math.round(o.wage).toLocaleString('en-US')}/yr US MEDIAN · EDUCATION ZONE ${o.zone} OF 5`:'',
      verdict:hasMoves?`Your best realistic move is ${best.title} — ${this.fmt(best.pay)}/yr, ${aiDown(best)?'lower':'higher'} AI risk, preparation ${best.time}.`:noMoves?"No single move beats what you have — you're already at the top of your frontier.":'',
      verdictSub:o?(hasMoves?`Based on ${o.n} real moves scored on pay, effort and AI risk, weighted by your priorities`:`Of ${o.n} realistic moves, none improves pay without a large retraining cost. That's a good position, not a dead end`):'',
      whyOpen:S.why,toggleWhy:()=>this.setState(s=>({why:!s.why})),whyLabel:S.why?'Hide the reasoning':'Why this move?',whyLines,
      wPay:S.w.pay,wSpeed:S.w.speed,wSafe:S.w.safe,setWPay:setW('pay'),setWSpeed:setW('speed'),setWSafe:setW('safe'),wPayLabel:wl(S.w.pay),wSpeedLabel:wl(S.w.speed),wSafeLabel:wl(S.w.safe),
      is3d:S.mode==='3d',isFlat:S.mode==='flat',isList:S.mode==='list',set3d:setMode('3d'),setFlat:setMode('flat'),setList:setMode('list'),tab3d:tab(S.mode==='3d'),tabFlat:tab(S.mode==='flat'),tabList:tab(S.mode==='list'),
      mapHint:tourOn?'Guided tour · '+(S.tour+1)+' of 3':this.rm?'Static view (reduced motion)':S.hover?'⏸ orbit paused · drag to rotate':`▶ auto-orbit · top ${Math.min(10,posFrontier.length)} labeled · flat chart shows all ${o?o.n:0}`,
      tourOn,tourNum:String(S.tour+1),tourTitle:tourOn?tourSteps[S.tour].t:'',tourText:tourOn?tourSteps[S.tour].x:'',tourNextLabel:S.tour===2?'Explore the map':'Next',tourNext:()=>{ if(S.tour>=2) endTour(); else this.setState(s=>({tour:s.tour+1})); },tourSkip:endTour,
      moves:ranked.map(m=>({title:m.title,meta:`${m.time} · effort ${m.eff.toFixed(2)} · ${popTag(m)}`,pay:this.fmt(m.pay),ai:`AI ${m.rng[0]}–${m.rng[1]}th`,open:()=>this.setState({drawer:m.id,copied:false})})),
      best:card(best),close:card(close),origMidPct:origMid+'%',origRange:o?`${o.rng[0]}–${o.rng[1]}th`:'',
      origLo:o?o.rng[0]+'%':'0%',origW:o?Math.max(2,o.rng[1]-o.rng[0])+'%':'0%',
      srcRows:o?o.srcs.map(s=>({name:s[0],pct:this.ord(Math.round(s[1]*100))})):[],
      spreadNote:o?(spread>=25?`A ${spread}-point spread means the evidence is mixed — weigh moves that narrow it.`:`A ${spread}-point spread — the three sources broadly agree here.`):'',
      altRows,
      routes:o?o.routes.map(r=>({gain:`${this.fmt(r.gain)}/yr · ${r.time}`,hops:r.hops.map((t,i)=>({title:t,arrowStyle:i<r.hops.length-1?'color:#6f7a74':'display:none',style:hopStyle(i,r.hops.length)}))})):[],
      hasCompare:cmpItems.length>0,compareCount:`${cmpItems.length} of 3 moves`,compareItems:cmpItems,clearCompare:()=>this.setState({compare:[]}),
      drawerOpen:!!(dm&&dt),drawer,closeDrawer:()=>this.setState({drawer:null}),copyLabel:S.copied?'✓ Copied':'Copy skills for my resume',
      heroGlobe,frontierScene,flatChart,summitScene,skillStack
    };
  }
}
