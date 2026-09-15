import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo users
  const passwordHash = await bcrypt.hash('password123', 10);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@freere.dev' },
    update: {},
    create: {
      username: 'Alice_Coder',
      email: 'alice@freere.dev',
      passwordHash,
      elo: 1350,
      wins: 12,
      losses: 4,
      draws: 1,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@freere.dev' },
    update: {},
    create: {
      username: 'Bob_Dev',
      email: 'bob@freere.dev',
      passwordHash,
      elo: 1220,
      wins: 8,
      losses: 7,
      draws: 2,
    },
  });

  const charlie = await prisma.user.upsert({
    where: { email: 'charlie@freere.dev' },
    update: {},
    create: {
      username: 'Charlie_Ninja',
      email: 'charlie@freere.dev',
      passwordHash,
      elo: 1540,
      wins: 25,
      losses: 6,
      draws: 0,
    },
  });

  // Seed Problems
  const problems = [
    {
      title: 'Two Sum',
      slug: 'two-sum',
      difficulty: 'Easy',
      description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

**Example 1:**
\`\`\`
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [3,2,4], target = 6
Output: [1,2]
\`\`\``,
      initialJS: `function twoSum(nums, target) {
  // Write your code here
  
}`,
      initialPy: `def twoSum(nums, target):
    # Write your code here
    pass`,
      sampleTests: JSON.stringify([
        { input: '[[2,7,11,15], 9]', expected: '[0,1]' },
        { input: '[[3,2,4], 6]', expected: '[1,2]' },
      ]),
      hiddenTests: JSON.stringify([
        { input: '[[2,7,11,15], 9]', expected: '[0,1]' },
        { input: '[[3,2,4], 6]', expected: '[1,2]' },
        { input: '[[3,3], 6]', expected: '[0,1]' },
        { input: '[[1,5,8,12,19], 20]', expected: '[0,4]' },
        { input: '[[10,20,30,40], 50]', expected: '[0,3]' },
      ]),
    },
    {
      title: 'Valid Anagram',
      slug: 'valid-anagram',
      difficulty: 'Easy',
      description: `Given two strings \`s\` and \`t\`, return \`true\` if \`t\` is an anagram of \`s\`, and \`false\` otherwise.

An Anagram is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.

**Example 1:**
\`\`\`
Input: s = "anagram", t = "nagaram"
Output: true
\`\`\`

**Example 2:**
\`\`\`
Input: s = "rat", t = "car"
Output: false
\`\`\``,
      initialJS: `function isAnagram(s, t) {
  // Write your code here
  
}`,
      initialPy: `def isAnagram(s, t):
    # Write your code here
    pass`,
      sampleTests: JSON.stringify([
        { input: '["anagram", "nagaram"]', expected: 'true' },
        { input: '["rat", "car"]', expected: 'false' },
      ]),
      hiddenTests: JSON.stringify([
        { input: '["anagram", "nagaram"]', expected: 'true' },
        { input: '["rat", "car"]', expected: 'false' },
        { input: '["listen", "silent"]', expected: 'true' },
        { input: '["hello", "billion"]', expected: 'false' },
        { input: '["a", "a"]', expected: 'true' },
      ]),
    },
    {
      title: 'Palindrome Number',
      slug: 'palindrome-number',
      difficulty: 'Medium',
      description: `Given an integer \`x\`, return \`true\` if \`x\` is a palindrome, and \`false\` otherwise.

**Example 1:**
\`\`\`
Input: x = 121
Output: true
\`\`\`

**Example 2:**
\`\`\`
Input: x = -121
Output: false (Reads -121 left-to-right and 121- right-to-left)
\`\`\``,
      initialJS: `function isPalindrome(x) {
  // Write your code here
  
}`,
      initialPy: `def isPalindrome(x):
    # Write your code here
    pass`,
      sampleTests: JSON.stringify([
        { input: '[121]', expected: 'true' },
        { input: '[-121]', expected: 'false' },
      ]),
      hiddenTests: JSON.stringify([
        { input: '[121]', expected: 'true' },
        { input: '[-121]', expected: 'false' },
        { input: '[10]', expected: 'false' },
        { input: '[12321]', expected: 'true' },
        { input: '[0]', expected: 'true' },
      ]),
    },
    {
      title: 'Reverse String',
      slug: 'reverse-string',
      difficulty: 'Easy',
      description: `Write a function that reverses a string. The input string is given as a string \`s\`.

Return the reversed string.

**Example 1:**
\`\`\`
Input: s = "hello"
Output: "olleh"
\`\`\``,
      initialJS: `function reverseString(s) {
  // Write your code here
  
}`,
      initialPy: `def reverseString(s):
    # Write your code here
    pass`,
      sampleTests: JSON.stringify([
        { input: '["hello"]', expected: '"olleh"' },
        { input: '["Hannah"]', expected: '"hannaH"' },
      ]),
      hiddenTests: JSON.stringify([
        { input: '["hello"]', expected: '"olleh"' },
        { input: '["Hannah"]', expected: '"hannaH"' },
        { input: '["a"]', expected: '"a"' },
        { input: '["12345"]', expected: '"54321"' },
      ]),
    },
  ];

  for (const prob of problems) {
    await prisma.problem.upsert({
      where: { slug: prob.slug },
      update: prob,
      create: prob,
    });
  }

  console.log('Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
