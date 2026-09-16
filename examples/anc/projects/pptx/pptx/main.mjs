export default async function ({ pptx, research }) {
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'ANC explanation';
  pptx.subject = 'Pressure superposition, timing and residual speech';
  pptx.title = 'Why ANC quiets aircraft rumble but leaves voices';
  pptx.lang = 'en-US';
  pptx.theme = { headFontFace:'Segoe UI', bodyFontFace:'Segoe UI', lang:'en-US' };
  const C={ink:'293238',paper:'FAF8F2',mute:'58636B',control:'B45B2A',line:'D2D6D7',white:'FFFFFF'};
  const U={
    rwth:'https://www.iks.rwth-aachen.de/forschung/audio/active-noise-control/',
    paper:'https://arxiv.org/html/2509.15864v1',
    sony:'https://helpguide.sony.net/mdr/wh1000xm5/v1/en/contents/TP1000534745.html',
    apple:'https://support.apple.com/en-us/108918'
  };
  const text=(s,t,x,y,w,h,size=22,color=C.ink,bold=false)=>s.addText(t,{x,y,w,h,fontFace:'Segoe UI',fontSize:size,color,bold,margin:0,breakLine:false,valign:'mid'});
  const box=(s,x,y,w,h,color)=>s.addShape(pptx.ShapeType.rect,{x,y,w,h,line:{color},fill:{color}});
  const line=(s,x,y,w,h,color=C.ink,dash=false)=>s.addShape(pptx.ShapeType.line,{x,y:h<0?y+h:y,w,h:Math.abs(h),flipV:h<0,line:{color,width:2,dashType:dash?'dash':'solid',beginArrowType:'none',endArrowType:'triangle'}});
  function page(title,n,dark=false){
    const s=pptx.addSlide(); s.background={color:dark?C.ink:C.paper};
    text(s,title,.65,.5,12,1.15,36,dark?C.white:C.ink,true);
    text(s,String(n).padStart(2,'0'),12,6.93,.6,.25,12,dark?C.white:C.mute);
    return s;
  }
  function cite(s,label,url,dark=false){
    s.addText(label,{x:.65,y:6.7,w:10.8,h:.35,fontSize:12,fontFace:'Segoe UI',color:dark?C.white:C.mute,margin:0,hyperlink:{url}});
  }
  function notes(s,t){s.addNotes(t);}
  {
    const s=page('Why aircraft rumble fades,\nbut voices remain',1,true);
    text(s,'ANC reduces pressure at your ear.\nIt does not mute a category called “noise”.',.7,2.3,7.3,1.6,29,C.white);
    s.addShape(pptx.ShapeType.ellipse,{x:9.4,y:2.25,w:2.4,h:2.4,fill:{color:C.paper},line:{color:C.paper}});
    text(s,'EAR',9.6,3.02,2,.55,34,C.ink,true);
    line(s,7.8,3.45,1.4,0,C.control);
    text(s,'What remains?',8.2,5.05,4,.65,26,C.white,true);
    cite(s,'Sony WH-1000XM5 guide · useful product observation, not a physical ban on cancelling speech',U.sony,true);
    notes(s,'Direct answer: some speech components can be reduced while enough residual remains audible. This deck is explanatory, not a new product test. Source: '+U.sony);
  }
  {
    const s=page('The ear receives two pressure contributions',2);
    box(s,4.45,2.3,.15,2.7,C.line);
    text(s,'Outside noise',.8,2.3,3,.5,24,C.ink,true);
    line(s,.9,3.1,7.8,0);
    text(s,'Physical barrier',3.5,5.3,3,.5,22);
    text(s,'Reference → controller',.8,4.35,3.4,.6,21);
    line(s,4.2,4.65,1.05,0,C.control,true);
    text(s,'Speaker',5.45,4.3,2,.6,24,C.control,true);
    line(s,7.2,4.4,1.65,-.9,C.control,true);
    s.addShape(pptx.ShapeType.ellipse,{x:8.9,y:2.4,w:2.3,h:2.3,line:{color:C.ink,width:2},fill:{color:C.paper}});
    text(s,'Ear\npressure',9.12,2.99,1.86,1,26,C.ink,true);
    text(s,'Passive: changes transmission.\nActive: adds pressure after a second path.',.8,1.6,11.6,.6,20,C.mute);
    text(s,'Solid = incoming pressure     Dashed = control path',.8,5.95,10,.4,18,C.mute);
    text(s,'Often: passive isolation helps higher bands; active control helps lower bands.',.8,6.32,11.5,.3,17,C.mute);
    cite(s,'RWTH IKS: Principle · Hilgemann et al. §2: internal microphone is only an approximation to the eardrum',U.paper);
    notes(s,'A schematic, not anatomy. Both sound pressures must match at the target after their acoustic paths. ANC-off leaves passive isolation present. '+U.rwth+' '+U.paper);
  }
  function causalSlide(stage){
    const titles=['First: noise alone leaves a residual','Then: opposite pressure reduces the sum','Change the phase: the residual grows'];
    const s=page(titles[stage],stage+3);
    const delta=stage===2?Math.PI/3:0, gain=stage===0?0:1;
    const labels=Array.from({length:41},(_,i)=>i===0?'0':i===20?'½ cycle':i===40?'1 cycle':'');
    const incoming=Array.from({length:41},(_,i)=>Math.sin(i*2*Math.PI/40));
    const control=incoming.map((_,i)=>-gain*Math.sin(i*2*Math.PI/40-delta));
    const residual=incoming.map((v,i)=>v+control[i]);
    s.addChart(pptx.ChartType.line,[
      {name:'Incoming',labels,values:incoming},
      {name:'Control',labels,values:control},
      {name:'Residual',labels,values:residual}
    ],{x:.85,y:1.85,w:8.25,h:3.65,showLegend:true,legendPos:'b',legendFontSize:15,
      chartColors:[C.ink,C.control,'687D55'],showTitle:false,
      catAxisLabelFontSize:13,valAxisLabelFontSize:13,valAxisMinVal:-2,valAxisMaxVal:2,valAxisMajorUnit:1,
      showCatName:false,showValue:false,lineSize:3,showMarker:false,
      catAxisTitle:'Time (one cycle)',
      chartArea:{fill:{color:C.paper},border:{color:C.paper}},
      plotArea:{fill:{color:C.paper}},valGridLine:{color:C.line,width:1}});
    text(s,stage===0?'No control\nResidual = incoming':stage===1?'Equal amplitude\nOpposite phase\nResidual = zero':'Equal amplitude\n60° phase error\nResidual = 1 × incoming',9.45,2.25,3.15,2.4,25,C.ink,true);
    text(s,'Normalized pressure · ideal single tone · identical target position',.85,5.72,11.8,.4,19,C.mute);
    text(s,stage===2?'The same time error takes more phase at a higher frequency.':stage===1?'Matching must hold after both acoustic paths reach the ear.':'Advance to add the control pressure at the same coordinates.',.85,6.15,11.8,.4,20);
    cite(s,'Analytical teaching model, not measured performance · RWTH IKS: phase and path matching',U.rwth);
    notes(s,'Causal build '+(stage+1)+'/3: slides 3–5 preserve chart bounds and geometry for click-through state animation. No page-fade effect and no timed OOXML animation claimed. Native chart data are editable. The 60-degree error is illustrative, not a headphone measurement. From residual sqrt(1+g²−2g cos(delta)); g=1 and delta=60 degrees give residual=1. '+U.rwth);
  }
  causalSlide(0); causalSlide(1); causalSlide(2);
  {
    const s=page('Speech is not immune to cancellation',6);
    box(s,.8,2.02,5.55,3.8,'EBE7DD');
    text(s,'The tempting shortcut',1.1,2.32,4.95,.6,24,C.mute,true);
    text(s,'“Voices remain,\nso voices cannot\nbe cancelled.”',1.1,3.25,4.9,1.8,31);
    text(s,'The counterexample',7,2.35,5.3,.6,24,C.control,true);
    text(s,'Active control can reduce\nlow-frequency own-voice\nocclusion in a closed ear canal.',7,3.2,5.2,1.6,27,C.ink,true);
    text(s,'This is not a promise to erase\nanother person’s whole voice.',7,5.05,5.2,.75,20,C.mute);
    cite(s,'RWTH IKS: Applications — Occlusion Effect Reduction',U.rwth);
    notes(s,'Speech has components affected differently by the combined response. Some can be reduced while others remain audible. Own-voice occlusion is a counterexample to inherent impossibility, not external speech cancellation evidence. No intelligibility experiment. '+U.rwth);
  }
  {
    const s=page('Before blaming the voice, check the conditions',7);
    const rows=[
      ['01','Mode','Transparency lets outside sound in.\nAdaptive modes can change the balance.'],
      ['02','Fit','Seal and ear position change the paths\nthe controller must handle.'],
      ['03','Baseline','Compare ANC on/off without moving the fit.\nRemoving the headset changes two things.']
    ];
    rows.forEach((r,i)=>{const y=1.95+i*1.4;
      text(s,r[0],.9,y,.9,.6,34,C.control,true);
      text(s,r[1],2.05,y,2.2,.6,26,C.ink,true);
      text(s,r[2],4.35,y,7.65,.95,23);
    });
    cite(s,'Apple listening modes · Sony WH-1000XM5 guide · model-specific behavior, not identical settings on every device',U.apple);
    notes(s,'The comparison procedure is a reasoned suggestion, not a newly performed experiment. Apple: '+U.apple+' Sony: '+U.sony);
  }
  {
    const s=page('A clean diagram is not a measured ear',8);
    text(s,'IDEAL MODEL',.9,1.9,4.9,.55,24,C.control,true);
    text(s,'One sinusoid\nOne target position\nLinear pressure addition',.9,2.8,4.7,2,28);
    line(s,5.7,3.65,1.45,0,C.mute);
    text(s,'REAL SYSTEM',7.55,1.9,4.9,.55,24,C.control,true);
    text(s,'Fit-dependent paths\nFinite control bandwidth\nStability and sensor limits',7.55,2.8,4.95,2,28);
    text(s,'Published prototype results vary with wearer and fit.\nThey do not predict decibels or speech understanding on your flight.',.9,5.3,11.6,.9,24,C.ink,true);
    cite(s,'Hilgemann, Chatzimoustafa & Jax · arXiv 2509.15864v1 · selected §§2 and 6.3, not a new test',U.paper);
    notes(s,'Selected-section reading only; original authors historical feedback-controller prototype measurements. No full methods audit, dataset download, stock-product benchmark or new test. The manuscript identifies JAES 2024 publication; v1 posted 2025. '+U.paper);
  }
  {
    const s=page('Ask what remains at the ear',9,true);
    text(s,'Rumble can fall more than speech.\nAudible speech can still be attenuated.',.85,2.05,11.6,1.45,32,C.white,true);
    const tags=['PATH','TIMING','FIT','MODE'];
    tags.forEach((t,i)=>{box(s,.9+i*3.12,4.3,2.7,.9,C.paper);text(s,t,1.03+i*3.12,4.48,2.44,.5,24,C.ink,true);});
    text(s,'No speech-immunity rule. No universal frequency wall.',.9,5.65,11.5,.7,27,C.white);
    cite(s,'Sources: RWTH IKS · Sony Help Guide · Apple Support · Hilgemann et al. (links in slide notes)',U.rwth,true);
    notes(s,'All source URLs: '+Object.values(U).join(' ')+' Research identity: '+research.id+'. Source-authoring only; actual presentation rendering and representative native edits have not been observed.');
  }
}
