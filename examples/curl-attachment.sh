#!/bin/bash -eu

# Script to download the first attachment found in Spond posts
# Uses curl-posts.sh to get posts, extracts first attachment and group ID,
# then uses curl-filetoken.sh to get a valid token for downloading

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Get posts using curl-posts.sh
echo "Fetching posts..." >&2
POSTS_DATA=$($SCRIPT_DIR/curl-posts.sh)

# Extract the first attachment URL and group ID from the posts
ATTACHMENT_URL=$(echo "$POSTS_DATA" | jq -r '.[] | select(.attachments != null and (.attachments | length > 0)) | .attachments[0].media' | head -1)
GROUP_ID=$(echo "$POSTS_DATA" | jq -r '.[] | select(.attachments != null and (.attachments | length > 0)) | .groupId' | head -1)

if [[ "$ATTACHMENT_URL" == "null" || -z "$ATTACHMENT_URL" ]]; then
    echo "No attachments found in recent posts" >&2
    exit 1
fi

if [[ "$GROUP_ID" == "null" || -z "$GROUP_ID" ]]; then
    echo "No group ID found for post with attachment" >&2
    exit 1
fi

echo "Found attachment: $ATTACHMENT_URL" >&2
echo "Group ID: $GROUP_ID" >&2

# Get file token using the group ID
echo "Getting file token..." >&2
FILE_TOKEN=$($SCRIPT_DIR/curl-filetoken.sh "$GROUP_ID" | jq -r '.value')

if [[ "$FILE_TOKEN" == "null" || -z "$FILE_TOKEN" ]]; then
    echo "Failed to get file token" >&2
    exit 1
fi

echo "Got file token, downloading attachment..." >&2

# Download the attachment using the token
curl "$ATTACHMENT_URL?auth=$FILE_TOKEN" \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: nb-NO,nb;q=0.9,en-GB;q=0.8,en;q=0.7,no;q=0.6,nn;q=0.5,en-US;q=0.4' \
  -H 'api-level: 2.7.9' \
  -H "authorization: Bearer $(cat ~/spond-token.txt)" \
  -H 'cache-control: no-cache' \
  -H 'dnt: 1' \
  -H 'origin: https://spond.com' \
  -H 'pragma: no-cache' \
  -H 'priority: u=1, i' \
  -H 'sec-ch-ua: "Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Linux"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-site' \
  -H 'sec-gpc: 1' \
  -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'