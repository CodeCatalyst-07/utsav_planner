/**
 * scripts/compute-contrast.ts
 *
 * Computes exact W3C WCAG 2.1 relative luminance and contrast ratios for all color tokens.
 */

function srgbToLinear(c8bit: number): number {
  const c = c8bit / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const tokens = {
  bg: '#FFF8F0',
  ink: '#2B1B17',
  primary: '#7A1F3D',
  secondary: '#0F766E',
  accent: '#F59E0B',
  surface: '#FFFFFF',
  'surface-border': '#EADCCB',
  danger: '#B42318',
  warning: '#B54708',
  white: '#FFFFFF',
};

const pairs: Array<{
  name: string;
  fg: keyof typeof tokens;
  bg: keyof typeof tokens;
  minLevel: 'AA' | 'AAA';
}> = [
  { name: 'Ink on Background (Body/Headings)', fg: 'ink', bg: 'bg', minLevel: 'AAA' },
  { name: 'Ink on Surface (Cards)', fg: 'ink', bg: 'surface', minLevel: 'AAA' },
  { name: 'Primary on Background', fg: 'primary', bg: 'bg', minLevel: 'AA' },
  { name: 'Primary on Surface', fg: 'primary', bg: 'surface', minLevel: 'AA' },
  { name: 'White on Primary (Buttons)', fg: 'white', bg: 'primary', minLevel: 'AA' },
  { name: 'Secondary on Background', fg: 'secondary', bg: 'bg', minLevel: 'AA' },
  { name: 'Secondary on Surface', fg: 'secondary', bg: 'surface', minLevel: 'AA' },
  { name: 'White on Secondary (Buttons)', fg: 'white', bg: 'secondary', minLevel: 'AA' },
  { name: 'Danger on Surface', fg: 'danger', bg: 'surface', minLevel: 'AA' },
  { name: 'Danger on Background', fg: 'danger', bg: 'bg', minLevel: 'AA' },
  { name: 'White on Danger (Buttons)', fg: 'white', bg: 'danger', minLevel: 'AA' },
  { name: 'Warning on Surface', fg: 'warning', bg: 'surface', minLevel: 'AA' },
  { name: 'Warning on Background', fg: 'warning', bg: 'bg', minLevel: 'AA' },
];

console.log('='.repeat(80));
console.log('  WCAG 2.1 CONTRAST RATIO AUDIT (All Design System Color Tokens)');
console.log('='.repeat(80));
console.log(
  'Pair Name'.padEnd(40) + 'Hex Codes'.padEnd(20) + 'Ratio'.padEnd(10) + 'WCAG Compliance'
);
console.log('-'.repeat(80));

for (const p of pairs) {
  const fgHex = tokens[p.fg];
  const bgHex = tokens[p.bg];
  const ratio = contrastRatio(fgHex, bgHex);
  const ratioStr = `${ratio.toFixed(2)}:1`;
  const passesAAA = ratio >= 7.0;
  const passesAA = ratio >= 4.5;
  const status = passesAAA
    ? 'Passes WCAG AAA (>= 7:1)'
    : passesAA
      ? 'Passes WCAG AA (>= 4.5:1)'
      : 'FAILS WCAG AA (< 4.5:1)';

  console.log(p.name.padEnd(40) + `${fgHex} on ${bgHex}`.padEnd(20) + ratioStr.padEnd(10) + status);
}
console.log('='.repeat(80));
