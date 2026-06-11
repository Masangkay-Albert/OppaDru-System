const fs = require('fs');
const path = require('path');
const root = process.cwd();
function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walk(full));
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) files.push(full);
  }
  return files;
}
const files = walk(root).filter(f => !f.endsWith('.d.ts'));
const fileDatas = files.map(file => {
  const rel = path.relative(root, file).replace(/\\/g,'/');
  const text = fs.readFileSync(file, 'utf8');
  const hash = require('crypto').createHash('sha256').update(text).digest('hex');
  return { file, rel, text, hash };
});
function countUses(target) {
  const basename = path.basename(target.file, path.extname(target.file));
  const escaped = basename.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
  const importRegex = new RegExp(`(from|import\\(|require\\()\\s*['\"]([^'\"]*${escaped}[^'\"]*)['\"]`, 'g');
  let count = 0;
  for (const other of fileDatas) {
    if (other.file === target.file) continue;
    if (importRegex.test(other.text)) count++;
  }
  return count;
}
const usage = fileDatas.map(d => ({ rel: d.rel, uses: countUses(d), hash: d.hash, size: d.text.length }));
const duplicates = {};
for (const d of usage) {
  duplicates[d.hash] = duplicates[d.hash] || [];
  duplicates[d.hash].push(d.rel);
}
const dupGroups = Object.values(duplicates).filter(arr => arr.length > 1);
const result = { usage: usage.sort((a,b)=>a.uses - b.uses || a.rel.localeCompare(b.rel)), duplicates: dupGroups };
fs.writeFileSync('usage-dup-report.json', JSON.stringify(result, null, 2));
console.log('done');
