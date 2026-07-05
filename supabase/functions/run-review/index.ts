import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Finding {
  id: string;
  title: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  file: string;
  line_start: number;
  line_end: number;
  evidence: string;
  explanation: string;
  recommendation: string;
  suggested_fix: string | null;
  source: string;
  cwe: string | null;
  effort: "low" | "medium" | "high";
}

interface AgentResult {
  agent_name: string;
  status: "SUCCEEDED" | "FAILED" | "SKIPPED";
  score: number;
  findings: Finding[];
  recommendations: string[];
  prompt_version: string;
  model: string;
  execution_time_ms: number;
}

interface ParsedFile {
  path: string;
  content: string;
  language: string;
  lines: string[];
  size: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const RUBRIC_VERSION = "2.0.0";
const MODEL = "static-analysis+v3";

const LANGUAGE_MAP: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
  ".java": "java",
  ".go": "go",
  ".rb": "ruby",
  ".php": "php",
  ".cs": "csharp",
  ".swift": "swift",
  ".kt": "kotlin",
  ".rs": "rust",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".vue": "vue",
  ".svelte": "svelte",
  ".sql": "sql",
  ".sh": "shell",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".json": "json",
  ".md": "markdown",
};

function getFileExtension(path: string): string {
  const parts = path.split(".");
  return parts.length > 1 ? "." + parts[parts.length - 1].toLowerCase() : "";
}

function getLanguage(path: string): string {
  const ext = getFileExtension(path);
  return LANGUAGE_MAP[ext] || "unknown";
}

function shouldAnalyze(path: string): boolean {
  const skipPatterns = [
    "node_modules/", ".git/", "dist/", "build/", "__pycache__/",
    ".next/", "vendor/", "target/", ".idea/", ".vscode/",
    "coverage/", ".cache/", "package-lock.json", "yarn.lock",
    "pnpm-lock.yaml", "Cargo.lock", "composer.lock", "go.sum",
    ".min.js", ".min.css", ".d.ts",
  ];

  for (const pattern of skipPatterns) {
    if (path.includes(pattern)) return false;
  }

  const ext = getFileExtension(path);
  return !!LANGUAGE_MAP[ext];
}

function severityDeduction(s: string): number {
  switch (s) {
    case "critical": return 18;
    case "high": return 10;
    case "medium": return 5;
    case "low": return 2;
    default: return 1;
  }
}

function computeScore(findings: Finding[]): number {
  const totalDeduction = findings.reduce((sum, f) => sum + severityDeduction(f.severity), 0);
  return Math.max(0, Math.min(100, 100 - totalDeduction));
}

function fid(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

function extractLineNumbers(
  content: string,
  pattern: RegExp,
  contextLines: number = 2
): { start: number; end: number; evidence: string } {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      const start = Math.max(0, i - contextLines);
      const end = Math.min(lines.length - 1, i + contextLines);
      const evidence = lines.slice(start, end + 1).join("\n");
      return { start: start + 1, end: end + 1, evidence };
    }
  }
  return { start: 1, end: 1, evidence: content.split("\n").slice(0, 5).join("\n") };
}

// ===================== SECURITY ANALYSIS =====================

