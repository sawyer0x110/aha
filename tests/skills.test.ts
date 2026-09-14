import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const skillNames = ['aha-research', 'aha-lab', 'aha-story'] as const;
const sharedReferences = ['authoring.md', 'research-codebase.md', 'research-public.md', 'audience.md', 'formats.md'];
type SkillName = typeof skillNames[number];
type Fixture = {
  id: string;
  skill: SkillName;
  priority: 'codebase' | 'public' | 'html' | 'image' | 'pptx' | 'video' | 'audience';
  prompt: string;
  materials: string[];
  references: string[];
  manualChecks: string[];
};

export const benchmarkPromptFixtures: Fixture[] = [
  {
    id: 'dirty-retry-path', skill: 'aha-research', priority: 'codebase',
    prompt: '先研究这个工作区中请求失败后的重试和取消行为。比较指定 base 与当前含未提交改动的版本，先交付可追溯草案，不要制作页面或运行仓库。',
    materials: ['获准读取的版本固定代码库，含 staged、unstaged 和 untracked 改动', '指定 base commit'],
    references: ['research-codebase.md', 'authoring.md'],
    manualChecks: ['固定 diff 两侧和 dirty 文件内容身份', '追踪入口、定义、调用者及错误／重试／取消', '核对测试、配置与相关历史，未执行测试标未观察', '交付主张台账与缺口，明确审阅前不建包'],
  },
  {
    id: 'navigation-fallback', skill: 'aha-lab', priority: 'codebase',
    prompt: '解释这份授权代码为何提前退出。宿主没有 LSP，只允许读取文件；先用窄范围文本证据调查，再判断能否做来源探索，不要安装工具。',
    materials: ['局部代码快照和实际可用工具清单'],
    references: ['research-codebase.md'],
    manualChecks: ['说明导航降级与覆盖范围', '定义和调用点有版本、行范围与真实哈希', '不执行安装或把教学模型当仓库实测'],
  },
  {
    id: 'public-contradiction', skill: 'aha-research', priority: 'public',
    prompt: '这组公开材料声称一种措施显著改善结果。请拆解问题、核对数值口径，追到原始方法并查相反证据；先做研究草案，预算最多八份深入阅读来源。',
    materials: ['公开原始报告', '同源转载两份', '与报告结论不同的独立调查'],
    references: ['research-public.md', 'authoring.md'],
    manualChecks: ['记录精确查询、实际标题、日期、链接和 UTC 获取时间', '实际读引用段落、方法和限制', '不将转载计作独立佐证', '核对单位、时间范围、相关与因果，保留反证与停止理由'],
  },
  {
    id: 'paywall-honesty', skill: 'aha-story', priority: 'public',
    prompt: '想把这篇付费文章做成讲解，但我只提供了标题和一段摘要，宿主无法登录。先告诉我目前到底能研究到什么，不要补写正文。',
    materials: ['文章标题、合法提供的摘要与不可读取正文的 URL'],
    references: ['research-public.md'],
    manualChecks: ['不声称读过全文或虚构事实', '把摘要范围、权限缺口和未解决主张保留下来', '研究审阅先于演示'],
  },
  {
    id: 'offline-html-evidence', skill: 'aha-lab', priority: 'html',
    prompt: '把已审阅的这组对照证据做成离线可探索 HTML。先显示结论和边界，再允许查看依据；主题没有计算引擎，不要造因果滑杆。',
    materials: ['获批 source-based Pack'],
    references: ['formats.md', 'authoring.md'],
    manualChecks: ['保持来源模式与既有事实，直接解释主题而非字段清单', '用具体对照／步骤与有理由的理解题答案帮助学习，来源查阅从属', '离线交互不等于因果实验，必要条件自然保留', '可见页面无受众标签、来源计数、Claim ID／哈希或生产指令', '检查实际文件，区分渲染成功与视觉审阅'],
  },
  {
    id: 'native-image-card', skill: 'aha-story', priority: 'image',
    prompt: '把这个已审阅 Pack 做成一张能分享的中文图片卡片，突出一个结论和限制。不要截图整个 Lab，不允许外部字体或 CDN。',
    materials: ['获批 Pack', '本地浏览器能力清单'],
    references: ['formats.md', 'audience.md'],
    manualChecks: ['专用卡片直接解释概念图示或保存状态，保留单位／依据与自然条件', '不是 Brief 摘抄或制作说明，读者能理解对照并核对答案', '使用实际支持的 PNG 路径，无浏览器则报告阻塞，不承诺图像生成 API', '检查真实图片的裁切和中文，不冒称截图原系统'],
  },
  {
    id: 'editable-presentation', skill: 'aha-story', priority: 'pptx',
    prompt: '用这个批准过的 Pack 做可编辑 PPTX 给工程团队，保留原生文本和形状、失败边界及来源。不要交一组整页截图。',
    materials: ['获批 Pack'],
    references: ['formats.md', 'audience.md'],
    manualChecks: ['使用 render-pptx 而非改扩展名', '从已有 Claims 的主题图示或原生状态适配文本／形状，不截图整页 Lab', '正文直接给最终读者解释和有理由的答案，不展示生产交接或审计字段', '事实、单位和限制与 Pack 一致，实际可编辑性需人工检查'],
  },
  {
    id: 'private-video-signoff', skill: 'aha-story', priority: 'video',
    prompt: '想把这个含私有材料的 Pack 做成带中文语音的视频。我愿意考虑 Edge TTS，但请先完整展示只读计划的旁白、声线与提供方让我审阅，未批准不能外发。',
    materials: ['私有测试 Pack，不含真实敏感信息', '浏览器／FFmpeg／Python 能力清单'],
    references: ['formats.md', 'authoring.md'],
    manualChecks: ['prepare-video 后展示完整旁白、provider／voice／rate、时间安排和时长策略，不只给哈希', '任何计划编辑后 video-plan-check 返回当前哈希和完整旁白，再审批；不发明封存命令', '当前 planHash 审批和网络授权是分离门槛，已选 Edge TTS 不代表后续版本自动获授权', '仅发送已确认旁白而非完整 Pack，离线替代明确 provider=provided-audio 而非 Edge 成功', '使用已有浏览器不自动下载，以实测音频做 pilot／正式版 QC，超出范围不扭曲语速', '旁白与卡片解释主题而非生产流程，审阅信息不印入视频', '报告静态卡片／短淡入淡出的真实能力；缺文件不称视频已生成，未试听不声称完成验收'],
  },
  {
    id: 'manager-known-context', skill: 'aha-story', priority: 'audience',
    prompt: '给熟悉服务运维的管理者解释这份研究结论。重点是需要做的决策、影响与权衡，保留会改变决策的技术条件，不要假设经理不懂技术或编造 ROI。',
    materials: ['同一获批事实集和受众已知背景'],
    references: ['audience.md'],
    manualChecks: ['基于已知背景而非岗位推定知识', '决策与风险 framing 不虚构量化影响', 'takeaway、术语、事实与单位忠实'],
  },
  {
    id: 'engineer-new-domain', skill: 'aha-research', priority: 'audience',
    prompt: '为首次接触此领域的工程师解释研究结果。说明机制、契约和失败路径，但首次出现的领域词要解释；保持同一证据集，不因工程师身份假设全都懂。',
    materials: ['同一获批事实集和受众背景'],
    references: ['audience.md', 'research-codebase.md'],
    manualChecks: ['机制／契约／失败 framing 与真实证据对应', '不推定跨领域知识', '适配不新增事实或删掉关键限制'],
  },
  {
    id: 'adult-bounded-analogy', skill: 'aha-lab', priority: 'audience',
    prompt: '我是成人初学者。请用这个已经查证的机制给我一层层解释，最多一个有边界的类比，再问一个能检验我是否会应用的问题；不要儿童化。',
    materials: ['同一获批事实集'],
    references: ['audience.md'],
    manualChecks: ['一个核心类比写明 limitations', '关键术语准确解释，check question 检验迁移，answer 说明理由而非只复述问题', '保持成人默认，无年龄／角色刻板印象，受众标签不展示给读者', '不把类比或生成文字用作外部证据'],
  },
  {
    id: 'synthetic-reader-explanation', skill: 'aha-lab', priority: 'html',
    prompt: '把已经审阅的合成候车材料做成给普通读者的离线解释页。数据只是教学假设；请用概念对照讲清楚，再给有答案的理解题，不要把选择来源当主要学习活动。',
    materials: ['已审阅合成材料 Claims／Evidence 与 Draft', '明确的比较条件及未解决问题'],
    references: ['authoring.md', 'audience.md', 'formats.md'],
    manualChecks: ['直接解释两种可能原因及具体对照，图示不是生产管线', '保留合成范围及比较条件，不暗示实际调查', 'TeachingVisual 只含普通字符串且 claimIds 引用既有主张，不新增模型或观察', '给有理由的理解题答案，来源为次级入口', '可见成品无受众标签、来源计数、Claim ID／哈希和审计／生产说明'],
  },
  {
    id: 'config-reader-comparison', skill: 'aha-story', priority: 'pptx',
    prompt: '基于这份已审阅的合成配置规则做直接给读者看的 PPTX。用具体对照解释编辑、选择与读取，给一个带理由的理解题答案；不要演示并不存在的实时软件执行。',
    materials: ['同一已审阅合成规则 Claims／Evidence 与规范 Draft', '编辑和选定配置相互独立的明确规则'],
    references: ['authoring.md', 'audience.md', 'formats.md'],
    manualChecks: ['图区分编辑、选择与读取，不暗示持续同步', '保留结果读取选定配置这一关键条件', '直接讲解而非来源计数或作者工作清单，理解题答案说明判断依据', '图示只表达既有主张，不暗示软件执行或观察轨迹', '事实、Claim／Evidence ID 和来源内容身份保持不变'],
  },
  {
    id: 'reviewed-presentation-correction', skill: 'aha-story', priority: 'image',
    prompt: '这份图片里的“为谁讲解”“原解释包讲解要点”和审计信息不该给读者看。现有事实和证据都已审阅且不变，请直接改成有概念对照、条件和理解题答案的成品，保存旧版。',
    materials: ['已审阅 Pack、原 Draft 和图片', '用户明确的仅呈现纠正请求，Claim／Evidence 不变'],
    references: ['authoring.md', 'audience.md', 'formats.md'],
    manualChecks: ['明确请求授权对应本地呈现修订，不重复索要纯 UI／排版批准', '记录原 Pack、修订范围和新 Draft 哈希，写新路径并保留旧输出', '保留 Claim／Evidence ID、事实、单位、模型输入、关键限制和研究台账', '不只去标签，实际编写直接解释、概念对照及有理由的答案', '首次研究／Draft 审阅仍不可跳过，新发现需补证审阅，呈现请求不授权外部 TTS'],
  },
  {
    id: 'evidence-import-preserves-lesson', skill: 'aha-story', priority: 'html',
    prompt: '把这份来源探索记录导回精确原 Pack，再输出讲解页。请保留原本已写好的主题解释、图示和条件；材料选择只是记录，不要替换成让下一位作者继续加工的交接幻灯片。',
    materials: ['精确原 source-based Pack，含已编写 narrative.slides[].visual／conditions', '对应身份的 exploration 与笔记'],
    references: ['authoring.md', 'formats.md'],
    manualChecks: ['核对原 Pack 身份，不手改 hash 绕过', '实际操作讲解选择器、次级来源选择器及浏览器下载，不用 CLI 导出冒充', '来源模式导入保留原 narrative、图示和条件，不制造作者交接页', '选择与原笔记保留在新修订／导入记录，不升级为事实', '主 HTML、卡片及原生 PPTX 使用实际导入的 Pack，产物／回执身份一致，不退回源 Pack', '成品直接解释主题，简洁来源为次级入口，审计信息不在可见画面', '未完成的 PPTX 布局不因 HTML 成功就标为验收通过'],
  },
];

