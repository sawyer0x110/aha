const data={"title":["Why noise cancellation leaves some voices audible","降噪耳机为什么仍能听见人声？"],"lead":["ANC adds a second sound pressure at your ear. Opposing waves can reduce the residual; ideal complete cancellation needs equal amplitudes and opposite phase at that position. It does not classify sounds as aircraft or voices.","主动降噪在耳边加入控制声压，抵消部分传入波动。理想的完全抵消才要求目标位置等幅反相；部分减弱不要求幅度完全相等。它不是飞机与人声的分类器。"],"question":["Follow the pressure, not the sound label","沿着声压的路径看，而不是按声音类别判断"],"claims":["c-pressure","c-delay","c-passive","c-speech","c-modes","c-measure"],"sources":[["RWTH IKS · active noise control","https://www.iks.rwth-aachen.de/forschung/audio/active-noise-control/"],["Sony · noise-cancelling function","https://helpguide.sony.net/mdr/wh1000xm5/v1/en/contents/TP1000534745.html"],["Hilgemann et al. · prototype and wearing conditions","https://arxiv.org/html/2509.15864v1"],["Apple · listening modes","https://support.apple.com/en-us/108918"]],"parts":[{"id":"local-pressure","claims":["c-pressure"],"title":["Two paths, one listening position","两条路径，在同一个位置相加"],"text":["Incoming noise and the loudspeaker output travel different acoustic paths. The controller must account for what reaches the ear, not merely flip the sign of the outside microphone signal.","外界噪声和扬声器发出的声音经过不同传播路径。控制器需要考虑最后到达耳边的声压，而不只是把外部麦克风读数翻转符号。"]},{"id":"timing","claims":["c-delay"],"title":["A small timing error matters more at higher frequency","同样的时间误差，在高频中占更大一圈"],"text":["For an assumed uncompensated error of 0.10 ms, the phase error is 3.6° at 100 Hz and 36° at 1,000 Hz. This is a single-tone calculation, not a headphone measurement or universal frequency cutoff.","假定未补偿的时间误差为 0.10 ms，100 Hz 的相位误差为 3.6°，1,000 Hz 则为 36°。这是单频解析示例，不是耳机实测，更不是所有耳机的统一失效频率。"]},{"id":"two-mechanisms","claims":["c-passive"],"title":["The seal blocks a path; ANC adds pressure","密封改变传声，主动控制加入声压"],"text":["Passive isolation changes how sound enters. Active control adds another pressure wave. Switching ANC off leaves the physical barrier in place; taking the headphones off changes both.","被动隔音改变声音传入的路径，主动控制则加入另一股声压。关闭 ANC 后，耳罩或耳塞的物理屏障仍在；摘下耳机则同时改变了两者。"]},{"id":"speech","claims":["c-speech"],"title":["Partly reduced can still mean audible","部分减弱，并不等于听不见"],"text":["Speech spans many frequency components. Some may be reduced while others remain. Recognizable residual speech does not prove that no speech was attenuated, or that its pressure was amplified.","语音包含多个频率成分，一部分可能被削弱，另一部分仍然残留。还能辨认出说话，不代表语音完全未衰减，也不能据此认定语音声压被放大。"]},{"id":"wearing","claims":["c-modes","c-measure"],"title":["Fit and mode can change the comparison","佩戴与模式也会改变结果"],"text":["A seal leak changes the acoustic path. Transparency deliberately admits outside sound; adaptive modes can change behavior. Keep fit and sound source fixed when comparing ANC on and off. That is a proposed comparison, not a test performed here.","密封泄漏会改变声学路径。通透模式主动引入环境声，自适应模式也可能改变行为。比较 ANC 开关时，应尽量保持佩戴和声源一致；这是比较建议，并非此处执行的测试。"]}],"limit":["Ideal pressure model at one target position. Not measured decibels, perceived loudness, or a prediction for your headphones.","同一目标位置的理想声压模型；不是实测分贝、感知响度，也不能预测具体耳机的表现。"],"narration":[["Incoming noise and a headphone speaker can both change the pressure at your ear. Active noise cancellation tries to make their sum smaller.",["c-pressure"]],["Ideal complete cancellation needs equal amplitudes and opposite phase at the ear. Partial reduction does not require a perfect match. The microphone is elsewhere, so both acoustic paths matter.",["c-pressure"]],["Watch the residual as the timing slips. Even equal amplitudes no longer cancel perfectly. This moving diagram is an ideal single-tone model, not a headset measurement.",["c-pressure","c-delay"]],["With an assumed timing error of one tenth of a millisecond, the phase error is three point six degrees at one hundred hertz, but thirty-six degrees at one thousand hertz.",["c-delay"]],["The physical seal also changes how sound gets in. Passive isolation and active control work together; turning active cancellation off does not remove the seal.",["c-passive"]],["Speech contains many components. Some can be reduced while others remain audible. Still hearing a voice does not mean that speech is impossible to cancel.",["c-speech"]],["Fit, leaks and listening mode can change the result. Transparency intentionally lets outside sound in. No ideal diagram can tell us the attenuation of your particular headphones.",["c-modes","c-measure"]]]};
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
})(context, "anc", data); }
