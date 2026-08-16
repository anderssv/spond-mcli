# Spond Features Analysis - Detailed Implementation Coverage

Based on exploration of the Spond web client as both a regular group member and
as a group administrator (the "Mytest" group), compared against the current
CLI/MCP tool set (2026-08-16).

Each row is tagged with whether the underlying Spond feature requires group
admin privileges to use, independent of whether spond-mcli implements it.

## Search

| Feature | Status | Admin? | Details |
|---|---|---|---|
| Unified search across events + all post types (plain, poll, payment) in one call | ✅ Implemented | No | `spond-mcli search <term>` / MCP tool `search_all`, results tagged `kind: "event"\|"post"` |
| Narrower single-type search | ✅ Implemented | No | `search_events`, `search_posts` (posts search only defaults to PLAIN) |
| File search by filename, across all groups (or one with `--group`) | ✅ Implemented | No | `spond-mcli search-files <term>` / MCP tool `search_files`. Separate command — Spond has no unified search including files. Only covers the group Files tab, not post attachments (planned). |
| File **content** search inside PDF/DOCX/XLSX (opt-in, downloads + converts each candidate file) | ✅ Implemented | No | `--content` flag / `content: true`. Slower — off by default. Spond's own UI file search is filename-only; this is something the UI itself can't do. |

## Events

| Feature | Status | Admin? | Details |
|---|---|---|---|
| List/search/filter events | ✅ Implemented | No | `get_events`, `get_upcoming_events`, `search_events`, `get_events_by_group` |
| Get event by ID, incl. members | ✅ Implemented | No | `get_event_by_id` |
| Accept invitation | ✅ Implemented | No | `accept_event` / `spond-mcli accept-event` |
| Decline invitation | ✅ Implemented | No | `decline_event` / `spond-mcli decline-event` |
| Read comments on an event | ✅ Implemented | No | `includeComments` param |
| Post a comment on an event | ❌ Not implemented | No | |
| Aggregate attendance counts (e.g. "5 attending, 6 unanswered") | ❌ Not surfaced as a summary field | No | Raw data available via `responses`, just not summarized |
| Send message to event host | ❌ Not implemented | No | This is really a Messages/Chat feature |
| Waitlist join/leave | ❌ Not implemented | No | Waitlist status is readable via `responses.waitinglistIds` |
| Create single event | ❌ Not implemented | **Admin** | |
| Create recurring event | ❌ Not implemented | **Admin** | |
| Season planner (schedule multiple events) | ❌ Not implemented | **Admin** | |
| Edit / cancel / delete event | ❌ Not implemented | **Admin** | |

## Posts

| Feature | Status | Admin? | Details |
|---|---|---|---|
| List/search/filter posts | ✅ Implemented | No | `get_posts`, `search_posts`, `get_posts_by_group` |
| Get post by ID | ✅ Implemented | No | `get_post_by_id` |
| Read comments/reactions | ✅ Implemented | No | `includeComments` param |
| Create a post | ❌ Not implemented | Either (member or admin, group-dependent) | |
| Comment/react on a post | ❌ Not implemented | No | |

## Polls

Polls have their own tab in the UI (`/client/polls`), but under the hood
they're just posts with `type=POLL` and a `poll` object (question,
description, options with vote arrays) — the same `/core/v1/posts` endpoint
`get_posts` already used.

| Feature | Status | Admin? | Details |
|---|---|---|---|
| Read polls / results | ✅ Implemented | No | `get_posts`/`search_all` with `type: 'POLL'`; question/description/vote counts surfaced |
| Vote on a poll | ❌ Not implemented | No | |
| Comment on a poll | ✅ Implemented (read) | No | Same `includeComments` mechanism as posts |
| Create a poll | ❌ Not implemented | Either | |

## Payments

Also its own tab (`/client/payments`), also just posts — `type=PAYMENT`
returns items whose actual `type` is `CLUB_PAYMENT`, with a `clubPayment`
object (title, amount, status).

