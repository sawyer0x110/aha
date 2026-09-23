const data={"title":["Why deleting a file does not erase an earlier Docker layer","文件删了，Docker 旧层的字节为什么还在？"],"lead":["A later deletion changes the merged filesystem view, not an immutable earlier layer. Creating and deleting a new temporary file in the same RUN is different: that path is absent at both endpoints of the resulting diff.","后续删除改变的是合并文件系统视图，不是不可变的旧层。在同一个 RUN 中创建再删除新的临时文件则不同：生成差异时，这个路径在前后两个端点都不存在。"],"question":["Keep the layer cutaway separate from the merged view","把层的剖面与合并视图分开看"],"claims":["c-layer","c-delete","c-same","c-example","c-base","c-size","c-writable"],"sources":[["Docker · understanding image layers","https://docs.docker.com/get-started/docker-concepts/building-images/understanding-image-layers/"],["OCI image-spec · layer whiteouts (pinned)","https://github.com/opencontainers/image-spec/blob/af26a05fba5ee648512f4ea3c9fda1fcc1b6d6dc/layer.md#whiteouts"],["Moby v27.5.1 · archive changes","https://github.com/moby/moby/blob/v27.5.1/pkg/archive/changes.go"],["Docker · RUN best practices","https://docs.docker.com/build/building/best-practices/#run"]],"parts":[{"id":"add","claims":["c-layer","c-example"],"title":["First RUN: the new payload becomes layer data","第一次 RUN：新文件载荷成为层数据"],"text":["Assume a newly created regular file contains 100 MB of uncompressed payload. If it remains when the RUN finishes successfully, that payload is recorded in an image layer in this ordinary unsquashed example.","假设一个新建普通文件含 100 MB 未压缩载荷。在这个普通、未压平的示例中，如果成功结束 RUN 时它仍存在，载荷就会记录进镜像层。"]},{"id":"delete","claims":["c-delete"],"title":["Later RUN: hide the path without rewriting the lower layer","后续 RUN：隐藏路径，不重写旧层"],"text":["The newer changeset represents removal using a whiteout. Applying it hides the lower path in the merged view. The marker itself is not an ordinary visible file there, and the earlier payload remains in its immutable layer.","新差异集用 whiteout 表示删除。应用后，合并视图不再显示下层路径；whiteout 本身也不是其中的普通可见文件。旧载荷仍保留在不可变的原层中。"]},{"id":"same-run","claims":["c-same"],"title":["Same RUN: compare absent before with absent after","同一个 RUN：前后都不存在"],"text":["For a NEW temporary file created and removed inside one RUN, neither endpoint contains that path. Its payload is therefore absent from that resulting diff. Other files or directory metadata can still change.","对于同一个 RUN 内新建再删除的临时文件，前后两个端点都没有这个路径，因此该差异不包含它的载荷。但其他文件或目录元数据仍可能发生变化。"]},{"id":"base","claims":["c-base"],"title":["The counterexample: a file already in the base","反例：基础层里原本就有的文件"],"text":["Deleting a preexisting base-layer file in one RUN still cannot reclaim its lower-layer bytes. Unlike the new temporary file, this path exists in the before snapshot, so deletion must be represented.","如果文件原本就存在于基础层，即使在一个 RUN 中删掉，也不能回收下层字节。它与新临时文件不同：前端点里有这个路径，因此需要记录删除。"]},{"id":"scope","claims":["c-size","c-writable"],"title":["Payload is not image size, and an image is not a running container","载荷不等于镜像大小，镜像层也不等于容器写层"],"text":["100 MB is an assumed payload, not measured download savings. Compression, sharing, cache and image overhead are different quantities. A running container adds its own writable layer; this diagram describes image changesets.","100 MB 是假定载荷，不是实测下载节省量。压缩、共享、缓存和镜像额外开销是不同量。运行中的容器还有独立可写层；这里画的是镜像差异层。"]}],"limit":["Ordinary unsquashed image changesets; 100 MB assumed uncompressed payload. No Docker build was run.","普通、未压平的镜像差异层；100 MB 为假定未压缩载荷。没有执行 Docker 构建。"],"narration":[["Suppose a successful RUN leaves a new file with one hundred megabytes of uncompressed payload. In this ordinary unsquashed example, that payload becomes part of an immutable image layer.",["c-layer","c-example"]],["A later RUN deletes the path. A whiteout hides it in the merged view, but the earlier layer still contains the payload. The whiteout is not an ordinary visible file in that merged view.",["c-delete"]],["Now create and delete a NEW temporary file inside one RUN. The path is absent both before and after, so its payload is not added to that resulting diff. Other changes can still remain.",["c-same"]],["Do not apply that conclusion to a file already in the base layer. Deleting it still cannot rewrite the older layer or reclaim its bytes.",["c-base"]],["The one hundred megabytes is an assumption, not a measured image or download saving. Compression and cache use are different quantities. A running container also has a separate writable layer.",["c-size","c-writable"]]]};
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
        if (part === "add") s.addShape(pptx.ShapeType.line, { x: 6.2, y: 3.58, w: 1.0, h: 1.2, flipV: true, line: { color: C.rose, width: 2.5, endArrowType: "triangle" } });
        else arrow(s, 6.2, 3.58, 1.0);
        tile(s, part === "add" ? "合并视图：/temp 可见" : "合并视图：/temp 不存在", 7.6, 3.15, 4.75, .85, true);
        text(s, part === "add" ? "首个 RUN 结束\n新文件仍然可见" : part === "base" ? "基础层已有的文件\n也不能被后层改写" : "视图中的删除\n不等于抹除旧层字节", 7.8, 4.5, 4.4, .9, 23);
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
})(context, "docker-layers", data); }
