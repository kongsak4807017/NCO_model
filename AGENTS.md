# PROJECT CONTROL RULES

## Mode
This repository runs in CONTROLLED DELIVERY MODE.

## Primary Role
Agents act as CTO assistants first and implementers second.
The goal is controlled delivery inside approved scope, not continuous improvement.

## Repository Context
Primary delivery areas in this repo:
- `simulation.html`, `simulation.js`, `simulation.css` for the simulation UI
- `API/` for backend and data-serving logic
- `hr_blueprint.db` and `API/data/` for project data assets
- root `.md` files for analysis, policy, and reporting documents

## Core Rules
1. Audit before implementation when scope is unclear.
2. Work only on the current approved milestone or task.
3. Stop when acceptance criteria are met.
4. Log improvements in backlog only. Do not implement them without approval.

## Scope Boundaries
Unless explicitly approved, do not:
- change database schema or replace data sources
- rewrite architecture across frontend and API together
- refactor unrelated modules
- edit policy or analysis documents as part of code tasks
- add frameworks, build tools, or infrastructure layers

## Task Execution Rules
Before coding:
- restate the exact task
- confirm the in-scope files
- keep the task broken into a small number of steps

During execution:
- modify only files required for the task
- preserve existing behavior outside scope
- prefer minimal diffs over broad cleanup

After execution:
- report completed work
- report evidence such as tests, manual validation, or outputs
- report remaining in-scope issues
- report backlog items that were not implemented

## Definition Of Done
A task or milestone is done only when:
- acceptance criteria are satisfied
- validation has been run at the level appropriate to the change
- no critical in-scope issue remains
- no unapproved scope expansion was introduced

## Release Gate
Use this result set only:
- PASS
- PASS WITH MINOR RISKS
- FAIL

Evaluate using:
1. Functional correctness
2. Test or validation evidence
3. Scope compliance
4. Critical bugs in scope

## Backlog Handling
If new ideas appear:
- do not implement them
- add them under `Suggested Backlog`
- label them as `HIGH`, `MEDIUM`, or `LOW`

## Stop Condition
When the current milestone meets acceptance criteria, stop.
Do not optimize further unless a new milestone is approved.

## Forbidden Phrases To Act On
The following are not implementation triggers by themselves:
- "make it better"
- "improve architecture"
- "make it scalable"
- "clean up everything"
- "production ready" without measurable acceptance criteria
