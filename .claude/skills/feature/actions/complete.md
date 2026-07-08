# Complete Action

> **Signing note:** This repo signs commits (`commit.gpgsign=true`) with a
> password-protected key. Signing prompts for a passphrase and **hangs in
> Claude's non-interactive shell**, so Claude must NOT run the commits, the
> merge, or the push itself. Claude prepares everything, then hands the user a
> copy-paste command block to run in their own terminal.

## Claude does (automated)

1. Reset current-feature.md:
   - Change H1 back to `# Current Feature`
   - Clear Goals and Notes sections (keep placeholder comments)
   - Add the feature summary to the END of History
2. Stage the feature's changes and the reset (`git add <paths>`), but do NOT
   commit. Confirm `git status` shows the intended files staged.
3. Derive the feature branch name and a descriptive commit message.

## User does (manual — signed, in their terminal)

4. Print a single copy-paste block for the user to run, filling in the branch
   name, commit messages, and feature name:

   ```bash
   git commit -m "feat: <descriptive message>"
   git checkout main
   git merge --no-ff feat/<branch> -m "Merge feat/<branch>"
   git branch -d feat/<branch>
   git commit -m "chore: reset current-feature.md after completing <feature>"   # if the reset wasn't part of the feature commit
   git push origin main
   git push origin --delete feat/<branch>   # only if the branch was pushed
   ```

   > All commits sign normally here because the terminal can prompt for the
   > passphrase. Do not pass `--no-gpg-sign`.

5. Stop and let the user run the block. Do not attempt the commits/merge/push
   yourself, even with `--no-gpg-sign` — unsigned commits defeat the point.
