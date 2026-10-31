import { execSync } from 'node:child_process';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const routes = [
  { name: '/', url: 'http://localhost:3001/' },
  { name: '/plan?sample=pune_wedding', url: 'http://localhost:3001/plan?sample=pune_wedding' },
  { name: '/plan/budget', url: 'http://localhost:3001/plan/budget' },
];

console.log('| Route | Performance | Accessibility | Best Practices | SEO |');
console.log('|---|---|---|---|---|');

for (const r of routes) {
  const tmpFile = `./lh-${Date.now()}.json`;
  const cmd = `CHROME_PATH="${CHROME_PATH}" pnpm dlx lighthouse "${r.url}" --form-factor=mobile --screenEmulation.mobile=true --output=json --output-path="${tmpFile}" --chrome-flags="--headless --no-sandbox" --no-enable-error-reporting --quiet`;
  try {
    execSync(cmd, { stdio: 'inherit' });
    if (existsSync(tmpFile)) {
      const data = JSON.parse(readFileSync(tmpFile, 'utf-8'));
      const cats = data.categories || {};
      const perf = Math.round((cats.performance?.score || 0) * 100);
      const a11y = Math.round((cats.accessibility?.score || 0) * 100);
      const bp = Math.round((cats['best-practices']?.score || 0) * 100);
      const seo = Math.round((cats.seo?.score || 0) * 100);
      console.log(`| \`${r.name}\` | ${perf} | ${a11y} | ${bp} | ${seo} |`);
      unlinkSync(tmpFile);
    }
  } catch (err) {
    console.error(`Failed on route ${r.name}:`, err.message);
  }
}
