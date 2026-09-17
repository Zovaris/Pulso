use crate::domain::command::{CommandCategory, DetectedCommand};

const DATABASE: [&str; 11] = [
    "db",
    "database",
    "migrate",
    "migration",
    "migrations",
    "seed",
    "prisma",
    "drizzle",
    "knex",
    "typeorm",
    "psql",
];

const TEST: [&str; 9] = [
    "test",
    "tests",
    "spec",
    "e2e",
    "coverage",
    "vitest",
    "jest",
    "playwright",
    "cypress",
];

const LINT: [&str; 11] = [
    "lint",
    "format",
    "fmt",
    "check",
    "typecheck",
    "types",
    "biome",
    "clippy",
    "eslint",
    "prettier",
    "stylelint",
];

const BUILD: [&str; 6] = ["build", "compile", "bundle", "dist", "release", "transpile"];

const DEV: [&str; 10] = [
    "dev",
    "develop",
    "start",
    "serve",
    "server",
    "watch",
    "preview",
    "storybook",
    "web",
    "run",
];

const INFRASTRUCTURE: [&str; 9] = [
    "docker",
    "compose",
    "deploy",
    "infra",
    "terraform",
    "k8s",
    "kubectl",
    "fly",
    "vercel",
];

const PERSISTENT: [&str; 11] = [
    "dev",
    "develop",
    "start",
    "serve",
    "server",
    "watch",
    "preview",
    "storybook",
    "tail",
    "web",
    "logs",
];

fn tokens(name: &str) -> Vec<String> {
    name.split(|character: char| !character.is_alphanumeric())
        .filter(|token| !token.is_empty())
        .map(|token| token.to_ascii_lowercase())
        .collect()
}

fn mentions(name: &str, words: &[&str]) -> bool {
    let tokens = tokens(name);
    tokens.iter().any(|token| words.contains(&token.as_str()))
}

pub fn categorize(name: &str) -> CommandCategory {
    if mentions(name, &DATABASE) {
        return CommandCategory::Database;
    }
    if mentions(name, &TEST) {
        return CommandCategory::Test;
    }
    if mentions(name, &LINT) {
        return CommandCategory::Lint;
    }
    if mentions(name, &BUILD) {
        return CommandCategory::Build;
    }
    if mentions(name, &DEV) {
        return CommandCategory::Dev;
    }
    if mentions(name, &INFRASTRUCTURE) {
        return CommandCategory::Infrastructure;
    }

    CommandCategory::Other
}

pub fn is_long_running(name: &str) -> bool {
    mentions(name, &PERSISTENT)
}

pub fn sort_commands(commands: &mut [DetectedCommand]) {
    commands.sort_by(|left, right| {
        left.category
            .rank()
            .cmp(&right.category.rank())
            .then(right.long_running.cmp(&left.long_running))
            .then_with(|| left.label.cmp(&right.label))
    });
}

#[cfg(test)]
mod tests;