async function markdownFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(target));
    else if (entry.name.endsWith('.md')) files.push(target);
  }
  return files;
}

function relativeLinks(markdown: string): string[] {
  return [...markdown.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)]
    .map(match => match[1]!)
    .filter(link => !/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(link));
}

test('three short independent entrances declare trigger frontmatter and shared research links', async () => {
  for (const name of skillNames) {
    const markdown = await fs.readFile(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    const frontmatter = markdown.match(/^---\r?\n([\s\S]+?)\r?\n---(?:\r?\n|$)/)?.[1];
    assert.ok(frontmatter, `${name}: YAML frontmatter exists`);
    assert.match(frontmatter, new RegExp(`^name: ${name}$`, 'm'));
    assert.match(frontmatter, /^description: .+/m);
    assert.match(frontmatter, /代码|仓库/);
    assert.match(frontmatter, /公开/);
    assert.match(frontmatter, /研究/);
    assert.ok(markdown.split(/\r?\n/).length < 200, `${name}: short entry, details live in references`);
    for (const reference of sharedReferences) {
      assert.ok(relativeLinks(markdown).includes(`references/${reference}`), `${name}: directly links ${reference}`);
    }
  }
});

test('all relative links resolve in each portable skill merged reference layout', async () => {
  const sharedRoot = path.join(root, 'skills', 'shared', 'references');
  for (const name of skillNames) {
    const ownRoot = path.join(root, 'skills', name);
    const published = new Map<string, string>();
    for (const file of await markdownFiles(ownRoot)) {
      published.set(path.relative(ownRoot, file), file);
    }
    for (const file of await markdownFiles(sharedRoot)) {
      published.set(path.join('references', path.relative(sharedRoot, file)), file);
    }
    for (const [relative, file] of published) {
      for (const link of relativeLinks(await fs.readFile(file, 'utf8'))) {
        const destination = path.normalize(path.join(path.dirname(relative), decodeURIComponent(link.split('#')[0]!)));
        assert.ok(published.has(destination), `${name}/${relative}: unresolved portable link ${link}`);
      }
    }
  }
});

test('each independent entrance declares reader delivery and narrow revision approval boundaries', async () => {
  for (const name of skillNames) {
    const markdown = await fs.readFile(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    for (const required of [
      '最终读者', '受众是内部编写输入', '概念对照／步骤', '有理由的理解题答案',
      '来源计数', 'Claim ID', '哈希', '研究台账', '回执', '来源元数据', '来源查阅是次级入口',
      '首次构建前', '事实／证据不变', '新 Draft 哈希', '保留旧输出',
      '不为纯 UI／排版另造审批循环',
    ]) {
      assert.ok(markdown.includes(required), `${name}: missing written contract ${required}`);
    }
    assert.match(markdown, /图示解释主题而非制作管线|图示解释主题而不是制作管线/);
    assert.match(markdown, /新模型或观察轨迹|新模型、执行代码或观察轨迹/);
    assert.match(markdown, /provider.*voice.*rate.*时间安排.*planHash/);
    assert.match(markdown, /新发现.*补证.*审阅|新增事实.*补证.*审阅/);
    assert.match(markdown, /新旁白.*外发/);
  }
});

test('shared authoring reference specifies TeachingVisual strings, bounds and identity preservation', async () => {
  const markdown = await fs.readFile(path.join(root, 'skills', 'shared', 'references', 'authoring.md'), 'utf8');
  for (const field of [
    'brief.explanation.visual', 'brief.explanation.conditions', 'brief.explanation.answer',
    'narrative.slides[].visual', 'narrative.slides[].conditions',
  ]) {
    assert.ok(markdown.includes(field), `authoring: missing ${field}`);
  }
  assert.match(markdown, /导出的 `TeachingVisual`/);
  assert.match(markdown, /`layout`.*`"cards"`.*`"steps"`/);
  assert.match(markdown, /`title`.*80 字符/);
  assert.match(markdown, /`items`.*2–4.*label.*body.*40 字符.*160 字符/);
  assert.match(markdown, /`claimIds`.*非空.*现有 Claims/);
  assert.match(markdown, /最多 6 条.*180 字符/);
  assert.match(markdown, /最多 400 字符/);
  assert.match(markdown, /所有文本都是普通字符串，不是 HTML、脚本或可执行代码/);
  assert.match(markdown, /不是新模型、新证据或观察轨迹/);
  assert.match(markdown, /保持 Claim／Evidence ID、来源内容身份和研究台账不变/);
  assert.match(markdown, /来源模式导入保留已编写的 `narrative`/);
  assert.match(markdown, /不能宣称已有自动语义审计/);
});

test('shared reader references require actual teaching, natural limits and secondary source lookup', async () => {
  for (const name of ['audience.md', 'formats.md']) {
    const markdown = await fs.readFile(path.join(root, 'skills', 'shared', 'references', name), 'utf8');
    for (const required of ['最终读者', '不是主要学习活动', 'Claim ID', '哈希', '答案']) {
      assert.ok(markdown.includes(required), `${name}: missing reader contract ${required}`);
    }
    assert.match(markdown, /普通字符串/);
    assert.match(markdown, /不是新模型|新模型或观察轨迹/);
    assert.match(markdown, /事实条件/);
    assert.match(markdown, /制作管线/);
    assert.match(markdown, /planHash/);
  }
});

test('imported-delivery references require actual revision identity and browser interaction checks', async () => {
  for (const relative of [
    ['shared', 'references', 'authoring.md'],
    ['shared', 'references', 'formats.md'],
    ['aha-story', 'references', 'story-workflow.md'],
    ['aha-lab', 'references', 'lab-workflow.md'],
  ]) {
    const markdown = await fs.readFile(path.join(root, 'skills', ...relative), 'utf8');
    assert.match(markdown, /实际导入的 Pack/, `${relative.join('/')}: imported revision is the renderer input`);
    assert.match(markdown, /源 Pack/, `${relative.join('/')}: warns against rendering the source instead`);
  }
  const workflow = await fs.readFile(path.join(root, 'skills', 'aha-lab', 'references', 'lab-workflow.md'), 'utf8');
  for (const required of ['讲解选择器', '次级来源选择器', '浏览器下载', '不能替代浏览器下载验收']) {
    assert.ok(workflow.includes(required), `lab workflow: missing manual check ${required}`);
  }
});

test('written contract separates native PPTX audit notes from Pack narration used by TTS', async () => {
  for (const relative of [
    ['skills', 'shared', 'references', 'authoring.md'],
    ['skills', 'shared', 'references', 'audience.md'],
    ['skills', 'shared', 'references', 'formats.md'],
    ['skills', 'aha-story', 'SKILL.md'],
    ['skills', 'aha-story', 'references', 'story-workflow.md'],
    ['README.md'],
    ['docs', 'RESEARCH.md'],
  ]) {
    const file = path.join(root, ...relative);
    const markdown = await fs.readFile(file, 'utf8');
    assert.match(markdown, /narrative\.slides\[\]\.notes/, `${file}: identifies the Pack narration field`);
    assert.match(markdown, /原生 PPTX 审计备注与内嵌 Pack/, `${file}: retains native audit storage`);
    assert.match(markdown, /完整来源身份和研究元数据/, `${file}: retains audit provenance`);
    assert.match(markdown, /原生 PPTX 审计备注不会送入 TTS|不(?:使用|读取)原生 PPTX 审计备注/, `${file}: audit notes are not TTS input`);
  }
});

test('research and adoption documentation exists with resolvable local references', async () => {
  for (const name of ['RESEARCH.md', 'REFERENCE-ADOPTION.md']) {
    const file = path.join(root, 'docs', name);
    const markdown = await fs.readFile(file, 'utf8');
    assert.match(markdown, /^# .+/);
    for (const link of relativeLinks(markdown)) {
      const destination = path.resolve(path.dirname(file), decodeURIComponent(link.split('#')[0]!));
      assert.ok((await fs.stat(destination)).isFile(), `${name}: missing ${link}`);
    }
  }
});

test('original benchmark prompts have complete manual rubrics; no host semantics are executed', async () => {
  const ids = new Set<string>();
  const priorities = new Set<string>();
  for (const fixture of benchmarkPromptFixtures) {
    assert.match(fixture.id, /^[a-z][a-z0-9-]+$/);
    assert.ok(!ids.has(fixture.id), `duplicate fixture ${fixture.id}`);
    ids.add(fixture.id);
    assert.ok(skillNames.includes(fixture.skill));
    assert.ok(fixture.prompt.length >= 30);
    assert.ok(fixture.materials.length > 0 && fixture.materials.every(item => item.trim().length > 0));
    assert.ok(fixture.manualChecks.length >= 3 && fixture.manualChecks.every(item => item.trim().length > 0));
    assert.ok(fixture.references.length > 0);
    for (const reference of fixture.references) {
      assert.ok(sharedReferences.includes(reference), `${fixture.id}: unknown reference`);
      assert.ok((await fs.stat(path.join(root, 'skills', 'shared', 'references', reference))).isFile());
    }
    priorities.add(fixture.priority);
  }
  assert.deepEqual([...priorities].sort(), ['audience', 'codebase', 'html', 'image', 'pptx', 'public', 'video']);
  const researchDoc = await fs.readFile(path.join(root, 'docs', 'RESEARCH.md'), 'utf8');
  assert.match(researchDoc, /人工语义评估/);
  assert.match(researchDoc, /静态结构测试/);
  assert.match(researchDoc, /不是已实现的自动语义审计/);
  for (const id of [
    'synthetic-reader-explanation', 'config-reader-comparison',
    'reviewed-presentation-correction', 'evidence-import-preserves-lesson',
  ]) {
    assert.ok(ids.has(id), `missing reader-delivery manual fixture ${id}`);
  }
});
