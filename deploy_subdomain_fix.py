import re

path = 'backend/lib/domain-intelligence.js'
src = open(path, encoding='utf-8').read()

OLD = """function normalizeHostname(hostname) {
  return String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\\/\\//, "")
    .replace(/^www\\./, "")
    .replace(/\\/.*$/, "");
}"""

NEW = """function normalizeHostname(hostname) {
  return String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\\/\\//, "")
    .replace(/^www\\d*\\./, "")   // strip www, www1, www2, etc.
    .replace(/\\/.*$/, "");
}"""

if OLD in src:
    src = src.replace(OLD, NEW, 1)
    print('normalizeHostname patched OK (www\\d* stripping)')
else:
    print('ERROR: normalizeHostname patch target not found')

open(path, 'w', encoding='utf-8').write(src)
print('domain-intelligence.js written.')
print('All done!')
