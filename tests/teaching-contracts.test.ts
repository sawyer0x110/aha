import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { NarrativeSchema, TeachingSchema, TeachingSceneSchema } from '../src/core/schema.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (relative: string) => readFile(path.join(root, ...relative.split('/')), 'utf8');
const shared = (name: string) => read(`skills/shared/references/${name}.md`);

function includesAll(text: string, phrases: string[]): void {
  for (const phrase of phrases) assert.ok(text.includes(phrase), `Missing written contract: ${phrase}`);
}

test('teaching contracts: independent short entrances link design and revision, not semantic proof', async () => {
  for (const skill of ['aha-research', 'aha-lab', 'aha-story']) {
    const text = await read(`skills/${skill}/SKILL.md`);
    assert.ok(text.split(/\r?\n/).length < 200);
    includesAll(text, [
      'references/teaching-design.md', 'references/quality-loop.md', 'references/formats.md',
      '先备知识', 'teaching', '1–12', 'pilot', '截图', '颜色编码', 'delta', '关系',
      '焦点', '可读性', '媒介适配', '返回设计层', '实际回答',
      'artifacts', '不静默覆盖用户文件',
    ]);
    assert.doesNotMatch(text, /每阶段.{0,12}最多两轮局部修复/);
  }
  includesAll(await read('skills/aha-research/SKILL.md'), ['独立研究可止于台账与结论']);
});

test('teaching contract documents optional schema bounds and retained legacy route', async () => {
  const text = await shared('teaching-design');
  const bounds = [
    ['entities', 2, 3], ['states', 2, 7], ['transitions', 1, 6],
    ['checks', 2, 8],
  ] as const;
  for (const [name, minimum, maximum] of bounds) {
    assert.equal(TeachingSchema.properties[name].minItems, minimum);
    assert.equal(TeachingSchema.properties[name].maxItems, maximum);
    assert.ok(text.includes(`\`${name}\` | ${name === 'states' ? '按发生顺序列出 ' : ''}${minimum}–${maximum}`));
  }
  assert.equal(NarrativeSchema.properties.slides.minItems, 1);
  assert.equal(NarrativeSchema.properties.slides.maxItems, 12);
  includesAll(text, [
    '旧 Draft／Pack', 'TeachingVisual', '数值引擎', '有来源支持的状态变化',
    'title', 'objective', 'misconception', 'recorded-example', 'source-example',
    'contentHash', 'evidenceIds', '恰好改变一个 targetEntityId', 'copyFromEntityId',
    'predictionId', 'correctChoiceId', 'feedback', 'claimIds',
    'headline', 'summary', 'transitionIds', 'takeaway',
    'hook', 'transition', 'mechanism', 'transfer', 'takeaway',
    '不是 HTML、脚本或可执行代码', '1–4 个案例、组成 5–8 页',
  ]);
});

test('teaching contract requires content-level design and genuinely new task instructions', async () => {
  includesAll(await shared('teaching-design'), [
    '来源事实不是脚本', '同一事实集不等于同一布局', '误解与先备知识',
    '体验后归纳', '新情境迁移', '未变',
  ]);
});

test('outcome and answer API contracts match schema without claiming observed execution', async () => {
  const outcome = TeachingSchema.properties.outcome;
  assert.ok(!TeachingSchema.required?.includes('outcome'));
  assert.deepEqual(Object.keys(outcome.properties).sort(), [
    'action', 'basis', 'claimIds', 'explanation', 'fromStateId', 'label', 'sourceEntityId',
  ]);
  assert.equal(outcome.properties.basis.const, 'rule-application');
  assert.equal(outcome.properties.action.maxLength, 100);
  assert.equal(outcome.properties.label.maxLength, 80);
  assert.equal(outcome.properties.explanation.maxLength, 240);
  const sceneKinds = TeachingSceneSchema.properties.kind.anyOf.map(kind => kind.const);
  assert.ok(sceneKinds.includes('outcome'));
  assert.ok(sceneKinds.includes('answer'));
  assert.deepEqual(TeachingSceneSchema.properties.statePhase.anyOf.map(phase => phase.const), ['before', 'after']);
  includesAll(await shared('teaching-design'), [
    'fromStateId', 'sourceEntityId', '100／80／240', 'rule-application',
    'teachingOutcome', '不是观察到的执行', '其他 scene 不允许 statePhase',
    '按作者填写的 statePhase 渲染', '不硬编码为 after',
    '`transfer`／`answer`', '`outcome`／`takeaway` 不带 transitionId 或 checkId',
    'outcome.claimIds', 'check.claimIds', '已经批准的规则', '保留状态',
  ]);
  includesAll(await shared('authoring'), [
    'teaching.outcome', 'rule-application', 'teachingOutcome', 'statePhase',
    'transfer／answer', '不是 observed 执行',
  ]);
});

test('actual artifact gates require tense continuity untouched code and a separate explained answer', async () => {
  includesAll(await shared('teaching-design'), [
    '叙事时态与所示状态一致', '跨页实体位置与箭头含义稳定',
    '不向实际代码／content 添加', '原内容已有的字符必须保留',
    '实际相邻的两页', '同一 checkId', '每个错误选项的理由', '不能用空 notes',
  ]);
  includesAll(await shared('quality-loop'), [
    '实际相邻页', 'before', 'after', '同一实体位置／顺序是否稳定',
    '同一种箭头是否始终表达同一关系', '保留内容逐字核对',
    '没有添加 `+`、`>`、星号等字符或删除原有字符',
    '下一页才显示正确答案', '每个错误选项的理由',
    '同样是阻塞项', '不能因结构测试通过而豁免',
  ]);
});

test('medium and quality contracts require inspect revise regenerate without claiming comprehension', async () => {
  includesAll(await shared('formats'), [
    '一个视觉论证', '预测 → 揭示 → 具体反馈', '记录状态回放',
    'hook', 'transition', 'mechanism', 'transfer', 'takeaway',
    '原生 PPTX', '另做分镜', '旁白解释什么', '不是把卡片全文朗读',
  ]);
  includesAll(await shared('quality-loop'), [
    '代表性 pilot', '实际文件', '颜色编码', 'delta', '关系', '焦点与可读性',
    '媒介适配', '观察到的回答', '学习任务未测', '不是人类理解测试',
    '0＝错误或无理由', '1＝结果对但机制／条件不完整', '2＝结果、理由和必要条件正确',
    '不手改最终 HTML／PPTX', '两次局部修补', '返回设计层',
    '没有任意硬性全局通过轮数', '真实阻塞',
    '不修改封存 Pack', '不静默覆盖用户文件', '可回滚归档',
  ]);
});

test('adoption distinguishes historical audit from latest supplied references and heuristic review', async () => {
  includesAll(await read('docs/REFERENCE-ADOPTION.md'), [
    '未重新执行来源／许可证审计',
    '5b57239578284385c72ebfb2d1fce3ab61a3950a/reference/narration-guidance.md',
    '6e3ce9c5a3b994a0e223a14a0f7eddf42fd0b9f5/skills/ppt-master/references/plan-core.md',
    '历史早期卡片', '这不是当前交付契约', 'LLM', '不是人类学习研究',
  ]);
  for (const file of ['README.md']) {
    includesAll(await read(file), ['teaching-contracts.test.ts', '不是语义证明', '实际回答']);
  }
});
