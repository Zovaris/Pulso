use std::path::Path;

use super::naming;
use super::{manifest, CommandDetector, DetectError};
use crate::domain::command::DetectedCommand;
use crate::support::paths;

pub const ID: &str = "procfile";
pub const LABEL: &str = "Procfile";

const NAMES: [&str; 1] = ["Procfile"];

const ONE_SHOT: [&str; 6] = [
    "assets",
    "assets:precompile",
    "migrate",
    "release",
    "seed",
    "setup",
];

const SHELL: [char; 9] = ['|', '&', ';', '<', '>', '$', '(', ')', '`'];

pub struct ProcfileDetector;

pub struct Entry<'a> {
    pub name: &'a str,
    pub command: &'a str,
}

impl CommandDetector for ProcfileDetector {
    fn id(&self) -> &'static str {
        ID
    }

    fn label(&self) -> &'static str {
        LABEL
    }

    fn detect(&self, project_dir: &Path) -> std::result::Result<Vec<DetectedCommand>, DetectError> {
        let Some(manifest) = manifest(project_dir, &NAMES) else {
            return Err(DetectError::Missing);
        };

        let raw = std::fs::read_to_string(&manifest).map_err(|error| {
            DetectError::Unreadable(format!("{LABEL} could not be read: {error}"))
        })?;

        let source = paths::as_string(&manifest);
        let cwd = paths::as_string(project_dir);

        let mut commands: Vec<DetectedCommand> = entries(&raw)
            .into_iter()
            .map(|entry| {
                let (program, args) = invocation(entry.command);

                DetectedCommand {
                    id: format!("{ID}:{}", entry.name),
                    label: entry.name.to_string(),
                    program,
                    args,
                    cwd: cwd.clone(),
                    source: source.clone(),
                    detector: ID.to_string(),
                    category: naming::categorize(entry.name),
                    long_running: !ONE_SHOT.contains(&entry.name),
                }
            })
            .collect();

        naming::sort_commands(&mut commands);

        Ok(commands)
    }
}

fn entries(contents: &str) -> Vec<Entry<'_>> {
    let mut found: Vec<Entry<'_>> = Vec::new();

    for line in contents.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        let Some((name, command)) = line.split_once(':') else {
            continue;
        };

        let name = name.trim();
        let command = command.trim();
        if name.is_empty() || command.is_empty() {
            continue;
        }
        if !name
            .chars()
            .all(|character| character.is_alphanumeric() || character == '-' || character == '_')
        {
            continue;
        }

        found.push(Entry { name, command });
    }

    found
}

fn split(command: &str) -> (Vec<String>, bool) {
    let mut words: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;
    let mut compound = false;

    for character in command.chars() {
        if let Some(open) = quote {
            if character == open {
                quote = None;
            } else {
                current.push(character);
            }
            continue;
        }

        if character == '"' || character == '\'' {
            quote = Some(character);
        } else if character.is_whitespace() {
            if !current.is_empty() {
                words.push(std::mem::take(&mut current));
            }
        } else {
            if SHELL.contains(&character) {
                compound = true;
            }
            current.push(character);
        }
    }

    if !current.is_empty() {
        words.push(current);
    }

    (words, compound)
}

fn through_a_shell(command: &str) -> (String, Vec<String>) {
    (
        "sh".to_string(),
        vec!["-c".to_string(), command.to_string()],
    )
}

fn invocation(command: &str) -> (String, Vec<String>) {
    let (words, compound) = split(command);
    if compound {
        return through_a_shell(command);
    }

    let Some((program, rest)) = words.split_first() else {
        return through_a_shell(command);
    };

    if program.contains('=') {
        return through_a_shell(command);
    }

    (program.clone(), rest.to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::detectors::scan;
    use crate::domain::command::ScanStatus;

    fn fixture(name: &str) -> std::path::PathBuf {
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("tests")
            .join("fixtures")
            .join(name)
    }

    fn detect(name: &str) -> Vec<DetectedCommand> {
        ProcfileDetector
            .detect(&fixture(name))
            .unwrap_or_else(|error| panic!("{name} should detect: {error:?}"))
    }

    fn command<'a>(commands: &'a [DetectedCommand], label: &str) -> &'a DetectedCommand {
        commands
            .iter()
            .find(|command| command.label == label)
            .unwrap_or_else(|| panic!("{label} should be detected"))
    }

    #[test]
    fn every_process_type_becomes_a_command() {
        let commands = detect("proc-project");

        assert_eq!(commands.len(), 4);
        let web = command(&commands, "web");
        assert_eq!(web.id, "procfile:web");
        assert_eq!(web.program, "bun");
        assert_eq!(web.args, vec!["run".to_string(), "dev".to_string()]);
        assert!(web.source.ends_with("Procfile"));
    }

    #[test]
    fn a_process_is_long_running_unless_it_is_a_one_shot() {
        let commands = detect("proc-project");

        assert!(command(&commands, "web").long_running);
        assert!(command(&commands, "worker").long_running);
        assert!(!command(&commands, "release").long_running);
        assert!(!command(&commands, "assets").long_running);
    }

    #[test]
    fn a_compound_line_goes_through_the_shell() {
        let (program, args) = invocation("NODE_ENV=production bun run dev");
        assert_eq!(program, "sh");
        assert_eq!(args, vec!["-c", "NODE_ENV=production bun run dev"]);

        let (program, args) = invocation("bun run dev | tee dev.log");
        assert_eq!(program, "sh");
        assert_eq!(args, vec!["-c", "bun run dev | tee dev.log"]);
    }

    #[test]
    fn a_plain_line_keeps_its_arguments_apart() {
        let (program, args) = invocation("bun run dev --host");

        assert_eq!(program, "bun");
        assert_eq!(args, vec!["run", "dev", "--host"]);
    }

    #[test]
    fn quotes_do_not_break_the_arguments() {
        let (program, args) = invocation("node -e 'console.log(1)'");

        assert_eq!(program, "node");
        assert_eq!(args, vec!["-e", "console.log(1)"]);
    }

    #[test]
    fn comments_and_blank_lines_are_not_processes() {
        let contents = "\
# a Procfile

web: bun run dev
broken:

unreadable line without a colon
";

        let found = entries(contents);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].name, "web");
    }

    #[test]
    fn the_project_folder_says_which_it_is() {
        let missing = ProcfileDetector.detect(&fixture("empty-project"));
        assert!(matches!(missing, Err(DetectError::Missing)));

        let scan = scan(5, &fixture("proc-project"));
        assert_eq!(scan.status, ScanStatus::Detected);
    }
}
