import { createDraft } from '../../src/core/examples.js';
import type { Draft, Teaching, TeachingVisual } from '../../src/core/schema.js';

export const calmConfig = 'mode=calm\n  +slots=2\n';
export const busyConfig = 'mode=busy\n  +slots=4\n';

/** Original synthetic rules and states, never an observed software execution. */
export function createTeachingDraft(): Draft {
  const draft = createDraft('evidence');
  draft.packId = 'synthetic-config-lesson';
  draft.brief.topic = '编辑配置与选定配置';
  draft.brief.question = '编辑之后，选定内容会自动变化吗？';
  draft.brief.explanation = {
    takeaway: '选定配置保留最近一次选择的内容。',
    glossary: [{ term: '选择', meaning: '把当前编辑内容复制到选定配置。' }],
    checkQuestion: '找到最后一次选择，再判断结果。',
    conditions: ['仅讨论本例定义的两个独立文本。'],
  };
  draft.evidence[0] = {
    ...draft.evidence[0]!, title: '合成配置规则', locator: '测试内原创规则',
    summary: '本例定义：选择复制当时的编辑配置；编辑只改变编辑配置；生成结果读取选定配置。',
    url: 'https://example.org/synthetic-config',
  };
  draft.evidence[1] = {
    ...draft.evidence[1]!, title: '合成范围说明', locator: '测试内原创说明',
    summary: '这些状态仅用于测试，没有运行外部软件，也不描述真实系统。',
  };
  draft.claims[0] = {
    ...draft.claims[0]!, text: draft.evidence[0].summary,
    scope: '仅在本测试定义的合成规则内成立。', limitations: ['不是外部系统的观察结果。'],
  };
  draft.claims[1] = {
    ...draft.claims[1]!, text: draft.evidence[1].summary,
    scope: '仅说明本测试的范围。', limitations: ['不提供真实系统证据。'],
  };
  draft.claims[2] = {
    ...draft.claims[2]!, text: '真实系统是否遵循这些规则，尚未研究。',
    scope: '测试之外。', limitations: ['需要真实来源。'],
  };
  const state = (id: string, label: string, editable: string, selected: string): Teaching['states'][number] => ({
    id, label, values: [
      { entityId: 'editable-config', label: editable === calmConfig ? '安静配置' : '忙碌配置', content: editable },
      { entityId: 'selected-config', label: selected === '' ? '尚未选择' : selected === calmConfig ? '安静配置' : '忙碌配置', content: selected },
    ],
  });
  const prediction = (id: string, question: string, right: string, reason: string, wrong: string, correction: string): Teaching['checks'][number] => ({
    id, kind: 'prediction', question,
    choices: [{ id: 'right', text: right, feedback: reason }, { id: 'wrong', text: wrong, feedback: correction }],
    correctChoiceId: 'right', claimIds: ['claim-a'],
  });
  draft.teaching = {
    title: '一次选择，不是持续同步', objective: '区分编辑与选择的作用对象。',
    misconception: '编辑配置会自动改变已选内容。',
    basis: { kind: 'source-example', note: '测试内原创合成规则和状态；不是实际执行记录。', evidenceIds: ['source-a'] },
    entities: [
      { id: 'editable-config', label: '编辑配置', description: '可以继续修改的文本。' },
      { id: 'selected-config', label: '选定配置', description: '最近一次选择留下的文本。' },
    ],
    states: [
      state('initial', '选择之前', calmConfig, ''),
      state('selected', '第一次选择后', calmConfig, calmConfig),
      state('edited', '仅编辑之后', busyConfig, calmConfig),
      state('reselected', '再次选择后', busyConfig, busyConfig),
    ],
    transitions: [
      { id: 'select', from: 'initial', to: 'selected', targetEntityId: 'selected-config', copyFromEntityId: 'editable-config', action: '选择当前配置', command: 'select editableConfig', explanation: '复制此刻的编辑内容，编辑配置不变。', predictionId: 'predict-select', claimIds: ['claim-a'] },
      { id: 'edit', from: 'selected', to: 'edited', targetEntityId: 'editable-config', action: '编辑为忙碌配置', command: 'mode=busy', explanation: '只修改编辑配置，选定内容保持安静配置。', predictionId: 'predict-edit', claimIds: ['claim-a'] },
      { id: 'reselect', from: 'edited', to: 'reselected', targetEntityId: 'selected-config', copyFromEntityId: 'editable-config', action: '再次选择配置', command: 'select editableConfig', explanation: '新的选择用忙碌配置替换选定内容。', predictionId: 'predict-reselect', claimIds: ['claim-a'] },
    ],
    checks: [
      prediction('predict-select', '首次选择会改变哪个文本？', '选定配置得到安静内容', '选择将当前内容写入选定配置。', '编辑配置被清空', '复制不是移动，编辑内容不会被清空。'),
      prediction('predict-edit', '只编辑之后，选定配置是什么？', '仍是安静配置', '尚未再次选择，所以已选内容不变。', '自动变为忙碌配置', '编辑只作用于编辑配置，没有持续同步。'),
      prediction('predict-reselect', '再次选择会留下什么内容？', '忙碌配置', '这次选择读取当前的忙碌内容。', '保留安静配置', '新的选择会替换旧的选定内容。'),
      {
        id: 'transfer', kind: 'transfer', question: '选择 calm，改 busy，选择，再清空编辑配置；选定内容是什么？',
        choices: [
          { id: 'a', text: '空文本', feedback: '清空只作用于编辑配置，没有再次选择。' },
          { id: 'b', text: 'busy', feedback: '最后一次选择读取的是 busy。' },
          { id: 'c', text: 'calm', feedback: '第二次选择已替换最初的 calm。' },
        ], correctChoiceId: 'b', claimIds: ['claim-a'],
      },
    ],
    card: {
      headline: '编辑和选择改变不同对象', summary: '先找操作，再比较内容。',
      transitionIds: ['select', 'edit', 'reselect'], takeaway: '选定内容由最近一次选择决定。', claimIds: ['claim-a'],
    },
    outcome: {
      fromStateId: 'edited', sourceEntityId: 'selected-config', action: '生成结果', label: '结果内容',
      explanation: '按本例规则读取选定配置，不读取最新编辑内容。',
      basis: 'rule-application', claimIds: ['claim-a'],
    },
  };
  const pages: Array<{ id: string; title: string; body: string; scene: NonNullable<Draft['narrative']['slides'][number]['scene']> }> = [
    { id: 'hook', title: '编辑后，为什么内容不同？', body: '编辑配置已经改变；选定配置仍保留原文。', scene: { kind: 'hook', transitionId: 'edit', statePhase: 'after' } },
    { id: 'select', title: '选择读取当时内容', body: '箭头表示一次复制，不是持续连接。', scene: { kind: 'mechanism', transitionId: 'select' } },
    { id: 'edit', title: '编辑只改变一个对象', body: '比较两行变化与保持原样的内容。', scene: { kind: 'transition', transitionId: 'edit' } },
    { id: 'outcome', title: '如果此刻生成结果', body: '结果会读取选定配置中的安静内容。', scene: { kind: 'outcome' } },
    { id: 'reselect', title: '再次选择才更新', body: '这一次选择把忙碌内容写入选定配置。', scene: { kind: 'mechanism', transitionId: 'reselect' } },
    { id: 'transfer', title: '换一个操作序列', body: '最后清空编辑文本，会影响已选内容吗？', scene: { kind: 'transfer', checkId: 'transfer' } },
    { id: 'answer', title: '逐项核对理由', body: '找到最后一次选择发生的时刻。', scene: { kind: 'answer', checkId: 'transfer' } },
    { id: 'takeaway', title: '追踪真正改变的对象', body: '编辑、选择与读取是不同操作。', scene: { kind: 'takeaway' } },
  ];
  draft.narrative.slides = pages.map(page => ({ ...page, notes: page.body, claimIds: ['claim-a'] }));
  return draft;
}

