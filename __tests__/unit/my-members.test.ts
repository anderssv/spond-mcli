import { describe, test, expect } from '@jest/globals';
import { resolveMyMembers } from '../../src/domain-logic.js';
import { SpondGroup } from '../../src/domain-types.js';

function groupWithMember(overrides: Partial<SpondGroup['members'][number]> = {}, groupOverrides: Partial<SpondGroup> = {}): SpondGroup {
  return {
    id: 'group-1',
    name: 'Team A',
    createdTime: new Date().toISOString(),
    members: [
      {
        id: 'member-1',
        firstName: 'Ola',
        lastName: 'Nordmann',
        createdTime: new Date().toISOString(),
        respondent: true,
        ...overrides
      }
    ],
    ...groupOverrides
  };
}

describe('resolveMyMembers', () => {
  test('returns empty array when there are no groups', () => {
    const result = resolveMyMembers([], 'my-profile-id');

    expect(result).toEqual([]);
  });

  test('returns empty array when a group has no members', () => {
    const group = groupWithMember({}, {});
    group.members = [];

    const result = resolveMyMembers([group], 'my-profile-id');

    expect(result).toEqual([]);
  });

  test('includes a member whose guardian profile.id matches the current user', () => {
    const group = groupWithMember({
      guardians: [{ id: 'guardian-1', firstName: 'Guardian', lastName: 'Person', profile: { id: 'my-profile-id' } as any }]
    });

    const result = resolveMyMembers([group], 'my-profile-id');

    expect(result).toEqual([
      { memberId: 'member-1', firstName: 'Ola', lastName: 'Nordmann', groupId: 'group-1', groupName: 'Team A' }
    ]);
  });

  test('collects matching members across multiple groups', () => {
    const groupA = groupWithMember(
      { id: 'member-a', firstName: 'Ola', guardians: [{ id: 'g1', firstName: 'G', lastName: 'P', profile: { id: 'my-profile-id' } as any }] },
      { id: 'group-a', name: 'Team A' }
    );
    const groupB = groupWithMember(
      { id: 'member-b', firstName: 'Kari', guardians: [{ id: 'g2', firstName: 'G', lastName: 'P', profile: { id: 'my-profile-id' } as any }] },
      { id: 'group-b', name: 'Team B' }
    );

    const result = resolveMyMembers([groupA, groupB], 'my-profile-id');

    expect(result.map(m => m.memberId)).toEqual(['member-a', 'member-b']);
  });

  test('excludes a member whose guardian profile.id does not match the current user', () => {
    const group = groupWithMember({
      guardians: [{ id: 'guardian-1', firstName: 'Guardian', lastName: 'Person', profile: { id: 'someone-elses-id' } as any }]
    });

    const result = resolveMyMembers([group], 'my-profile-id');

    expect(result).toEqual([]);
  });

  test('excludes a member with no guardians at all', () => {
    const group = groupWithMember({ guardians: undefined });

    const result = resolveMyMembers([group], 'my-profile-id');

    expect(result).toEqual([]);
  });

  test('matches on guardian.profile.id, not guardian.id', () => {
    const group = groupWithMember({
      guardians: [{ id: 'my-profile-id', firstName: 'Guardian', lastName: 'Person', profile: { id: 'a-different-id' } as any }]
    });

    const result = resolveMyMembers([group], 'my-profile-id');

    expect(result).toEqual([]);
  });
});
