#!/usr/bin/env python3
"""
push_and_deploy.py
------------------
Run this on your Windows PC from the serper-app repo root.

Steps performed:
  1. Switch to the working branch
  2. Pull latest commits from remote
  3. Run all pending deploy/patch scripts (fix12, etc.) against local files
  4. Stage + commit any file changes those scripts produce
  5. Push the branch to GitHub
  6. SSH into the server and run: git pull + pm2 restart

Usage:
    python push_and_deploy.py

Edit the SERVER_* variables below before first use.
"""

import subprocess
import sys
import os

# ── CONFIG ────────────────────────────────────────────────────────────────────
BRANCH        = "claude/ecstatic-darwin-nfuxtc"
REMOTE        = "origin"
SERVER_USER   = "ubuntu"          # SSH username on your server
SERVER_HOST   = "your.server.ip"  # IP address or hostname
SERVER_PATH   = "~/serper-app"    # Path to the repo on the server
PM2_APP_NAME  = "serper-app"      # Name used in pm2 list (change if different)
SSH_KEY       = ""                # Path to SSH key, e.g. r"C:\Users\you\.ssh\id_rsa"
                                  # Leave "" to use default SSH key
# ─────────────────────────────────────────────────────────────────────────────


def run(cmd, check=True, cwd=None):
    """Print and run a shell command."""
    print(f"\n>>> {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=cwd)
    if check and result.returncode != 0:
        print(f"ERROR: command failed (exit {result.returncode})")
        sys.exit(result.returncode)
    return result.returncode


def main():
    # 1. Make sure we're on the right branch
    run(f"git checkout {BRANCH}")

    # 2. Pull latest from remote
    run(f"git pull {REMOTE} {BRANCH}")

    # 3. Run deploy/patch scripts (add more here as needed)
    patch_scripts = [
        "deploy_fix12.py",      # Phase 2 domain priors (66 new entries)
    ]
    for script in patch_scripts:
        if os.path.exists(script):
            print(f"\n--- Running {script} ---")
            run(f"python {script}")
        else:
            print(f"[SKIP] {script} not found")

    # 4. Stage and commit any changes produced by the patch scripts
    status = subprocess.run("git status --porcelain", shell=True,
                            capture_output=True, text=True)
    if status.stdout.strip():
        run("git add -A")
        run('git commit -m "Apply Phase 2 patch scripts (domain priors)"')
    else:
        print("\n[INFO] No file changes to commit — patch scripts already applied.")

    # 5. Push to GitHub
    print(f"\n--- Pushing to GitHub ({REMOTE}/{BRANCH}) ---")
    run(f"git push -u {REMOTE} {BRANCH}")

    # 6. SSH into the server and deploy
    print(f"\n--- Deploying on server ({SERVER_HOST}) ---")
    ssh_key_flag = f"-i {SSH_KEY}" if SSH_KEY else ""

    server_cmds = " && ".join([
        f"cd {SERVER_PATH}",
        f"git fetch {REMOTE}",
        f"git checkout {BRANCH}",
        f"git pull {REMOTE} {BRANCH}",
        f"npm install --prefix backend --omit=dev",
        f"pm2 restart {PM2_APP_NAME}",
        f"pm2 logs {PM2_APP_NAME} --lines 20 --nostream",
    ])

    ssh_cmd = f'ssh {ssh_key_flag} {SERVER_USER}@{SERVER_HOST} "{server_cmds}"'
    run(ssh_cmd)

    print("\n✓ Push and deploy complete!")


if __name__ == "__main__":
    main()
