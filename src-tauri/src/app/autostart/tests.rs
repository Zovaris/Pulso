use super::*;

#[test]
fn the_plist_runs_the_binary_at_load() {
    let plist = plist("/Applications/Pulso.app/Contents/MacOS/pulso", LABEL);

    assert!(plist.contains("<key>RunAtLoad</key>\n\t<true/>"));
    assert!(plist.contains(&format!("<string>{LABEL}</string>")));
    assert!(plist.contains("<string>/Applications/Pulso.app/Contents/MacOS/pulso</string>"));
}

#[test]
fn the_plist_is_well_formed() {
    let plist = plist("/tmp/pulso", LABEL);

    assert!(plist.starts_with("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"));
    assert!(plist.trim_end().ends_with("</plist>"));
    assert_eq!(
        plist.matches("<dict>").count(),
        plist.matches("</dict>").count()
    );
    assert_eq!(
        plist.matches("<array>").count(),
        plist.matches("</array>").count()
    );
}

#[test]
fn a_path_with_xml_characters_cannot_break_the_document() {
    let plist = plist("/tmp/a & b <c>", LABEL);

    assert!(plist.contains("<string>/tmp/a &amp; b &lt;c&gt;</string>"));
    assert!(!plist.contains("<c>"));
}

#[test]
fn the_label_is_the_bundle_identifier() {
    assert_eq!(LABEL, "com.justcallmebryan.pulso");
}
