import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIntelligenceResponse } from './parse-intelligence-response';

const validIds = new Set(['rec1', 'rec2']);

const validPayload = {
  executiveMessage: 'Paragraph one.\n\nParagraph two.',
  crossKpiNarrative: 'Occupancy rose while ADR fell.',
  decisionSummaryText: 'Top priorities today.',
  forecastNarrative: 'Month-end occupancy trending toward the forecast range.',
  riskElaboration: { rec1: 'Elaboration for rec1.' },
  opportunityElaboration: { rec2: 'Elaboration for rec2.' },
  businessImpactEstimates: { rec1: 'Estimated ADR improvement: +2-4%.' },
};

test('parses a well-formed structured response', () => {
  const parsed = parseIntelligenceResponse(JSON.stringify(validPayload), validIds);
  assert.ok(parsed);
  assert.equal(parsed!.executiveMessage, validPayload.executiveMessage);
  assert.equal(parsed!.riskElaboration.rec1, 'Elaboration for rec1.');
  assert.equal(parsed!.forecastNarrative, validPayload.forecastNarrative);
});

test('tolerates a markdown code fence around the JSON (models sometimes add one despite instructions)', () => {
  const fenced = '```json\n' + JSON.stringify(validPayload) + '\n```';
  const parsed = parseIntelligenceResponse(fenced, validIds);
  assert.ok(parsed);
  assert.equal(parsed!.decisionSummaryText, validPayload.decisionSummaryText);
});

test('accepts forecastNarrative: null', () => {
  const payload = { ...validPayload, forecastNarrative: null };
  const parsed = parseIntelligenceResponse(JSON.stringify(payload), validIds);
  assert.ok(parsed);
  assert.equal(parsed!.forecastNarrative, null);
});

test('REGRESSION: drops a hallucinated recommendation id rather than trusting it — the model must never introduce a risk/opportunity that was not actually classified by the real rules engine', () => {
  const payload = {
    ...validPayload,
    riskElaboration: { rec1: 'Real elaboration.', 'rec-invented-by-model': 'Should be dropped.' },
  };
  const parsed = parseIntelligenceResponse(JSON.stringify(payload), validIds);
  assert.ok(parsed);
  assert.equal(parsed!.riskElaboration.rec1, 'Real elaboration.');
  assert.equal(parsed!.riskElaboration['rec-invented-by-model'], undefined);
  assert.equal(Object.keys(parsed!.riskElaboration).length, 1);
});

test('fails closed on malformed JSON — never partially trusts broken output', () => {
  const parsed = parseIntelligenceResponse('not json at all {{{', validIds);
  assert.equal(parsed, null);
});

test('fails closed when a required string field is missing', () => {
  const { executiveMessage: _omit, ...incomplete } = validPayload;
  const parsed = parseIntelligenceResponse(JSON.stringify(incomplete), validIds);
  assert.equal(parsed, null);
});

test('fails closed when a required string field is empty', () => {
  const payload = { ...validPayload, executiveMessage: '   ' };
  const parsed = parseIntelligenceResponse(JSON.stringify(payload), validIds);
  assert.equal(parsed, null);
});

test('fails closed when forecastNarrative is neither a string nor null', () => {
  const payload = { ...validPayload, forecastNarrative: 42 };
  const parsed = parseIntelligenceResponse(JSON.stringify(payload), validIds);
  assert.equal(parsed, null);
});

test('fails closed when a map field is an array instead of an object', () => {
  const payload = { ...validPayload, riskElaboration: ['not', 'an', 'object'] };
  const parsed = parseIntelligenceResponse(JSON.stringify(payload), validIds);
  assert.equal(parsed, null);
});

test('fails closed when the top-level JSON value is an array, not an object', () => {
  const parsed = parseIntelligenceResponse(JSON.stringify([validPayload]), validIds);
  assert.equal(parsed, null);
});
