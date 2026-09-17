(() => {
  "use strict";
  const { geoArea, geoRotation, geoMercator, geoOrthographic, geoEqualEarth, geoPath, geoGraticule10, geoCentroid } = Geo;
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
  const txt = (x, y, value, cls = "label", extra = "") => `<text x="${x}" y="${y}" class="${cls}" ${extra}>${esc(value)}</text>`;
  const line = (x1, y1, x2, y2, cls = "line", extra = "") => `<path d="M${x1},${y1}L${x2},${y2}" class="${cls}" ${extra}/>`;
  const rect = (x, y, width, height, cls, extra = "") => `<rect x="${x}" y="${y}" width="${width}" height="${height}" class="${cls}" ${extra}/>`;
  const path = (geometry, projection, cls, extra = "") => `<path d="${geoPath(projection)(geometry) || ""}" class="${cls}" ${extra}/>`;
  function normalizeGeometry(geometry) {
    if (!["Polygon", "MultiPolygon"].includes(geometry.type)) throw new Error("Unsupported boundary geometry.");
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    const coordinates = polygons.map(rings => {
      const copy = rings.map(ring => ring.map(point => point.slice()));
      if (geoArea({ type:"Polygon", coordinates:copy }) > 2 * Math.PI) copy.forEach(ring => ring.reverse());
      return copy;
    });
    return { type:geometry.type, coordinates:geometry.type === "Polygon" ? coordinates[0] : coordinates };
  }
  const countries = MAP_DATA.features.map(f => ({ ...f, geometry:normalizeGeometry(f.geometry) }));
  const greenland = countries.find(f => f.properties.name === "Greenland");
  if (!greenland) throw new Error("Missing Greenland.");
  const world = { type:"FeatureCollection", features:countries.filter(f => f !== greenland) };
  const africa = { type:"FeatureCollection", features:countries.filter(f => f.properties.continent === "Africa") };
  const centroid = geoCentroid(greenland), originalArea = geoArea(greenland), grid = geoGraticule10();
  if (!(originalArea > 0 && originalArea < .1)) throw new Error("Invalid Greenland winding.");
  const parallel = latitude => ({ type:"LineString", coordinates:Array.from({ length:181 }, (_, i) => [-180 + i * 2, latitude]) });
  const meridian = longitude => ({ type:"LineString", coordinates:Array.from({ length:85 }, (_, i) => [longitude, -84 + i * 2]) });
  const equator = parallel(0);
  const mercator = geoMercator().scale(95).translate([455,285]).precision(.15).clipExtent([[64,4],[818,374]]);
  const globe = geoOrthographic().scale(94).translate([1017,148]).rotate([-centroid[0],-30]).precision(.15);
  const mechanismGlobe = geoOrthographic().scale(147).translate([350,190]).rotate([0,-25]).precision(.15);
  const mechanismMap = geoMercator().scale(72).translate([910,280]).precision(.15).clipExtent([[650,44],[1214,324]]);
  const leftMap = geoMercator().scale(68).translate([343,255]).precision(.04).clipExtent([[64,54],[622,322]]);
  const equalMap = geoEqualEarth().scale(96).translate([954,188]).precision(.04).clipExtent([[658,54],[1216,322]]);
  const defs = `<defs>
    <clipPath id="main-clip"><rect x="64" y="4" width="754" height="370"/></clipPath>
    <clipPath id="mechanism-clip"><rect x="650" y="44" width="564" height="280"/></clipPath>
    <clipPath id="left-clip"><rect x="64" y="54" width="558" height="268"/></clipPath>
    <clipPath id="equal-clip"><rect x="658" y="54" width="558" height="268"/></clipPath>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10Z" fill="var(--cp-accent)"/></marker>
  </defs>`;
  function movedGeometry(progress) {
    // One rigid spherical rotation, conjugated to Greenland's centroid longitude.
    const rotate = geoRotation([0, -centroid[1] * progress, 0]);
    const point = p => {
      const q = rotate([p[0] - centroid[0], p[1]]);
      return [((q[0] + centroid[0] + 540) % 360) - 180, q[1]];
    };
    const g = greenland.geometry;
    return { type:g.type, coordinates:g.type === "Polygon"
      ? g.coordinates.map(ring => ring.map(point))
      : g.coordinates.map(poly => poly.map(ring => ring.map(point))) };
  }
  function mapWithMotion(progress, opening = false) {
    const moved = movedGeometry(progress), center = mercator(geoCentroid(moved));
    const relativeError = Math.abs(geoArea(moved) / originalArea - 1);
    if (relativeError > 1e-10) throw new Error("Rigid rotation changed spherical area.");
    const labelX = center[0] - 182, labelY = Math.max(66, Math.min(320, center[1] - 18));
    window.greenlandState = { progress, relativeError, centroid:geoCentroid(moved), projectedArea:geoPath(mercator).area(moved),
      originalAreaSteradians:originalArea, movedAreaSteradians:geoArea(moved), scale:mercator.scale(), translate:mercator.translate() };
    return rect(64,4,754,370,"ocean", 'rx="10"') +
      `<g clip-path="url(#main-clip)">` +
      path(world,mercator,"land") + path(africa,mercator,"africa") + path(grid,mercator,"grid") +
      path(equator,mercator,"equator") + (progress > 0 ? path(greenland,mercator,"ghost") : "") +
      path(moved,mercator,"greenland", 'data-geometry="moving"') +
      line(labelX+114,labelY-7,center[0]-10,center[1],"leader") + txt(labelX,labelY,"Greenland") +
      txt(535,265,"Africa") + txt(83,304,"Equator","small") + `</g>` +
      txt(82,33,"SPHERICAL MERCATOR","small") + txt(82,356,"Fixed map scale · Polar regions cropped","small") +
      txt(881,29,"ON THE SPHERE","small") +
      path({ type:"Sphere" },globe,"ocean") + path(world,globe,"land") + path(grid,globe,"grid") +
      path(moved,globe,"greenland") +
      txt(875,280,opening ? "Same world." : "Same land. Same area.","strong") +
      txt(875,320,opening ? "Unequal magnification." : progress < .5 ? "High latitude: enlarged." : progress < 1 ? "Southward: less magnified." : "Equator: less magnified.","label");
  }
  function bars(t) {
    const ratio = 30365000 / 2166086, unit = 57, growing = .2 + .8 * t;
    return txt(70,49,"REPORTED LAND AREAS","small") + txt(70,100,"Africa is about","strong") +
      txt(70,168,"14×","number accent") + txt(225,164,"Greenland's area","strong") +
      txt(74,226,"Greenland · 2.17 million km²","label") + rect(74,242,unit*growing,30,"greenland") +
      txt(74,313,"Africa · 30.4 million km²","label") + rect(74,329,unit*ratio*growing,30,"africa") +
      txt(913,120,"AREA BARS","label") + txt(913,153,"Equal heights; lengths","small") +
      txt(913,179,"encode reported area.","small") + txt(913,230,"Not fourteen shapes","small") +
      txt(913,256,"packed into Africa.","small");
  }
  function meridians(stage, t) {
    const highlight = stage === 2 ? .35 + .65*t : 1;
    let svg = txt(191,25,"GLOBE: meridians converge","label") +
      path({ type:"Sphere" },mechanismGlobe,"ocean") + path(world,mechanismGlobe,"land") +
      path(grid,mechanismGlobe,"grid") + path(greenland,mechanismGlobe,"greenland");
    for (const lon of [-30,0,30]) svg += path(meridian(lon),mechanismGlobe,"accent-line", `opacity="${highlight}"`);
    svg += path(parallel(0),mechanismGlobe,"equator") + path(parallel(60),mechanismGlobe,"accent-line");
    svg += txt(66,102,"60° N","small") + line(123,99,...mechanismGlobe([-45,60]),"leader") +
      txt(66,278,"Equator","small") + line(137,272,...mechanismGlobe([-45,0]),"leader") +
      txt(179,364,"Same longitude gap → less distance","small");
    svg += rect(650,44,564,280,"ocean", 'rx="8"') + `<g clip-path="url(#mechanism-clip)">` +
      path(grid,mechanismMap,"grid");
    for (const lon of [-30,0,30]) svg += path(meridian(lon),mechanismMap,"accent-line");
    for (const lat of [0,30,60,75]) {
      svg += path(parallel(lat),mechanismMap, lat === 0 ? "equator" : stage === 4 ? "accent-line" : "grid");
      svg += txt(668,mechanismMap([0,lat])[1]-6,`${lat}°`,"small");
    }
    svg += `</g>` + txt(670,25,"MERCATOR: equal longitude spacing","label") +
      txt(683,360,stage === 4 ? "Latitude spacing grows to preserve local angles" : "Equal gap on paper → east-west stretching","small");
    if (stage === 4) {
      const y0 = mechanismMap([0,0])[1], y30 = mechanismMap([0,30])[1], y60 = mechanismMap([0,60])[1];
      svg += line(1110,y0,1110,y30,"accent-line",'marker-start="url(#arrow)" marker-end="url(#arrow)"') +
        line(1145,y30,1145,y60,"accent-line",'marker-start="url(#arrow)" marker-end="url(#arrow)"') +
        txt(1160,(y0+y30)/2+6,"30°","small") + txt(1160,(y30+y60)/2+6,"30°","small");
    }
    return svg;
  }
  function localPatch(stage, t) {
    let svg = txt(74,33,"LOCAL · TINY PATCH · SPHERICAL MODEL","label accent") +
      txt(160,83,"At equator","strong") + txt(622,83,"At 60° latitude","strong") +
      rect(211,149,90,90,"patch") + txt(185,280,"1× width","label") + txt(185,310,"1× height","label") +
      line(347,194,537,194,"accent-line",'marker-end="url(#arrow)"') + txt(353,170,"Mercator scale","small") +
      rect(638,105,180,180,"patch") + txt(670,320,"2× width","label") +
      txt(840,199,"2× height","label") +
      txt(993,142,stage === 5 ? "Scale at" : "2 × 2","strong") +
      txt(993,183,stage === 5 ? "the equator" : "=", "strong") +
      txt(993,238,stage === 5 ? "is 1." : "4× area","big accent");
    if (stage === 6) svg += line(728,105,728,285,"accent-line",`opacity="${t}"`) + line(638,195,818,195,"accent-line",`opacity="${t}"`);
    svg += txt(160,358,stage === 5 ? "Compare identical tiny ground patches at two latitudes." : "A LOCAL result — not a whole-country multiplier.","label");
    return svg;
  }
  const routeStart = mercator([-65,5]), routeEnd = mercator([5,60]);
  const routeLength = Math.hypot(routeEnd[0]-routeStart[0],routeEnd[1]-routeStart[1]);
  const headingVector = [(routeEnd[0]-routeStart[0])/routeLength,(routeEnd[1]-routeStart[1])/routeLength];
  function navigation(stage, t) {
    let svg = rect(64,4,754,370,"ocean",'rx="10"') + `<g clip-path="url(#main-clip)">` +
      path(world,mercator,"land") + path(africa,mercator,"africa") + path(greenland,mercator,"greenland") +
      path(grid,mercator,"grid") + path(equator,mercator,"equator");
    const p = stage === 9 ? .45 : .45 + .55*t;
    svg += line(...routeStart,routeStart[0]+(routeEnd[0]-routeStart[0])*p,routeStart[1]+(routeEnd[1]-routeStart[1])*p,
      "accent-line",'marker-end="url(#arrow)"') + `</g>` +
      txt(82,32,"SPHERICAL MERCATOR","small") + txt(82,355,"Polar regions cropped","small") +
      txt(510,158,"Constant heading","label") + txt(510,185,"Straight on this map","small") +
      txt(874,42,"LOCAL ANGLES","label") +
      line(941,248,941,103,"line",'stroke-dasharray="5 5"') +
      line(941,248,941+headingVector[0]*160,248+headingVector[1]*160,"accent-line",'marker-end="url(#arrow)"') +
      `<path d="M941,185A63,63 0 0 1 ${941+headingVector[0]*63},${248+headingVector[1]*63}" class="accent-line"/>` +
      txt(922,87,"N","label") + txt(1020,218,"heading","small") +
      txt(867,300,"A rhumb line: constant heading","label") +
      txt(867,332,"Not usually the shortest route.","small");
    return svg;
  }
  function comparison(stage) {
    let svg = txt(83,30,"SPHERICAL MERCATOR","label") + txt(679,30,"EQUAL EARTH · EQUAL AREA","label accent");
    for (const [projection,clip,x] of [[leftMap,"left-clip",64],[equalMap,"equal-clip",658]]) {
      svg += rect(x,54,558,268,"ocean",'rx="8"') + `<g clip-path="url(#${clip})">` +
        path(world,projection,"land", `data-geometry="${clip}-world"`) + path(africa,projection,"africa",`data-geometry="${clip}-africa"`) +
        path(grid,projection,"grid") + path(greenland,projection,"greenland",`data-geometry="${clip}-greenland"`) + `</g>`;
      const center = projection(centroid);
      svg += line(center[0]-60,Math.max(70,center[1]),center[0]-6,Math.max(70,center[1]),"leader") +
        txt(center[0]-163,Math.max(76,center[1]+6),"Greenland","small");
      const a = projection([54,5]), coast = projection([36,5]);
      svg += line(coast[0],coast[1],a[0]-5,a[1],"line") + txt(a[0],a[1]+6,"Africa","small");
    }
    svg += txt(83,350,"High latitudes enlarged · Polar crop","small") +
      txt(679,350,stage === 11 ? "Correct relative areas WITHIN this view" : "Area ratios preserved; shapes and angles change","small");
    return svg;
  }
  function closing(t) {
    return txt(73,54,"WHAT DO YOU NEED THE MAP TO DO?","label accent") +
      txt(73,129,"Compare land area","big") + txt(75,174,"Equal Earth","strong accent") +
      txt(75,211,"Preserves relative areas within the map.","small") +
      txt(73,290,"Follow a compass heading","big") + txt(75,335,"Mercator","strong accent") +
      path({ type:"Sphere" },globe,"ocean") + path(world,globe,"land") + path(grid,globe,"grid") +
      path(greenland,globe,"greenland") +
      line(888,289,1172,289,"accent-line",`opacity="${.3+.7*t}" marker-end="url(#arrow)"`) +
      txt(888,330,"Purpose, not a perfect map.","label");
  }
  const scenes = [
    ["opening","Why does Greenland look so big?","A MATTER OF PROJECTION","A spherical Mercator map — not every world map has this distortion.","Sources: PROJ · Esri Mercator · Made with Natural Earth (public domain)."],
    ["area-bars","The real comparison is area.","MEASURE THE LAND, NOT THE INK","Rounded statistics; generalized map polygons are not precision area measurements.","Sources: IndexMundi / CIA Factbook (2021) · Britannica, Africa · approximately 14:1."],
    ["meridians-globe","Longitude lines converge on a globe.","FIRST: THE SPHERE","Highlighted meridians are 30° apart; their ground separation decreases toward the poles.","Sources: PROJ spherical Mercator equations · Esri Mercator documentation."],
    ["meridians-map","On Mercator, meridians stay parallel.","THEN: THE FLAT MAP","Equal longitude spacing on paper magnifies high-latitude east-west distances.","Sources: PROJ spherical Mercator equations · Esri Mercator documentation."],
    ["latitude-stretch","North-south stretching must match.","THE MISSING BRIDGE","The marked intervals both span 30° latitude, but cover different distances on Mercator.","Sources: PROJ spherical Mercator equations · Esri Mercator: local angle preservation."],
    ["local-patch","Zoom in on one tiny patch.","A LOCAL SCALE EXAMPLE","Spherical model · equatorial scale = 1 · diagram enlarged for visibility.","Source: derived from PROJ equations · LOCAL linear scale = sec(latitude)."],
    ["local-area","Twice as wide. Twice as tall.","A LOCAL AREA EXAMPLE","LOCAL at 60° · 2 × 2 = 4 · Greenland spans many latitudes, not one scale factor.","Source: derived from PROJ equations · LOCAL area scale = sec²(latitude)."],
    ["moving-greenland","Move the land. Not the map scale.","A GEOGRAPHICAL THOUGHT EXPERIMENT","Only Greenland is relocated. Its boundary undergoes a rigid spherical rotation.","Sources: D3 geoRotation / geoArea · PROJ · Made with Natural Earth (public domain)."],
    ["unchanged-area","Same area. Less magnification.","THE PROJECTION CHANGES THE APPEARANCE","Dashed outline: original position. Solid outline: the same land at the equator.","Sources: D3 geoRotation / geoArea · PROJ · Made with Natural Earth (public domain)."],
    ["local-angles","Mercator makes a useful trade-off.","AREA IS NOT ITS PRIORITY","Local angle preservation does not mean whole continents keep their shape or area.","Source: Esri Mercator documentation · spherical model · Natural Earth (public domain)."],
    ["constant-heading","Straight means constant heading.","NOT USUALLY THE SHORTEST ROUTE","A rhumb line maintains the same angle to every meridian it crosses.","Source: Esri Mercator documentation · spherical model · Natural Earth (public domain)."],
    ["equal-earth","For area, change the projection.","TWO REAL PROJECTIONS","Separate fixed map scales — compare relative areas within each view, not sizes between panels.","Sources: Esri Equal Earth documentation · Made with Natural Earth (public domain)."],
    ["projection-tradeoff","Equal area does not mean no distortion.","A DIFFERENT TRADE-OFF","Separate fixed map scales — Equal Earth preserves area ratios, not local angles.","Sources: Esri Equal Earth · Britannica map projections · Natural Earth (public domain)."],
    ["closing-choice","Choose a map for the question.","AREA OR COMPASS HEADING?","No flat world map avoids every kind of distortion.","Sources: Esri Mercator / Equal Earth · Britannica · Made with Natural Earth (public domain)."]
  ];
  const override = new URLSearchParams(location.search).get("scoutTheme");
  window.ahaVideo = {
    renderFrame({ segmentIndex = 0, segmentFrame = 0, segmentFrames = 1 }) {
      if (!Number.isInteger(segmentIndex) || !scenes[segmentIndex]) throw new Error("Invalid segment.");
      const t = Math.max(0,Math.min(1,segmentFrames > 1 ? segmentFrame/(segmentFrames-1) : 1)), smooth = t*t*(3-2*t);
      const [id,title,kicker,note,source] = scenes[segmentIndex];
      document.documentElement.dataset.theme = ["light","dark"].includes(override) ? override : segmentIndex === 0 || segmentIndex === 13 ? "dark" : "light";
      $("heading").textContent = title; $("eyebrow").textContent = kicker;
      $("note").textContent = note; $("source").textContent = source;
      window.greenlandState = null;
      let markup;
      if (segmentIndex === 0) markup = mapWithMotion(0,true);
      else if (segmentIndex === 1) markup = bars(smooth);
      else if (segmentIndex <= 4) markup = meridians(segmentIndex,smooth);
      else if (segmentIndex <= 6) markup = localPatch(segmentIndex,smooth);
      else if (segmentIndex <= 8) markup = mapWithMotion(segmentIndex === 7 ? smooth : 1);
      else if (segmentIndex <= 10) markup = navigation(segmentIndex,smooth);
      else if (segmentIndex <= 12) markup = comparison(segmentIndex);
      else markup = closing(smooth);
      $("scene").innerHTML = defs + `<g data-scene="${id}">${markup}</g>`;
      $("scene").setAttribute("aria-label", `${title} ${note}`);
      window.fullSceneState = { id,segmentIndex,progress:t,theme:document.documentElement.dataset.theme };
    }
  };
  window.greenlandDiagnostics = { movedGeometry,originalArea,centroid,countries,greenland,africa,mercator,leftMap,equalMap,
    reportedRatio:30365000/2166086, localLinearScale:1/Math.cos(Math.PI/3), localAreaScale:1/Math.cos(Math.PI/3)**2 };
  window.ahaVideo.renderFrame({ segmentIndex:0,segmentFrame:0,segmentFrames:101 });
})();
