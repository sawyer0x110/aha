import { buildPack } from './pack.js';
import { type Draft, type Engine, type Pack, type Scenario } from './schema.js';

export function createDraft(engine: Engine): Draft {
  const question = engine === 'retry' ? '为什么有些失败会重试，有些会立即停止？'
    : engine === 'compound' ? '相同收益率换一个顺序，最终金额一定不同吗？'
      : '两段不同的材料，是否足以证明同一个结论？';
  const assumptions = engine === 'retry'
    ? ['确定性教学模型，不执行任何仓库代码。', '最大重试次数不包含首次尝试；错误类别和结果序列由输入明确提供。', '等待是逻辑时间，指数退避受最大延迟限制，不代表真实耗时。']
    : engine === 'compound'
      ? ['收益率以百分数输入，现金流时点明确为期初或期末。', '采用精确有理数计算，不做逐期舍入；显示到两位小数，四舍五入。', '无费用、税收或随机市场过程；不是投资建议。']
      : ['以下两段材料是原创合成示例，不是真实研究或调查。', '材料之间的差异不是因果证据；选择来源只改变阅读范围。'];
  const scenarios: Scenario[] = engine === 'retry'
    ? [
      {
        id: 'baseline', title: '两次可重试失败后成功', mode: 'derived-model', claimIds: ['rule'],
        input: {
          maxRetries: 2, baseDelayMs: 250, multiplier: 2, maxDelayMs: 60000,
          outcomes: ['transient', 'transient', 'success'], retryableErrors: ['transient'],
        },
      },
      {
        id: 'comparison', title: '同样错误，但不允许重试', mode: 'derived-model', claimIds: ['rule'],
        input: {
          maxRetries: 0, baseDelayMs: 250, multiplier: 2, maxDelayMs: 60000,
          outcomes: ['transient', 'transient', 'success'], retryableErrors: ['transient'],
        },
      },
    ]
    : engine === 'compound'
      ? [
        {
          id: 'baseline', title: '先涨后跌，第一期末追加现金', mode: 'derived-model', claimIds: ['rule'],
          input: { principal: '10000', rates: ['10', '-10'], cashflows: ['1000', '0'], timing: 'end' },
        },
        {
          id: 'comparison', title: '先跌后涨，同一时点追加现金', mode: 'derived-model', claimIds: ['rule'],
          input: { principal: '10000', rates: ['-10', '10'], cashflows: ['1000', '0'], timing: 'end' },
        },
      ]
      : [
        {
          id: 'baseline', title: '只阅读材料 A', mode: 'source-based', claimIds: ['claim-a'],
          input: { evidenceIds: ['source-a'] },
        },
        {
          id: 'comparison', title: '并列阅读材料 A 与 B', mode: 'source-based', claimIds: ['claim-a', 'claim-b', 'unknown'],
          input: { evidenceIds: ['source-a', 'source-b'] },
        },
      ];
  const draft: Draft = {
    schemaVersion: '0.1.0', packId: `${engine}-example`, visibility: 'private',
    brief: {
      topic: engine === 'retry' ? '确定性重试' : engine === 'compound' ? '复利与现金流' : '证据与观点比较',
      question, audience: '成人初学者', language: 'zh-CN', prerequisites: [],
      scope: ['单主题、可复核的教学示例；正式使用前替换为自己的问题和依据。'],
      exclusions: engine === 'evidence'
        ? ['不推断因果，不把合成材料当作真实世界事实。']
        : ['不执行外部代码，不证明真实系统或未来世界一定如此。'],
      explanation: engine === 'compound' ? {
        takeaway: '现金流介入后，收益率的先后顺序可能改变最终金额。',
        analogy: { text: '像不同时间加入的新队员：入队之后，才参与后面的比赛。', limitations: '只类比参与时点，不代表投资收益可预测或风险可忽略。' },
        glossary: [{ term: '现金流', meaning: '本期额外投入或取出的金额。' }, { term: '复利', meaning: '本期收益进入余额，参与后续计算。' }],
        checkQuestion: '把两期现金流都改为零，交换收益率顺序还会改变最终金额吗？',
      } : engine === 'retry' ? {
        takeaway: '失败是否重试，要同时看错误类别和剩余重试次数。',
        analogy: { text: '像打电话未接通：允许再拨，也仍受最多拨几次的限制。', limitations: '真实电话行为不等于代码协议；模型等待不是真实耗时。' },
        glossary: [{ term: '重试', meaning: '首次尝试失败后，再发起一次尝试。' }, { term: '退避', meaning: '后续尝试前，按规则增加计划等待。' }],
        checkQuestion: '把最大重试次数设为零，是不能尝试，还是只允许首次尝试？',
      } : {
        takeaway: '材料能支持各自的说法，不代表已经排除了其他解释。',
        analogy: { text: '像两位目击者提供不同视角，拼在一起也可能缺少关键背景。', limitations: '本例是合成材料，不是真实证言或独立因果证明。' },
        glossary: [{ term: '来源声称', meaning: '材料自身报告的说法，仍需核对。' }, { term: '因果', meaning: '某因素确实造成变化，而不只是同时出现。' }],
        checkQuestion: '要区分车辆数量和客流的影响，还缺少哪类对照？',
      },
    },
    modelSpec: { engine, version: '1.0.0', assumptions, evidenceIds: engine === 'evidence' ? ['source-a', 'source-b'] : ['rules'] },
    evidence: engine === 'evidence'
      ? [
        {
          id: 'source-a', kind: 'document', title: '合成材料 A：候车记录',
          locator: '本示例内原创材料，第一段', sourceVersion: 'synthetic-1',
          summary: '材料 A 声称：某个示例车站在周一增派车辆后，记录的候车时间较短。未控制天气和乘客数量。',
        },
        {
          id: 'source-b', kind: 'document', title: '合成材料 B：客流说明',
          locator: '本示例内原创材料，第二段', sourceVersion: 'synthetic-1',
          summary: '材料 B 声称：同一天乘客人数也减少。现有材料不能分离车辆数量和客流的影响。',
        },
      ]
      : [{
        id: 'rules', kind: 'model-spec', title: 'Aha 内置教学模型规则',
        locator: `内置 ${engine} 引擎 1.0.0；参见随 Skill 附带的模型参考`,
        sourceVersion: 'builtin-model-1.0.0', summary: assumptions.join(' '),
      }],
    claims: engine === 'evidence'
      ? [
        { id: 'claim-a', type: 'source-claim', text: '材料 A 报告候车时间缩短。', scope: '仅复述合成材料，不是独立观察。', evidenceIds: ['source-a'], assumptions: [], limitations: ['未控制其他条件。'] },
        { id: 'claim-b', type: 'source-claim', text: '材料 B 提出了客流减少这一不同解释。', scope: '仅复述合成材料。', evidenceIds: ['source-b'], assumptions: [], limitations: ['不能量化各因素贡献。'] },
        { id: 'unknown', type: 'unresolved', text: '车辆增加是否独立造成候车时间缩短，尚不能确定。', scope: '现有合成材料范围内。', evidenceIds: ['source-a', 'source-b'], assumptions: [], limitations: ['需要额外对照材料。'] },
      ]
      : [{
        id: 'rule', type: 'model-result',
        text: engine === 'retry'
          ? '在这个模型中，是否继续尝试由错误类别和剩余重试预算共同决定。'
          : '无现金流且不逐期舍入时，仅交换同一组收益率不改变最终金额；有中途现金流时可能不同。',
        scope: '仅在明确的内置模型与输入域下成立。',
        evidenceIds: ['rules'], assumptions, limitations: ['模型规则不是对外部系统或现实效果的独立证明。'],
      }],
    scenarios,
    narrative: {
      version: 1,
      slides: [
        { id: 'question', title: question, body: '先明确问题的前提，再观察一个最小案例。', notes: '这是教学模板，不是自动研究生成的事实。', claimIds: [] },
        { id: 'model', title: engine === 'evidence' ? '材料能够说明什么' : '先说清规则和假设', body: assumptions.join('；'), notes: '', claimIds: [] },
        { id: 'baseline', title: scenarios[0]!.title, body: '以下状态来自当前解释包中保存的同一个案例。', notes: '请先预测，再观察结果。', claimIds: scenarios[0]!.claimIds, scenarioId: 'baseline' },
        { id: 'comparison', title: scenarios[1]!.title, body: '比较输入差异，不能只看结果数字。', notes: '', claimIds: scenarios[1]!.claimIds, scenarioId: 'comparison' },
        { id: 'boundary', title: '解释的边界', body: '展示结果不等于证明现实世界因果关系；模型和材料均有明确适用范围。', notes: '', claimIds: [] },
        { id: 'sources', title: '回到依据，继续探索', body: '检查规则、材料定位与未解决问题，再尝试新的合法案例。', notes: '', claimIds: engine === 'evidence' ? ['claim-a', 'claim-b', 'unknown'] : ['rule'] },
      ],
    },
  };
  if (engine === 'compound') {
    const notes = [
      '相同收益率换一个顺序，最终金额一定不同吗？这是一个可复核的教学模型，不是投资建议。',
      '这里明确每期收益率、追加金额和追加时点。内部精确计算，只在展示时保留两位小数。',
      '先对本金计息，再加入第一期末追加的现金。第二期对新的余额计息。请先预测结果。',
      '现在只交换两期收益率，追加金额和追加时点都不变。差异来自新增现金参与了不同的后续收益。',
      '如果没有中途现金流，也不逐期舍入，仅交换同一组收益率不会改变最终金额。这里没有模拟税费或随机市场。',
      '请把两期现金流都改为零，比较结果，再用自己的话解释什么时候顺序重要。依据和假设都保留在解释包里。',
    ];
    draft.narrative.slides.forEach((slide, index) => { slide.notes = notes[index]!; });
  }
  return draft;
}

export async function createExample(engine: Engine): Promise<Pack> {
  return buildPack(createDraft(engine));
}
