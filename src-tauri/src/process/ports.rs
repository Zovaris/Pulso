use crate::domain::port::DetectedPort;

const MIN_PORT: u16 = 1024;
const HOSTS: [&str; 5] = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"];

pub fn infer(ports: &mut Vec<DetectedPort>, text: &str) -> bool {
    let mut changed = false;

    for (port, url) in candidates(text) {
        changed |= merge(ports, port, url);
    }

    changed
}

fn merge(ports: &mut Vec<DetectedPort>, port: u16, url: Option<String>) -> bool {
    if let Some(existing) = ports.iter_mut().find(|known| known.port == port) {
        if existing.url.is_none() && url.is_some() {
            existing.url = url;
            return true;
        }
        return false;
    }

    ports.push(DetectedPort {
        id: format!("log:{port}"),
        port,
        url,
    });

    true
}

fn candidates(text: &str) -> Vec<(u16, Option<String>)> {
    let mut found = Vec::new();
    let mut waits_for_a_port = false;

    for token in text.split_whitespace() {
        let cleaned = token.trim_matches(|character: char| {
            matches!(
                character,
                '"' | '\'' | '(' | ')' | '[' | ']' | '<' | '>' | ',' | ';' | '|' | '`'
            )
        });

        if waits_for_a_port {
            waits_for_a_port = false;
            let bare = cleaned.trim_end_matches('.');
            if is_port(bare) {
                if let Ok(port) = bare.parse() {
                    found.push((port, None));
                    continue;
                }
            }
        }

        if let Some((port, url)) = url_candidate(cleaned) {
            found.push((port, Some(url)));
            continue;
        }

        if is_a_port_word(cleaned) {
            waits_for_a_port = true;
            continue;
        }

        if let Some(port) = host_candidate(cleaned).or_else(|| named_port_candidate(cleaned)) {
            found.push((port, None));
        }
    }

    found
}

fn is_a_port_word(token: &str) -> bool {
    matches!(
        token.to_ascii_lowercase().as_str(),
        "port" | "port:" | "--port" | "--port:" | "-p"
    )
}

fn url_candidate(token: &str) -> Option<(u16, String)> {
    let scheme = token.find("://")?;
    let url = token
        .trim_end_matches(['.', ',', ')', ']', '\''])
        .to_string();
    let after_scheme = &token[scheme + 3..];
    let authority = after_scheme.split('/').next()?;
    let port = authority.rsplit(':').next()?;

    if authority.contains(':') && is_port(port) {
        return Some((port.parse().ok()?, url));
    }

    None
}

fn host_candidate(token: &str) -> Option<u16> {
    let (host, port) = token.rsplit_once(':')?;
    let host = host.trim_start_matches('[').trim_end_matches(']');
    let known = HOSTS.contains(&host) || token.starts_with(':');

    if !known || !is_port(port) {
        return None;
    }

    port.parse().ok()
}

fn named_port_candidate(token: &str) -> Option<u16> {
    let lowered = token.to_ascii_lowercase();
    let rest = lowered
        .strip_prefix("port")
        .or_else(|| lowered.strip_prefix("--port"))
        .or_else(|| lowered.strip_prefix("port="))?;
    let rest = rest
        .trim_start_matches(['=', ':', '-'])
        .trim_end_matches(['.', ',']);

    if !is_port(rest) {
        return None;
    }

    rest.parse().ok()
}

fn is_port(candidate: &str) -> bool {
    !candidate.is_empty()
        && candidate.len() <= 5
        && candidate
            .chars()
            .all(|character| character.is_ascii_digit())
        && candidate
            .parse::<u16>()
            .map(|port| port >= MIN_PORT)
            .unwrap_or(false)
}

#[cfg(test)]
mod tests;
