#!/bin/bash

owner=$(gh repo view --json owner --jq '.owner.login')
repo=$(gh repo view --json name --jq '.name')

# 既存のRulesetを確認
existing_id=$(gh api repos/$owner/$repo/rulesets --jq '.[] | select(.name == "repository-protection") | .id' 2>/dev/null)

if [ -n "$existing_id" ]; then
  method="PUT"
  endpoint="repos/$owner/$repo/rulesets/$existing_id"
  echo "Updating existing ruleset (id: $existing_id)..."
else
  method="POST"
  endpoint="repos/$owner/$repo/rulesets"
  echo "Creating new ruleset..."
fi

gh api $endpoint \
  --method $method \
  --header "Content-Type: application/json" \
  --input - << 'EOF'
{
  "name": "repository-protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main"],
      "exclude": []
    }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_signatures" },
    { "type": "required_linear_history" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "test" }
        ]
      }
    }
  ]
}
EOF
