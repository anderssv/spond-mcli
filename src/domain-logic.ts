import type { SpondGroup } from './domain-types.js';

export interface MyMember {
  memberId: string;
  firstName: string;
  lastName: string;
  groupId: string;
  groupName: string;
}

export function resolveMyMembers(groups: SpondGroup[], myProfileId: string): MyMember[] {
  const result: MyMember[] = [];

  for (const group of groups) {
    for (const member of group.members ?? []) {
      const isMyMember = member.guardians?.some(guardian => guardian.profile?.id === myProfileId) ?? false;
      if (isMyMember) {
        result.push({
          memberId: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          groupId: group.id,
          groupName: group.name
        });
      }
    }
  }

  return result;
}

export enum AttendanceStatus {
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  UNANSWERED = 'unanswered',
  WAITLISTED = 'waitlisted',
  UNCONFIRMED = 'unconfirmed'
}

export enum RegistrationStatus {
  PENDING = 'pending',
  OPEN = 'open',
  CLOSED = 'closed'
}

export function calculateRegistrationStatus(
  event: { inviteTime?: string | null; expired?: boolean },
  currentTime: Date = new Date()
): RegistrationStatus {
  // If event is expired, registration is closed
  if (event.expired) {
    return RegistrationStatus.CLOSED;
  }
  
  // If inviteTime is null, registration is immediately open
  if (event.inviteTime === null || event.inviteTime === undefined) {
    return RegistrationStatus.OPEN;
  }
  
  // Compare current time with invite time
  const inviteDate = new Date(event.inviteTime);
  
  if (currentTime >= inviteDate) {
    return RegistrationStatus.OPEN;
  } else {
    return RegistrationStatus.PENDING;
  }
}