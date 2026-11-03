import { Type, type Static } from '@sinclair/typebox';
import { check } from '../core/check.js';
import { fail } from '../core/errors.js';
import { hashValue } from '../core/identity.js';

const id = Type.String({ pattern: '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$' });
const text = Type.String({ minLength: 1, maxLength: 2000, pattern: '\\S' });
const object = { additionalProperties: false } as const;
const provenance = Type.Object({
  kind: Type.Union([
    Type.Literal('manual-teaching-model'), Type.Literal('code-derived'), Type.Literal('runtime-record'),
  ]),
  description: text,
  references: Type.Array(text, { maxItems: 64, uniqueItems: true }),
}, object);

export const MechanismModelSchema = Type.Object({
  schemaVersion: Type.Literal('1.0.0'),
  title: text,
  provenance,
  assumptions: Type.Array(text, { minItems: 1, maxItems: 64 }),
  omissions: Type.Array(text, { minItems: 1, maxItems: 64 }),
  states: Type.Array(Type.Object({ id, description: text }, object), { minItems: 1, maxItems: 256 }),
  events: Type.Array(Type.Object({ id, description: text }, object), { maxItems: 256 }),
  initial: id,
  transitions: Type.Array(Type.Object({ id, from: id, event: id, to: id, basis: text }, object), { maxItems: 4096 }),
  rules: Type.Array(Type.Object({
    id, description: text, forbiddenStates: Type.Array(id, { minItems: 1, maxItems: 256, uniqueItems: true }),
  }, object), { maxItems: 64 }),
}, object);

export const MechanismTraceSchema = Type.Object({
  schemaVersion: Type.Literal('1.0.0'),
  provenance,
  initial: id,
  steps: Type.Array(Type.Object({ event: id, to: id }, object), { maxItems: 4096 }),
}, object);

export type MechanismModel = Static<typeof MechanismModelSchema>;
type Transition = MechanismModel['transitions'][number];

function unique(values: string[], location: string): Set<string> {
  const result = new Set(values);
  if (result.size !== values.length) fail('MECHANISM_DUPLICATE', 'IDs must be unique within their collection.', location);
  return result;
}

function checkProvenance(value: Static<typeof provenance>, location: string): void {
  if (value.kind !== 'manual-teaching-model' && value.references.length === 0) {
    fail('MECHANISM_PROVENANCE', 'Code-derived and runtime-record declarations need snapshot/run references; their truth is not verified.', location);
  }
}

export async function checkMechanism(input: unknown, traceInput?: unknown) {
  const model = check(MechanismModelSchema, input);
  checkProvenance(model.provenance, '/provenance');
  const states = unique(model.states.map(state => state.id), '/states');
  const events = unique(model.events.map(event => event.id), '/events');
  unique(model.transitions.map(transition => transition.id), '/transitions');
  unique(model.rules.map(rule => rule.id), '/rules');
  const reference = (known: Set<string>, value: string, location: string) => {
    if (!known.has(value)) fail('MECHANISM_REFERENCE', `Unknown reference: ${value}.`, location);
  };
  reference(states, model.initial, '/initial');
  const outgoing = new Map<string, Map<string, Transition>>();
  for (const [index, transition] of model.transitions.entries()) {
    reference(states, transition.from, `/transitions/${index}/from`);
    reference(states, transition.to, `/transitions/${index}/to`);
    reference(events, transition.event, `/transitions/${index}/event`);
    let choices = outgoing.get(transition.from);
    if (!choices) { choices = new Map(); outgoing.set(transition.from, choices); }
    if (choices.has(transition.event)) {
      fail('MECHANISM_AMBIGUOUS', 'Each state/event pair must have exactly one declared outcome; expand guarded cases into explicit events/states.', `/transitions/${index}`);
    }
    choices.set(transition.event, transition);
  }
  for (const [index, rule] of model.rules.entries()) {
    for (const state of rule.forbiddenStates) reference(states, state, `/rules/${index}/forbiddenStates`);
  }

  // FIFO discovery records a shortest path by transition count, with declaration-order ties.
  const queue = [model.initial];
  const parent = new Map<string, Transition | null>([[model.initial, null]]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    for (const transition of outgoing.get(queue[cursor]!)?.values() ?? []) {
      if (parent.has(transition.to)) continue;
      parent.set(transition.to, transition);
      queue.push(transition.to);
    }
  }
  const pathTo = (state: string): Transition[] => {
    const steps: Transition[] = [];
    let step = parent.get(state);
    while (step) { steps.push(step); step = parent.get(step.from); }
    return steps.reverse();
  };
  const rules = model.rules.map(rule => {
    const forbidden = new Set(rule.forbiddenStates);
    const reached = queue.find(state => forbidden.has(state));
    return reached === undefined
      ? { id: rule.id, status: 'holds-in-model' as const }
      : { id: rule.id, status: 'violated' as const, counterexample: { initial: model.initial, state: reached, steps: pathTo(reached) } };
  });

  let trace;
  if (traceInput !== undefined) {
    const supplied = check(MechanismTraceSchema, traceInput);
    checkProvenance(supplied.provenance, '/trace/provenance');
    let current = model.initial;
    const accepted: Transition[] = [];
    let failure: { index: number; code: string; from: string; event?: string; expected?: string; actual: string } | undefined;
    if (supplied.initial !== model.initial) {
      failure = { index: 0, code: 'INITIAL_MISMATCH', from: model.initial, expected: model.initial, actual: supplied.initial };
    } else {
      for (const [index, step] of supplied.steps.entries()) {
        const transition = outgoing.get(current)?.get(step.event);
        const code = !events.has(step.event) ? 'UNKNOWN_EVENT'
          : !states.has(step.to) ? 'UNKNOWN_STATE'
            : !transition ? 'ILLEGAL_TRANSITION'
              : transition.to !== step.to ? 'OUTCOME_MISMATCH' : undefined;
        if (code) {
          failure = { index, code, from: current, event: step.event, actual: step.to, ...(transition ? { expected: transition.to } : {}) };
          break;
        }
        accepted.push(transition!);
        current = step.to;
      }
    }
    trace = {
      traceHash: await hashValue(supplied), provenance: supplied.provenance, provenanceVerified: false,
      status: failure ? 'violated' as const : 'conforms-to-model' as const,
      acceptedSteps: accepted, finalState: current,
      ...(failure ? { failure } : {}),
    };
  }
  return {
    status: rules.some(rule => rule.status === 'violated') || trace?.status === 'violated' ? 'violated' as const : 'checked' as const,
    modelHash: await hashValue(model),
    model,
    exploration: {
      complete: true, reachable: queue,
      unreachable: model.states.filter(state => !parent.has(state.id)).map(state => state.id),
      deadEnds: queue.filter(state => !outgoing.get(state)?.size),
      examinedTransitions: model.transitions.filter(transition => parent.has(transition.from)).length,
    },
    rules, ...(trace ? { trace } : {}),
    scope: 'Exhaustive only for the supplied finite graph and forbidden-state rules, not program correctness, liveness, source fidelity or observed execution.',
    undeclaredBehavior: 'Missing transitions are disallowed only by this model; real behavior outside the supplied states/events/transitions is unknown.',
    provenanceVerified: false,
    sourceCodeExecuted: false,
  };
}
