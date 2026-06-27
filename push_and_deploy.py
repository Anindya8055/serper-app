#!/usr/bin/env python3
"""
push_and_deploy.py
------------------
Run this on your Windows PC from inside the serper-app folder:

    python push_and_deploy.py

What it does:
  1. Runs pending patch scripts (domain priors, etc.)
  2. Commits any resulting file changes
  3. Pushes to GitHub (main branch)
  4. SSHs into the server -> git pull -> pm2 restart -> shows logs
"""

import subprocess
import sys
import os

# ── CONFIG ────────────────────────────────────────────────────────────────────
BRANCH       = "main"
REMOTE       = "origin"
SERVER_USER  = "root"
SERVER_HOST  = "152.42.222.12"
SERVER_PATH  = "/root/serper-app"
PM2_APP_NAME = "serper-backend"
# ─────────────────────────────────────────────────────────────────────────────

# Patch scripts to run before pushing (skipped automatically if already applied)
PATCH_SCRIPTS = [
    "deploy_fix12.py",   # Phase 2 domain priors — 66 new entries
]


def run(cmd, check=True):
    print(f"\n>>> {cmd}")
    result = subprocess.run(cmd, shell=True)
    if check and result.returncode != 0:
        print(f"\n[ERROR] Command failed with exit code {result.returncode}")
        sys.exit(result.returncode)
    return result.returncode


def main():
    print("=" * 60)
    print("  serper-app — push & deploy")
    print("=" * 60)

    # 1. Run patch scripts
    for script in PATCH_SCRIPTS:
        if os.path.exists(script):
            print(f"\n--- Running {script} ---")
            run(f"python {script}")
        else:
            print(f"\n[SKIP] {script} not found")

    # 2. Commit any file changes the patch scripts made
    status = subprocess.run(
        "git status --porcelain", shell=True, capture_output=True, text=True
    )
    if status.stdout.strip():
        run("git add backend/config/domain-priors/exact.json")
        run('git commit -m "Phase 2 domain priors — 66 new entries"')
    else:
        print("\n[OK] Nothing new to commit — patch already applied.")

    # 3. Push to GitHub
    print(f"\n{'=' * 60}")
    print(f"  Pushing to GitHub  (origin/main)")
    print("=" * 60)
    run(f"git push {REMOTE} {BRANCH}")

    # 4. Deploy on server via SSH
    print(f"\n{'=' * 60}")
    print(f"  Deploying on server  (root@{SERVER_HOST})")
    print("=" * 60)

    server_commands = " && ".join([
        f"cd {SERVER_PATH}",
        f"git pull origin {BRANCH}",
        f"pm2 restart {PM2_APP_NAME}",
        f"pm2 logs {PM2_APP_NAME} --lines 30 --nostream",
    ])

    ssh_cmd = f'ssh {SERVER_USER}@{SERVER_HOST} "{server_commands}"'
    run(ssh_cmd)

    print("\n" + "=" * 60)
    print("  DONE — push & deploy complete!")
    print("  Site: https://search.yaaply.net/")
    print("=" * 60)


if __name__ == "__main__":
    main()