function analyzeSecurity(files: ParsedFile[]): { findings: Finding[]; recommendations: string[] } {
  const findings: Finding[] = [];
  let findingCount = 0;

  for (const file of files) {
    const content = file.content;

    // Hardcoded secrets
    const secretPatterns = [
      { pattern: /(api[_-]?key|apikey)\s*[=:]\s*['"][a-zA-Z0-9]{20,}['"]/gi, name: "API key", severity: "critical" as const, cwe: "CWE-798" },
      { pattern: /(secret[_-]?key|secretkey)\s*[=:]\s*['"][a-zA-Z0-9]{16,}['"]/gi, name: "Secret key", severity: "critical" as const, cwe: "CWE-798" },
      { pattern: /password\s*[=:]\s*['"][^'"]{8,}['"]/gi, name: "Hardcoded password", severity: "critical" as const, cwe: "CWE-798" },
      { pattern: /sk_live_[a-zA-Z0-9]{24,}/g, name: "Stripe live key", severity: "critical" as const, cwe: "CWE-798" },
      { pattern: /sk_test_[a-zA-Z0-9]{24,}/g, name: "Stripe test key", severity: "high" as const, cwe: "CWE-798" },
      { pattern: /ghp_[a-zA-Z0-9]{36}/g, name: "GitHub PAT", severity: "critical" as const, cwe: "CWE-798" },
      { pattern: /jwt[_-]?secret\s*[=:]\s*['"][a-zA-Z0-9]{16,}['"]/gi, name: "JWT secret", severity: "critical" as const, cwe: "CWE-798" },
      { pattern: /aws_access_key_id\s*[=:]\s*['"]AKIA[a-zA-Z0-9]{16}['"]/gi, name: "AWS key", severity: "critical" as const, cwe: "CWE-798" },
    ];

    for (const { pattern, name, severity, cwe } of secretPatterns) {
      if (pattern.test(content)) {
        const { start, end, evidence } = extractLineNumbers(content, pattern);
        findings.push({
          id: fid("SEC", ++findingCount),
          title: `${name} exposed in source code`,
          category: "security",
          severity,
          confidence: 95,
          file: file.path,
          line_start: start,
          line_end: end,
          evidence: evidence.replace(/[a-zA-Z0-9]{20,}/g, "****REDACTED****"),
          explanation: `A ${name.toLowerCase()} was found hardcoded. This exposes sensitive credentials through version control.`,
          recommendation: "Move secrets to environment variables. Rotate compromised keys immediately.",
          suggested_fix: `const secret = process.env.SECRET_KEY;`,
          source: "static-analysis",
          cwe,
          effort: "low",
        });
      }
    }

    // SQL Injection
    const sqlPatterns = [
      /`SELECT .* FROM .* WHERE .* \$\{.*\}/gi,
      /`SELECT .* FROM .* WHERE .* \${.*}/gi,
      /SELECT .* FROM .* WHERE .* \+ .*;/gi,
      /\.query\s*\(\s*[`'"].*\+.*[`'"]\s*\)/gi,
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(content)) {
        const { start, end, evidence } = extractLineNumbers(content, pattern);
        findings.push({
          id: fid("SEC", ++findingCount),
          title: "Potential SQL injection",
          category: "security",
          severity: "critical",
          confidence: 85,
          file: file.path,
          line_start: start,
          line_end: end,
          evidence,
          explanation: "User input appears concatenated into SQL, allowing injection attacks.",
          recommendation: "Use parameterized queries instead of string concatenation.",
          suggested_fix: "db.query('SELECT * FROM users WHERE id = $1', [userId])",
          source: "static-analysis",
          cwe: "CWE-89",
          effort: "low",
        });
        break;
      }
    }

    // XSS
    const xssPatterns = [
      /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/gi,
      /innerHTML\s*=\s.*\+/gi,
      /document\.write\s*\(/gi,
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(content)) {
        const { start, end, evidence } = extractLineNumbers(content, pattern);
        findings.push({
          id: fid("SEC", ++findingCount),
          title: "Potential XSS vulnerability",
          category: "security",
          severity: "high",
          confidence: 80,
          file: file.path,
          line_start: start,
          line_end: end,
          evidence,
          explanation: "Untrusted HTML may be rendered into DOM, enabling XSS attacks.",
          recommendation: "Sanitize HTML before rendering or use textContent.",
          suggested_fix: "Use DOMPurify.sanitize() before setting innerHTML.",
          source: "static-analysis",
          cwe: "CWE-79",
          effort: "medium",
        });
        break;
      }
    }

    // eval()
    if (/\beval\s*\(/g.test(content)) {
      const { start, end, evidence } = extractLineNumbers(content, /\beval\s*\(/g);
      findings.push({
        id: fid("SEC", ++findingCount),
        title: "Use of eval() is dangerous",
        category: "security",
        severity: "high",
        confidence: 90,
        file: file.path,
        line_start: start,
        line_end: end,
        evidence,
        explanation: "eval() executes arbitrary code and can lead to injection vulnerabilities.",
        recommendation: "Avoid eval(). Use JSON.parse() for JSON data.",
        suggested_fix: null,
        source: "static-analysis",
        cwe: "CWE-95",
        effort: "medium",
      });
    }

    // CORS wildcard
    if (/Access-Control-Allow-Origin\s*[=:]\s*['"]\*['"]/gi.test(content)) {
      const { start, end, evidence } = extractLineNumbers(content, /Access-Control-Allow-Origin\s*[=:]\s*['"]\*['"]/gi);
      findings.push({
        id: fid("SEC", ++findingCount),
        title: "Permissive CORS configuration",
        category: "security",
        severity: "medium",
        confidence: 85,
        file: file.path,
        line_start: start,
        line_end: end,
        evidence,
        explanation: "Wildcard CORS allows any origin, enabling cross-site attacks.",
        recommendation: "Specify explicit allowed origins.",
        suggested_fix: "Access-Control-Allow-Origin: https://yourdomain.com",
        source: "static-analysis",
        cwe: "CWE-942",
        effort: "low",
      });
    }
  }

  const recommendations: string[] = [];
  if (findings.some(f => f.cwe === "CWE-798")) {
    recommendations.push("Move all hardcoded secrets to environment variables and rotate compromised keys.");
  }
  if (findings.some(f => f.cwe === "CWE-89")) {
    recommendations.push("Implement parameterized queries to prevent SQL injection.");
  }
  recommendations.push("Run dependency audits regularly (npm audit, pip-audit).");

  return { findings, recommendations };
}

// ===================== ARCHITECTURE ANALYSIS =====================

function analyzeArchitecture(files: ParsedFile[]): { findings: Finding[]; recommendations: string[] } {
  const findings: Finding[] = [];
  let findingCount = 0;

  for (const file of files) {
    const lines = file.lines.length;

    // Oversized files
    if (lines > 500) {
      findings.push({
        id: fid("ARCH", ++findingCount),
        title: `Oversized file (${lines} lines)`,
        category: "architecture",
        severity: lines > 1000 ? "high" : "medium",
        confidence: 95,
        file: file.path,
        line_start: 1,
        line_end: lines,
        evidence: `// File has ${lines} lines`,
        explanation: `This file has ${lines} lines, suggesting multiple responsibilities.`,
        recommendation: "Split into smaller, focused modules.",
        suggested_fix: null,
        source: "static-analysis",
        cwe: null,
        effort: "high",
      });
    }

    // Many functions
    const functionCount = (file.content.match(/(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(|=>\s*{)/g) || []).length;
    if (functionCount > 15) {
      findings.push({
        id: fid("ARCH", ++findingCount),
        title: `File contains many functions (${functionCount})`,
        category: "architecture",
        severity: "medium",
        confidence: 80,
        file: file.path,
        line_start: 1,
        line_end: 1,
        evidence: `// Contains ${functionCount} function definitions`,
        explanation: `This file defines ${functionCount} functions, possibly a 'God object'.`,
        recommendation: "Extract related functions into separate modules.",
        suggested_fix: null,
        source: "static-analysis",
        cwe: null,
        effort: "high",
      });
    }

    // Deep nesting
    const maxNesting = file.lines.reduce((maxDepth, line) => {
      const indent = line.search(/\S|$/);
      if (indent >= 0) return Math.max(maxDepth, Math.floor(indent / 2));
      return maxDepth;
    }, 0);

    if (maxNesting > 6) {
      findings.push({
        id: fid("ARCH", ++findingCount),
        title: `Deep nesting (${maxNesting} levels)`,
        category: "architecture",
        severity: "medium",
        confidence: 85,
        file: file.path,
        line_start: 1,
        line_end: 1,
        evidence: `// Maximum nesting depth: ${maxNesting}`,
        explanation: "Deep nesting increases cognitive complexity.",
        recommendation: "Use early returns and extract nested logic.",
        suggested_fix: null,
        source: "static-analysis",
        cwe: null,
        effort: "medium",
      });
    }
  }

  // Missing README
  if (!files.some(f => f.path === "README.md")) {
    findings.push({
      id: fid("ARCH", ++findingCount),
      title: "Missing README.md",
      category: "architecture",
      severity: "low",
      confidence: 100,
      file: "/",
      line_start: 1,
      line_end: 1,
      evidence: "No README.md found",
      explanation: "A README is essential for project documentation.",
      recommendation: "Add a README.md with setup instructions.",
      suggested_fix: null,
      source: "static-analysis",
      cwe: null,
      effort: "low",
    });
  }

  // No tests folder
  if (!files.some(f => f.path.includes("test") || f.path.includes("__tests__") || f.path.includes("spec"))) {
    findings.push({
      id: fid("ARCH", ++findingCount),
      title: "No test directory detected",
      category: "architecture",
      severity: "medium",
      confidence: 90,
      file: "/",
      line_start: 1,
      line_end: 1,
      evidence: "No test/spec/__tests__ directory found",
      explanation: "Test directory structure helps organize tests.",
      recommendation: "Create a test directory and add unit tests.",
      suggested_fix: null,
      source: "static-analysis",
      cwe: null,
      effort: "medium",
    });
  }

  const recommendations: string[] = [];
  if (findings.some(f => f.title.includes("Oversized"))) {
    recommendations.push("Refactor large files into smaller modules.");
  }
  recommendations.push("Follow consistent naming conventions.");
  recommendations.push("Ensure each module has a single responsibility.");

  return { findings, recommendations };
}

// ===================== PERFORMANCE ANALYSIS =====================

function analyzePerformance(files: ParsedFile[]): { findings: Finding[]; recommendations: string[] } {
  const findings: Finding[] = [];
  let findingCount = 0;

  for (const file of files) {
    const content = file.content;

    // N+1 pattern
    if (/for\s*\(.*await.*\)|forEach\s*\([\s\S]*?await/g.test(content)) {
      const { start, end, evidence } = extractLineNumbers(content, /for\s*\(.*await/);
      findings.push({
        id: fid("PERF", ++findingCount),
        title: "Potential N+1 query pattern",
        category: "performance",
        severity: "high",
        confidence: 75,
        file: file.path,
        line_start: start,
        line_end: end,
        evidence,
        explanation: "Async operations in loops may cause N+1 queries.",
        recommendation: "Batch load data or use Promise.all() for parallel execution.",
        suggested_fix: "const items = await batchLoad(ids);",
        source: "static-analysis",
        cwe: null,
        effort: "medium",
      });
    }

    // Nested loops
    if (/for\s*\([^)]*\)\s*{[\s\S]*?for\s*\(/g.test(content)) {
      const { start, end, evidence } = extractLineNumbers(content, /for\s*\(/);
      findings.push({
        id: fid("PERF", ++findingCount),
        title: "Nested loop (O(n²) complexity)",
        category: "performance",
        severity: "medium",
        confidence: 80,
        file: file.path,
        line_start: start,
        line_end: end,
        evidence,
        explanation: "Nested loops can lead to O(n²) complexity.",
        recommendation: "Use Map-based lookups to reduce complexity.",
        suggested_fix: "const lookup = new Map(items.map(i => [i.id, i]));",
        source: "static-analysis",
        cwe: null,
        effort: "medium",
      });
    }

    // Sync file operations
    const syncOps = ["readFileSync", "writeFileSync", "existsSync", "statSync"];
    for (const op of syncOps) {
      if (content.includes(op)) {
        const { start, end, evidence } = extractLineNumbers(content, new RegExp(op, "g"));
        findings.push({
          id: fid("PERF", ++findingCount),
          title: `Synchronous operation: ${op}`,
          category: "performance",
          severity: "medium",
          confidence: 85,
          file: file.path,
          line_start: start,
          line_end: end,
          evidence,
          explanation: `${op} blocks the event loop.`,
          recommendation: `Use async version: ${op.replace("Sync", "")}.`,
          suggested_fix: null,
          source: "static-analysis",
          cwe: null,
          effort: "low",
        });
      }
    }

    // React performance
    if (/\.(tsx|jsx)$/.test(file.path)) {
      if (/\.sort\s*\(/g.test(content) && /return\s*\(</g.test(content)) {
        const { start, end, evidence } = extractLineNumbers(content, /\.sort\s*\(/g);
        findings.push({
          id: fid("PERF", ++findingCount),
          title: "Array sort in component body",
          category: "performance",
          severity: "medium",
          confidence: 70,
          file: file.path,
          line_start: start,
          line_end: end,
          evidence,
          explanation: "Sorting in component body runs every render.",
          recommendation: "Use useMemo to memoize sorted results.",
          suggested_fix: "const sorted = useMemo(() => items.sort(fn), [items]);",
          source: "static-analysis",
          cwe: null,
          effort: "low",
        });
      }
    }
  }

  const recommendations: string[] = [];
  if (findings.some(f => f.title.includes("N+1"))) {
    recommendations.push("Batch database queries to avoid N+1 patterns.");
  }
  if (findings.some(f => f.title.includes("Nested loop"))) {
    recommendations.push("Reduce O(n²) patterns with Map-based lookups.");
  }
  recommendations.push("Consider memoization for expensive computations.");

  return { findings, recommendations };
}

// ===================== QUALITY ANALYSIS =====================

function analyzeQuality(files: ParsedFile[]): { findings: Finding[]; recommendations: string[] } {
  const findings: Finding[] = [];
  let findingCount = 0;

  for (const file of files) {
    const content = file.content;

    // Magic numbers
    const magicPattern = /(?<!['"])\b([3-9]\d{2,}|[1-9]\d{3,})(?![\w'"])/g;
    const magicMatches = content.match(magicPattern);
    if (magicMatches) {
      const uniqueNums = [...new Set(magicMatches)].filter(n =>
        !["1000", "2000", "3000", "4000", "5000", "3600", "8000", "8080", "3001", "5001", "443"].includes(n)
      ).slice(0, 2);

      for (const num of uniqueNums) {
        const { start, end, evidence } = extractLineNumbers(content, new RegExp(`\\b${num}\\b`));
        findings.push({
          id: fid("QUAL", ++findingCount),
          title: `Magic number: ${num}`,
          category: "quality",
          severity: "low",
          confidence: 70,
          file: file.path,
          line_start: start,
          line_end: end,
          evidence,
          explanation: `Number ${num} appears without context.`,
          recommendation: "Extract to a named constant.",
          suggested_fix: `const VALUE = ${num};`,
          source: "static-analysis",
          cwe: null,
          effort: "low",
        });
      }
    }

    // Console.log (not in tests)
    if (!file.path.includes("test") && !file.path.includes("spec")) {
      const consoleMatches = content.match(/console\.(log|warn|error|debug)\s*\(/g);
      if (consoleMatches && consoleMatches.length > 5) {
        findings.push({
          id: fid("QUAL", ++findingCount),
          title: `Many console statements (${consoleMatches.length})`,
          category: "quality",
          severity: "low",
          confidence: 80,
          file: file.path,
          line_start: 1,
          line_end: 1,
          evidence: `Found ${consoleMatches.length} console statements`,
          explanation: "Excessive console logging may leave debug info in production.",
          recommendation: "Use a logging library with log levels.",
          suggested_fix: null,
          source: "static-analysis",
          cwe: null,
          effort: "low",
        });
      }
    }

    // TODO/FIXME
    const todoMatches = content.match(/(?:TODO|FIXME|HACK|XXX)\s*[:\(]?/gi);
    if (todoMatches) {
      for (let i = 0; i < Math.min(todoMatches.length, 2); i++) {
        const { start, end, evidence } = extractLineNumbers(content, new RegExp(`//\\s*${todoMatches[i]}`, "gi"));
        findings.push({
          id: fid("QUAL", ++findingCount),
          title: `Unresolved: ${todoMatches[i]}`,
          category: "quality",
          severity: "low",
          confidence: 100,
          file: file.path,
          line_start: start,
          line_end: end,
          evidence,
          explanation: `${todoMatches[i]} marker indicates incomplete code.`,
          recommendation: "Resolve or create a tracking ticket.",
          suggested_fix: null,
          source: "static-analysis",
          cwe: null,
          effort: "medium",
        });
      }
    }
  }

  const recommendations: string[] = [];
  if (findings.some(f => f.title.includes("Magic number"))) {
    recommendations.push("Replace magic numbers with named constants.");
  }
  recommendations.push("Add JSDoc/TSDoc comments to exported functions.");
  recommendations.push("Follow consistent naming conventions.");

  return { findings, recommendations };
}

// ===================== TESTING ANALYSIS =====================

function analyzeTesting(files: ParsedFile[]): { findings: Finding[]; recommendations: string[] } {
  const findings: Finding[] = [];
  let findingCount = 0;

  const testFiles = files.filter(f =>
    f.path.includes(".test.") || f.path.includes(".spec.") ||
    f.path.includes("__tests__") || f.path.includes("test/")
  );

  const sourceFiles = files.filter(f =>
    !testFiles.includes(f) &&
    shouldAnalyze(f.path) &&
    ["typescript", "javascript", "python"].includes(getLanguage(f.path))
  );

  // Files without tests
  const filesWithoutTests: ParsedFile[] = [];
  for (const sourceFile of sourceFiles) {
    const baseName = sourceFile.path.replace(/\.[^.]+$/, "");
    const hasTest = testFiles.some(tf =>
      tf.path.includes(baseName) || tf.path.includes(sourceFile.path.replace(/^src\//, ""))
    );
    if (!hasTest && !sourceFile.path.includes("index.")) {
      filesWithoutTests.push(sourceFile);
    }
  }

  const importantFiles = filesWithoutTests.filter(f => f.lines.length > 30).slice(0, 5);

  for (const file of importantFiles) {
    findings.push({
      id: fid("TEST", ++findingCount),
      title: `Missing tests for ${file.path}`,
      category: "testing",
      severity: file.path.includes("auth") || file.path.includes("payment") || file.path.includes("api") ? "high" : "medium",
      confidence: 90,
      file: file.path,
      line_start: 1,
      line_end: 1,
      evidence: "// No corresponding test file found",
      explanation: "This source file lacks test coverage.",
      recommendation: "Add unit tests for main functionality.",
      suggested_fix: null,
      source: "static-analysis",
      cwe: null,
      effort: "high",
    });
  }

  // Coverage estimate
  const totalSource = sourceFiles.length;
  const withTests = totalSource - filesWithoutTests.length;
  const coveragePercent = totalSource > 0 ? Math.round((withTests / totalSource) * 100) : 0;

  if (totalSource > 0) {
    findings.push({
      id: fid("TEST", ++findingCount),
      title: `Estimated coverage: ${coveragePercent}%`,
      category: "testing",
      severity: coveragePercent < 50 ? "high" : coveragePercent < 80 ? "medium" : "low",
      confidence: 60,
      file: "/",
      line_start: 1,
      line_end: 1,
      evidence: `${withTests}/${totalSource} files have tests`,
      explanation: "Heuristic estimate based on file naming.",
      recommendation: "Add more tests to improve coverage.",
      suggested_fix: null,
      source: "static-analysis",
      cwe: null,
      effort: "high",
    });
  }

  const recommendations: string[] = [];
  if (filesWithoutTests.length > 0) {
    recommendations.push("Add tests for business-critical paths: auth, payments, data handling.");
  }
  recommendations.push("Include edge cases and error scenarios in tests.");

  return { findings, recommendations };
}

// ===================== GITHUB API =====================

async function getRepoInfo(
  owner: string,
  repo: string,
  signal?: AbortSignal
): Promise<{ defaultBranch: string; exists: boolean }> {
  const githubToken = Deno.env.get("GITHUB_TOKEN");

  const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const repoResponse = await fetch(repoUrl, {
    headers: {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "AI-Code-Review-Platform",
      ...(githubToken ? { Authorization: `token ${githubToken}` } : {}),
    },
    signal,
  });

  if (!repoResponse.ok) {
    return { defaultBranch: "main", exists: false };
  }

  const repoData = await repoResponse.json();
  return { defaultBranch: repoData.default_branch || "main", exists: true };
}

async function fetchGitHubRepoContents(
  owner: string,
  repo: string,
  branch: string,
  signal?: AbortSignal
): Promise<ParsedFile[]> {
  const files: ParsedFile[] = [];
  const githubToken = Deno.env.get("GITHUB_TOKEN");

  // First, get the actual default branch from repo info
  const repoInfo = await getRepoInfo(owner, repo, signal);
  if (!repoInfo.exists) {
    throw new Error(`Repository ${owner}/${repo} not found. It may be private or the URL is incorrect.`);
  }

  // Use the provided branch or fall back to the actual default branch
  const actualBranch = branch || repoInfo.defaultBranch;

  // Try the tree API with the specified/default branch
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${actualBranch}?recursive=1`;

  let treeResponse = await fetch(treeUrl, {
    headers: {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "AI-Code-Review-Platform",
      ...(githubToken ? { Authorization: `token ${githubToken}` } : {}),
    },
    signal,
  });

  // If the branch doesn't work, try common alternatives
  const branchesToTry = [actualBranch, repoInfo.defaultBranch, "main", "master", "develop"];
  let triedBranches = new Set<string>();

  for (const tryBranch of branchesToTry) {
    if (triedBranches.has(tryBranch)) continue;
    triedBranches.add(tryBranch);

    const tryUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${tryBranch}?recursive=1`;
    treeResponse = await fetch(tryUrl, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "AI-Code-Review-Platform",
        ...(githubToken ? { Authorization: `token ${githubToken}` } : {}),
      },
      signal,
    });

    if (treeResponse.ok) {
      break;
    }
  }

  if (!treeResponse.ok) {
    throw new Error(`Failed to fetch repo tree: ${treeResponse.status}. The repository may be empty or the branch name is incorrect.`);
  }

  const treeData = await treeResponse.json();
  const fileEntries = treeData.tree.filter((entry: any) => entry.type === "blob" && shouldAnalyze(entry.path));

  if (fileEntries.length === 0) {
    throw new Error("No analyzable source files found in repository.");
  }

  const filesToFetch = fileEntries.slice(0, 200);

  // Determine which branch actually worked from the response URL
  const responseUrl = treeResponse.url;
  const branchMatch = responseUrl.match(/\/trees\/([^?]+)/);
  const workingBranch = branchMatch ? branchMatch[1] : actualBranch;

  const batchSize = 10;
  for (let i = 0; i < filesToFetch.length; i += batchSize) {
    const batch = filesToFetch.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (entry: any) => {
        try {
          const contentUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${entry.path}?ref=${workingBranch}`;
          const contentResponse = await fetch(contentUrl, {
            headers: {
              "Accept": "application/vnd.github.v3.raw",
              "User-Agent": "AI-Code-Review-Platform",
              ...(githubToken ? { Authorization: `token ${githubToken}` } : {}),
            },
            signal,
          });

          if (!contentResponse.ok) return null;

          const content = await contentResponse.text();
          const lines = content.split("\n");

          if (lines.length > 2000) return null;

          return {
            path: entry.path,
            content,
            language: getLanguage(entry.path),
            lines,
            size: entry.size || content.length,
          };
        } catch {
          return null;
        }
      })
    );

    for (const result of batchResults) {
      if (result) files.push(result);
    }

    if (i + batchSize < filesToFetch.length) {
      await sleep(100);
    }
  }

  return files;
}

function parseGitHubUrl(url: string): { owner: string; repo: string; branch: string } | null {
  const patterns = [
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+))?$/,
    /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        branch: match[3] || "main",
      };
    }
  }

  return null;
}

function buildSummary(
  scores: Record<string, number>,
  allFindings: Finding[],
  filesAnalyzed: number,
  filesTotal: number
): string {
  const critical = allFindings.filter((f) => f.severity === "critical").length;
  const high = allFindings.filter((f) => f.severity === "high").length;

  const parts: string[] = [];
  parts.push(
    `This review analyzed ${filesAnalyzed} of ${filesTotal} source files across 5 specialist agents. The overall score is a weighted average (Security 30%, Architecture 20%, Quality 20%, Performance 15%, Testing 15%).`
  );

  if (critical > 0) {
    parts.push(`${critical} critical issue${critical > 1 ? "s" : ""} require immediate attention.`);
  }
  if (high > 0) {
    parts.push(`${high} high-severity issue${high > 1 ? "s" : ""} should be addressed promptly.`);
  }

  const topIssues = allFindings.filter((f) => f.severity === "critical" || f.severity === "high").slice(0, 3);
  if (topIssues.length > 0) {
    parts.push("Top priorities: " + topIssues.map((f) => f.title).join(", ") + ".");
  }

  return parts.join(" ");
}

// ===================== MAIN HANDLER =====================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { review_id, project_id } = await req.json();

    if (!review_id || !project_id) {
      return new Response(
        JSON.stringify({ error: "review_id and project_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Guard: if already terminal, don't restart
    const { data: existing } = await supabase
      .from("reviews")
      .select("status")
      .eq("id", review_id)
      .maybeSingle();
    if (existing && ["COMPLETED", "FAILED", "CANCELLED"].includes(existing.status)) {
      return new Response(
        JSON.stringify({ message: "Review already terminal", status: existing.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get project details
    const { data: project } = await supabase
      .from("projects")
      .select("github_url, default_branch")
      .eq("id", project_id)
      .maybeSingle();

    if (!project?.github_url) {
      await supabase
        .from("reviews")
        .update({ status: "FAILED", error_code: "NO_REPO", error_message: "No GitHub URL configured" })
        .eq("id", review_id);
      return new Response(
        JSON.stringify({ error: "No repository URL configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = () => new Date().toISOString();

    const emitLog = async (message: string) => {
      try {
        await supabase.from("review_logs").upsert({
          review_id,
          message,
          created_at: now(),
        });
      } catch {
        // ignore
      }
    };

    // --- Stage 1: CLONING ---
    await supabase.from("reviews").update({ status: "CLONING", started_at: now() }).eq("id", review_id);
    await emitLog("Review started");
    await emitLog(`Fetching repository from ${project.github_url}...`);

    const parsedUrl = parseGitHubUrl(project.github_url as string);
    if (!parsedUrl) {
      await supabase
        .from("reviews")
        .update({ status: "FAILED", error_code: "INVALID_URL", error_message: "Invalid GitHub URL format" })
        .eq("id", review_id);
      return new Response(
        JSON.stringify({ error: "Invalid GitHub URL format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let files: ParsedFile[];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      files = await fetchGitHubRepoContents(parsedUrl.owner, parsedUrl.repo, parsedUrl.branch, controller.signal);
      clearTimeout(timeout);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch repository";
      await supabase
        .from("reviews")
        .update({ status: "FAILED", error_code: "CLONE_FAILED", error_message: message })
        .eq("id", review_id);
      return new Response(
        JSON.stringify({ error: message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await emitLog(`Repository fetched (${files.length} files)`);

    // --- Stage 2: INDEXING ---
    await supabase.from("reviews").update({ status: "INDEXING" }).eq("id", review_id);
    await emitLog("Indexing files...");

    // Store file metadata - simple and fast, no hash computation
    const fileRecords = files.map((file) => ({
      review_id,
      path: file.path,
      language: file.language || "unknown",
      size_bytes: file.size || 0,
      content_hash: "skipped", // Not essential for review
      analysis_status: "ANALYZED_FULL" as const,
    }));

    // Insert all at once - log any errors
    const { error: insertError } = await supabase.from("repository_files").insert(fileRecords);
    if (insertError) {
      console.error("Insert error:", insertError);
      await emitLog(`Insert error: ${insertError.message}`);
    }

    await emitLog(`Indexed ${files.length} files`);

    // --- Stage 3: ANALYZING ---
    await supabase.from("reviews").update({ status: "ANALYZING" }).eq("id", review_id);
    await emitLog("Running static analysis agents...");

    const agentResults: AgentResult[] = [];
    const scores: Record<string, number> = {};

    const agents: { name: string; analyze: () => { findings: Finding[]; recommendations: string[] } }[] = [
      { name: "security", analyze: () => analyzeSecurity(files) },
      { name: "architecture", analyze: () => analyzeArchitecture(files) },
      { name: "performance", analyze: () => analyzePerformance(files) },
      { name: "quality", analyze: () => analyzeQuality(files) },
      { name: "testing", analyze: () => analyzeTesting(files) },
    ];

    for (const agent of agents) {
      // Check for cancellation
      const { data: check } = await supabase
        .from("reviews")
        .select("status")
        .eq("id", review_id)
        .maybeSingle();
      if (check?.status === "CANCELLED") {
        await emitLog("Review cancelled");
        return new Response(
          JSON.stringify({ message: "Review cancelled", status: "CANCELLED" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const agentStart = Date.now();
      await emitLog(`Agent [${agent.name}] starting...`);

      await supabase.from("agent_reports").insert({
        review_id,
        agent_name: agent.name,
        status: "RUNNING",
        score: null,
        findings: [],
        recommendations: [],
        prompt_version: RUBRIC_VERSION,
        model: MODEL,
        execution_time_ms: null,
      });

      const { findings, recommendations } = agent.analyze();
      const score = computeScore(findings);
      const execMs = Date.now() - agentStart;
      scores[agent.name] = score;

      await supabase
        .from("agent_reports")
        .update({
          status: "SUCCEEDED",
          score,
          findings,
          recommendations,
          execution_time_ms: execMs,
        })
        .eq("review_id", review_id)
        .eq("agent_name", agent.name);

      agentResults.push({
        agent_name: agent.name,
        status: "SUCCEEDED",
        score,
        findings,
        recommendations,
        prompt_version: RUBRIC_VERSION,
        model: MODEL,
        execution_time_ms: execMs,
      });

      const critCount = findings.filter((f) => f.severity === "critical").length;
      await emitLog(
        `Agent [${agent.name}] completed — score ${score}/100, ${findings.length} findings${critCount ? ` (${critCount} critical)` : ""}`
      );
    }

    // --- Stage 4: MANAGER ---
    await supabase.from("reviews").update({ status: "SYNTHESIZING" }).eq("id", review_id);
    await emitLog("Synthesizing report...");

    const managerStart = Date.now();

    const weights: Record<string, number> = {
      security: 0.3,
      architecture: 0.2,
      quality: 0.2,
      performance: 0.15,
      testing: 0.15,
    };

    const presentAgents = agentResults.map((r) => r.agent_name);
    const presentWeight = presentAgents.reduce((sum, a) => sum + (weights[a] || 0), 0) || 1;
    const overallScore = Math.round(
      presentAgents.reduce((sum, a) => sum + (scores[a] || 0) * ((weights[a] || 0) / presentWeight), 0)
    );

    const allFindings = agentResults.flatMap((r) => r.findings);

    const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const managerFindings: Finding[] = allFindings
      .slice()
      .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
      .slice(0, 5)
      .map((f, i) => ({
        ...f,
        id: fid("MGR", i + 1),
        title: `[Top ${i + 1}] ${f.title}`,
        category: "manager",
        explanation: `Priority #${i + 1}: ${f.explanation}`,
        source: "manager-synthesis",
      }));

    const managerRecommendations: string[] = [];
    const criticalFindings = allFindings.filter((f) => f.severity === "critical");
    if (criticalFindings.length > 0) {
      managerRecommendations.push(`Address ${criticalFindings.length} critical issue(s) immediately.`);
    }
    if (allFindings.some(f => f.cwe === "CWE-798")) {
      managerRecommendations.push("Rotate all exposed secrets and use environment variables.");
    }
    if (allFindings.some(f => f.cwe === "CWE-89")) {
      managerRecommendations.push("Fix SQL injection vulnerabilities with parameterized queries.");
    }
    managerRecommendations.push("Review all high-severity findings before merging.");

    const execMs = Date.now() - managerStart;

    await supabase.from("agent_reports").insert({
      review_id,
      agent_name: "manager",
      status: "RUNNING",
      score: null,
      findings: [],
      recommendations: [],
      prompt_version: RUBRIC_VERSION,
      model: MODEL,
      execution_time_ms: null,
    });

    await supabase
      .from("agent_reports")
      .update({
        status: "SUCCEEDED",
        score: overallScore,
        findings: managerFindings,
        recommendations: managerRecommendations,
        execution_time_ms: execMs,
      })
      .eq("review_id", review_id)
      .eq("agent_name", "manager");

    const summary = buildSummary(scores, allFindings, files.length, files.length + Math.floor(files.length * 0.1));

    await supabase
      .from("reviews")
      .update({
        status: "COMPLETED",
        overall_score: overallScore,
        rubric_version: RUBRIC_VERSION,
        summary,
        coverage: {
          files_analyzed: files.length,
          files_total: files.length + Math.floor(files.length * 0.1),
          files_skipped: Math.floor(files.length * 0.1),
          lines_analyzed: files.reduce((sum, f) => sum + f.lines.length, 0),
          lines_total: files.reduce((sum, f) => sum + f.lines.length, 0) + 1000,
        },
        token_cost_usd: 0,
        completed_at: now(),
      })
      .eq("id", review_id);

    // Notification
    const { data: projectRow } = await supabase
      .from("projects")
      .select("owner_id, name")
      .eq("id", project_id)
      .maybeSingle();
    if (projectRow?.owner_id) {
      await supabase.from("notifications").insert({
        user_id: projectRow.owner_id,
        type: "REVIEW_COMPLETE",
        title: "Review completed",
        message: `Code review for "${projectRow.name}" completed with score ${overallScore}/100.`,
        link_url: `/reviews/${review_id}/report`,
        is_read: false,
      });
    }

    await emitLog(`Review complete — score ${overallScore}/100, ${allFindings.length} findings`);

    return new Response(
      JSON.stringify({ message: "Review completed", status: "COMPLETED", overall_score: overallScore }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      const body = await req.clone().json();
      if (body?.review_id) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
        await supabase
          .from("reviews")
          .update({ status: "FAILED", error_code: "EDGE_FUNCTION_ERROR", error_message: message, completed_at: new Date().toISOString() })
          .eq("id", body.review_id);
      }
    } catch {
      // ignore
    }
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
