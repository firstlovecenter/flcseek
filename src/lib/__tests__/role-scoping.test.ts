import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import {
  hasMinRole,
  resolveGroupScope,
  getQueryParams,
} from '@/lib/api/middleware';
import { ROLES } from '@/lib/constants';
import type { UserPayload } from '@/lib/auth';

function paramsFor(url: string) {
  return getQueryParams(new NextRequest(`http://localhost${url}`));
}

function user(overrides: Partial<UserPayload>): UserPayload {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    username: 'test',
    role: 'leader',
    ...overrides,
  };
}

describe('hasMinRole', () => {
  it('follows the role hierarchy', () => {
    expect(hasMinRole(ROLES.SUPERADMIN, ROLES.LEADER)).toBe(true);
    expect(hasMinRole(ROLES.LEADPASTOR, ROLES.OVERSEER)).toBe(true);
    expect(hasMinRole(ROLES.LEADER, ROLES.ADMIN)).toBe(false);
    expect(hasMinRole(ROLES.ADMIN, ROLES.SUPERADMIN)).toBe(false);
  });

  it('treats a role as satisfying itself', () => {
    expect(hasMinRole(ROLES.ADMIN, ROLES.ADMIN)).toBe(true);
  });

  it('treats unknown roles as no permissions', () => {
    expect(hasMinRole('bogus' as never, ROLES.LEADER)).toBe(false);
  });
});

describe('resolveGroupScope', () => {
  it('locks leaders to their month name and ignores query params', () => {
    const scope = resolveGroupScope(
      user({ role: 'leader', group_name: 'January', group_id: 'g-1' }),
      paramsFor('/api/people?group_id=someone-elses-group')
    );
    expect(scope).toEqual({ groupName: 'January' });
  });

  it('locks admins to their month name', () => {
    const scope = resolveGroupScope(
      user({ role: 'admin', group_name: 'March' }),
      paramsFor('/api/people')
    );
    expect(scope).toEqual({ groupName: 'March' });
  });

  it('lets superadmin filter by group_id query param', () => {
    const scope = resolveGroupScope(
      user({ role: 'superadmin' }),
      paramsFor('/api/people?group_id=abc-123')
    );
    expect(scope).toEqual({ groupId: 'abc-123' });
  });

  it('gives superadmin unrestricted scope with no params', () => {
    const scope = resolveGroupScope(user({ role: 'superadmin' }), paramsFor('/api/people'));
    expect(scope).toEqual({ groupId: undefined });
  });

  it('lets leadpastor and overseer see all groups', () => {
    for (const role of ['leadpastor', 'overseer'] as const) {
      const scope = resolveGroupScope(user({ role }), paramsFor('/api/people'));
      expect(scope.groupName).toBeUndefined();
    }
  });
});

describe('getQueryParams', () => {
  it('caps limit at 500', () => {
    expect(paramsFor('/api/people?limit=9999').limit).toBe(500);
  });

  it('defaults limit to 100 and offset to 0', () => {
    const p = paramsFor('/api/people');
    expect(p.limit).toBe(100);
    expect(p.offset).toBe(0);
  });
});
