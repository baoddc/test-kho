const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const sddDir = path.join(rootDir, '.superpowers', 'sdd');

// Ensure workspace exists
function ensureWorkspace() {
  if (!fs.existsSync(sddDir)) {
    fs.mkdirSync(sddDir, { recursive: true });
  }
  fs.writeFileSync(path.join(sddDir, '.gitignore'), '*\n');
  return sddDir;
}

// Extract task brief
function taskBrief(planFile, taskNum) {
  ensureWorkspace();
  const planPath = path.resolve(rootDir, planFile);
  if (!fs.existsSync(planPath)) {
    console.error(`Error: Plan file not found: ${planPath}`);
    process.exit(2);
  }

  const content = fs.readFileSync(planPath, 'utf8');
  const lines = content.split(/\r?\n/);
  
  let inTask = false;
  let inFence = false;
  const taskLines = [];
  
  // Match heading like "### Task 1: ..." or "## Task 1"
  const taskHeadingRegex = new RegExp(`^#+[ \\t]+Task[ \\t]+${taskNum}([^0-9]|$)`, 'i');
  const genericTaskHeadingRegex = /^#+[ \t]+Task[ \t]+[0-9]+/i;

  for (const line of lines) {
    if (line.startsWith('```')) {
      inFence = !inFence;
    }
    
    if (!inFence && genericTaskHeadingRegex.test(line)) {
      if (taskHeadingRegex.test(line)) {
        inTask = true;
      } else {
        inTask = false;
      }
    }
    
    if (inTask) {
      taskLines.push(line);
    }
  }

  if (taskLines.length === 0) {
    console.error(`Error: Task ${taskNum} not found in ${planFile}`);
    process.exit(3);
  }

  const outFile = path.join(sddDir, `task-${taskNum}-brief.md`);
  fs.writeFileSync(outFile, taskLines.join('\n') + '\n', 'utf8');
  console.log(`wrote ${outFile}: ${taskLines.length} lines`);
}

// Generate review package
function reviewPackage(base, head) {
  ensureWorkspace();
  
  let baseShort, headShort;
  try {
    baseShort = execSync(`git rev-parse --short ${base}`, { encoding: 'utf8' }).trim();
    headShort = execSync(`git rev-parse --short ${head}`, { encoding: 'utf8' }).trim();
  } catch (err) {
    console.error(`Error verifying commits: ${base} or ${head}`);
    process.exit(2);
  }

  const logOutput = execSync(`git log --oneline ${base}..${head}`, { encoding: 'utf8' });
  const statOutput = execSync(`git diff --stat ${base}..${head}`, { encoding: 'utf8' });
  const diffOutput = execSync(`git diff -U10 ${base}..${head}`, { encoding: 'utf8' });

  const packageContent = [
    `# Review package: ${base}..${head}`,
    '',
    '## Commits',
    logOutput,
    '## Files changed',
    statOutput,
    '## Diff',
    diffOutput
  ].join('\n');

  const outFile = path.join(sddDir, `review-${baseShort}..${headShort}.diff`);
  fs.writeFileSync(outFile, packageContent, 'utf8');
  
  const commitCount = execSync(`git rev-list --count ${base}..${head}`, { encoding: 'utf8' }).trim();
  const byteCount = Buffer.byteLength(packageContent, 'utf8');
  
  console.log(`wrote ${outFile}: ${commitCount} commit(s), ${byteCount} bytes`);
}

// CLI Routing
const args = process.argv.slice(2);
const command = args[0];

if (command === 'task-brief') {
  if (args.length < 3) {
    console.error('Usage: node sdd-util.js task-brief PLAN_FILE TASK_NUMBER');
    process.exit(1);
  }
  taskBrief(args[1], args[2]);
} else if (command === 'review-package') {
  if (args.length < 3) {
    console.error('Usage: node sdd-util.js review-package BASE HEAD');
    process.exit(1);
  }
  reviewPackage(args[1], args[2]);
} else {
  console.error('Unknown command. Available commands: task-brief, review-package');
  process.exit(1);
}
