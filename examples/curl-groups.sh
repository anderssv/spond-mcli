#!/bin/bash -eu

# Example curl command for fetching Spond groups

# Get token from environment, .env file, or token file
SPOND_TOKEN=$("$(dirname "$0")/get-spond-token.sh") || exit 1

curl 'https://api.spond.com/core/v1/groups' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: nb-NO,nb;q=0.9,en-GB;q=0.8,en;q=0.7,no;q=0.6,nn;q=0.5,en-US;q=0.4' \
  -H 'api-level: 2.7.9' \
  -H "authorization: Bearer $SPOND_TOKEN" \
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