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
mod tests {
    use super::*;

    #[test]
    fn the_words_in_a_name_decide_its_category() {
        assert_eq!(categorize("db:migrate"), CommandCategory::Database);
        assert_eq!(categorize("test:e2e"), CommandCategory::Test);
        assert_eq!(categorize("typecheck"), CommandCategory::Lint);
        assert_eq!(categorize("make-dist"), CommandCategory::Build);
        assert_eq!(categorize("serve_assets"), CommandCategory::Dev);
        assert_eq!(categorize("deploy"), CommandCategory::Infrastructure);
        assert_eq!(categorize("prepare"), CommandCategory::Other);
    }

    #[test]
    fn a_long_running_name_is_about_the_verb() {
        assert!(is_long_running("dev"));
        assert!(is_long_running("watch:css"));
        assert!(is_long_running("web"));
        assert!(is_long_running("logs"));
        assert!(!is_long_running("test:e2e"));
        assert!(!is_long_running("build"));
    }

    #[test]
    fn running_a_project_is_not_the_same_as_serving_it() {
        assert_eq!(categorize("run"), CommandCategory::Dev);
        assert!(!is_long_running("run"));
        assert!(is_long_running("run:server"));
    }

    #[test]
    fn the_tool_verbs_of_a_toolchain_land_where_a_user_expects_them() {
        assert_eq!(categorize("clippy"), CommandCategory::Lint);
        assert_eq!(categorize("fmt"), CommandCategory::Lint);
    }

    #[test]
    fn servers_come_before_one_shot_steps() {
        let build = |label: &str| DetectedCommand {
            id: label.to_string(),
            label: label.to_string(),
            program: "make".to_string(),
            args: vec![label.to_string()],
            cwd: "/tmp".to_string(),
            source: "/tmp/Makefile".to_string(),
            detector: "makefile".to_string(),
            category: categorize(label),
            long_running: is_long_running(label),
        };
        let mut commands = vec![build("deploy"), build("build"), build("test"), build("dev")];

        sort_commands(&mut commands);

        let labels: Vec<&str> = commands.iter().map(|c| c.label.as_str()).collect();
        assert_eq!(labels, vec!["dev", "test", "build", "deploy"]);
    }
}
