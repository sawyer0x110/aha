
export default async function ({ pptx }) {
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Aha example refresh · original native authoring';
  pptx.subject = 'A source-grounded introduction to two portable skills';
  pptx.lang = 'en-US';
  pptx.theme = { headFontFace:'Segoe UI', bodyFontFace:'Segoe UI', lang:'en-US' };
  const C={ink:'242424',muted:'5C5C5C',paper:'F7F4EF',surface:'FFFFFF',line:'DEDEDE',rose:'B11F4B',soft:'F7E8ED',night:'292929',pale:'DEDEDE',pink:'FD8EA1'};
  const S=pptx.ShapeType;
  function text(slide, value, x,y,w,h,size=22,color=C.ink,bold=false){
    slide.addText(value,{x,y,w,h,fontFace:'Segoe UI',fontSize:size,color,bold,margin:0,breakLine:false,valign:'mid',paraSpaceAfterPt:8});
  }
  function box(slide,x,y,w,h,label,sub,accent=false){
    slide.addShape(S.rect,{x,y,w,h,fill:{color:accent?C.soft:C.surface},line:{color:accent?C.rose:C.line,width:1.2}});
    text(slide,label,x+.22,y+.18,w-.44,.46,24,accent?C.rose:C.ink,true);
    if(sub)text(slide,sub,x+.22,y+.78,w-.44,h-.94,20);
  }
  function line(slide,x1,y1,x2,y2,accent=false){
    slide.addShape(S.line,{x:x1,y:Math.min(y1,y2),w:x2-x1,h:Math.abs(y2-y1),flipV:y2<y1,line:{color:accent?C.rose:C.muted,width:2.4,beginArrowType:'none',endArrowType:'triangle'}});
  }
  function slide(title, number, source, dark=false){
    const s=pptx.addSlide();s.background={color:dark?C.night:C.paper};
    text(s,`AHA / ${String(number).padStart(2,'0')}`,.6,.28,5,.3,12,dark?C.pink:C.rose,true);
    text(s,title,.6,.85,12.1,1.05,36,dark?C.pale:C.ink,true);
    text(s,source,.6,6.84,11.8,.32,10,dark?C.pale:C.muted);
    text(s,String(number),12.2,6.84,.5,.32,11,dark?C.pale:C.muted);
    return s;
  }
  function note(s,copy){s.addNotes(copy+'\nSource basis: read-only Aha commit 31ff1331. No repository tests or new Git/ANC experiment were run.');}
  let s=slide('Aha turns supported answers into explanations',1,'Aha 31ff1331 · two portable skills · fresh source investigation',true);
  text(s,'Find the answer.\nThen design how it becomes understandable.',.7,2.35,8.5,1.9,32,C.pale);
  s.addShape(S.rect,{x:10.25,y:2.45,w:2.1,h:2.1,fill:{color:C.night},line:{color:C.pink,width:3}});
  text(s,'?',10.7,2.66,1.2,1.1,64,C.pink,true);
  text(s,'Evidence → authored source → actual review',.7,5.4,11.5,.5,24,C.pink);
  note(s,'Aha is not a universal report-to-slide template. Research and explanation are distinct acts of authorship. This deck is source-only until approved rendering and application QA.');

  s=slide('Two skills share one research snapshot',2,'Sources: skills/aha-research; skills/aha-explain; src/research/dossier.ts');
  box(s,.6,2.25,3.6,2.5,'aha-research','Question → report\nClaims + evidence + gaps',true);
  box(s,4.88,2.25,3.6,2.5,'Research Dossier','Immutable content identity\nKeep uncertainty visible');
  box(s,9.14,2.25,3.6,2.5,'aha-explain','Initialize → author\nCheck → approve → inspect',true);
  line(s,4.22,3.4,4.83,3.4);line(s,8.49,3.4,9.08,3.4);
  text(s,'New evidence creates a new snapshot; it does not silently update old works.',.8,5.4,11.7,.7,25);
  note(s,'The host follows the chosen workflow. There is no promised automatic dispatch between the two skills. Dossier identity preserves a particular report and ledger; it does not prove the argument is true.');

  s=slide('Share evidence, not the same composition',3,'Sources: artifact-authoring.md; HTML / image / PPTX / video guides');
  const formats=[
    ['HTML','Explore a condition\nInspect a record'],
    ['PNG','One self-contained path\nChoose size for display'],
    ['PPTX','Native text and charts\nBuild a spoken sequence'],
    ['Video','Change condition over time\nShow the consequence']
  ];
  formats.forEach(([label,sub],i)=>box(s,.7+(i%2)*6.1,2.12+Math.floor(i/2)*1.86,5.75,1.7,label,sub,i===1));
  text(s,'1080 × 1800 here is a scrollable brief—not Aha’s design default.',.8,6.04,11.8,.42,20,C.muted);
  note(s,'The image sizing order is explicit dimensions, destination, reading context, then structure. At a fixed display width, more source pixels do not make labels larger. The deck uses native objects rather than screenshots.');

  function anc(number,delta,title){
    const s=slide(title,number,'Source: examples/anc/projects/html/html/index.html · ideal tone model');
    const labels=Array.from({length:33},(_,i)=>i%8===0?`${i/32}`:'');
    const f=i=>2*Math.PI*i/32;
    const incoming=labels.map((_,i)=>Math.sin(f(i)));
    const speaker=labels.map((_,i)=>-Math.sin(f(i)-delta));
    s.addChart(pptx.ChartType.line,[
      {name:'Incoming',labels,values:incoming},
      {name:'Speaker',labels,values:speaker},
      {name:'Sum',labels,values:incoming.map((n,i)=>n+speaker[i])}
    ],{x:.65,y:2.18,w:7.6,h:3.75,
      chartColors:[C.ink,'919191',C.rose],showLegend:true,legendPos:'b',legendFontSize:13,
      catAxisTitle:'Time across one cycle',showCatName:false,
      valAxisMinVal:-2,valAxisMaxVal:2,valAxisMajorUnit:1,
      valAxisTitle:'Normalized pressure',showValue:false,showMarker:false,lineSize:2.5,
      chartArea:{fill:{color:C.paper},border:{color:C.paper}},
      plotArea:{fill:{color:C.surface}},catAxisLabelFontSize:11,valAxisLabelFontSize:12,
      showTitle:false});
    text(s,`${Math.round(delta*180/Math.PI)}°`,8.9,2.45,3.3,1,64,C.rose,true);
    text(s,'phase mismatch',8.9,3.42,3.5,.55,22);
    text(s,(2*Math.abs(Math.sin(delta/2))).toFixed(2),8.9,4.1,3.5,.9,48,C.rose,true);
    text(s,'residual peak ratio',8.9,5.0,3.5,.6,22);
    text(s,'Equal input amplitudes. A model—not headset data or perceived loudness.',.8,6.17,11.7,.4,19,C.muted);
    return s;
  }
  s=anc(4,0,'ANC / build 1: opposite pressures cancel');
  note(s,'The slider in the existing HTML recomputes incoming, speaker and summed SVG paths. Start at zero phase mismatch: equal and opposite input pressures sum to zero in this ideal single-tone model. Advance to the next slide to change only the phase, keeping axes and amplitude fixed.');
  s=anc(5,Math.PI/2,'ANC / build 2: change phase, reveal a residual');
  note(s,'This native slide-to-slide causal build changes the phase condition to ninety degrees while retaining the same chart geometry. The sum is no longer zero; the model peak ratio is about 1.41. This is a progressive presentation build, not an authored PowerPoint timing animation or a measured device result. Both charts remain native editable charts.');

  function gitSlide(number,conflict){
    const s=slide(conflict?'Git / build 2: two replacements leave a conflict':'Git / build 1: a revert leaves no net change',number,
      'Source: examples/git-merge/projects/html/html/index.html · selected embedded-record lines');
    const items=conflict?[['Base','timeout = 30'],['Ours','timeout = 60'],['Theirs','timeout = 90'],['Working file','diff3 markers:\n60 / 30 / 90']]:
      [['Base','timeout = 30'],['Ours · reverted','timeout = 30'],['Theirs','timeout = 60'],['Result','timeout = 60']];
    items.forEach(([name,value],i)=>box(s,.65+i*3.18,2.15,2.94,1.6,name,value,i===3));
    line(s,2.1,4.38,5.0,4.38);line(s,2.1,4.38,5.0,5.48);
    text(s,'BASE',.75,4.09,1.1,.4,19);
    text(s,'OURS',5.1,4.06,1.8,.45,20);
    text(s,'THEIRS',5.1,5.18,1.8,.45,20);
    if(!conflict){line(s,6.8,4.38,9.9,4.95,true);line(s,6.8,5.48,9.9,4.95,true);
      box(s,9.9,4.4,2.65,1.1,'Merge · HEAD','',true);}
    else text(s,'No merge commit.\nHEAD stays at ours.',8.3,4.27,4.1,1.1,26,C.rose,true);
    text(s,conflict?'Button selects stored conflict state; it does not compute a new merge.':'Ours equals base; the record retains their change. History is not a vote.',.75,6.13,11.8,.42,20);
    return s;
  }
  s=gitSlide(6,false);note(s,'The original interface loads three existing records. Revert case: base and ours contain timeout 30; theirs and the recorded result contain 60. Panels here show only the selected line. This is not a new execution of Git.');
  s=gitSlide(7,true);note(s,'Advance changes the condition: both sides replace the same base line differently. The conflict record keeps HEAD at ours and exposes index stages. The missing merge node is an important consequence, not an animation flourish. Clean text merging would not prove program correctness.');

  s=slide('A structural check cannot judge the explanation',8,'Sources: src/artifacts/project.ts; src/artifacts/render.ts; artifact-qa.md');
  box(s,.7,2.18,5.7,3.55,'Runtime checks','Known claim IDs\nResearch / source identity\nResource paths and output hashes\nDeclared coverage',true);
  box(s,6.9,2.18,5.7,3.55,'Host and reviewer judge','Does evidence support the claim?\nDo objects and arrows explain it?\nIs the language clear?\nCan a reader use the real output?');
  text(s,'PPTX Node authoring has host privileges. “--allow-code” is permission, not a sandbox.',.8,6.03,11.8,.53,19,C.muted);
  note(s,'HTML packaging does not execute authored code. Browser and Node render steps require reviewed local execution approval. A source receipt is not semantic, visual, native editing, or learning evidence.');

  s=slide('Video binds narration to a changing visual source',9,'Sources: src/media/plan.ts; src/media/video.ts · not Remotion');
  box(s,.7,2.3,3.5,2.3,'Approved plan','Text + voice + rate\nResearch + source identity',true);
  box(s,4.9,2.3,3.5,2.3,'Measured speech','Segment duration → frames\nCurrent plan/audio binding');
  box(s,9.1,2.3,3.5,2.3,'Frame callback','State from frame inputs\nBrowser → FFmpeg');
  line(s,4.22,3.45,4.85,3.45);line(s,8.42,3.45,9.05,3.45);
  text(s,'1280 × 720 · 30 fps · H.264/AAC · segment-level captions',.8,5.0,11.8,.65,27,C.rose,true);
  text(s,'External speech consent is separate. A source edit invalidates the old plan/audio binding.',.8,5.9,11.8,.55,21);
  note(s,'Current video implementation captures deterministic callbacks and encodes with FFmpeg. Sampled changes do not establish meaningful motion or reproducible frames. Watch and listen to a representative pilot before the full video. No speech has been requested in this handoff.');

  s=slide('Preserve evidence. Design relationships. Inspect results.',10,'Source: Aha 31ff1331 · structural checks do not establish understanding',true);
  const endings=[['RESEARCH','Is the answer supported?'],['AUTHOR','Does this medium explain it?'],['REVIEW','Does the real output work?']];
  endings.forEach(([a,b],i)=>{text(s,a,.8,2.25+i*1.15,2.7,.5,20,C.pink,true);text(s,b,3.75,2.2+i*1.15,8.2,.7,29,C.pale);});
  text(s,'Two skills support the process. Neither replaces its judgments.',.8,6.03,11.8,.48,23,C.pink);
  note(s,'Evidence is read-only code inspection, not a new web study or measured skill-effectiveness claim. New examples are not declared completed. Native charts and shapes are authored; actual PowerPoint rendering and representative edits remain to be tested.');
}
