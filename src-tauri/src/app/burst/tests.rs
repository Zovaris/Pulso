use super::*;

#[test]
fn only_the_first_item_opens_a_burst() {
    let mut burst = Burst::default();

    assert!(burst.push(1));
    assert!(!burst.push(2));
    assert_eq!(burst.take(), vec![1, 2]);
    assert!(burst.push(3));
}

#[test]
fn a_burst_is_answered_once_with_everything_in_it() {
    static BURST: Mutex<Option<Burst<u8>>> = Mutex::new(None);
    let (sender, receiver) = std::sync::mpsc::channel();

    for item in [1, 2, 3] {
        let sender = sender.clone();
        gather(&BURST, item, Duration::from_millis(40), move |items| {
            let _ = sender.send(items);
        });
    }

    assert_eq!(
        receiver.recv_timeout(Duration::from_secs(2)).unwrap(),
        vec![1, 2, 3]
    );
    assert!(receiver.recv_timeout(Duration::from_millis(120)).is_err());
}
