# Spond API Examples

This directory contains example scripts and documentation for interacting with the Spond API directly using curl commands. These examples are useful for debugging and understanding the API behavior.

## Authentication

All examples automatically read the bearer token from `../spond-token.txt`. Make sure the token file contains a valid token.

## Scripts

### `curl-groups.sh`
Fetches all groups that the user is a member of.
- **Authentication**: Bearer token only
- **Response**: Large JSON array with group details and member information
- **Size**: ~500KB+ depending on group membership

### `curl-events-unfiltered.sh`
Fetches unfiltered events (all groups).
- **Authentication**: Bearer token only
- **Response**: JSON array of events from all groups
- **Size**: ~800KB+ depending on active events and group sizes

### `curl-events-filtered.sh`
Fetches events filtered by specific group ID (dynamically determined).
- **Authentication**: May require enhanced authentication beyond bearer token
- **Response**: JSON array of events from specific group only
- **Size**: Smaller, depends on group activity
- **Group Selection**: Uses `get-first-group-id.sh` for dynamic group selection

### `curl-posts.sh`
Fetches recent posts from all groups.
- **Authentication**: Bearer token only
- **Response**: JSON array of posts with comments, reactions, and attachments
- **Size**: Variable, depends on post activity

### `curl-group-files.sh`
Fetches files and resources from a specific group (dynamically determined).
- **Authentication**: Bearer token only
- **Response**: JSON object with group files and folder structure
- **Group Selection**: Uses `get-first-group-id.sh` for dynamic group selection

### `curl-filetoken.sh GROUP_ID`
Gets a file access token for a specific group ID.
- **Usage**: `./curl-filetoken.sh GROUP_ID`
- **Authentication**: Bearer token only
- **Response**: JSON object with JWT token for file access
- **Purpose**: Used by other scripts to access protected files

### `curl-attachment.sh`
Downloads the first attachment found in recent posts.
- **Process**: Fetches posts → extracts attachment URL and group ID → gets file token → downloads attachment
- **Authentication**: Bearer token only
- **Dependencies**: Uses `curl-posts.sh` and `curl-filetoken.sh`

### `get-first-group-id.sh`
Helper script that returns a group ID for use by other scripts.
- **Priority**: 
  1. If `group-id.txt` file exists, uses group ID from that file
  2. Otherwise, uses the first group ID from `curl-groups.sh`
- **Authentication**: Bearer token only (when fetching from API)
- **Response**: Single group ID string

## Authentication Requirements

Based on debugging session findings:

| API Call | groupId | Auth Required |
|----------|---------|---------------|
| Events   | No      | Bearer token only |
| Events   | Yes     | May require enhanced authentication |
| Groups   | N/A     | Bearer token only |

**Key Insight**: GroupId filtering may require enhanced authentication beyond just the bearer token, depending on the specific parameter combination used.

## Group ID Configuration

Most scripts that require a group ID use the `get-first-group-id.sh` helper script for dynamic group selection:

### Default Behavior
By default, scripts will use the first group ID returned by the groups API:
```bash
./curl-events-filtered.sh  # Uses first group automatically
```

### Override with Specific Group ID
To use a specific group ID, create a `group-id.txt` file:
```bash
echo "YOUR_SPECIFIC_GROUP_ID" > group-id.txt
./curl-events-filtered.sh  # Now uses your specified group ID
```

### Reset to Default
To return to default behavior, simply remove the file:
```bash
rm group-id.txt
./curl-events-filtered.sh  # Back to using first group
```

## Usage

1. Ensure `../spond-token.txt` contains a valid token
2. (Optional) Create `group-id.txt` with a specific group ID if you want to override the default
3. Run the script: `./curl-groups.sh`

## Debugging Tips

- Test groups API first to verify authentication
- Use unfiltered events to test basic events API
- Be aware that filtered events may require enhanced authentication
- Large responses (>500KB) are normal due to detailed member information
- Empty array `[]` response indicates successful filtering with no matching events