/** Legacy conceptual visuals with deliberately long original Chinese conditions. */
export function createLongReaderDraft(): Draft {
  const draft = createDraft('evidence');
  draft.visibility = 'public';
  draft.brief.explanation!.conditions = [];
  draft.evidence.forEach((source, index) => { source.url = `https://example.org/material-${index}`; });
  const visual = (index: number): TeachingVisual => ({
    layout: index === 4 ? 'steps' : 'cards', title: `对照材料中的两种解释：${index + 1}`,
    items: [
      { label: '车辆数量', body: '车辆增加可能影响候车时间，但仍须比较其他条件。' },
      { label: '乘客数量', body: '乘客减少也可能改变等待时间，不能忽略这一因素。' },
      ...(index === 4 ? [{ label: '独立对照', body: '分别比较每种变化，才能检验不同解释。' }] : []),
    ], claimIds: ['claim-a', 'claim-b'],
  });
  draft.brief.explanation!.visual = visual(0);
  draft.narrative.slides = draft.narrative.slides.slice(0, 5).map((page, index) => ({
    id: page.id, title: `如何阅读不同材料：${index + 1}`,
    body: index === 3 ? '先核对材料中的描述。\n再比较车辆与乘客数量。\n最后说明尚未排除的解释。' : '两种变化可能同时发生；只凭这些材料，还不能断定各自的影响。',
    notes: '测试内原创讲解；不是实际研究结论。', claimIds: ['claim-a', 'claim-b'],
    visual: index === 4 ? {
      ...visual(index),
      items: [
        { label: '核对车辆', body: '读取材料。\n核对数量。\n保留条件。\n不猜原因。' },
        { label: '核对乘客', body: '读取说明。\n比较人数。\n记录变化。\n保留疑问。' },
        { label: '寻找对照', body: '分开因素。\n比较条件。\n补充材料。\n再作判断。' },
      ],
    } : visual(index),
    conditions: index === 2 || index === 3
      ? ['这里仅讨论合成材料中的候车记录，车辆数量与乘客数量可能同时变化；没有额外对照时，不能把单次比较解释为真实场景中的独立因果关系。']
      : [],
  }));
  return draft;
}
