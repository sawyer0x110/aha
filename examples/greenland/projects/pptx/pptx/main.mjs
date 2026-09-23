const data={"title":["Why Mercator makes Greenland look enormous","墨卡托地图为什么把格陵兰放大了？"],"lead":["Africa has about fourteen times Greenland's reported area. A Mercator map can obscure that comparison because its magnification increases toward the poles.","按引用的面积统计，非洲约为格陵兰的 14 倍。墨卡托地图越靠近两极放大越严重，因此看轮廓容易误判面积比例。"],"question":["Separate land area from projected area","把土地面积与地图上的面积分开"],"claims":["c-area","c-cause","c-bridge","c-scale","c-navigation","c-poles","c-equal","c-resource","c-motion"],"sources":[["PROJ · spherical Mercator equations","https://raw.githubusercontent.com/OSGeo/PROJ/9.9/docs/source/operations/projections/merc.rst"],["Britannica · Africa","https://www.britannica.com/place/Africa"],["IndexMundi · Greenland area (2021 source page)","https://www.indexmundi.com/greenland/area.html"],["Esri · Mercator properties","https://pro.arcgis.com/en/pro-app/3.6/help/mapping/properties/mercator.htm"],["Natural Earth · public-domain boundaries","https://www.naturalearthdata.com/about/terms-of-use/"],["Esri · Equal Earth","https://doc.esri.com/en/arcgis-pro/latest/help/mapping/properties/equal-earth.html"]],"parts":[{"id":"area","claims":["c-area"],"title":["About fourteen times, not fourteen packed outlines","约 14 倍，不是装进 14 个轮廓"],"text":["The cited areas are 2,166,086 km² for Greenland and about 30,365,000 km² for Africa. They support a rounded ratio, not a claim that fourteen Greenland outlines fit inside Africa. The official Greenland PDF body was not verified.","引用资料给出格陵兰 2,166,086 km²、非洲约 30,365,000 km²。它们支持约 14 倍的比较，而非轮廓装箱；本次研究未核验格陵兰官方 PDF 的正文。"]},{"id":"spacing","claims":["c-bridge","c-cause"],"title":["Equal longitude gaps are not equal ground distances","同样的经度间隔，不是同样的地面距离"],"text":["Meridians converge on a sphere but stay equally spaced on a Mercator map. The map therefore stretches east-west distances more at high latitude. To preserve local angles, it stretches north-south distances by the same local factor.","球面上的经线向两极汇聚，墨卡托图上的经线却始终等距，因此高纬地区东西方向被放大。为了保持局部角度，南北方向也要按相同的局部倍率拉伸。"]},{"id":"local-scale","claims":["c-scale"],"title":["At 60°: twice in each direction, four times in area","60° 附近：两方向各两倍，面积四倍"],"text":["For a tiny patch in spherical Mercator with equatorial scale one, linear scale is sec(latitude) and area scale is its square. Greenland spans many latitudes: a local fourfold factor is not a whole-country multiplier.","以赤道比例为 1 的球面墨卡托为例，微小区域的线性倍率是纬度余弦的倒数，面积倍率是其平方。格陵兰跨越多个纬度，不能把局部四倍当成整国倍率。"]},{"id":"motion","claims":["c-motion","c-resource"],"title":["Move the land on a sphere, not by shrinking a picture","在球面上移动土地，而不是缩小图片"],"text":["Apply the same three-dimensional rotation to every boundary vertex. Spherical area stays unchanged while its outline on a fixed Mercator map changes. Natural Earth 1:110 million boundaries are generalized public-domain data, not precise survey measurements.","对边界的所有顶点施加同一个三维旋转：球面面积保持不变，固定墨卡托图上的轮廓却会改变。Natural Earth 1:1.1 亿边界是公共领域概化数据，不是精密测量。"]},{"id":"tradeoffs","claims":["c-navigation","c-poles","c-equal"],"title":["Choose the property your question needs","先问地图要保留什么"],"text":["Mercator preserves local angles and draws constant-heading rhumb lines straight; they are usually not shortest routes. Its poles lie at infinity and must be cropped. Equal Earth preserves area proportions, but not every shape, angle or distance.","墨卡托保留局部角度，把恒定罗盘航向的恒向线画成直线，但它通常不是最短路线；两极在无穷远，有限地图必须裁切。Equal Earth 保面积比例，却不保所有形状、角度和距离。"]}],"limit":["Spherical Mercator; local scale is not a whole-country multiplier. Generalized boundaries are not statistical area measurements.","球面墨卡托；局部倍率不是整国倍率。概化边界的计算面积不替代统计面积。"],"narration":[["Greenland looks enormous on many Mercator maps. But Africa has about fourteen times its reported land area. The map and the land are measuring different things.",["c-area","c-cause"]],["On a sphere, meridians converge toward the poles. Mercator keeps them equally spaced on the page. The same longitude gap is therefore stretched more at high latitude.",["c-bridge","c-cause"]],["To preserve local angles, Mercator stretches north-south distances by the same local factor. Near sixty degrees, a tiny patch is doubled in both directions, giving four times the area.",["c-bridge","c-scale"]],["That is a local result, not one multiplier for all of Greenland. The country spans different latitudes, and each part is magnified differently.",["c-scale"]],["Now rotate the actual generalized boundary on a sphere toward the equator. Its land area stays the same, but its footprint shrinks on this fixed-scale Mercator map. This is not a two-dimensional resize.",["c-motion","c-resource"]],["Mercator makes constant-heading routes straight, though they are usually not the shortest routes. Its poles project to infinity, so a finite map must cut them off.",["c-navigation","c-poles"]],["For comparing areas, an equal-area map such as Equal Earth is useful. It preserves area proportions, not every shape or angle. The right projection depends on the question.",["c-equal"]]]};
export default async function (context) { return (async function authorSlides({ pptx }, topic, data) {
  const C = { bg: "F7F4EF", ink: "242424", muted: "5C5C5C", rose: "B11F4B", soft: "F4E3E8", border: "919191", white: "FFFFFF" };
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Aha";
  pptx.subject = data.title[1];
  pptx.title = data.title[1];
  pptx.lang = "zh-CN";
  pptx.theme = { headFontFace: "Microsoft YaHei", bodyFontFace: "Microsoft YaHei", lang: "zh-CN" };
  const text = (s, value, x, y, w, h, size = 22, extra = {}) => s.addText(value, {
    x, y, w, h, fontFace: "Microsoft YaHei", fontSize: size, color: C.ink,
    margin: 0, breakLine: false, valign: "mid", ...extra,
  });
  const rect = (s, x, y, w, h, fill = C.white) => s.addShape(pptx.ShapeType.rect, {
    x, y, w, h, fill: { color: fill }, line: { color: C.border, width: 1 },
  });
  const tile = (s, label, x, y, w = 3.5, h = .85, accent = false) => {
    rect(s, x, y, w, h, accent ? C.soft : C.white);
    text(s, label, x + .16, y + .08, w - .32, h - .16, 21, { align: "center", bold: accent });
  };
  const arrow = (s, x, y, w) => s.addShape(pptx.ShapeType.line, {
    x, y, w, h: 0, line: { color: C.rose, width: 2.5, endArrowType: "triangle" },
  });
  const base = (title, index, source = "") => {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    text(s, title, .65, .48, 12.0, .9, 30, { bold: true });
    text(s, source, .65, 6.88, 11.4, .35, 11, { color: C.muted });
    text(s, String(index).padStart(2, "0"), 12.05, 6.84, .55, .4, 13, { align: "right", color: C.muted });
    return s;
  };
  const caveat = (s, value) => text(s, value, .7, 5.98, 11.9, .62, 17, { color: C.muted });
  const table = (s, rows, x = .8, y = 3.25, w = 11.7, widths) => s.addTable(rows, {
    x, y, w, colW: widths, fontFace: "Microsoft YaHei", fontSize: 19,
    color: C.ink, fill: C.white, border: { type: "solid", color: C.border, pt: 1 },
    margin: [.12, .16, .12, .16], valign: "middle", rowH: .55,
  });
  function mechanism(s, part) {
    if (topic === "anc") {
      if (part === "timing") {
        tile(s, "假定误差：0.10 ms", .9, 3.15, 4, .85, true);
        tile(s, "100 Hz → 3.6°", 6.4, 3.15, 5.8);
        tile(s, "1,000 Hz → 36°", 6.4, 4.3, 5.8);
        arrow(s, 5.1, 3.58, 1.05);
        s.addShape(pptx.ShapeType.line, { x: 5.6, y: 3.58, w: 0, h: 1.14, line: { color: C.rose, width: 2.5 } });
        arrow(s, 5.6, 4.72, .55);
        text(s, "频率越高\n误差占周期的比例越大", .9, 4.35, 4.5, 1.0, 21);
      } else if (part === "two-mechanisms") {
        tile(s, "外界声音", .85, 3.3, 2.1);
        arrow(s, 3.05, 3.72, .65);
        tile(s, "密封／屏障", 3.8, 3.3, 3);
        arrow(s, 6.9, 3.72, .65);
        tile(s, "到达耳边的声压", 7.65, 3.3, 4.7, .85, true);
        tile(s, "扬声器控制声压", 3.8, 4.55, 3);
        s.addShape(pptx.ShapeType.line, { x: 7.3, y: 3.72, w: 0, h: 1.26, line: { color: C.rose, width: 2.5 } });
        arrow(s, 6.9, 4.98, .4);
        text(s, "两路声压在目标位置叠加", 7.65, 4.55, 4.7, .85, 21);
      } else if (part === "speech") {
        table(s, [["不能推出", "可以支持的解释"], ["仍能听见 → 完全未衰减", "部分成分减弱，残余仍可听"], ["人声更突出 → 声压被放大", "其他声音减弱得更多"], ["人声 → 天生不可抵消", "控制效果取决于成分与路径"]]);
      } else if (part === "wearing") {
        table(s, [["比较变量", "为什么要注意"], ["佩戴与密封", "改变传入与受控声学路径"], ["ANC／通透／自适应", "模式目标和实际行为不同"], ["型号与声场", "理想模型不提供个人衰减量"]]);
      } else {
        tile(s, "传入声压 d", .9, 3.35, 3.4);
        text(s, "+", 4.5, 3.35, .55, .85, 34, { align: "center" });
        tile(s, "控制声压 a", 5.2, 3.35, 3.4);
        text(s, "=", 8.8, 3.35, .55, .85, 34, { align: "center" });
        tile(s, "残余 e", 9.5, 3.35, 2.8, .85, true);
        text(s, "同一时刻、同一耳边目标位置；不是让整个空间静音", 1, 4.65, 11.4, .65, 22, { align: "center" });
      }
    } else if (topic === "greenland") {
      if (part === "area" || part === "cover") {
        text(s, "面积／百万平方千米", .95, 2.85, 6.0, .4, 18, { color: C.muted });
        s.addChart(pptx.ChartType.bar, [{ name: "面积", labels: ["格陵兰", "非洲"], values: [2.166086, 30.365] }], {
          x: .85, y: 3.0, w: 8.0, h: 2.6, catAxisLabelFontFace: "Microsoft YaHei", catAxisLabelFontSize: 18,
          valAxisLabelFontSize: 14, valAxisTitle: "百万平方公里", showValue: true, showLegend: false,
          showCatName: false, chartColors: [C.rose], showTitle: false, showBorder: false,
          valAxisMinVal: 0, valAxisMaxVal: 35, valAxisMajorUnit: 10,
          dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00",
        });
        text(s, "约 14 倍", 9.25, 3.4, 3.1, .9, 34, { bold: true, color: C.rose });
        text(s, "统计面积比较\n不是轮廓装箱", 9.25, 4.45, 3.1, .8, 21);
      } else if (part === "spacing") {
        tile(s, "球面：经线汇聚", .9, 3.2, 4.8);
        tile(s, "墨卡托：经线等距", 7.1, 3.2, 5.1, .85, true);
        arrow(s, 5.9, 3.62, .95);
        text(s, "同样经度差\n高纬地面距离更短", 1.1, 4.4, 4.5, 1.0, 23);
        text(s, "东西拉伸更多\n南北同倍率以保局部角度", 7.3, 4.4, 4.8, 1.0, 23);
      } else if (part === "local-scale") {
        rect(s, 1.4, 3.65, 1.05, 1.05, C.soft);
        text(s, "赤道：1 × 1", .9, 4.95, 3, .55, 22);
        arrow(s, 3.7, 4.18, 1.3);
        rect(s, 6.0, 3.1, 2.1, 2.1, C.soft);
        text(s, "60°：2 × 2", 5.7, 5.35, 3.1, .5, 22);
        text(s, "局部面积 4 倍", 9.0, 3.7, 3.5, 1, 30, { bold: true, color: C.rose });
      } else if (part === "motion") {
        tile(s, "同一个球面区域", .9, 3.25, 4.6);
        arrow(s, 5.7, 3.67, 1);
        tile(s, "统一三维旋转", 6.9, 3.25, 5.3, .85, true);
        table(s, [["保持不变", "重新投影后改变"], ["球面土地面积", "固定墨卡托图上的面积与轮廓"]], .9, 4.45, 11.3);
      } else {
        table(s, [["投影", "保留的性质", "不能据此保证"], ["普通墨卡托", "局部角度；恒向线为直线", "面积；最短路线"], ["Equal Earth", "区域面积比例", "所有形状、角度、距离"]], .85, 3.25, 11.7, [2.6, 4.6, 4.5]);
      }
    } else if (topic === "cpython-string") {
      if (part === "observation" || part === "encoding" || part === "boundaries") {
        table(s, [["100,000 个 ASCII 加上", "槽宽 / 字节", "str / 字节", "UTF-8 / 字节"],
          ["无新增", "1", "100,049", "100,000"], ["U+00E9", "1", "100,074", "100,002"],
          ["U+4E2D", "2", "200,076", "100,003"], ["U+1F600", "4", "400,080", "100,004"]], .8, 3.03, 11.7, [4.1, 2.0, 2.8, 2.8]);
      } else {
        text(s, "原 str：不变", .9, 3.12, 3.2, .5, 22, { bold: true });
        text(s, "新结果：每个码点槽都扩宽", 6.5, 3.12, 5.5, .5, 22, { bold: true });
        for (let i = 0; i < 5; i++) {
          tile(s, i === 3 ? "…" : "a", .9 + i * .57, 3.92, .48, .65);
          tile(s, i === 4 ? "码点" : i === 3 ? "…" : "a", 6.5 + i * 1.08, 3.92, .95, .65, true);
        }
        arrow(s, 4.45, 4.24, 1.55);
        text(s, "一字节槽", .9, 4.92, 3.6, .55, 22);
        text(s, "含 U+1F600 → 四字节槽", 6.5, 4.92, 5.4, .55, 22);
      }
    } else {
      if (part === "same-run") {
        tile(s, "前端点：无 /temp", .9, 3.3, 3.4);
        tile(s, "创建 → 删除", 5, 3.3, 3.2, .85, true);
        tile(s, "后端点：无 /temp", 8.9, 3.3, 3.5);
        arrow(s, 4.4, 3.72, .45); arrow(s, 8.3, 3.72, .45);
        text(s, "只对新临时文件成立：该路径的载荷不进入此次差异", 1, 4.8, 11.2, .8, 24, { align: "center" });
      } else if (part === "scope") {
        table(s, [["此图展示", "不能混为一谈"], ["假定文件载荷 100 MB", "压缩大小、下载量、共享磁盘占用"], ["不可变镜像层", "运行中容器的独立可写层"], ["普通未压平差异", "压平、多阶段选择与缓存清理"]]);
      } else {
        if (part !== "add") tile(s, "后加层：whiteout", .9, 3.15, 5.0);
        tile(s, part === "add" ? "首个提交层：/temp · 100 MB" : "旧层：/temp · 100 MB", .9, 4.35, 5.0, .85, true);
        arrow(s, 6.2, 3.58, 1.0);
        tile(s, part === "add" ? "合并视图：/temp 可见" : "合并视图：/temp 不存在", 7.6, 3.15, 4.75, .85, true);
        text(s, part === "base" ? "基础层已有的文件\n也不能被后层改写" : "视图中的删除\n不等于抹除旧层字节", 7.8, 4.5, 4.4, .9, 23);
      }
    }
  }
  let s = base(data.title[1], 1, "研究快照：2026-09-16 / 17；本作品不冒充新实测");
  text(s, data.lead[1], .75, 1.62, 11.8, 1.2, 24);
  mechanism(s, "cover");
  caveat(s, data.limit[1]);
  s.addNotes(data.lead[1] + "\n讲解重点：先区分对象与表示，再沿图中的关系解释变化。研究日期与版本沿用封存档案。");
  for (const [index, part] of data.parts.entries()) {
    s = base(part.title[1], index + 2, data.sources.map(source => source[0].split(" · ")[0]).join(" / "));
    text(s, part.text[1], .75, 1.6, 11.8, 1.26, 22);
    mechanism(s, part.id);
    caveat(s, data.limit[1]);
    s.addNotes(part.text[1] + "\n材料支持：" + part.claims.join(", ") + "\n" + data.sources.map(([label, url]) => `${label}: ${url}`).join("\n"));
  }
  s = base("回到最初的问题", 7, "完整依据与来源范围见同目录 research/report.md");
  text(s, data.lead[1], .85, 1.7, 11.6, 1.25, 26, { bold: true });
  tile(s, data.question[1], .85, 3.3, 11.6, .85, true);
  text(s, data.limit[1], .95, 4.55, 11.3, .95, 22);
  text(s, "来源：" + data.sources.map(source => source[0].split(" · ")[0]).join("；"), .95, 5.8, 11.3, .6, 16, { color: C.muted });
  s.addNotes("用一个条件不同的新情形检查自己的解释，但本作品没有执行真人理解测试。\n" + data.sources.map(([label, url]) => `${label}: ${url}`).join("\n"));
})(context, "greenland", data); }
