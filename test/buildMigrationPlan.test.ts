import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { buildMigrationPlan } from '../src/migration/buildMigrationPlan.js';
import type { ClassifiedIssueSets } from '../src/types/index.js';

const rootPath = '/repo';
const filePath = path.resolve(rootPath, 'src/Button.tsx');

function createClassifiedIssues(): ClassifiedIssueSets {
  return {
    deterministic: [
      {
        case: 'deterministic',
        filePath,
        line: 10,
        column: 8,
        property: 'backgroundColor',
        rawValue: '#ffffff',
        normalizedValue: '#ffffff',
        valueType: 'string',
        tokenGroup: 'color',
        suggestion: 'semantic.color.bg.surface',
        reason: 'single exact token candidate',
      },
    ],
    ambiguous: [
      {
        case: 'ambiguous',
        filePath,
        line: 11,
        column: 8,
        property: 'color',
        rawValue: '#ffffff',
        normalizedValue: '#ffffff',
        valueType: 'string',
        tokenGroup: 'color',
        candidates: ['semantic.color.text.inverse', 'primitive.color.white'],
        rankedCandidates: [
          {
            id: 'semantic.color.text.inverse',
            score: 80,
            reasons: ['role keyword "text" matches property "color"'],
          },
          {
            id: 'primitive.color.white',
            score: 75,
            reasons: ['value match'],
          },
        ],
        reason: 'multiple exact token candidates',
      },
    ],
    noCandidate: [
      {
        case: 'no-candidate',
        filePath,
        line: 12,
        column: 8,
        property: 'padding',
        rawValue: '13',
        normalizedValue: '13px',
        valueType: 'number',
        tokenGroup: 'spacing',
        reason: 'no exact token candidate found',
      },
    ],
    unsupported: [
      {
        case: 'unsupported',
        filePath,
        line: 13,
        column: 8,
        property: 'boxShadow',
        rawValue: '0 1px 2px #000000',
        normalizedValue: '0 1px 2px #000000',
        valueType: 'string',
        tokenGroup: 'color',
        reason: 'unsupported property',
      },
    ],
  };
}

test('buildMigrationPlan groups decisions for migration planning', () => {
  const plan = buildMigrationPlan(createClassifiedIssues(), { rootPath });

  assert.deepEqual(plan.summary, {
    'safe-replacements': 1,
    'needs-review': 1,
    'no-token-found': 1,
    unsupported: 1,
  });
  assert.equal(
    plan.groups['safe-replacements'][0]?.replacementCandidateId,
    'semantic.color.bg.surface',
  );
  assert.equal(plan.groups['needs-review'][0]?.decision, 'ambiguous');
  assert.equal(plan.groups['no-token-found'][0]?.decision, 'unknown');
  assert.equal(plan.groups.unsupported[0]?.decision, 'unsupported');
});

test('buildMigrationPlan issue ids are stable for the same location and value', () => {
  const firstPlan = buildMigrationPlan(createClassifiedIssues(), { rootPath });
  const secondPlan = buildMigrationPlan(createClassifiedIssues(), { rootPath });

  assert.equal(firstPlan.items[0]?.id, secondPlan.items[0]?.id);
  assert.match(firstPlan.items[0]?.id ?? '', /^MIG-[a-f0-9]{10}$/);
});
