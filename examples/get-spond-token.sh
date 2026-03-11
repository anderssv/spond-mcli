#!/bin/bash -eu

# Helper function to get Spond token from various sources
# Priority: 1. Environment variable, 2. .env file, 3. ~/spond-token.txt file
get_spond_token() {
    # First check environment variable
    if [[ -n "${SPOND_TOKEN:-}" ]]; then
        echo "$SPOND_TOKEN"
        return 0
    fi
    
    # Then check .env file in parent directory (relative to script location)
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local env_file="$script_dir/../.env"
    if [[ -f "$env_file" ]]; then
        local token=$(grep "^SPOND_TOKEN=" "$env_file" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
        if [[ -n "$token" ]]; then
            echo "$token"
            return 0
        fi
    fi
    
    # Finally fall back to token file
    local token_file="$HOME/spond-token.txt"
    if [[ -f "$token_file" ]]; then
        cat "$token_file"
        return 0
    fi
    
    # No token found
    echo "Error: No SPOND_TOKEN found. Please set SPOND_TOKEN environment variable, add it to .env file, or create ~/spond-token.txt" >&2
    return 1
}

# If script is being executed directly (not sourced), run the function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    get_spond_token
fi