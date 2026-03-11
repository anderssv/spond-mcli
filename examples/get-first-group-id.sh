#!/bin/bash -eu

# Script to get a group ID for use in other scripts
# Priority:
# 1. If group-id.txt file exists, use the group ID from that file
# 2. Otherwise, get the first group ID from curl-groups.sh

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if group-id.txt file exists
GROUP_ID_FILE="$SCRIPT_DIR/group-id.txt"

if [[ -f "$GROUP_ID_FILE" ]]; then
    # Read group ID from file
    GROUP_ID=$(cat "$GROUP_ID_FILE" | tr -d '[:space:]')
    
    if [[ -z "$GROUP_ID" ]]; then
        echo "Error: group-id.txt file is empty" >&2
        exit 1
    fi
    
    echo "$GROUP_ID"
else
    # Get groups data and extract the first group ID
    FIRST_GROUP_ID=$($SCRIPT_DIR/curl-groups.sh | jq -r '.[0].id')
    
    if [[ "$FIRST_GROUP_ID" == "null" || -z "$FIRST_GROUP_ID" ]]; then
        echo "Error: Could not get first group ID" >&2
        exit 1
    fi
    
    echo "$FIRST_GROUP_ID"
fi