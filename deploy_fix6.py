
import json, os

# ── 1. server.js: skip snippet for known-prior domains ──────────────────────
sjs = open('backend/server.js', encoding='utf-8').read()

OLD = """        if (!serperTitle && !serperSnippet) continue;
        const hit = classifyFromSnippet(url, serperTitle || "", serperSnippet || "");"""

NEW = """        if (!serperTitle && !serperSnippet) continue;
        // Skip snippet classification for known-prior domains — the prior is more reliable
        if (getDomainPrior(results[i].domain)) continue;
        const hit = classifyFromSnippet(url, serperTitle || "", serperSnippet || "");"""

if OLD in sjs:
    open('backend/server.js', 'w', encoding='utf-8').write(sjs.replace(OLD, NEW, 1))
    print('server.js patched OK')
else:
    print('server.js: already patched or mismatch')

# ── 2. exact.json: add mensjournal + roadrunnersports ───────────────────────
path = 'backend/config/domain-priors/exact.json'
data = json.load(open(path, encoding='utf-8'))
to_add = {
    "mensjournal.com": "Newspaper",
    "roadrunnersports.com": "E-commerce",
}
added = [d for d, t in to_add.items() if not data.get(d) and (data.update({d: t}) or True)]
json.dump(data, open(path, 'w', encoding='utf-8'), indent=2)
print(f"exact.json: added {len(added)} domains ({', '.join(added) if added else 'none new'})")
print('Done!')