import { fail } from './errors.js';
import type { Pack, Teaching, TeachingCheck } from './schema.js';

function unique(items: ReadonlyArray<{ id: string }>, location: string): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) fail('TEACHING_REFERENCE', `Duplicate ID ${item.id}.`, location);
    ids.add(item.id);
  }
  return ids;
}

export function changedLines(before: string, after: string): number[] {
  const left = before.split('\n');
  const right = after.split('\n');
  const lengths = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0));
  for (let a = left.length - 1; a >= 0; a--) {
    for (let b = right.length - 1; b >= 0; b--) {
      lengths[a]![b] = left[a] === right[b] ? 1 + lengths[a + 1]![b + 1]!
        : Math.max(lengths[a + 1]![b]!, lengths[a]![b + 1]!);
    }
  }
  const same = new Set<number>();
  let a = 0;
  let b = 0;
  while (a < left.length && b < right.length) {
    if (left[a] === right[b]) { same.add(b); a++; b++; }
    else if (lengths[a + 1]![b]! >= lengths[a]![b + 1]!) a++;
    else b++;
  }
  return right.flatMap((_, index) => same.has(index) ? [] : [index]);
}

export function teachingCheck(teaching: Teaching, id: string): TeachingCheck {
  return teaching.checks.find(item => item.id === id)
    ?? fail('TEACHING_REFERENCE', `Unknown understanding check ${id}.`, '/teaching/checks');
}

export function transitionContext(teaching: Teaching, id: string) {
  const transition = teaching.transitions.find(item => item.id === id)
    ?? fail('TEACHING_REFERENCE', `Unknown transition ${id}.`, '/teaching/transitions');
  const before = teaching.states.find(item => item.id === transition.from)
    ?? fail('TEACHING_REFERENCE', 'Missing before state.', '/teaching/states');
  const after = teaching.states.find(item => item.id === transition.to)
    ?? fail('TEACHING_REFERENCE', 'Missing after state.', '/teaching/states');
  const changes = teaching.entities.map(entity => {
    const previous = before.values.find(item => item.entityId === entity.id)
      ?? fail('TEACHING_REFERENCE', 'Missing entity value.', '/teaching/states');
    const next = after.values.find(item => item.entityId === entity.id)
      ?? fail('TEACHING_REFERENCE', 'Missing entity value.', '/teaching/states');
    return {
      entity, before: previous, after: next, changed: previous.content !== next.content,
      changedLines: changedLines(previous.content, next.content),
    };
  });
  return { transition, before, after, changes };
}

export function teachingOutcome(teaching: Teaching) {
  const outcome = teaching.outcome ?? fail('TEACHING_OUTCOME', 'This scene requires a sourced rule application.', '/teaching/outcome');
  const state = teaching.states.find(item => item.id === outcome.fromStateId)
    ?? fail('TEACHING_REFERENCE', 'Unknown outcome state.', '/teaching/outcome/fromStateId');
  const entity = teaching.entities.find(item => item.id === outcome.sourceEntityId)
    ?? fail('TEACHING_REFERENCE', 'Unknown outcome source.', '/teaching/outcome/sourceEntityId');
  const value = state.values.find(item => item.entityId === entity.id)
    ?? fail('TEACHING_REFERENCE', 'Missing outcome source content.', '/teaching/outcome');
  return { outcome, state, entity, value };
}

