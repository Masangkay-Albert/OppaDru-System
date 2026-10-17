import { readFileSync } from 'node:fs';

const files = [
  'src/modules/franchise-side/pages/FranchiseApplicationPage.tsx',
  'src/modules/franchise-side/pages/FranchiseApplicationPage.css',
];
const forbidden = /\b(?:bg-white|text-gray-[\w/-]+|text-red-[\w/-]+|bg-red-[\w/-]+|border-red-[\w/-]+|bg-stone-[\w/-]+|text-white|bg-amber-[\w/-]+|border-amber-[\w/-]+|text-amber-[\w/-]+)\b|#[\da-f]{3,8}\b|\brgb\(/i;
const violations = files.flatMap((file) => {
  const contents = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  return contents.split(/\r?\n/).flatMap((line, index) => forbidden.test(line)
    ? [`${file}:${index + 1}: ${line.trim()}`]
    : []);
});

if (violations.length) {
  console.error(`Hardcoded form colors are not allowed outside the theme tokens:\n${violations.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Franchise form color-token check passed.');
}
