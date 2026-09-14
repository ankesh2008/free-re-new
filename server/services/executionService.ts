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
 * Execute user code against a set of test cases locally in an isolated sub-process.
 */
export async function runTestsLocally(
  code: string,
  language: 'javascript' | 'python',
  testCases: TestCase[]
): Promise<ExecutionResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freere-'));
  const results = [];
  let testsPassed = 0;
  const startTime = Date.now();

  try {
    if (language === 'javascript') {
      const runnerCode = `
${code}

const testCases = ${JSON.stringify(testCases)};
const results = [];

for (let i = 0; i < testCases.length; i++) {
  const tc = testCases[i];
  try {
    const args = JSON.parse(tc.input);
    const expected = JSON.parse(tc.expected);
    
    // Find entry function in code
    const fnName = Object.keys(global).find(k => typeof global[k] === 'function' && k !== 'runnerCode') || 
                   '${code.match(/function\s+([a-zA-Z0-9_$]+)/)?.[1] || 'twoSum'}';
                   
    let result;
    if (typeof eval(fnName) === 'function') {
      result = eval(fnName)(...args);
    } else {
      throw new Error("Function " + fnName + " not found");
    }

    const passed = JSON.stringify(result) === JSON.stringify(expected);
    results.push({
      testIndex: i,
      passed,
      actual: JSON.stringify(result),
      expected: JSON.stringify(expected)
    });
  } catch (err) {
    results.push({
      testIndex: i,
      passed: false,
      expected: tc.expected,
      error: err.message || String(err)
    });
  }
}

console.log(JSON.stringify(results));
`;
      const scriptPath = path.join(tmpDir, 'runner.js');
      fs.writeFileSync(scriptPath, runnerCode);

      try {
        const output = execSync(`node "${scriptPath}"`, { timeout: 3000 }).toString();
        const parsed = JSON.parse(output.trim());
        parsed.forEach((r: any) => {
          if (r.passed) testsPassed++;
          results.push(r);
        });
      } catch (err: any) {
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
              error: err.stderr?.toString() || err.message || 'Execution error',
            },
          ],
        };
      }
    } else if (language === 'python') {
      // Find python function name
      const fnName = code.match(/def\s+([a-zA-Z0-9_$]+)/)?.[1] || 'twoSum';
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

      try {
        // Try python or python3
        const pythonCmd = os.platform() === 'win32' ? 'python' : 'python3';
        const output = execSync(`${pythonCmd} "${scriptPath}"`, { timeout: 3000 }).toString();
        const parsed = JSON.parse(output.trim());
        parsed.forEach((r: any) => {
          if (r.passed) testsPassed++;
          results.push(r);
        });
      } catch (err: any) {
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
    }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
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
}
