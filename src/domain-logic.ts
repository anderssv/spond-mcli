import type { SpondGroup, SpondPost } from './domain-types.js';

export function matchesSearchTerm(post: SpondPost, searchTerm: string): boolean {
  const haystack = [
    post.title,
    post.body,
    post.poll?.question,
    post.poll?.description,
    post.clubPayment?.title
  ].filter((part): part is string => !!part).join(' ').toLowerCase();

  return haystack.includes(searchTerm.toLowerCase());
}

export function matchesFilename(resourceName: string, searchTerm: string): boolean {
  return resourceName.toLowerCase().includes(searchTerm.toLowerCase());
}

const CONTENT_CONVERTERS: Record<string, string> = {
  'application/pdf': 'pdftotext',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx2txt',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'ssconvert',
  'application/vnd.ms-excel': 'ssconvert'
};

export function getConverterCommand(mediaType?: string): string | null {
  if (!mediaType) return null;
  return CONTENT_CONVERTERS[mediaType] ?? null;
}

export function isContentSearchable(mediaType?: string): boolean {
  return getConverterCommand(mediaType) !== null;
}

export function sanitizeResourceIdHint(hint: string, maxLength = 120): string {
  return hint
    .replace(/\0/g, '')
    .split(/[/\\]/)
    .pop()!
    .replace(/\.\./g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, maxLength);
}

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

// Fields from a /auth2/login response that are safe to surface in an error
// message. Anything outside this set (notably 2FA challenge tokens and
// phoneNumber) is dropped to avoid leaking sensitive data into logs.
const SAFE_LOGIN_ERROR_FIELDS = ['error', 'errorKey', 'errorCode', 'message'] as const;

export function extractAccessToken(loginResult: Record<string, unknown>): string {
  const accessToken = loginResult.accessToken;
  if (accessToken && typeof accessToken === 'object') {
    const token = (accessToken as Record<string, unknown>).token;
    if (typeof token === 'string' && token) {
      return token;
    }
  }

  const safeFields: Record<string, unknown> = {};
  for (const field of SAFE_LOGIN_ERROR_FIELDS) {
    if (field in loginResult) {
      safeFields[field] = loginResult[field];
    }
  }

  const diagnostic = Object.keys(safeFields).length > 0
    ? JSON.stringify(safeFields)
    : '(no recognised diagnostic fields in response)';
  throw new Error(`Login failed. ${diagnostic}`);
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
  CLOSED = 'closed',
  CANCELLED = 'cancelled'
}

// Shared across the CLI's agent help text and the MCP accept_event/decline_event
// tool descriptions, so the explanation of registrationStatus can't drift between
// the two interfaces the way it did before.
export const REGISTRATION_STATUS_EXPLANATION = 'Only "open" can be responded to right now. "pending" means the invite hasn\'t gone out yet (see inviteTime), "closed" means the event expired, "cancelled" means the organizer cancelled it (see cancelledReason). Responding to a non-open event fails with an explanatory error.';

export function calculateRegistrationStatus(
  event: { inviteTime?: string | null; expired?: boolean; cancelled?: boolean },
  currentTime: Date = new Date()
): RegistrationStatus {
  // If event is cancelled, registration is cancelled regardless of other state
  if (event.cancelled) {
    return RegistrationStatus.CANCELLED;
  }

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

const EVENT_RESPONSE_ERROR_MESSAGES: Record<string, string> = {
  inviteNotSent: "This event isn't open for responses yet — its invite hasn't been sent out. It should become open closer to the event, matching its pending registration status."
};

const GENERIC_REGISTRATION_HINT = "Check the event's registration status — it may not be open for responses yet.";

export function describeEventResponseError(rawError: string): string {
  const jsonStart = rawError.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const body = JSON.parse(rawError.slice(jsonStart)) as { message?: unknown; errorKey?: unknown };
      const errorKey = typeof body.errorKey === 'string' ? body.errorKey : undefined;
      if (errorKey && EVENT_RESPONSE_ERROR_MESSAGES[errorKey]) {
        return EVENT_RESPONSE_ERROR_MESSAGES[errorKey];
      }
      if (typeof body.message === 'string') {
        return `${body.message}. ${GENERIC_REGISTRATION_HINT}`;
      }
    } catch {
      // Not a JSON body — fall through to the generic hint below
    }
  }

  return `${rawError}. ${GENERIC_REGISTRATION_HINT}`;
}