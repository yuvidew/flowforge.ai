---
description: Commit changes, push the branch, and open a pull request
argument-hint: [branch-name]  (only used if currently on main/master)
---

Ship the current changes: **$ARGUMENTS**

Follow these steps in order.

## 1. Review the changes

- Run `git status`, `git diff` (unstaged), and `git diff --staged` (staged) to see
  exactly what changed before doing anything else.

  ```bash
  git status
  git diff
  git diff --staged
  ```

- Scan the changed/untracked file list for secret-shaped files (`.env`, `.env.*` other
  than `.env.example`, `*.pem`, anything with `key` or `credential` in the name, etc.).
  If any match, **do not stage or commit them** — exclude them and warn the user by
  name instead.

## 2. Commit with a clear message

- Stage the reviewed, non-secret files (name them explicitly — avoid `git add -A`/`git
  add .` so a secret file never slips in):

  ```bash
  git add <file1> <file2> ...
  ```

- Write a Conventional Commits message from the actual diff (don't guess): `type(scope):
  short summary`, under 72 chars, e.g. `feat(auth): add Google login`. In the body, add
  a short bullet list of what changed and why. Use a heredoc so formatting survives:

  ```bash
  git commit -m "$(cat <<'EOF'
  type(scope): short summary

  - what changed and why, bullet 1
  - what changed and why, bullet 2
  EOF
  )"
  ```

- Never amend — always create a new commit. Never skip hooks (`--no-verify`).

## 3. Push the branch

- Check the current branch:

  ```bash
  git branch --show-current
  ```

- If it's `main` or `master`: **stop and ask for a new branch name** before doing
  anything else. If `$ARGUMENTS` was given, use that as the branch name; otherwise ask
  the user with `AskUserQuestion`. Then create the branch and switch to it:

  ```bash
  git checkout -b <branch-name>
  ```

- Push the current branch. If it has no upstream yet, push with `-u`; otherwise a plain
  push:

  ```bash
  git push -u origin <branch-name>   # first push on this branch
  git push                           # if upstream is already set
  ```

## 4. Open a pull request with a detailed description

- Compare this branch against `main` and read **all** commits on it, not just the
  latest one:

  ```bash
  git log main..HEAD
  git diff main...HEAD
  ```

- Use `gh pr create` with a body (via heredoc) in exactly this structure:

  ```
  ## Summary
  One or two sentences on what this branch does.

  ## New features
  - Each feature added in this branch and what it does for the user.

  ## How it works
  A short explanation of the implementation approach.

  ## Files changed
  - `path/to/file` - what changed in this file and why

  ## How to test
  Steps a reviewer can follow to verify the changes.
  ```

- Append the standard attribution footer this session normally uses for PR
  descriptions, for consistency with how PRs are created elsewhere.

  ```bash
  gh pr create --title "type(scope): short summary" --body "$(cat <<'EOF'
  ## Summary
  ...

  ## New features
  - ...

  ## How it works
  ...

  ## Files changed
  - `path/to/file` - ...

  ## How to test
  - ...
  EOF
  )"
  ```

## 5. Report

Show:
- The final commit message
- The branch name
- The PR link

## 6. Merge and clean up (ask first)

- Ask the user (e.g. with `AskUserQuestion`) whether to merge the PR now. Do not merge
  without an explicit yes — this affects the shared `main` branch.
- If they confirm, merge with the branch deleted on the remote in the same step:

  ```bash
  gh pr merge <branch-name> --squash --delete-branch
  ```

  (Use whatever merge strategy — `--squash`, `--merge`, or `--rebase` — the user prefers;
  default to `--squash` if they don't say.)

- Switch back to `main`, delete the local branch, and sync:

  ```bash
  git checkout main
  git branch -d <branch-name>
  git pull
  ```

- Report the final state: which branch was merged, that `main` is now checked out, and
  that it's up to date with the remote.
