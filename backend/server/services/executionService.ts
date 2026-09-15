import vm from 'vm';
import { execSync } from 'child_process';
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

/**
 * Safely execute user code against test cases.
 * JavaScript uses Node vm context with sandbox restrictions and timeouts.
 * Python uses an isolated script execution with timeout limits.
 */
export async function runTestsLocally(
  code: string,
  language: 'javascript' | 'python',
  testCases: TestCase[]
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const results = [];
  let testsPassed = 0;

  if (language === 'javascript') {
    try {
      // Find entry function name safely via AST/regex
      const fnMatch = code.match(/function\s+([a-zA-Z0-9_$]+)/) || code.match(/(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=/);
      const fnName = fnMatch ? fnMatch[1] : 'solution';

      // Construct sandboxed execution context
      const sandbox: any = {
        console: { log: () => {} },
        JSON,
        Math,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
      };

      vm.createContext(sandbox);

      // Execute code definition inside sandbox with 1000ms limit
      vm.runInNewContext(code, sandbox, { timeout: 1000 });

      if (typeof sandbox[fnName] !== 'function') {
        throw new Error(`Target function '${fnName}' is not defined`);
      }

      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        try {
          const args = JSON.parse(tc.input);
          const expected = JSON.parse(tc.expected);

          const evalCode = `JSON.stringify(${fnName}(...${JSON.stringify(args)}))`;
          const actualStr = vm.runInNewContext(evalCode, sandbox, { timeout: 1000 });
          const actual = JSON.parse(actualStr);

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

      const runnerCode = `
import json, sys

${code}

test_cases = json.loads('''${JSON.stringify(testCases)}''')
results = []

for i, tc in enumerate(test_cases):
    try:
        args = json.loads(tc['input'])
        expected = json.loads(tc['expected'])
        fn = globals()['${fnName}']
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
`;
      const scriptPath = path.join(tmpDir, 'runner.py');
      fs.writeFileSync(scriptPath, runnerCode);

      const pythonCmd = os.platform() === 'win32' ? 'python' : 'python3';
      let output = '';

      try {
        output = execSync(`${pythonCmd} "${scriptPath}"`, {
          timeout: 3000,
          encoding: 'utf-8',
          maxBuffer: 1024 * 1024,
        }).toString();
      } catch (err: any) {
        if (err.killed || err.signal === 'SIGTERM') {
          return {
            status: 'TIME_LIMIT_EXCEEDED',
            testsPassed: 0,
            totalTests: testCases.length,
            executionTimeMs: 3000,
            results: [
              {
                testIndex: 0,
                passed: false,
                expected: '',
                error: 'Python execution time limit exceeded (3000ms)',
              },
            ],
          };
        }
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
              error: err.stderr?.toString() || err.message || 'Python execution error',
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
