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
