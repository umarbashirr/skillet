#!/bin/bash
# Ralph (AFK): N autonomous TDD iterations in a Docker sandbox.
# Usage: ./afk-ralph.sh <iterations> [JIRA-STORY-KEY]
# Requires Docker Desktop 4.50+ (`docker sandbox`).
# The story key is remembered in .ralph-story; PRD.md mode runs when neither exists.
# Source: Matt Pocock, https://www.aihero.dev/getting-started-with-ralph
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations> [JIRA-STORY-KEY]"
  exit 1
fi

if [ -n "$2" ]; then
  echo "$2" > .ralph-story
fi
STORY=$(cat .ralph-story 2>/dev/null)

for ((i=1; i<=$1; i++)); do
  if [ -n "$STORY" ]; then
    result=$(docker sandbox run claude --permission-mode acceptEdits -p "/ralph-once $STORY")
  else
    result=$(docker sandbox run claude --permission-mode acceptEdits -p "/ralph-once")
  fi

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "Story complete after $i iterations."
    exit 0
  fi
done
