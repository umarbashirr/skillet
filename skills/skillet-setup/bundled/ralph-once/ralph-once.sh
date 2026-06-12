#!/bin/bash
# Ralph (human-in-the-loop): one TDD iteration per invocation.
# Usage: ./ralph-once.sh [JIRA-STORY-KEY]
# The story key is remembered in .ralph-story; PRD.md mode runs when neither exists.
# Source: Matt Pocock, https://www.aihero.dev/getting-started-with-ralph

if [ -n "$1" ]; then
  echo "$1" > .ralph-story
fi
# tr -d '\r': the file may have been written by ralph-once.cmd (CRLF)
STORY=$(cat .ralph-story 2>/dev/null | tr -d '\r')

if [ -n "$STORY" ]; then
  claude --permission-mode acceptEdits "/ralph-once $STORY"
else
  claude --permission-mode acceptEdits "/ralph-once"
fi
