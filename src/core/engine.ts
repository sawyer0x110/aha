import { check } from './check.js';
import { fail } from './errors.js';
import {
  RetryInputSchema, CompoundInputSchema, EvidenceInputSchema,
  type ModelSpec, type Scenario, type Trace, type State,
} from './schema.js';

type Rational = { n: bigint; d: bigint };

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

function rational(n: bigint, d: bigint): Rational {
  const divisor = gcd(n, d);
  return { n: n / divisor, d: d / divisor };
}

function decimal(value: string): Rational {
  const negative = value.startsWith('-');
  const [whole = '0', fraction = ''] = value.replace(/^-/, '').split('.');
  return rational(BigInt(whole + fraction) * (negative ? -1n : 1n), 10n ** BigInt(fraction.length));
}

function add(a: Rational, b: Rational): Rational {
  return rational(a.n * b.d + b.n * a.d, a.d * b.d);
}

function multiply(a: Rational, b: Rational): Rational {
  return rational(a.n * b.n, a.d * b.d);
}

function money(value: Rational): string {
  const absolute = value.n < 0n ? -value.n : value.n;
  const cents = (absolute * 200n + value.d) / (2n * value.d);
  return `${value.n < 0n && cents !== 0n ? '-' : ''}${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

export function runScenario(model: ModelSpec, scenario: Scenario): Trace {
  if (model.version !== '1.0.0') fail('ENGINE_VERSION', 'Unsupported model version.', '/modelSpec/version');
  const expectedMode = model.engine === 'evidence' ? 'source-based' : 'derived-model';
  if (scenario.mode !== expectedMode) {
    fail('MODE_UNSUPPORTED', `Engine ${model.engine} requires ${expectedMode}; real execution is not supported.`, '/mode');
  }
  const trace: Trace = {
    scenarioId: scenario.id, engine: model.engine, engineVersion: model.version,
    mode: scenario.mode, input: structuredClone(scenario.input),
    initialState: {}, events: [], result: {},
  };
  let state: State = {};
  let time = 0;
  function initial(value: State): void {
    state = value;
    trace.initialState = { ...value };
  }
  function emit(kind: string, next: State, details: State): void {
    const step = trace.events.length + 1;
    if (step > 1000) fail('STEP_LIMIT', 'Scenario exceeded the event budget.');
    trace.events.push({
      eventId: `event-${step}`, step, kind, logicalTimeMs: time,
      stateBefore: { ...state }, stateAfter: { ...next }, details,
      evidenceIds: [...model.evidenceIds],
    });
    state = next;
  }
  if (model.engine === 'retry') {
    const input = check(RetryInputSchema, scenario.input, '/input');
    initial({ attempt: 0, status: 'ready', totalDelayMs: 0 });
    let delay = Math.min(input.baseDelayMs, input.maxDelayMs);
    for (let attempt = 1; attempt <= input.maxRetries + 1; attempt++) {
      const outcome = input.outcomes[attempt - 1];
      if (outcome === undefined) {
        fail('OUTCOME_MISSING', `Provide an outcome for attempt ${attempt}; missing outcomes are not assumed successful.`, '/input/outcomes');
      }
      emit('attempt-started', { attempt, status: 'running', totalDelayMs: time }, { reasonCode: 'attempt-started' });
      if (outcome === 'success') {
        emit('succeeded', { ...state, status: 'success' }, { reasonCode: 'success' });
        break;
      }
      const retryable = input.retryableErrors.includes(outcome);
      if (!retryable || attempt > input.maxRetries) {
        const reason = retryable ? 'retries-exhausted' : 'not-retryable';
        emit('stopped', { ...state, status: reason }, { error: outcome, reasonCode: reason });
        break;
      }
      emit('retry-scheduled', { ...state, status: 'waiting', totalDelayMs: time + delay },
        { error: outcome, delayMs: delay, reasonCode: 'retryable-error' });
      time += delay;
      delay = Math.min(delay * input.multiplier, input.maxDelayMs);
    }
  } else if (model.engine === 'compound') {
    const input = check(CompoundInputSchema, scenario.input, '/input');
    if (input.cashflows.length !== input.rates.length) {
      fail('CASHFLOW_LENGTH', 'Each period requires an explicit cashflow, including zero.', '/input/cashflows');
    }
    let balance = decimal(input.principal);
    if (balance.n < 0n) fail('PRINCIPAL_RANGE', 'Initial principal must be nonnegative.', '/input/principal');
    const snapshot = (period: number): State => ({
      period, balance: money(balance), exactBalance: `${balance.n}/${balance.d}`,
    });
    initial(snapshot(0));
    input.rates.forEach((rateText, index) => {
      const rate = decimal(rateText);
      if (rate.n < -100n * rate.d || rate.n > 1000n * rate.d) {
        fail('RATE_RANGE', 'Rate must be between -100 and 1000 percent.', `/input/rates/${index}`);
      }
      const flowText = input.cashflows[index];
      if (flowText === undefined) fail('CASHFLOW_LENGTH', 'Missing cashflow.', `/input/cashflows/${index}`);
      const flow = decimal(flowText);
      const factor = rational(rate.d * 100n + rate.n, rate.d * 100n);
      if (input.timing === 'beginning') {
        balance = add(balance, flow);
        if (balance.n < 0n) fail('BALANCE_RANGE', 'A withdrawal cannot exceed the balance.', `/input/cashflows/${index}`);
        balance = multiply(balance, factor);
      } else {
        balance = add(multiply(balance, factor), flow);
      }
      if (balance.n < 0n) fail('BALANCE_RANGE', 'A withdrawal cannot exceed the balance.', `/input/cashflows/${index}`);
      emit('period-settled', snapshot(index + 1), {
        ratePercent: rateText, cashflow: flowText, timing: input.timing,
        reasonCode: input.timing === 'beginning' ? 'cashflow-before-return' : 'cashflow-after-return',
      });
    });
  } else if (model.engine === 'evidence') {
    const input = check(EvidenceInputSchema, scenario.input, '/input');
    initial({ selectedEvidence: input.evidenceIds.length, status: 'source-based' });
  } else {
    fail('ENGINE_UNSUPPORTED', 'Only retry, compound and evidence engines are supported.');
  }
  trace.result = { ...state };
  return trace;
}

export function stateAt(trace: Trace, step: number): State {
  if (!Number.isInteger(step) || step < 0 || step > trace.events.length) {
    fail('STEP_RANGE', 'Step is outside this trace.', '/step');
  }
  let state = { ...trace.initialState };
  for (let index = 0; index < step; index++) {
    const event = trace.events[index];
    if (!event) fail('TRACE_INVALID', 'Missing semantic event.', `/events/${index}`);
    state = { ...event.stateAfter };
  }
  return state;
}
