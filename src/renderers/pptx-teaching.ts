import PptxGenJS from 'pptxgenjs';
import { fail } from '../core/errors.js';
import type { Narrative, Teaching, TeachingCheck } from '../core/schema.js';
import { teachingCheck, teachingOutcome, transitionContext } from '../core/teaching.js';

const Presentation = 'default' in PptxGenJS ? PptxGenJS.default : PptxGenJS;
type Deck = InstanceType<typeof Presentation>;
type Slide = ReturnType<Deck['addSlide']>;
type Box = { x: number; y: number; w: number; h: number };
type TextOptions = NonNullable<Parameters<Slide['addText']>[1]>;
type Typography = {
  text(slide: Slide, value: string, box: Box, path: string, options: TextOptions): void;
  height(value: string, width: number, size: number): number;
  limit(message: string, path: string): never;
};
const C = {
  ink: '242424', muted: '5C5C5C', rose: 'B11F4B', soft: 'F6E7EC',
  white: 'FFFFFF', line: 'B7AEA5', cream: 'F7F4EF', sage: 'E8EDE5',
};

/**
 * Native, editable state-teaching scenes. Geometry is checked at the existing
 * readable font floor; oversized authored content fails rather than shrinking.
 * Code uses exact logical lines, with changed-line markers separate from content.
 */
