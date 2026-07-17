/**
 * Diagnostic script to verify changes are applied
 */

import fs from 'fs';
import path from 'path';

console.log('=== DIAGNOSING CHANGES ===\n');

// Check PublicLayout.tsx for footer changes
const publicLayoutPath = 'src/components/public/PublicLayout.tsx';
const publicLayoutContent = fs.readFileSync(publicLayoutPath, 'utf8');

console.log('1. FOOTER VISIBILITY CHECK:');
if (publicLayoutContent.includes('block md:block')) {
  console.log('   Footer visibility: FIXED (block md:block found)');
} else if (publicLayoutContent.includes('hidden md:block')) {
  console.log('   Footer visibility: STILL HIDDEN (hidden md:block found)');
} else {
  console.log('   Footer visibility: UNCLEAR (no specific classes found)');
}

// Check index.css for glass transparency
const cssPath = 'src/index.css';
const cssContent = fs.readFileSync(cssPath, 'utf8');

console.log('\n2. GLASS TRANSPARENCY CHECK:');
const lightModeGlass = cssContent.match(/--glass-bg: rgba\(255, 255, 255, ([\d.]+)\)/);
const darkModeGlass = cssContent.match(/\.dark[^{]*\{[^}]*--glass-bg: rgba\(10, 10, 10, ([\d.]+)\)/);

if (lightModeGlass && darkModeGlass) {
  console.log(`   Light mode glass opacity: ${lightModeGlass[1]}`);
  console.log(`   Dark mode glass opacity: ${darkModeGlass[1]}`);
  if (parseFloat(lightModeGlass[1]) <= 0.1 && parseFloat(darkModeGlass[1]) <= 0.1) {
    console.log('   Glass transparency: FIXED (opacity <= 0.1)');
  } else {
    console.log('   Glass transparency: NOT FIXED (opacity > 0.1)');
  }
} else {
  console.log('   Glass transparency: UNCLEAR (could not find values)');
}

// Check HeroSection.tsx for inline style
const heroPath = 'src/components/public/HeroSection.tsx';
const heroContent = fs.readFileSync(heroPath, 'utf8');

console.log('\n3. INLINE STYLE CHECK:');
if (heroContent.includes('style={{ background:')) {
  console.log('   Inline style: ADDED (found in HeroSection)');
} else {
  console.log('   Inline style: NOT FOUND');
}

// Check if files exist and are readable
console.log('\n4. FILE ACCESS CHECK:');
const files = [publicLayoutPath, cssPath, heroPath];
files.forEach(file => {
  try {
    const stat = fs.statSync(file);
    console.log(`   ${file}: EXISTS (${stat.size} bytes)`);
  } catch (error) {
    console.log(`   ${file}: ERROR (${error.message})`);
  }
});

console.log('\n=== DIAGNOSIS COMPLETE ===');
console.log('\nIf changes are in files but not visible:');
console.log('1. Clear browser cache (Ctrl+F5 or Cmd+Shift+R)');
console.log('2. Restart dev server (kill process 34264 and run npm run dev)');
console.log('3. Check browser dev tools for CSS overrides');
