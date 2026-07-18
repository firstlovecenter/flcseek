import { describe, it, expect } from 'vitest';
import {
  evaluateCondition,
  evaluateConditionSet,
  type ConvertEvaluationInput,
} from '@/lib/milestone-auto-calc';

function input(overrides: Partial<ConvertEvaluationInput> = {}): ConvertEvaluationInput {
  return {
    attendanceCount: 0,
    daysSinceRegistration: 0,
    completedStages: new Set<number>(),
    ...overrides,
  };
}

describe('evaluateCondition', () => {
  describe('attendance_count', () => {
    it('defaults to gte', () => {
      const cond = { type: 'attendance_count' as const, value: 4 };
      expect(evaluateCondition(input({ attendanceCount: 3 }), 2, cond)).toBe(false);
      expect(evaluateCondition(input({ attendanceCount: 4 }), 2, cond)).toBe(true);
      expect(evaluateCondition(input({ attendanceCount: 10 }), 2, cond)).toBe(true);
    });

    it('supports equals and lte operators', () => {
      expect(
        evaluateCondition(input({ attendanceCount: 4 }), 2, {
          type: 'attendance_count',
          value: 4,
          operator: 'equals',
        })
      ).toBe(true);
      expect(
        evaluateCondition(input({ attendanceCount: 5 }), 2, {
          type: 'attendance_count',
          value: 4,
          operator: 'lte',
        })
      ).toBe(false);
    });

    it('treats a non-numeric value as threshold 0', () => {
      expect(
        evaluateCondition(input({ attendanceCount: 0 }), 2, {
          type: 'attendance_count',
          value: 'abc',
        })
      ).toBe(true);
    });
  });

  describe('time_elapsed', () => {
    it('compares days since registration', () => {
      const cond = { type: 'time_elapsed' as const, value: 30 };
      expect(evaluateCondition(input({ daysSinceRegistration: 29 }), 2, cond)).toBe(false);
      expect(evaluateCondition(input({ daysSinceRegistration: 30 }), 2, cond)).toBe(true);
    });
  });

  describe('previous_milestone', () => {
    it('always passes for the first milestone', () => {
      const cond = { type: 'previous_milestone' as const, value: 0 };
      expect(evaluateCondition(input(), 1, cond)).toBe(true);
    });

    it('requires the immediately preceding stage to be completed', () => {
      const cond = { type: 'previous_milestone' as const, value: 0 };
      expect(evaluateCondition(input(), 5, cond)).toBe(false);
      expect(evaluateCondition(input({ completedStages: new Set([4]) }), 5, cond)).toBe(true);
      expect(evaluateCondition(input({ completedStages: new Set([3]) }), 5, cond)).toBe(false);
    });
  });

  it('returns false for unknown condition types', () => {
    expect(
      evaluateCondition(input(), 2, { type: 'nonsense' as never, value: 1 })
    ).toBe(false);
  });
});

describe('evaluateConditionSet', () => {
  const attendance4 = { type: 'attendance_count' as const, value: 4 };
  const days30 = { type: 'time_elapsed' as const, value: 30 };

  it('returns false for an empty condition list', () => {
    expect(evaluateConditionSet(input(), 2, [], 'AND')).toBe(false);
    expect(evaluateConditionSet(input(), 2, [], 'OR')).toBe(false);
  });

  it('AND requires every condition', () => {
    const i = input({ attendanceCount: 5, daysSinceRegistration: 10 });
    expect(evaluateConditionSet(i, 2, [attendance4, days30], 'AND')).toBe(false);
    const j = input({ attendanceCount: 5, daysSinceRegistration: 40 });
    expect(evaluateConditionSet(j, 2, [attendance4, days30], 'AND')).toBe(true);
  });

  it('OR requires any condition', () => {
    const i = input({ attendanceCount: 5, daysSinceRegistration: 10 });
    expect(evaluateConditionSet(i, 2, [attendance4, days30], 'OR')).toBe(true);
    const j = input({ attendanceCount: 0, daysSinceRegistration: 10 });
    expect(evaluateConditionSet(j, 2, [attendance4, days30], 'OR')).toBe(false);
  });

  it('defaults to AND logic', () => {
    const i = input({ attendanceCount: 5, daysSinceRegistration: 10 });
    expect(evaluateConditionSet(i, 2, [attendance4, days30])).toBe(false);
  });
});
