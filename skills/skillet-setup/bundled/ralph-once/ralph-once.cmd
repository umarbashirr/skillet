@echo off
rem Ralph (human-in-the-loop): one TDD iteration per invocation. Windows twin of ralph-once.sh.
rem Usage: ralph-once.cmd [JIRA-STORY-KEY]
rem The story key is remembered in .ralph-story; PRD.md mode runs when neither exists.
rem Source: Matt Pocock, https://www.aihero.dev/getting-started-with-ralph
setlocal

rem redirect-first form: "echo %~1>file" would misparse a trailing digit as a stream handle
if not "%~1"=="" (>.ralph-story echo %~1)

set "STORY="
if exist .ralph-story set /p STORY=<.ralph-story

if defined STORY (
  call claude --permission-mode acceptEdits "/ralph-once %STORY%"
) else (
  call claude --permission-mode acceptEdits "/ralph-once"
)
