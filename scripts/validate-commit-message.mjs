import { readFile } from "node:fs/promises";

const CEILING = 200;
const GIT_WRITTEN = /^(Merge |Revert "|fixup! |squash! )/;
const FOOTERS = [
  {
    pattern: /^co-authored-by:/i,
    problem: "no co-author trailer: drop the Co-Authored-By line.",
  },
  {
    pattern: /generated with codebuff/i,
    problem: "no generated-by footer: drop that line.",
  },
];

const messagePath = process.argv[2];

if (!messagePath) {
  console.error(
    "Usage: node scripts/validate-commit-message.mjs .git/COMMIT_EDITMSG",
  );
  process.exit(1);
}

const message = await readFile(messagePath, "utf8");
const lines = message
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line !== "" && !line.startsWith("#"));

const subject = lines[0] ?? "";
const problems = [];

if (subject === "") {
  problems.push("the message is empty.");
}

for (const footer of FOOTERS) {
  if (lines.some((line) => footer.pattern.test(line))) {
    problems.push(footer.problem);
  }
}

if (subject !== "" && !GIT_WRITTEN.test(subject)) {
  if (lines.length > 1) {
    problems.push(
      `a title and nothing else: ${lines.length} lines of content.`,
    );
  }

  if (subject.length > CEILING) {
    problems.push(
      `the title is ${subject.length} characters, past the ceiling of ${CEILING}.`,
    );
  }
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`commit rejected: ${problem}`);
  }

  process.exit(1);
}
