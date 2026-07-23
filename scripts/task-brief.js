const fs = require('fs');
const path = require('path');

const planFile = process.argv[2];
const taskNum = process.argv[3];
const outFile = process.argv[4] || path.join(__dirname, '..', '.superpowers', 'sdd', `task-${taskNum}-brief.md`);

if (!planFile || !taskNum) {
  console.error("Usage: node task-brief.js <plan_file> <task_num> [out_file]");
  process.exit(1);
}

const content = fs.readFileSync(planFile, 'utf8');
const lines = content.split('\n');

let inFence = false;
let intask = false;
let briefLines = [];

for (let line of lines) {
  if (line.trim().startsWith('```')) {
    inFence = !inFence;
  }
  if (!inFence) {
    const taskHeaderMatch = line.match(/^#+[ \t]+Task[ \t]+([0-9]+)/i);
    if (taskHeaderMatch) {
      intask = (taskHeaderMatch[1] === taskNum);
    }
  }
  if (intask) {
    briefLines.push(line);
  }
}

if (briefLines.length === 0) {
  console.error(`Task ${taskNum} not found in ${planFile}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, briefLines.join('\n'), 'utf8');
console.log(`Wrote brief to ${outFile}`);
