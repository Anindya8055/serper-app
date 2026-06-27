
import os

# ── 1. server.js: fix Phase 1 overwrite bug ─────────────────────────────────
sjs = open('backend/server.js', encoding='utf-8').read()

OLD = """        for (let i = 0; i < results.length; i++) {
          if (results[i].domain !== domain) continue;

          const prevStatus = results[i].analysisStatus;
          const nextStatus = prevStatus === "done" ? "done" : "processing";"""

NEW = """        for (let i = 0; i < results.length; i++) {
          if (results[i].domain !== domain) continue;

          const prevStatus = results[i].analysisStatus;
          // Don't overwrite Phase 1 snippet classifications with weaker domain analysis
          if (prevStatus === "done") continue;
          const nextStatus = "processing";"""

if OLD in sjs:
    open('backend/server.js', 'w', encoding='utf-8').write(sjs.replace(OLD, NEW, 1))
    print('server.js patched OK')
else:
    print('server.js: already patched or mismatch')

# ── 2. exact.json: add new domain priors ────────────────────────────────────
import json
path = 'backend/config/domain-priors/exact.json'
data = json.load(open(path, encoding='utf-8'))
to_add = {
    "nike.com": "E-commerce",
    "adidas.com": "E-commerce",
    "asics.com": "E-commerce",
    "newbalance.com": "E-commerce",
    "brooks.com": "E-commerce",
    "saucony.com": "E-commerce",
    "hokaoneone.com": "E-commerce",
    "hoka.com": "E-commerce",
    "hibbett.com": "E-commerce",
    "believeintherun.com": "Blog",
    "findmyfootwear.com": "Blog",
    "mensfitness.co.uk": "Newspaper",
    "womenshealthmag.co.uk": "Newspaper",
}
added = [d for d, t in to_add.items() if not data.get(d) and (data.update({d: t}) or True)]
json.dump(data, open(path, 'w', encoding='utf-8'), indent=2)
print(f"exact.json: added {len(added)} domains ({', '.join(added) if added else 'none new'})")
print('Done!')