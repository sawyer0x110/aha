# Why can one emoji nearly quadruple a CPython string?

[观看 21.47 秒机制试片](pilot.mp4) · [英文字幕](pilot.mp4.srt) · [英文研究报告](research/report.md) · [返回作品入口](../index.html)

本例仅提供英文配音视频试片：1280×720、30 fps、H.264/AAC，644 帧。六个示意字符槽代表十万个 ASCII 码点；加入 U+1F600 后，新字符串的全部码点使用四字节存储，再与 UTF-8 编码只增加四字节对照。

## 机制与边界

研究固定 CPython v3.11.15（`2340a037f7450e70fccfe411e6531afb4d57a312`），阅读 PEP 393、`PyUnicode_Concat`、`PyUnicode_New` 和相关头文件。已有本地 CPython 3.11.15 观察使用 `sys.getsizeof(str)`：十万个 `a` 占 100,049 字节，追加 U+1F600 的新字符串占 400,080 字节；对应 UTF-8 载荷为 100,000 和 100,004 字节。

这是特定 CPython 字符串对象的大小，不是进程内存、文件大小或所有 Python 实现的保证，也不是任何 emoji 都会触发的四倍规律。动画示意新结果的存储表示，**不是原不可变字符串被原地扩容，也不是实际分配器轨迹**。小字符串、已有宽字符和其他构建的比例可能不同。

## 当前文件与来源

- `pilot.mp4`、`.mp4.json`、`.mp4.srt`：试片、原始收据和字幕，保留渲染文件名及字节。
- `projects/video/`：可编辑 HTML/SVG 场景及绑定研究副本；不是独立 HTML 成品。
- `research/`、`video-plan.json`、`audio/`：封存研究、当前完整旁白计划和直接 Edge TTS 配音。没有虚构的音频导入来源。
- [本轮收录与验收](../../evals/examples/code-pilots-20260917/publication.json)：保留精确授权、预览、编码帧和明确的审阅缺口。历史工作路径不代表本目录的实时路径。

配音使用 `en-US-AriaNeural`、`+0%`；只外发了批准的旁白及必要声音参数。图形为自行绘制的 SVG，无下载字体或外部视觉库。

## 验收与复现

完整解码、批准字幕文字及时间、抽样状态与 A→B→A 重放、文字边界已检查。部分静帧读取失败，视觉覆盖不完整；**用户要求收录不等于连续听看或理解验收**。所有未完成项保留在验收记录中。

`npm run examples:verify` 检查当前作品身份，不执行场景代码。审阅源码并获得本地执行许可后，可使用已有录音离线输出到新目录：

```powershell
node .\dist\skills\aha-explain\scripts\aha.mjs render-video .\examples\cpython-string\projects\video .\examples\cpython-string\video-plan.json .\examples\cpython-string\audio .\artifacts\cpython-rebuild\pilot.mp4 --approve 9a87e23140f1144e06a4258a34d35aa595dcdf84441181bf074b8c7255962289 --allow-code
```

参数不替代权限；修改源码或旁白后须重新准备计划并取得相应批准，不能手改身份复用音频。
