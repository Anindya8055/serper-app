import subprocess
import sys
import os

BRANCH       = "main"
REMOTE       = "origin"
SERVER_USER  = "root"
SERVER_HOST  = "152.42.222.12"
SERVER_PATH  = "/var/www/serper-app"
PM2_APP_NAME = "serper-backend"

PATCH_SCRIPTS = [
    "deploy_fix12.py",
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
    print("  serper-app -- push & deploy")
    print("=" * 60)

    # 1. Run patch scripts if they exist
    for script in PATCH_SCRIPTS:
        if os.path.exists(script):
            print(f"\n--- Running {script} ---")
            run(f"python {script}")
        else:
            print(f"\n[SKIP] {script} not found")

    # 2. Commit any uncommitted changes
    status = subprocess.run(
        "git status --porcelain", shell=True, capture_output=True, text=True
    )
    if status.stdout.strip():
        run("git add -A")
        run("git commit -m \"Apply latest fixes and domain priors\"")
    else:
        print("\n[OK] Nothing to commit.")

    # 3. Push to GitHub
    print("\n--- Pushing to GitHub (origin/main) ---")
    run(f"git push {REMOTE} {BRANCH}")

    # 4. Deploy on server
    print(f"\n--- Deploying on server (root@{SERVER_HOST}) ---")
    server_commands = (
        f"cd {SERVER_PATH} && "
        f"git pull origin {BRANCH} && "
        f"pm2 restart {PM2_APP_NAME} && "
        f"pm2 logs {PM2_APP_NAME} --lines 30 --nostream"
    )
    run(f"ssh {SERVER_USER}@{SERVER_HOST} \"{server_commands}\"")

    print("\n" + "=" * 60)
    print("  DONE -- https://search.yaaply.net/")
    print("=" * 60)


if __name__ == "__main__":
    main()
