use super::*;

#[test]
fn a_sample_reaches_the_frontend_the_way_it_reads_it() {
    let json = serde_json::to_value(MetricSample {
        execution_id: 4,
        cpu: 14.25,
        memory: 260_046_848,
        processes: 3,
    })
    .expect("the sample should serialize");

    assert_eq!(json["executionId"], 4);
    assert_eq!(json["cpu"], 14.25);
    assert_eq!(json["memory"], 260_046_848);
    assert_eq!(json["processes"], 3);
}
