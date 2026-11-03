# 可核对的重试教学模型

[English](README.md) | [简体中文](README.zh-CN.md)

这是原创的**手工教学模型**：一个任务，最多尝试两次。它不是从评估用 worker 或真实服务提取的，两个轨迹都不是真实运行记录。它是开发用输入数据，不是已渲染的作品集交付，也不是强制作品 Schema。

完成源码构建后，从仓库根目录运行：

```powershell
node .\dist\cli\aha.mjs mechanism-check ".\examples\mechanism-retry\model.json" --trace ".\examples\mechanism-retry\trace.json"
node .\dist\cli\aha.mjs mechanism-check ".\examples\mechanism-retry\model.json" --trace ".\examples\mechanism-retry\illegal-trace.json"
```

第一条返回退出码 0／`checked`：启动 → 首次失败 → 重试 → 成功，抵达 `done`。六个状态可达；`over-budget` 是有意不可达的状态。`retry-budget` 规则只在所声明的图中成立。`done` 与 `exhausted` 按设计没有出边。

第二条返回退出码 1／`violated`：前两步合法并抵达 `done`；索引 2 再次 `start`，构成 `ILLEGAL_TRANSITION`。结果保留已接受前缀和每条转换的依据。前缀符合模型不等于任务已完成。

要查看规则反例，可在单独副本中加入 `exhausted` 经 `retry` 到 `over-budget` 的转换，使用新 ID 并注明这是故意违反教学规则的依据。最短反例为五步：启动、失败、重试、失败、重试。`tests/mechanisms.test.ts` 覆盖该变体、漏状态引用、歧义结果、错误轨迹结果、环、有界输入与可重复的 A-B-A 检查。

模型假设事件顺序处理、最多一个活跃尝试；省略时间、请求重叠、清理、取消、退避与外部副作用。遍历不证明恰好一次投递、活性或真实程序正确性；实现中完全未被写入模型的状态也无法被发现。代码推导模型和运行记录声明需要来源／运行引用，但工具不认证声明真假。

结果含模型、哈希、状态、转换、依据及反例，可作为自由编写的文字、图解或控件的数据；不附带固定视觉模板、自动动画或代码提取。执行作者视觉代码仍需单独授权，普通 Node 子进程不是 OS 沙箱。详见[输入／结果契约](../../skills/aha-explain/references/mechanism-checks.md)。