export function renderTeachingScene(
  deck: Deck, slide: Slide, teaching: Teaching, page: Narrative['slides'][number],
  area: Box, path: string, typography: Typography,
): void {
  const { height, limit } = typography;
  const scene = page.scene!;
  const say = (value: string, box: Box, name: string, size = 20, extra: TextOptions = {}) => {
    if (box.y < area.y - 0.002 || box.y + box.h > area.y + area.h + 0.002) {
      limit(`Teaching ${scene.kind} exceeds its content area by ${(box.y + box.h - area.y - area.h).toFixed(2)}in. Shorten ${name}.`, `${path}/scene`);
    }
    typography.text(slide, value, box, `${path}/scene/${name}`, {
      fontSize: size, color: C.ink, objectName: `Aha teaching ${name}`, ...extra,
    });
  };
  const shape = (box: Box, name: string, fill = C.white, outline?: 'changed' | 'frozen') => {
    if (box.w <= 0 || box.h <= 0) limit('Teaching panel has no readable space.', `${path}/scene`);
    slide.addShape(outline === 'changed' ? deck.ShapeType.rect : deck.ShapeType.roundRect, {
      ...box, rectRadius: 0.12, objectName: `Aha teaching ${name}`,
      fill: { color: fill }, line: {
        color: outline === 'changed' ? C.rose : C.line,
        width: outline === 'changed' ? 2.4 : 1,
        ...(outline === 'frozen' ? { dashType: 'dash' as const } : {}),
        ...(!outline ? { transparency: 100 } : {}),
      },
    });
  };
  const arrow = (x: number, y: number, w: number, name: string, reverse = false, hypothetical = false) => {
    slide.addShape(deck.ShapeType.line, {
      x, y, w, h: 0, objectName: `Aha teaching action arrow ${name}`,
      line: {
        color: C.rose, width: 2.5, beginArrowType: reverse ? 'triangle' : 'none', endArrowType: reverse ? 'none' : 'triangle',
        ...(hypothetical ? { dashType: 'dash' as const } : {}),
      },
    });
  };
  const code = (content: string, box: Box, name: string, changes: number[] = [], size = 20) => {
    const lines = content.split('\n');
    // A terminal newline ends the last source line; it is not an extra line of content.
    if (lines.length > 1 && lines.at(-1) === '') lines.pop();
    const lineHeight = size * 1.3 / 72 + 0.02;
    if (lines.length * lineHeight > box.h) {
      limit(`File snippet needs ${lines.length} lines at ${size}pt (${(lines.length * lineHeight).toFixed(2)}in; available ${box.h.toFixed(2)}in). Use a shorter teaching example.`, `${path}/scene/${name}`);
    }
    lines.forEach((line, index) => {
      const row = { x: box.x, y: box.y + index * lineHeight, w: box.w, h: lineHeight };
      const units = [...line].reduce((sum, char) => sum + (/[\u0020-\u007e]/.test(char) ? 0.6 : char === '\t' ? 2.4 : 1), 0);
      if (units * size / 72 > (box.w - 0.3) * 0.95) {
        limit('File-content lines must fit without wrapping. Shorten the example line.', `${path}/scene/${name}`);
      }
      if (changes.includes(index)) {
        shape({ ...row, h: lineHeight }, `changed line ${index + 1}`, C.soft);
        shape({ ...row, w: 0.055, h: lineHeight }, `diff margin ${index + 1}`, C.rose);
      }
      // Keep source text exact; markers are separate editable shapes, not invented file content.
      slide.addText(line || ' ', {
        ...row, x: row.x + 0.3, w: row.w - 0.3, fontSize: size, fontFace: 'Consolas', lang: 'zh-CN',
        margin: 0, wrap: false, breakLine: false, valign: 'top', paraSpaceAfter: 0,
        lineSpacing: size * 1.3, color: changes.includes(index) ? C.rose : C.ink,
        objectName: `Aha teaching ${name} line ${index + 1}`,
      });
    });
  };
  const snippet = (
    box: Box, label: string, value: Teaching['states'][number]['values'][number],
    status: string, name: string, outline?: 'changed' | 'frozen', changes: number[] = [], compact = false,
  ) => {
    shape(box, `${name} panel`, C.white, outline);
    const inner = { x: box.x + 0.22, w: box.w - 0.44 };
    if (compact) {
      const caption = `${label} · ${status}`;
      const h = height(caption, inner.w, 20);
      say(caption, { ...inner, y: box.y + 0.12, h }, `${name} entity`, 20, { bold: true });
      const y = box.y + 0.24 + h;
      code(value.content, { ...inner, y, h: box.y + box.h - y - 0.12 }, name, changes);
      return;
    }
    const labelHeight = height(label, inner.w, 20);
    say(label, { ...inner, y: box.y + 0.14, h: labelHeight }, `${name} entity`, 20, { bold: true });
    const statusY = box.y + 0.14 + labelHeight + 0.06;
    const statusHeight = height(`${status} · ${value.label}`, inner.w, 18);
    say(`${status} · ${value.label}`, { ...inner, y: statusY, h: statusHeight }, `${name} status`, 18,
      { color: outline === 'changed' ? C.rose : C.muted });
    const codeY = statusY + statusHeight + 0.14;
    code(value.content, { ...inner, y: codeY, h: box.y + box.h - codeY - 0.14 }, name, changes);
  };
  const choiceLabel = (choice: TeachingCheck['choices'][number], index: number) => {
    const letter = String.fromCharCode(65 + index);
    return new RegExp(`^${letter}(?:[：:、.)）]|\\s)`).test(choice.text) ? choice.text : `${letter} · ${choice.text}`;
  };
  const choices = (check: TeachingCheck, box: Box) => {
    let y = box.y;
    check.choices.forEach((choice, index) => {
      const label = choiceLabel(choice, index);
      const h = height(label, box.w - 0.4, 20) + 0.2;
      if (y + h > box.y + box.h) limit('Prediction choices do not fit. Shorten the choices.', `${path}/scene/check`);
      shape({ ...box, y, h }, `choice ${index + 1}`, C.white);
      say(label, { x: box.x + 0.2, y: y + 0.1, w: box.w - 0.4, h: h - 0.2 }, `choice ${index + 1}`);
      y += h + 0.1;
    });
  };

  const narrative = page.body.replace(/\r\n|\r|\n/g, ' ');
  const bodyHeight = height(narrative, area.w, 20);
  say(narrative, { ...area, h: bodyHeight }, 'narrative');
  const body = { ...area, y: area.y + bodyHeight + 0.24, h: area.h - bodyHeight - 0.24 };
  if (body.h < 2.1) limit('Teaching scene needs more space below its narrative.', `${path}/body`);
  const entityBoxes = (box: Box, count = teaching.entities.length): Box[] => {
    const gap = count === 2 ? 1.1 : 0.45;
    const w = (box.w - gap * (count - 1)) / count;
    return Array.from({ length: count }, (_, index) => ({ ...box, x: box.x + index * (w + gap), w }));
  };
  const connectEntities = (boxes: Box[], source: number, target: number, name: string, hypothetical = false) => {
    const from = boxes[source]!, to = boxes[target]!;
    if (Math.abs(source - target) === 1) {
      const left = source < target ? from : to;
      const right = source < target ? to : from;
      arrow(left.x + left.w + 0.04, from.y + from.h / 2, right.x - left.x - left.w - 0.08, name, source > target, hypothetical);
    } else {
      const y = from.y - 0.12;
      const x1 = from.x + from.w / 2, x2 = to.x + to.w / 2;
      slide.addShape(deck.ShapeType.line, {
        x: Math.min(x1, x2), y, w: Math.abs(x2 - x1), h: 0,
        objectName: `Aha teaching action arrow ${name}`,
        line: { color: C.rose, width: 2.5, ...(hypothetical ? { dashType: 'dash' as const } : {}) },
      });
      for (const x of [x1, x2]) slide.addShape(deck.ShapeType.line, {
        x, y, w: 0, h: 0.12, objectName: `Aha teaching entity connector ${name}`,
        line: {
          color: C.rose, width: 2.5, ...(x === x2 ? { endArrowType: 'triangle' as const } : {}),
          ...(hypothetical ? { dashType: 'dash' as const } : {}),
        },
      });
    }
  };

  if (scene.kind === 'hook') {
    const context = transitionContext(teaching, scene.transitionId!);
    const phase = scene.statePhase
      ?? fail('TEACHING_SCENE', 'A hook requires an explicit before/after statePhase.', `${path}/scene/statePhase`);
    const boxes = entityBoxes(body);
    context.changes.forEach((change, index) => {
      const value = change[phase];
      snippet(boxes[index]!, change.entity.label, value, '当前内容', `entity ${change.entity.id} hook`);
    });
    return;
  }

  if (scene.kind === 'transfer') {
    const check = teachingCheck(teaching, scene.checkId!);
    const qh = height(check.question, body.w, 26);
    say(check.question, { ...body, h: qh }, 'transfer question', 26, { bold: true });
    choices(check, { ...body, y: body.y + qh + 0.22, h: body.h - qh - 0.22 });
    return;
  }

  if (scene.kind === 'answer') {
    const check = teachingCheck(teaching, scene.checkId!);
    const answer = check.choices.findIndex(choice => choice.id === check.correctChoiceId);
    say(`正确答案：${String.fromCharCode(65 + answer)}`, { ...body, h: 0.53 }, 'answer verdict', 28,
      { bold: true, color: C.rose });
    let y = body.y + 0.73;
    const labelWidth = 3.2;
    check.choices.forEach((choice, index) => {
      const label = choiceLabel(choice, index);
      const feedbackWidth = body.w - labelWidth - 0.7;
      const h = Math.max(height(label, labelWidth, 20), height(choice.feedback, feedbackWidth, 20));
      shape({ ...body, y, h: h + 0.24 }, `answer option ${index + 1}`, index === answer ? C.sage : C.white);
      say(label, { x: body.x + 0.2, y: y + 0.12, w: labelWidth, h }, `answer choice ${index + 1}`, 20, { bold: index === answer });
      say(choice.feedback, { x: body.x + labelWidth + 0.5, y: y + 0.12, w: feedbackWidth, h },
        `answer reason ${index + 1}`, 20, { bold: index === answer });
      y += h + 0.38;
    });
    return;
  }

  if (scene.kind === 'outcome') {
    const { outcome, state, entity, value } = teachingOutcome(teaching);
    const rule = `如果此刻执行：${outcome.action}`;
    const rh = height(rule, body.w, 20);
    say(rule, { ...body, h: rh }, 'outcome basis', 20, { color: C.rose, bold: true });
    const eh = height(outcome.explanation, body.w, 20);
    const diagram = { ...body, y: body.y + rh + 0.2, h: body.h - rh - eh - 0.34 };
    const count = teaching.entities.length;
    const resultWidth = count === 2 ? 3.03 : 2.8;
    const inputs = entityBoxes({ ...diagram, w: body.w - resultWidth - 0.45 }, count);
    // Outcome diagrams reserve equal input slots; their order remains the authored entity order.
    const inputWidth = (body.w - resultWidth - 0.45 - (count - 1) * 0.45) / count;
    inputs.forEach((box, index) => { box.x = body.x + index * (inputWidth + 0.45); box.w = inputWidth; });
    teaching.entities.forEach((item, index) => {
      const existing = state.values.find(entry => entry.entityId === item.id)!;
      snippet(inputs[index]!, item.label, existing, item.id === entity.id ? '从这里取用' : '保持不变',
        `outcome entity ${item.id}`, 'frozen', [], true);
    });
    const result = { ...diagram, x: body.x + body.w - resultWidth, w: resultWidth };
    shape(result, 'outcome result panel', C.sage, 'changed');
    const lh = height(outcome.label, result.w - 0.44, 20);
    say(outcome.label, { x: result.x + 0.22, y: result.y + 0.12, w: result.w - 0.44, h: lh }, 'outcome result label', 20, { bold: true });
    code(value.content, { x: result.x + 0.22, y: result.y + lh + 0.24, w: result.w - 0.44, h: result.h - lh - 0.36 }, 'outcome result');
    connectEntities([...inputs, result], teaching.entities.findIndex(item => item.id === entity.id), count, 'rule application', true);
    say(outcome.explanation, { ...body, y: body.y + body.h - eh, h: eh }, 'outcome explanation');
    return;
  }

  if (scene.kind === 'takeaway') {
    const card = teaching.card;
    const hh = height(card.headline, body.w - 0.6, 28);
    shape({ ...body, h: hh + 0.28 }, 'takeaway headline panel', C.rose);
    say(card.headline, { x: body.x + 0.3, y: body.y + 0.14, w: body.w - 0.6, h: hh },
      'takeaway headline', 28, { color: C.white, bold: true });
    const summaryY = body.y + hh + 0.4;
    const sh = height(card.summary, body.w, 20);
    say(card.summary, { ...body, y: summaryY, h: sh }, 'takeaway summary');
    const y = summaryY + sh + 0.2;
    const gap = 0.5;
    const width = (body.w - gap * (card.transitionIds.length - 1)) / card.transitionIds.length;
    let timelineHeight = 0;
    card.transitionIds.forEach((id, index) => {
      const context = transitionContext(teaching, id);
      const target = context.changes.find(change => change.entity.id === context.transition.targetEntityId)!;
      const x = body.x + index * (width + gap);
      shape({ x, y, w: 0.44, h: 0.44 }, `timeline node ${index + 1}`, C.rose);
      say(String(index + 1), { x, y: y + 0.03, w: 0.44, h: 0.36 }, `timeline number ${index + 1}`, 18,
        { color: C.white, align: 'center', bold: true });
      if (index < card.transitionIds.length - 1) arrow(x + width + 0.06, y + 0.22, gap - 0.12, `timeline ${index + 1}`);
      const actionHeight = height(context.transition.action, width - 0.58, 20);
      say(context.transition.action, { x: x + 0.58, y: y + 0.03, w: width - 0.58, h: actionHeight },
        `timeline action ${index + 1}`, 20, { bold: true });
      const result = `${target.entity.label}：${target.before.label} → ${target.after.label}`;
      const resultHeight = height(result, width, 20);
      const resultY = Math.max(0.44, actionHeight + 0.03) + 0.14;
      say(result, { x, y: y + resultY, w: width, h: resultHeight }, `timeline result ${index + 1}`);
      timelineHeight = Math.max(timelineHeight, resultY + resultHeight);
    });
    const takeawayHeight = height(card.takeaway, body.w, 22);
    say(card.takeaway, { ...body, y: y + timelineHeight + 0.18, h: takeawayHeight }, 'takeaway rule', 22, { bold: true, color: C.rose });
    return;
  }

  if (scene.kind !== 'transition' && scene.kind !== 'mechanism') {
    fail('PPTX_SCENE_UNSUPPORTED', `Unsupported teaching scene kind: ${String(scene.kind)}.`, `${path}/scene/kind`);
  }
  const context = transitionContext(teaching, scene.transitionId!);
  const { transition, changes } = context;
  const target = changes.find(change => change.entity.id === transition.targetEntityId)!;
  const explanationHeight = height(transition.explanation, body.w, 20);
  const operation = transition.command ? `${transition.action} · ${transition.command}` : transition.action;
  const operationHeight = transition.copyFromEntityId ? height(operation, body.w, 22) + 0.2 : 0;
  if (transition.copyFromEntityId) say(operation, { ...body, h: operationHeight - 0.2 }, 'operation', 22, { bold: true, color: C.rose });
  const diagram = {
    ...body, y: body.y + operationHeight,
    h: body.h - operationHeight - explanationHeight - 0.14,
  };
  const explanationY = body.y + body.h - explanationHeight;
  say(transition.explanation, { ...body, y: explanationY, h: explanationHeight }, 'operation explanation');
  const boxes = entityBoxes(diagram);
  if (transition.copyFromEntityId) {
    changes.forEach((change, index) => snippet(
      boxes[index]!, change.entity.label, change.after,
      change.changed ? '写入 · 已改变' : '保持不变', `entity ${change.entity.id} copy`,
      change.changed ? 'changed' : 'frozen', change.changedLines,
    ));
    connectEntities(boxes, changes.findIndex(change => change.entity.id === transition.copyFromEntityId),
      changes.findIndex(change => change === target), 'one time copy');
  } else {
    changes.forEach((change, index) => {
      const box = boxes[index]!;
      if (!change.changed) {
        snippet(box, change.entity.label, change.after, '保持不变', `entity ${change.entity.id} frozen`, 'frozen');
        return;
      }
      shape(box, `entity ${change.entity.id} change panel`, C.white, 'changed');
      const title = `${change.entity.label} · ${transition.action}`;
      const th = height(title, box.w - 0.4, 20);
      say(title, { x: box.x + 0.2, y: box.y + 0.14, w: box.w - 0.4, h: th }, `entity ${change.entity.id} heading`, 20, { bold: true });
      const y = box.y + th + 0.3;
      const rowsHeight = box.y + box.h - y - 0.16;
      const rowHeight = (rowsHeight - 0.28) / 2;
      for (const [row, value] of [change.before, change.after].entries()) {
        const rowY = y + row * (rowHeight + 0.28);
        const label = `${row === 0 ? '操作前' : '改变后'}\n${value.label}`;
        const lh = height(label, 1.15, 20);
        if (lh > rowHeight) limit('Before/after labels need more room; keep version labels short.', `${path}/scene`);
        say(label, { x: box.x + 0.2, y: rowY, w: 1.15, h: lh }, `target ${row === 0 ? 'before' : 'after'} label`, 20);
        code(value.content, { x: box.x + 1.45, y: rowY, w: box.w - 1.65, h: rowHeight },
          `target ${row === 0 ? 'before' : 'after'}`, row === 1 ? change.changedLines : []);
      }
      slide.addShape(deck.ShapeType.line, {
        x: box.x + box.w / 2, y: y + rowHeight + 0.05, w: 0, h: 0.18,
        objectName: 'Aha teaching action arrow within changed entity',
        line: { color: C.rose, width: 2.5, endArrowType: 'triangle' },
      });
    });
  }
}