export function validateTeaching(pack: Pack): void {
  const teaching = pack.teaching;
  if (!teaching) {
    if (pack.narrative.slides.some(slide => slide.scene)) {
      fail('TEACHING_REQUIRED', 'Teaching scenes require an explicit teaching plan.', '/narrative/slides');
    }
    return;
  }
  if (pack.modelSpec.engine !== 'evidence') {
    fail('TEACHING_MODE', 'Recorded/source examples are not substitutes for numerical model traces.', '/teaching');
  }
  const entities = unique(teaching.entities, '/teaching/entities');
  unique(teaching.states, '/teaching/states');
  const transitions = unique(teaching.transitions, '/teaching/transitions');
  unique(teaching.checks, '/teaching/checks');
  const claims = new Set(pack.claims.filter(claim => claim.type !== 'unresolved').map(claim => claim.id));
  const requireClaims = (ids: string[]) => {
    if (!ids.length || ids.some(id => !claims.has(id))) {
      fail('TEACHING_REFERENCE', 'Teaching must reference existing, resolved claims.', '/teaching');
    }
  };
  for (const id of teaching.basis.evidenceIds) {
    const evidence = pack.evidence.find(item => item.id === id);
    if (!evidence || (teaching.basis.kind === 'recorded-example' && !evidence.contentHash)) {
      fail('TEACHING_BASIS', 'Recorded examples require identifiable retained evidence.', '/teaching/basis');
    }
  }
  for (const state of teaching.states) {
    const valueIds = state.values.map(item => item.entityId);
    if (new Set(valueIds).size !== entities.size || valueIds.length !== entities.size
      || valueIds.some(id => !entities.has(id))) {
      fail('TEACHING_STATE', 'Every state must contain each entity exactly once.', '/teaching/states');
    }
  }
  if (teaching.states.length !== teaching.transitions.length + 1) {
    fail('TEACHING_SEQUENCE', 'A teaching sequence needs one initial state and one state per operation.', '/teaching');
  }
  const predictionIds = new Set<string>();
  teaching.transitions.forEach((transition, index) => {
    requireClaims(transition.claimIds);
    if (transition.from !== teaching.states[index]!.id || transition.to !== teaching.states[index + 1]!.id
      || !entities.has(transition.targetEntityId)) {
      fail('TEACHING_SEQUENCE', 'Transitions must follow the explicitly ordered states.', '/teaching/transitions');
    }
    const prediction = teachingCheck(teaching, transition.predictionId);
    if (prediction.kind !== 'prediction' || predictionIds.has(prediction.id)) {
      fail('TEACHING_CHECK', 'Each operation needs its own prediction check.', '/teaching/transitions');
    }
    predictionIds.add(prediction.id);
    if (transition.claimIds.some(id => !prediction.claimIds.includes(id))) {
      fail('TEACHING_REFERENCE', 'Prediction claims must cover the operation they explain.', '/teaching/checks');
    }
    const context = transitionContext(teaching, transition.id);
    const changed = context.changes.filter(change => change.changed);
    if (changed.length !== 1 || changed[0]!.entity.id !== transition.targetEntityId) {
      fail('TEACHING_CHANGE', 'Each teaching operation must change exactly its declared target.', '/teaching/transitions');
    }
    if (transition.copyFromEntityId) {
      const source = context.before.values.find(value => value.entityId === transition.copyFromEntityId);
      if (!source || transition.copyFromEntityId === transition.targetEntityId || source.content !== changed[0]!.after.content) {
        fail('TEACHING_COPY', 'A copy arrow must match the retained source and destination content.', '/teaching/transitions');
      }
    }
  });
  const predictions = new Set(teaching.checks.filter(check => check.kind === 'prediction').map(check => check.question.trim()));
  for (const check of teaching.checks) {
    const choices = unique(check.choices, '/teaching/checks/choices');
    requireClaims(check.claimIds);
    if (!choices.has(check.correctChoiceId)) fail('TEACHING_CHECK', 'Missing correct choice.', '/teaching/checks');
    if (check.kind === 'prediction' && !predictionIds.has(check.id)) {
      fail('TEACHING_CHECK', 'Prediction checks must belong to an operation.', '/teaching/checks');
    }
    if (check.kind === 'transfer' && predictions.has(check.question.trim())) {
      fail('TEACHING_CHECK', 'A transfer question must not repeat an operation prediction.', '/teaching/checks');
    }
  }
  if (!teaching.checks.some(check => check.kind === 'transfer')) {
    fail('TEACHING_CHECK', 'Add a distinct transfer task after the worked example.', '/teaching/checks');
  }
  requireClaims(teaching.card.claimIds);
  if (teaching.outcome) {
    teachingOutcome(teaching);
    requireClaims(teaching.outcome.claimIds);
    if (teaching.outcome.claimIds.some(id => !teaching.card.claimIds.includes(id))) {
      fail('TEACHING_REFERENCE', 'Card claims must cover the rule application it displays.', '/teaching/card');
    }
  }
  for (const id of teaching.card.transitionIds) {
    if (!transitions.has(id)) fail('TEACHING_REFERENCE', 'Card references an unknown operation.', '/teaching/card');
    if (transitionContext(teaching, id).transition.claimIds.some(claim => !teaching.card.claimIds.includes(claim))) {
      fail('TEACHING_REFERENCE', 'Card claims must cover the operations it displays.', '/teaching/card');
    }
  }
  for (const slide of pack.narrative.slides) {
    if (!slide.scene) continue;
    if (slide.visual || slide.scenarioId) {
      fail('TEACHING_SCENE', 'A teaching scene cannot also select a legacy visual or model snapshot.', '/narrative/slides');
    }
    const scene = slide.scene;
    if (scene.kind === 'hook' ? !scene.statePhase : scene.statePhase !== undefined) {
      fail('TEACHING_SCENE', 'Only hook scenes require an explicit before/after statePhase.', '/narrative/slides');
    }
    let required: string[] = [];
    if (['hook', 'transition', 'mechanism'].includes(scene.kind)) {
      if (!scene.transitionId) fail('TEACHING_SCENE', 'This scene needs an operation.', '/narrative/slides');
      required = transitionContext(teaching, scene.transitionId).transition.claimIds;
    } else if (scene.transitionId) {
      fail('TEACHING_SCENE', 'Unexpected operation on this scene kind.', '/narrative/slides');
    }
    if (scene.kind === 'transfer' || scene.kind === 'answer') {
      if (!scene.checkId) fail('TEACHING_SCENE', 'A transfer scene needs a check.', '/narrative/slides');
      const check = teachingCheck(teaching, scene.checkId);
      if (check.kind !== 'transfer') fail('TEACHING_SCENE', 'Use a new transfer situation, not the worked example prediction.', '/narrative/slides');
      required = check.claimIds;
    } else if (scene.checkId) {
      fail('TEACHING_SCENE', 'Unexpected check on this scene kind.', '/narrative/slides');
    }
    if (scene.kind === 'outcome') required = teachingOutcome(teaching).outcome.claimIds;
    if (scene.kind === 'takeaway') required = teaching.card.claimIds;
    if (required.some(id => !slide.claimIds.includes(id))) {
      fail('TEACHING_REFERENCE', 'Slide claims must cover its teaching scene.', '/narrative/slides');
    }
  }
}
