#!/bin/bash -eu

# Example curl command for fetching filtered Spond events by groupId
# Uses the first group ID from curl-groups.sh
# NOTE: GroupId filtering may require enhanced authentication beyond just bearer token

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Get token from environment, .env file, or token file
SPOND_TOKEN=$("$SCRIPT_DIR/get-spond-token.sh") || exit 1

# Get the first group ID dynamically
GROUP_ID=$($SCRIPT_DIR/get-first-group-id.sh)

curl "https://api.spond.com/core/v1/sponds?includeComments=true&includeHidden=false&addProfileInfo=true&scheduled=true&order=asc&max=20&groupId=$GROUP_ID&minEndTimestamp=2025-06-26T22:00:00.001Z" \
  -H 'accept: application/json' \
  -H 'accept-language: nb-NO,nb;q=0.9,en-GB;q=0.8,en;q=0.7,no;q=0.6,nn;q=0.5,en-US;q=0.4' \
  -H 'api-level: 2.7.9' \
  -H "authorization: Bearer $SPOND_TOKEN" \
  -H 'cache-control: no-cache' \
  -H 'content-type: application/json' \
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