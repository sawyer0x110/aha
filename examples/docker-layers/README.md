# 文件删了，Docker 旧层的字节为什么还在？

后续删除改变的是合并文件系统视图，不是不可变的旧层。在同一个 RUN 中创建再删除新的临时文件则不同：生成差异时，这个路径在前后两个端点都不存在。

## 当前作品

[双语 HTML](docker-layers.html) · [英文 PNG · 1800×1600](docker-layers.png) · [中文原生 PPTX · 7 页](docker-layers.pptx) · [英文配音视频 · 58.30 秒](docker-layers.mp4) · [字幕](docker-layers.mp4.srt)

四种格式本轮重新创作；封存[研究报告](research/report.md)沿用原来源、版本与缺口，不冒充重新研究或实测。普通、未压平的镜像差异层；100 MB 为假定未压缩载荷。没有执行 Docker 构建。

## 源码与证据

[HTML 源码](projects/html/) · [PNG 源码](projects/image/) · [PPTX 源码](projects/pptx/) · [视频源码](projects/video/)

[当前 QA](qa/)按格式分开保存。唯一收录索引是[统一交付清单](../delivery-manifest.json)。新英文旁白经批准由 Edge TTS / Jenny 合成；字幕布局修正后，以新的已批准计划离线导入相同 WAV，不是再次合成。[录音来源](audio/provenance.json)保留对应身份。

PNG 按至少 1200px 宽阅读。已检查双语交互、图片阅读尺寸、PowerPoint 导出与副本编辑，以及视频解码、静音播放和抽样画面；没有实际听审或真人理解验收。PPTX 仍有局部标点换行等小问题，详见各格式 QA。第三方资料、配音和字体权利不由仓库 MIT 许可替代。
