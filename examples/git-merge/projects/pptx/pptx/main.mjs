export default async function ({ pptx, research }) {
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Aha / Git explanation';
  pptx.subject = 'Three-way merge, net reversion and ancestry';
  pptx.title = 'Why can a Git merge bring back a reverted change?';
  pptx.lang = 'en-US';
  pptx.theme = { headFontFace:'Segoe UI', bodyFontFace:'Segoe UI', lang:'en-US' };
  const C = { ink:'242424', paper:'F7F4EF', white:'FFFFFF', rose:'B11F4B', soft:'F5E5E9', muted:'5C5C5C', line:'919191' };
  const baseUrl = 'https://github.com/git/git/blob/e9019fcafe0040228b8631c30f97ae1adb61bcdc/';
  function text(slide, value, x,y,w,h,size=24,extra={}) {
    slide.addText(value,{x,y,w,h,fontFace:'Segoe UI',fontSize:size,color:C.ink,margin:0,breakLine:false,...extra});
  }
  function box(slide,x,y,w,h,fill=C.white,line=C.line) {
    slide.addShape(pptx.ShapeType.rect,{x,y,w,h,fill:{color:fill},line:{color:line,width:1}});
  }
  function line(slide,x,y,w,h,color=C.line,arrow=false) {
    slide.addShape(pptx.ShapeType.line,{x,y,w,h,line:{color,width:2,...(arrow?{endArrowType:'triangle'}:{})}});
  }
  function node(slide,label,x,y,color=C.rose) {
    slide.addShape(pptx.ShapeType.ellipse,{x,y,w:.48,h:.48,line:{color,width:2},fill:{color:C.white}});
    text(slide,label,x-.5,y-.7,2.2,.6,19);
  }
  function page(title,number,{dark=false,source='Git 2.55 · merge-strategies / merge-ort.c',path='Documentation/merge-strategies.adoc'}={}) {
    const s=pptx.addSlide(); s.background={color:dark?C.ink:C.paper};
    const multiline=title.includes('\n');
    text(s,title,.65,.55,12,multiline?1.55:1.1,multiline?38:title.length>48?31:34,{bold:true,color:dark?C.white:C.ink});
    text(s,String(number).padStart(2,'0'),12,6.95,.65,.25,12,{color:dark?C.white:C.muted});
    text(s,source,.65,6.95,11,.27,12,{color:dark?C.white:C.muted,hyperlink:{url:baseUrl+path}});
    return s;
  }
  function comparison(slide,base,ours,theirs,result,selected,explanation,assumptionY=6.3) {
    ['BASE','OURS NOW','THEIRS NOW','RESULT'].forEach((label,i)=>text(slide,label,.8+i*3.1,2,2.6,.4,19,{bold:true}));
    [base,ours,theirs,result].forEach((value,i)=>{
      box(slide,.8+i*3.1,2.6,2.5,1.25,i===selected?C.soft:C.white,i===selected?C.rose:C.line);
      text(slide,value,.95+i*3.1,2.9,2.2,.6,36,{bold:true,fontFace:'Consolas',align:'center'});
    });
    text(slide,explanation,.8,4.7,11.5,1.2,27);
    text(slide,'Illustrative ordinary files: matching modes; no renames or custom drivers.',.8,assumptionY,11.5,.25,16,{color:C.muted});
  }
  let s=page('Why can a Git merge bring back\na reverted change?',1,{dark:true});
  text(s,'A revert changes content.\nIt is not a permanent veto.',.8,2.55,8.2,1.7,32,{color:C.white});
  ['BASE','OURS','THEIRS'].forEach((label,i)=>{
    s.addShape(pptx.ShapeType.ellipse,{x:9.7+(i%2)*1.35,y:2.7+Math.floor(i/2)*1.6,w:1.1,h:1.1,fill:{color:C.rose},line:{color:C.rose}});
    text(s,label,9.7+(i%2)*1.35,3.1+Math.floor(i/2)*1.6,1.1,.3,13,{bold:true,color:C.white,align:'center'});
  });
  text(s,'The missing explanation is usually the third state: the merge base.',.8,5.75,11.5,.65,23,{color:C.white});
  s.addNotes('Audience: readers who know commits and branches. This presentation is a static-source, primary-document-based explanation, not a new Git experiment. The central example is an ordinary committed revert after both branches independently changed the same content.');

  s=page('History finds the base; trees decide the content',2,{path:'Documentation/git-merge-base.adoc'});
  line(s,1.3,3.2,9.7,0); line(s,1.3,3.2,3,1.7); line(s,4.3,4.9,6.7,0);
  node(s,'B · off',1.1,2.96); node(s,'A · on',5,2.96); node(s,'R · off',10.8,2.96);
  node(s,'T · on',10.8,4.66);
  text(s,'ours',2.1,2.55,2,.4,20);text(s,'theirs',5.2,5.35,2,.4,20);
  text(s,'Parent → child, left to right. R reverses A on our branch.',.8,1.8,11.7,.6,26);
  text(s,'A best common ancestor is not “whichever file is newest.” Multiple best bases can exist.',.8,6,11.5,.6,23);
  s.addNotes('B is the best common ancestor in this illustrative graph, not the current ours state. The source merge_ort_internal, lines 5303–5450, obtains bases and supplies three trees. Multiple bases are combined by ort. Historical traversal and tree comparison must not be conflated.');

  s=page('Build 1 / Compare each current file with B',3);
  comparison(s,'off','off','on','?',2,'Ours returned to the base: off → on → off.\nTheirs still differs from the base: off → on.');
  line(s,2.1,4.2,3.1,0,C.line);
  text(s,'equal',3.1,4.15,1.2,.4,18,{align:'center'});
  s.addNotes('Native progressive-build sequence starts here. In slide-show mode, advance to slide 4: the on token moves from the theirs column to the result column; matching geometry keeps object identities stable. This is a click-driven change across slides, not a timed in-slide animation. The base-equality rule is implemented in merge-ort.c lines 1375–1389.');

  s=page('Build 2 / The other side supplies the net change',4);
  comparison(s,'off','off','on','on',3,'Because ours equals B, the file-selection rule takes theirs.\nThe revert happened, but its net change here is zero.');
  line(s,8.2,4.1,3.1,0,C.rose,true);
  text(s,'select theirs',8.5,4.12,2.6,.35,18,{color:C.rose});
  s.addNotes('The native result token is now on. The movement is semantic: it indicates selection of the other current file, not replay of the old commit. No Git command was run. Keep the same columns and object geometry when editing slides 3–5.');

  s=page('Build 3 / Change the base—and the answer reverses',5);
  comparison(s,'on','off','on','off',3,'The tips still read off and on. But now theirs equals B.\nOurs carries the net change, so the same rule keeps off.');
  line(s,5.1,4.1,6.2,0,C.rose,true);
  text(s,'select ours',7.2,4.12,2.3,.35,18,{color:C.rose});
  s.addNotes('This is a different hypothetical topology, not a mutation of the preceding Git repository. Highlighting the changed base counters the claim that reverting guarantees reintroduction. The symmetric source branch selects side1 when side2 equals the base.');

  s=page('One returned change does not erase independent work',6);
  s.addTable([
    ['Path','Base','Ours','Theirs','Result'],
    ['feature.txt','off','off','on','on'],
    ['local.txt','old','local update','old','local update'],
    ['remote.txt','old','old','remote update','remote update']
  ],{x:.8,y:2,w:11.7,h:2.65,colW:[2.3,1.5,2.65,2.65,2.6],fontFace:'Segoe UI',fontSize:19,
    border:{pt:1,color:C.line},color:C.ink,fill:C.white,margin:.14,
    rowH:.66,bold:false});
  box(s,.8,5.3,.2,.7,C.rose,C.rose);
  text(s,'Different paths can have different unchanged sides.\nA normal merge is not “pick one whole branch.”',1.25,5.25,10.9,1,27);
  s.addNotes('The native table contains illustrative path states, not measured data. Each row uses the ordinary-file equality rule. Same-file edits to separate regions are a different content-merge problem; do not infer that every independent-looking edit is conflict-free.');

  s=page('A conflict is a different branch of the mechanism',7,{path:'merge-ort.c#L2097-L2295'});
  comparison(s,'off','manual','on','review',3,'Neither current file matches B. A content merge is needed.\nIncompatible edits may conflict; different edits need not.',6.55);
  box(s,.8,5.95,11.6,.5,C.soft,C.soft);
  text(s,'A clean text merge does not certify the program’s behavior.',1,6.03,11.2,.3,20,{bold:true});
  s.addNotes('merge_3way passes base and both current blobs to ll_merge. handle_content_merge turns positive merge status into an unclean result; the caller reports conflicts. The underlying driver and xdiff were not audited here. The word review does not assert a particular actual output for a fabricated experiment.');

  s=page('“Undo” can change content—or change ancestry',8,{path:'Documentation/git-revert.adoc',source:'Git 2.55 · git-revert and git-reset manuals'});
  const rows=[
    ['Ordinary revert','New inverse-change commit; old history stays.','--no-commit delays the commit.'],
    ['Revert a merge','Choose a mainline parent with -m.','Tree change reversed; merge ancestry stays.'],
    ['Commit reset','Move HEAD; mode controls index/worktree.','Path reset only changes the index.']
  ];
  rows.forEach((row,i)=>{
    const y=1.95+i*1.45;
    text(s,String(i+1),.8,y,.7,.65,38,{color:C.rose,bold:true});
    text(s,row[0],1.7,y,3,.7,26,{bold:true});
    text(s,row[1],4.8,y,7.1,.65,24);
    text(s,row[2],4.8,y+.7,7.1,.5,21,{color:C.muted});
  });
  text(s,'Do not repair a merge by blindly resetting or reverting the revert.',.8,6.45,11.5,.35,20,{bold:true});
  s.addNotes('Reverting a merge does not remove the fact that its ancestors were merged; the manual limits what later merges reintroduce. Inspect subsequent history before choosing a repair. reset --hard may overwrite data. This deck supplies distinctions, not executable repair commands. reset source: '+baseUrl+'Documentation/git-reset.adoc');

  s=page('Strategy and conflict preference are not interchangeable',9);
  box(s,.8,2,5.65,2.5,C.white);box(s,6.85,2,5.65,2.5,C.soft);
  text(s,'-s ours',1.05,2.3,5,.7,36,{fontFace:'Consolas',bold:true});
  text(s,'Keep our entire tree.\nIgnore their content.',1.05,3.2,5,1.1,27);
  text(s,'-Xours',7.1,2.3,5,.7,36,{fontFace:'Consolas',bold:true});
  text(s,'Favor our conflicting hunks.\nTheir clean changes still enter.',7.1,3.2,5,1.1,27);
  text(s,'ort is the default for one branch. recursive aliases ort since 2.50.',.8,4.95,11.8,.65,24);
  text(s,'Source pin: Git 2.55.0 · e9019fc · tag date 29 June 2026.\nThe 16 September lookup also saw 2.56.0-rc0, not a stable release.',.8,5.85,11.8,.8,19,{color:C.muted});
  s.addNotes('This is counterevidence against universalizing the main result to every strategy. Neither ours choice is a universal safe fix. Version API: https://api.github.com/repos/git/git/git/tags/5ce91c059e41090e7d2cffad39c04af8acf98dc1 . The tag list read only five entries; no complete maintenance-version survey. Report identity: '+research.id);

  s=page('Find the base.\nCompare three states.',10,{dark:true});
  const actions=['Identify the actual tips and strategy','Distinguish the kind of undo','Review the intended content and test'];
  actions.forEach((value,i)=>{
    s.addShape(pptx.ShapeType.ellipse,{x:.85,y:3+i*.83,w:.42,h:.42,fill:{color:C.rose},line:{color:C.rose}});
    text(s,value,1.6,2.96+i*.83,10.6,.6,27,{color:C.white});
  });
  text(s,'The commit message tells you intent.\nThe base and current trees explain the merge.',.85,5.75,11.8,.9,25,{color:C.white});
  s.addNotes('Limits: primary manual and source reading only, with no new Git experiments. Multiple bases, complex renames, submodules and custom drivers need further case-specific analysis. Final presentation-app rendering and native editing QA are pending separate approval. No screenshot-based slides. Slides 3–5 form an editable click-driven build sequence; timed in-slide PowerPoint animation is not claimed.');
}
