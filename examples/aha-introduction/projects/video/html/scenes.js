(() => {
  "use strict";
  const { geoArea, geoRotation, geoMercator, geoOrthographic, geoPath, geoGraticule10, geoCentroid } = Geo;
  const $ = id => document.getElementById(id);
  // prepareHtml packages these static image declarations before any script executes.
  const previewUrls = Object.fromEntries(["git-html","git-infographic","git-slide-03","git-video-03"]
    .map(name => [`${name}.png`,$(`preview-${name}`).getAttribute("src")]));
  const escape = value => String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[c]);
  const text = (x, y, value, cls = "label") => `<text x="${x}" y="${y}" class="${cls}">${escape(value)}</text>`;
  const rect = (x, y, w, h, cls = "box") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="${cls}"/>`;
  const line = (x, y, x2, y2, cls = "line") => `<path d="M${x},${y}L${x2},${y2}" class="${cls}"/>`;
  const path = (g, projection, cls) => `<path d="${geoPath(projection)(g) || ""}" class="${cls}"/>`;
  const clamp = value => Math.min(1, Math.max(0, value));
  const ease = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
  const ids = ["research-skill","explanation-skill","mercator-question","spherical-rotation",
    "new-string","utf8-contrast","layer-created","later-whiteout","same-run",
    "saved-html-image","saved-slides-video","evidence-visible"];
  const titles = [
    "Aha: researched visual explanations",
    "From supported finding to visible mechanism",
    "Why does Greenland look so large?",
    "Move the land. Keep its spherical area.",
    "One added face. A NEW string representation.",
    "UTF-8 bytes are a different representation",
    "Docker layers: a file's bytes enter the image",
    "Hidden in the view. Retained in the layer.",
    "Change the boundary: create + delete in ONE RUN",
    "Actual formats: the existing Git explanation",
    "The same Git topic, authored for other media",
    "Evidence supports it. The mechanism explains it."
  ];
  const notes = [
    "Two portable skills, coordinated by your AI host.",
    "Research the question, then design an explanation for the chosen medium.",
    "Spherical Mercator · polar crop · generalized boundary, not an exact survey.",
    "Counterfactual relocation on a sphere, not actual continental motion or 2D scaling.",
    "CPython 3.11.15 · U+1F600 only · schematic slots; original str is unchanged.",
    "Measured on CPython 3.11.15 · object size ≠ encoded payload ≠ process memory.",
    "100 MB = illustrative uncompressed payload; no Docker build was run.",
    "Whiteout shown in layer cutaway only; not an ordinary file in the merged view.",
    "NEW temporary path only. Other metadata may remain; earlier base-file bytes are not reclaimed.",
    "Existing Git artifacts only. Greenland, CPython and Docker remain video-only.",
    "Saved previews of existing Git artifacts; not live controls or playback.",
    "Research supported by sources → visible mechanism → an explanation you can follow."
  ];
  const sources = [
    "Source: installed aha-research and aha-explain skill definitions.",
    "Sources: Aha research and explanation authoring guides.",
    "Sources: PROJ Mercator · Natural Earth 5.1.2.",
    "Sources: D3 spherical rotation · PROJ Mercator · Natural Earth 5.1.2.",
    "Sources: PEP 393 · CPython 3.11.15 (2340a037).",
    "Sources: Python Unicode HOWTO · CPython 3.11.15 measurements.",
    "Sources: Docker image-layer guide · Moby 27.5.1 (4c9b3b01).",
    "Sources: OCI layer specification (af26a05f) · Moby archive implementation.",
    "Sources: OCI filesystem changesets · Docker cleanup guidance.",
    "Provenance: existing Git HTML screenshot + delivered PNG · 2026-09-16.",
    "Provenance: existing Git slide 03 render + encoded video frame 853 · 2026-09-16.",
    "Sources: Aha skill guides · Greenland, CPython and Docker research."
  ];
  function normalizeGeometry(geometry) {
    if (!["Polygon","MultiPolygon"].includes(geometry.type)) throw new Error("Unsupported geometry.");
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    const normalized = polygons.map(rings => {
      const copy = rings.map(ring => ring.map(point => point.slice()));
      if (geoArea({ type:"Polygon", coordinates:copy }) > 2 * Math.PI) copy.forEach(ring => ring.reverse());
      return copy;
    });
    return { type:geometry.type, coordinates:geometry.type === "Polygon" ? normalized[0] : normalized };
  }
  const countries = MAP_DATA.features.map(feature => ({ ...feature, geometry:normalizeGeometry(feature.geometry) }));
  const greenland = countries.find(feature => feature.properties.name === "Greenland");
  if (!greenland) throw new Error("Greenland boundary missing.");
  const world = { type:"FeatureCollection", features:countries.filter(feature => feature !== greenland) };
  const africa = { type:"FeatureCollection", features:countries.filter(feature => feature.properties.continent === "Africa") };
  const centroid = geoCentroid(greenland), area = geoArea(greenland);
  if (!(area > 0 && area < .1)) throw new Error("Invalid boundary winding.");
  const grid = geoGraticule10();
  const equator = { type:"LineString", coordinates:Array.from({length:181}, (_, i) => [-180 + i * 2, 0]) };
  const mercator = geoMercator().scale(90).translate([450,270]).precision(.15).clipExtent([[64,4],[818,358]]);
  const globe = geoOrthographic().scale(96).translate([1020,138]).rotate([-centroid[0],-30]).precision(.15);
  function movedGeometry(progress) {
    // Adapted unchanged mathematical operation: a single conjugated spherical rotation.
    const rotate = geoRotation([0,-centroid[1] * progress,0]);
    const point = p => {
      const q = rotate([p[0] - centroid[0],p[1]]);
      return [((q[0] + centroid[0] + 540) % 360) - 180,q[1]];
    };
    const g = greenland.geometry;
    return { type:g.type, coordinates:g.type === "Polygon" ? g.coordinates.map(ring => ring.map(point))
      : g.coordinates.map(poly => poly.map(ring => ring.map(point))) };
  }
  function mapScene(progress, state) {
    const moved = movedGeometry(progress), movedArea = geoArea(moved), center = mercator(geoCentroid(moved));
    const relativeError = Math.abs(movedArea / area - 1);
    if (relativeError > 1e-10) throw new Error("Spherical area invariant failed.");
    state.greenland = {
      rotationProgress:progress, originalAreaSteradians:area, movedAreaSteradians:movedArea,
      relativeAreaError:relativeError, movedCentroid:geoCentroid(moved),
      projectedArea:geoPath(mercator).area(moved), originalProjectedArea:geoPath(mercator).area(greenland),
      mercatorScale:mercator.scale(), mercatorTranslate:mercator.translate(),
      clipExtent:mercator.clipExtent(), geometryOperation:"rigid-spherical-rotation", planarScaling:false
    };
    const labelY = Math.max(77,Math.min(310,center[1] - 12));
    return `<defs><clipPath id="map-clip"><rect x="64" y="4" width="754" height="354"/></clipPath></defs>` +
      rect(64,4,754,354,"ocean") + `<g clip-path="url(#map-clip)">` +
      path(world,mercator,"land") + path(africa,mercator,"africa") + path(grid,mercator,"grid") +
      path(equator,mercator,"equator") + (progress > 0 ? path(greenland,mercator,"ghost") : "") +
      path(moved,mercator,"greenland") + text(96,labelY,"Greenland") +
      line(218,labelY-7,center[0]-12,center[1],"accent-line") + text(530,258,"Africa") +
      text(78,296,"Equator","tiny") + `</g>` + text(82,32,"FIXED SPHERICAL MERCATOR","tiny") +
      text(82,342,"Polar regions cropped","tiny") + text(880,22,"ON THE SPHERE","small") +
      path({type:"Sphere"},globe,"ocean") + path(world,globe,"land") + path(grid,globe,"grid") +
      path(moved,globe,"greenland") + text(865,278,"Same spherical area","label") +
      text(865,321,progress < .5 ? "High latitude: enlarged" : "Lower latitude: less enlarged","small");
  }
  function slots(x, y, count, width, label, subdivisions = 1) {
    let s = "";
    for (let i = 0; i < count; i++) {
      s += rect(x+i*(width+8),y,width,48,"slot") +
        text(x+i*(width+8)+width/2,y+31,Array.isArray(label) ? label[i] : label,"code center");
      for (let j=1; j<subdivisions; j++) s += line(x+i*(width+8)+j*width/subdivisions,y+39,
        x+i*(width+8)+j*width/subdivisions,y+47,"accent-line");
    }
    return s;
  }
  function researchScene(p, state) {
    state.skills = { research:"sources-evidence-limitations", explain:"requested-medium", hostCoordinates:true,
      automaticDispatch:false, exampleShown:false, emphasisProgress:ease(p) };
    return text(64,76,"Understand the question.","big") +
      text(64,144,"Make the mechanism clear.","big") +
      line(64,170,64+1152*ease(p),170,"emphasis") +
      text(64,242,"aha-research","strong accent") +
      text(64,285,"Sources · evidence · conditions","label") +
      text(700,242,"aha-explain","strong accent") +
      text(700,285,"Visual explanations for your audience","label") +
      line(527,254,640,254,"accent-line");
  }
  function explanationScene(p, state) {
    state.skills = { research:"sources-evidence-limitations", explain:"requested-medium", hostCoordinates:true,
      automaticDispatch:false, exampleShown:false, evidenceToExplanationProgress:ease(p) };
    return text(64,47,"Research the question","strong") +
      text(735,47,"Design the explanation","strong") +
      text(64,122,"A supported finding","label") +
      text(64,176,"The conditions behind it","label") +
      text(64,230,"What the evidence leaves open","label") +
      line(525,162,682,162,"accent-line") +
      rect(525+137*ease(p),151,20,22,"solid") +
      text(735,122,"HTML for exploration","label") +
      text(735,176,"Images and slides for reading","label") +
      text(735,230,"Video for changing mechanisms","label") +
      text(64,331,"One question. An explanation composed for its use.","strong");
  }
  function stringScene(p, utf8, state) {
    const grow = utf8 ? 1 : ease((p-.18)/.5), width = 30+90*grow;
    state.cpython = {
      implementation:"CPython", version:"3.11.15", commit:"2340a037f7450e70fccfe411e6531afb4d57a312",
      originalCodePoints:100000, originalSlotBytes:1, originalObjectBytes:100049, originalUnchanged:true,
      addedCodePoint:"U+1F600", newCodePoints:100001, newSlotBytes:4, newObjectBytes:400080,
      transitionProgress:grow, drawnSlotWidth:width, intermediateWidthsAreIllustration:true,
      utf8Before:100000, utf8After:100004, utf8Delta:4, utf8PrefixSlotBytes:1,
      observations:"inherited-local-observation-not-reproduced", schematicCells:true, unicodeThreshold:"U+FFFF"
    };
    if (!utf8) return text(64,28,"ORIGINAL · 'a' × 100,000","small") + slots(64,45,6,30,"a") +
      text(340,78,"…  unchanged","label") + text(824,78,"100,049 bytes","strong") +
      text(64,136,"NEW RESULT · same prefix + U+1F600","small") +
      slots(64,157,6,width,"a",4) + text(64+6*(width+8),190,"… + 😀","label") +
      text(64,254,"Each resulting code point uses 4 bytes.","label") +
      text(824,254,"400,080 bytes","strong accent") +
      text(64,315,"U+1F600 > U+FFFF  ·  not every emoji / Python implementation","small") +
      text(824,304,"str object size","small") +
      text(824,334,"including overhead","small");
    const add = p >= .25;
    state.cpython.utf8AddedVisible = add;
    return text(64,30,"str OBJECT MEMORY","small") +
      rect(64,48,728,65,"selected") + text(88,90,"Four-byte slots throughout the NEW result","label") +
      text(834,90,"400,080 bytes","strong") +
      text(64,156,"UTF-8 ENCODED PAYLOAD","small") +
      slots(64,177,8,30,"a") + text(380,209,"…","label") +
      (add ? slots(478,177,4,55,["F0","9F","98","80"],1) : rect(478,177,244,48,"removed")) +
      text(478,258,add ? "U+1F600 → F0 9F 98 80" : "Add one code point","code") +
      text(834,207,add ? "100,004 bytes" : "100,000 bytes","strong accent") +
      text(64,315,"ASCII stays one byte each.","label") +
      text(834,307,add ? "Δ only 4 bytes" : "Original payload","label");
  }
  function dockerScene(p, mode, state) {
    const adding = mode === "create", deleting = mode === "delete", same = mode === "same";
    const stage = adding ? (p < .25 ? "writing" : "recorded") :
      deleting ? (p < .35 ? "before-delete" : "hidden") : (p < .25 ? "before" : p < .65 ? "temporary" : "after");
    const hidden = deleting && stage === "hidden";
    const payloadRecorded = !same && (!adding || stage === "recorded");
    state.docker = {
      mode, phase:stage, path:"/tmp/demo.bin", newTemporaryPath:true, payloadBytes:100000000,
      quantity:"illustrative-uncompressed-payload", dockerBuilt:false, ordinaryUnsquashedImage:true,
      priorLayerPayloadBytes:payloadRecorded ? 100000000 : 0,
      priorLayerImmutable:true, whiteoutInNewLayer:hidden, whiteoutVisibleInMergedView:false,
      mergedPathPresent:same ? stage === "temporary" : !hidden,
      resultingDiffPayloadBytes:same && stage === "after" ? 0 : null,
      sameRunEndpointBeforePresent:false, sameRunEndpointAfterPresent:false,
      noClaimOfEmptyWholeLayer:true, baseFileReclamation:false
    };
    if (same) {
      const positions = [150,620,1100], phases = ["BEFORE RUN","DURING RUN","AFTER RUN"];
      let s = text(64,29,"ONE RUN · create NEW /tmp/demo.bin && delete /tmp/demo.bin","code") +
        line(251,150,497,150,"line") + line(743,150,1005,150,"line");
      positions.forEach((x,i) => { s += text(x,76,phases[i],"small center"); });
      s += rect(66,96,185,108,"removed") + text(159,159,"Path absent","small center") +
        rect(497,96,246,108,stage === "temporary" ? "selected" : "box") +
        text(620,142,"100 MB temp file","label center") + text(620,177,"created, then deleted","small center") +
        rect(1005,96,185,108,"removed") + text(1098,159,"Path absent","small center");
      const x = stage === "before" ? positions[0] : stage === "temporary" ? positions[1] : positions[2];
      s += line(x-75,222,x+75,222,"emphasis") +
        text(64,275,"Diff compares the endpoints, not the temporary contents.","label") +
        text(64,330,stage === "after" ? "Result: no payload for this path in the resulting diff." : "Both endpoints lack this NEW file.","strong");
      return s;
    }
    let s = text(64,29,adding ? "RUN 1 · create /tmp/demo.bin" : "RUN 2 · delete /tmp/demo.bin","code") +
      text(64,75,"IMAGE LAYERS · CUTAWAY","small") + text(829,75,"MERGED FILESYSTEM VIEW","small") +
      rect(64,105,638,94,hidden ? "selected" : "removed") +
      text(87,143,hidden ? "Later layer: .wh.demo.bin" : "Later layer","code") +
      text(87,177,hidden ? "Deletion marker, not payload erasure" : "No deletion marker yet","small") +
      rect(64,216,638,97,"box") + text(87,246,"Earlier immutable layer","small") +
      rect(87,263,Math.max(1,580*(adding ? ease(p/.35) : 1)),30,"solid") +
      text(829,124,hidden ? "/tmp/demo.bin absent" : "/tmp/demo.bin","code") +
      rect(829,154,364,133,hidden ? "removed" : "selected") +
      text(1011,214,hidden ? "Path hidden" : "100 MB file","strong center") +
      text(64,348,payloadRecorded ? "100 MB payload retained in earlier layer" : "Recording the assumed 100 MB payload…","label");
    if (hidden) s += line(721,151,797,151,"accent-line") + text(754,191,"hides","tiny center");
    return s;
  }
  function savedFormats(p, slides, state) {
    const assets = slides ? ["git-slide-03.png","git-video-03.png"] : ["git-html.png","git-infographic.png"];
    state.formats = {
      example:"existing-git-merge", existingFormats:["html","png","native-pptx","narrated-video"],
      previews:assets, displayedAs:"saved-raster-previews", liveInteraction:false, livePlayback:false,
      editingDemonstrated:false, mainThreeExamplesFormats:["video"], revealProgress:ease(p)
    };
    const left = slides ? "Native slides · saved slide 03" : "HTML · actual rendered page excerpt";
    const right = slides ? "Narrated video · saved encoded frame" : "PNG · actual saved infographic";
    let s = text(64,28,left,"label") + text(676,28,right,"label") +
      rect(64,45,548,278,"preview-frame") + rect(676,45,548,278,"preview-frame");
    if (slides) {
      s += `<image href="${escape(previewUrls[assets[0]])}" x="64" y="45" width="548" height="278" preserveAspectRatio="xMidYMid meet"/>` +
        `<image href="${escape(previewUrls[assets[1]])}" x="676" y="45" width="548" height="278" preserveAspectRatio="xMidYMid meet"/>`;
    } else {
      // Crop the existing tall screenshot to its actual model controls; do not fabricate a live browser.
      s += `<svg x="64" y="45" width="548" height="278" viewBox="50 1170 1180 600" preserveAspectRatio="xMidYMid meet">` +
        `<image href="${escape(previewUrls["git-html.png"])}" x="0" y="0" width="1280" height="3397"/></svg>` +
        `<image href="${escape(previewUrls["git-infographic.png"])}" x="676" y="45" width="548" height="278" preserveAspectRatio="xMidYMid meet"/>`;
    }
    s += line(64,337,64+1160*ease(p),337,"accent-line") +
      text(64,362,slides ? "PPTX for presenting ideas · video for showing change" : "HTML for exploration · PNG for a self-contained overview","tiny");
    return s;
  }
  function closing(p, state) {
    state.summary = { sequence:["evidence","visible-mechanism","explanation"], focus:Math.min(2,Math.floor(p*3)),
      examples:["fixed-spherical-area","unchanged-original-str","immutable-prior-layer"] };
    return text(64,42,"What changes?","strong") + text(708,42,"What stays fixed?","strong") +
      text(64,113,"Greenland's map footprint","label") + text(708,113,"Its spherical area","label") +
      text(64,183,"A new string's slot width","label") + text(708,183,"The original str","label") +
      text(64,253,"The merged filesystem view","label") + text(708,253,"The earlier layer's bytes","label") +
      line(64,125+70*state.summary.focus,1216,125+70*state.summary.focus,"emphasis") +
      text(64,338,"Evidence","strong accent") + text(300,338,"→","strong") +
      text(365,338,"Visible mechanism","strong") + text(747,338,"→","strong") +
      text(812,338,"Explanation","strong");
  }
  window.ahaVideo = {
    async renderFrame({frame, fps, segmentIndex, segmentFrame, segmentFrames, text:approvedText}) {
      if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= ids.length) throw new Error("Unknown scene.");
      const p = segmentFrames > 1 ? clamp(segmentFrame/(segmentFrames-1)) : 1;
      const theme = segmentIndex < 2 || segmentIndex >= 9 ? "dark" : "light";
      const state = { schemaVersion:1, sceneId:ids[segmentIndex], segmentIndex, frame, fps,
        segmentFrame, segmentFrames, progress:p, theme, approvedNarration:approvedText,
        captionSafeTop:550, authoredContentBottom:548, timing:"segment-local-deterministic" };
      document.documentElement.setAttribute("data-theme",theme);
      $("heading").textContent = titles[segmentIndex];
      $("eyebrow").textContent = segmentIndex < 2 ? "AHA · TWO PORTABLE SKILLS" : segmentIndex < 4 ?
        "01 · A GEOGRAPHIC MECHANISM" : segmentIndex < 6 ? "02 · A CODE REPRESENTATION" :
        segmentIndex < 9 ? "03 · A FILESYSTEM MECHANISM" : "AHA · FROM EVIDENCE TO EXPLANATION";
      $("note").textContent = notes[segmentIndex];
      $("source").textContent = sources[segmentIndex];
      let svg;
      if (segmentIndex === 0) svg = researchScene(p,state);
      else if (segmentIndex === 1) svg = explanationScene(p,state);
      else if (segmentIndex < 4) svg = mapScene(segmentIndex === 2 ? 0 : ease((p-.08)/.84),state);
      else if (segmentIndex < 6) svg = stringScene(p,segmentIndex === 5,state);
      else if (segmentIndex < 9) svg = dockerScene(p,["create","delete","same"][segmentIndex-6],state);
      else if (segmentIndex < 11) svg = savedFormats(p,segmentIndex === 10,state);
      else svg = closing(p,state);
      $("scene").innerHTML = svg;
      $("scene").setAttribute("aria-label",titles[segmentIndex]+". "+notes[segmentIndex]);
      window.overviewState = state;
    }
  };
})();
