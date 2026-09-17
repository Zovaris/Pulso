use super::*;

fn scan() -> CommandScan {
    CommandScan::detected(
        3,
        vec![DetectedCommand {
            id: "package_json:dev".to_string(),
            label: "dev".to_string(),
            program: "bun".to_string(),
            args: vec!["run".to_string(), "dev".to_string()],
            cwd: "/tmp/one".to_string(),
            source: "/tmp/one/package.json".to_string(),
            detector: "package_json".to_string(),
            category: CommandCategory::Dev,
            long_running: true,
        }],
    )
}

#[test]
fn a_fresh_scan_carries_no_flags() {
    assert!(scan().flags.is_empty());
}

#[test]
fn flags_survive_the_trip_to_the_frontend_in_camel_case() {
    let mut flags = BTreeMap::new();
    flags.insert(
        "package_json:dev".to_string(),
        CommandFlags {
            favorite: true,
            hidden: false,
        },
    );

    let json = serde_json::to_value(scan().with_flags(flags)).expect("the scan should serialize");

    assert_eq!(json["flags"]["package_json:dev"]["favorite"], true);
    assert_eq!(json["flags"]["package_json:dev"]["hidden"], false);
}

#[test]
fn commands_still_reach_the_frontend_the_way_it_reads_them() {
    let json = serde_json::to_value(scan()).expect("the scan should serialize");

    assert_eq!(json["projectId"], 3);
    assert_eq!(json["commands"][0]["longRunning"], true);
    assert_eq!(json["commands"][0]["category"], "dev");
    assert_eq!(json["status"], "detected");
}

#[test]
fn a_scan_with_nothing_to_show_still_serializes() {
    let empty = CommandScan::new(1, ScanStatus::NoManifest, Some("package.json".to_string()));
    let json = serde_json::to_value(empty).expect("the scan should serialize");

    assert_eq!(json["status"], "noManifest");
    assert_eq!(json["flags"], serde_json::json!({}));
}
