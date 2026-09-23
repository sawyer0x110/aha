# 一个码点为什么会让 CPython 字符串变宽？

在这个紧凑 CPython 字符串示例中，新结果的所有码点槽使用同一存储宽度。加入 U+1F600 后，连原有 ASCII 前缀也使用四字节槽；UTF-8 则是另一种表示方式。

## 当前作品

[双语 HTML](cpython-string.html) · [英文 PNG · 1800×1600](cpython-string.png) · [中文原生 PPTX · 7 页](cpython-string.pptx) · [英文配音视频 · 63.23 秒](cpython-string.mp4) · [字幕](cpython-string.mp4.srt)

四种格式本轮重新创作；封存[研究报告](research/report.md)沿用原来源、版本与缺口，不冒充重新研究或实测。CPython 3.11.15 紧凑字符串示例；大小来自既有记录，未重新测量；槽位示意不按实际数量绘制。

## 源码与证据

[HTML 源码](projects/html/) · [PNG 源码](projects/image/) · [PPTX 源码](projects/pptx/) · [视频源码](projects/video/)

[当前 QA](qa/)按格式分开保存。唯一收录索引是[统一交付清单](../delivery-manifest.json)。新英文旁白经批准由 Edge TTS / Jenny 合成；字幕布局修正后，以新的已批准计划离线导入相同 WAV，不是再次合成。[录音来源](audio/provenance.json)保留对应身份。

PNG 按至少 1200px 宽阅读。已检查双语交互、图片阅读尺寸、PowerPoint 导出与副本编辑，以及视频解码、静音播放和抽样画面；没有实际听审或真人理解验收。PPTX 仍有局部标点换行等小问题，详见各格式 QA。第三方资料、配音和字体权利不由仓库 MIT 许可替代。
