import fs from 'fs';
import path from 'path';

const dir = 'c:/Users/ViP/Downloads/financecalc';
let count = 0;
fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.html')) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const target = 'class="hidden lg:flex items-center gap-5 text-xs font-semibold text-slate-600"';
    const replacement = 'class="hidden lg:flex items-center gap-3 text-xs font-semibold text-slate-600"';
    if (content.includes(target)) {
      content = content.replace(target, replacement);
      fs.writeFileSync(filePath, content, 'utf8');
      count++;
    }
  }
});
console.log(`Successfully updated navigation gap to gap-3 in ${count} HTML files.`);
