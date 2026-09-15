import vm from 'vm';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TestCase {
  input: string; // e.g. "[[2,7,11,15], 9]"
  expected: string; // e.g. "[0,1]"
}

export interface ExecutionResult {
  status: 'ACCEPTED' | 'WRONG_ANSWER' | 'COMPILE_ERROR' | 'TIME_LIMIT_EXCEEDED';
  testsPassed: number;
  totalTests: number;
  executionTimeMs: number;
  results: {
    testIndex: number;
    passed: boolean;
    actual?: string;
    expected: string;
    error?: string;
  }[];
}

const MAX_CODE_LENGTH = 50000;

// JavaScript Blacklisted Patterns for Static Security Scan
const JS_FORBIDDEN_PATTERNS = [
  /\bprocess\b/,
  /\bglobal\b/,
  /\bglobalThis\b/,
  /\brequire\b/,
  /\bimport\b/,
  /\beval\b/,
  /\bFunction\b/,
  /\bconstructor\b/,
  /\b__proto__\b/,
  /\bmainModule\b/,
  /\bbinding\b/,
  /\bBuffer\b/,
  /\bchild_process\b/,
  /\bfs\b/,
  /\bos\b/,
  /\bpath\b/,
  /\bnet\b/,
  /\bhttp\b/,
  /\bhttps\b/,
  /\bReflect\b/,
  /\bProxy\b/,
];