| Feature | Status | Admin? | Details |
|---|---|---|---|
| Read payment requests / paid status | ✅ Implemented | No | `get_posts`/`search_all` with `type: 'PAYMENT'`; amount/status surfaced |
| Create payment request | ❌ Not implemented | **Admin** | |

## Messages / Chat

| Feature | Status | Admin? | Details |
|---|---|---|---|
| Read/send private or group chat | ❌ Not implemented | No | "Mine" tab |
| "My children" chat view | ❌ Not implemented | No | |

## Groups

| Feature | Status | Admin? | Details |
|---|---|---|---|
| List groups | ✅ Implemented | No | `get_groups` |
| Get group members | ✅ Implemented | No | Embedded in `get_groups`/`get_group_by_id`, not a dedicated tool |
| Get group files / download a file | ✅ Implemented | No | `get_group_files`, `get_group_file` |
| **My members** (your guardian relationships across all groups, with names, cached 5min) | ✅ Implemented | No | `spond-mcli my-members` |
| Add/edit/delete a member, import from Excel | ❌ Not implemented | **Admin** | |
| Invite link management | ❌ Not implemented | **Admin** | |
| Group settings (name, contact person, visibility, chat limits, etc.) | ❌ Not implemented | **Admin** | |
| Create subgroup | ❌ Not implemented | **Admin** | |
| Leave / delete group | ❌ Not implemented | **Admin** | |
| Download member list (Excel) | ❌ Not implemented | **Admin** | |
| Download/export attendance history | ❌ Not implemented | **Admin** | |

## Fundraising

| Feature | Status | Admin? | Details |
|---|---|---|---|
| View campaigns / success stories | ❌ Not implemented | No | |
| Create campaign | ❌ Not implemented | **Admin** | |

## Notifications

| Feature | Status | Admin? | Details |
|---|---|---|---|
| Activity feed (accepts, comments, time changes, etc. across all your groups) | ❌ Not implemented | No | Could make a nice "what's new" command |

## Attachments / Documents

| Feature | Status | Admin? | Details |
|---|---|---|---|
| Fetch attachment | ✅ Implemented | No | `get_attachment` |
| Convert PDF → text | ✅ Implemented | No | `convert_pdf_to_text` (requires pdftotext) |
| Convert DOCX → text | ✅ Implemented | No | `convert_docx_to_text` (requires docx2txt) |
| Convert XLSX/XLS → CSV text | ✅ Implemented | No | `convert_xlsx_to_text` (requires ssconvert, part of gnumeric) |

## Account / Auth / Tooling

| Feature | Status | Admin? | Details |
|---|---|---|---|
| Login via email/password | ✅ Implemented | No | `spond-mcli login`, matches the community `spond` Python package's `/auth2/login` |
| Login via browser (2FA accounts) | ✅ Implemented | No | `spond-mcli login --browser` |
| CLI | ✅ Implemented | No | `spond-mcli <command>`, JSON output |
| MCP server | ✅ Implemented | No | `spond-mcli mcp`, stdio |
| Agent-oriented help | ✅ Implemented | No | `spond-mcli --agent-help` |
| Profile settings, payment methods | ❌ Not implemented | No (own account, not group-admin) | |

## Summary

Everything currently implemented is non-admin, read access to member-visible
data — events, posts (plain, poll, payment), groups, files, plus the
accept/decline write actions, the my-members convenience command, and
unified search across events and all post types. Everything admin-scoped
(settings, member management, event/poll/payment creation, exports) is
entirely unimplemented, as is a chunk of non-admin functionality: voting on
polls, messages, notifications, and writing comments.

## Possible next features, roughly in order of value for a read-first,
## guardian-focused tool

1. **Notifications feed** — "what's new across my groups"
2. **Posting comments** on events/posts — small write addition
3. **Voting on a poll** — small write addition
4. Admin features (member management, event/poll/payment creation, group
   settings) — only relevant if/when the tool is used by group admins, not
   just guardians