// Python Blacklisted Patterns for Static Security Scan
const PYTHON_FORBIDDEN_PATTERNS = [
  /\bimport\s+os\b/,
  /\bfrom\s+os\b/,
  /\bimport\s+sys\b/,
  /\bfrom\s+sys\b/,
  /\bimport\s+subprocess\b/,
  /\bfrom\s+subprocess\b/,
  /\bimport\s+shutil\b/,
  /\bimport\s+socket\b/,
  /\bimport\s+urllib\b/,
  /\bimport\s+http\b/,
  /\bimport\s+pickle\b/,
  /\bimport\s+ctypes\b/,
  /\bimport\s+importlib\b/,
  /\bimport\s+builtins\b/,
  /\b__import__\b/,
  /\beval\s*\(/,
  /\bexec\s*\(/,
  /\bopen\s*\(/,
  /\bglobals\s*\(/,
  /\blocals\s*\(/,
  /\bgetattr\s*\(/,
  /\bsetattr\s*\(/,
  /\bcompile\s*\(/,
  /\b__subclasses__\b/,
  /\b__bases__\b/,
  /\b__mro__\b/,
  /\b__globals__\b/,
];

/**
 * Validate code against static security rules before execution.
 */
function validateCodeSecurity(code: string, language: 'javascript' | 'python'): string | null {
  if (!code || typeof code !== 'string') {
    return 'Code submission is empty or invalid';
  }

  if (code.length > MAX_CODE_LENGTH) {
    return `Code exceeds maximum allowed length of ${MAX_CODE_LENGTH} characters`;
  }

  const patterns = language === 'javascript' ? JS_FORBIDDEN_PATTERNS : PYTHON_FORBIDDEN_PATTERNS;

  for (const pattern of patterns) {
    if (pattern.test(code)) {
      return `Security Policy Violation: Forbidden statement or identifier detected (${pattern.source})`;
    }
  }

  return null;
}

/**
 * Safely execute user code against test cases with isolated sandboxing.
 */
export async function runTestsLocally(
  code: string,
  language: 'javascript' | 'python',
  testCases: TestCase[]
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const results = [];
  let testsPassed = 0;

  // 1. Static Security Scan
  const secError = validateCodeSecurity(code, language);
  if (secError) {
    return {
      status: 'COMPILE_ERROR',
      testsPassed: 0,
      totalTests: testCases.length,
      executionTimeMs: Date.now() - startTime,
      results: [
        {
          testIndex: 0,
          passed: false,
          expected: '',
          error: secError,
        },
      ],
    };
  }

  if (language === 'javascript') {
    try {
      // Find entry function name safely
      const fnMatch = code.match(/function\s+([a-zA-Z0-9_$]+)/) || code.match(/(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=/);
      const fnName = fnMatch ? fnMatch[1] : 'solution';

      // Construct hardened null-prototype sandbox context
      const sandbox = Object.create(null);
      sandbox.console = Object.freeze({ log: () => {} });
      sandbox.JSON = JSON;
      sandbox.Math = Math;
      sandbox.Array = Array;
      sandbox.Object = Object;
      sandbox.String = String;
      sandbox.Number = Number;
      sandbox.Boolean = Boolean;
      sandbox.RegExp = RegExp;

      vm.createContext(sandbox);

      // Execute code definition inside sandbox with 1000ms limit
      vm.runInNewContext(code, sandbox, { timeout: 1000 });

      if (typeof sandbox[fnName] !== 'function') {
        throw new Error(`Target function '${fnName}' is not defined or is not a valid function`);
      }

      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        try {
          const args = JSON.parse(tc.input);
          const expected = JSON.parse(tc.expected);

          const actual = sandbox[fnName](...args);
          const passed = JSON.stringify(actual) === JSON.stringify(expected);
          if (passed) testsPassed++;

          results.push({
            testIndex: i,
            passed,
            actual: JSON.stringify(actual),
            expected: JSON.stringify(expected),
          });
        } catch (err: any) {
          results.push({
            testIndex: i,
            passed: false,
            expected: tc.expected,
            error: err.message || String(err),
          });
        }
      }

      const executionTimeMs = Date.now() - startTime;
      const allPassed = testsPassed === testCases.length && testCases.length > 0;

      return {
        status: allPassed ? 'ACCEPTED' : 'WRONG_ANSWER',
        testsPassed,
        totalTests: testCases.length,
        executionTimeMs,
        results,
      };
    } catch (err: any) {
      const isTimeout = err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' || err.message?.includes('timed out');
      return {
        status: isTimeout ? 'TIME_LIMIT_EXCEEDED' : 'COMPILE_ERROR',
        testsPassed: 0,
        totalTests: testCases.length,
        executionTimeMs: Date.now() - startTime,
        results: [
          {
            testIndex: 0,
            passed: false,
            expected: '',
            error: isTimeout ? 'Execution time limit exceeded (1000ms)' : err.message || String(err),
          },
        ],
      };
    }
  } else if (language === 'python') {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freere-'));
    try {
      const fnMatch = code.match(/def\s+([a-zA-Z0-9_$]+)/);
      const fnName = fnMatch ? fnMatch[1] : 'solution';

      const solutionPath = path.join(tmpDir, 'user_solution.py');
      const testsPath = path.join(tmpDir, 'tests.json');
      const runnerPath = path.join(tmpDir, 'runner.py');

      fs.writeFileSync(solutionPath, code);
      fs.writeFileSync(testsPath, JSON.stringify(testCases));

      // Runner script reads solution and tests without inline interpolation
      const runnerCode = `import json
import sys
sys.path.insert(0, r'${tmpDir.replace(/\\/g, '\\\\')}')
import user_solution

def run():
    with open('${testsPath.replace(/\\/g, '\\\\')}', 'r') as f:
        test_cases = json.load(f)
    results = []

    for i, tc in enumerate(test_cases):
        try:
            args = json.loads(tc['input'])
            expected = json.loads(tc['expected'])
            fn = getattr(user_solution, '${fnName}')
            actual = fn(*args) if isinstance(args, list) else fn(args)
            passed = actual == expected
            results.append({
                "testIndex": i,
                "passed": passed,
                "actual": json.dumps(actual),
                "expected": json.dumps(expected)
            })
        except Exception as e:
            results.append({
                "testIndex": i,
                "passed": False,
                "expected": tc['expected'],
                "error": str(e)
            })

    print(json.dumps(results))

if __name__ == '__main__':
    run()
`;
      fs.writeFileSync(runnerPath, runnerCode);

      const pythonCmd = os.platform() === 'win32' ? 'python' : 'python3';
      let output = '';

      try {
        // Run with isolated execution flags (-S -I -E -B -u) and stripped environment
        output = execFileSync(
          pythonCmd,
          ['-S', '-I', '-E', '-B', '-u', runnerPath],
          {
            cwd: tmpDir,
            timeout: 2500,
            encoding: 'utf-8',
            maxBuffer: 1024 * 1024,
            env: { PATH: process.env.PATH || '' }, // Strip all application environment secrets
          }
        ).toString();
      } catch (err: any) {
        const isTimeout = err.code === 'ETIMEDOUT' || err.killed || err.signal === 'SIGTERM';
        return {
          status: isTimeout ? 'TIME_LIMIT_EXCEEDED' : 'COMPILE_ERROR',
          testsPassed: 0,
          totalTests: testCases.length,
          executionTimeMs: Date.now() - startTime,
          results: [
            {
              testIndex: 0,
              passed: false,
              expected: '',
              error: isTimeout ? 'Python execution time limit exceeded (2500ms)' : err.stderr?.toString() || err.message || 'Python execution error',
            },
          ],
        };
      }

      const parsed = JSON.parse(output.trim());
      parsed.forEach((r: any) => {
        if (r.passed) testsPassed++;
        results.push(r);
      });

      const executionTimeMs = Date.now() - startTime;
      const allPassed = testsPassed === testCases.length && testCases.length > 0;

      return {
        status: allPassed ? 'ACCEPTED' : 'WRONG_ANSWER',
        testsPassed,
        totalTests: testCases.length,
        executionTimeMs,
        results,
      };
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }

  return {
    status: 'COMPILE_ERROR',
    testsPassed: 0,
    totalTests: testCases.length,
    executionTimeMs: Date.now() - startTime,
    results: [],
  };
}
