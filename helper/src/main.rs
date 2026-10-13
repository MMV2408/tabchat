//! tabchat-helper: sends Tabchat's desktop notifications over D-Bus.
//!
//! Why a separate process? GNOME links a notification to the app of the process that sends it.
//! Coming from Tabchat itself, a click "starts" Tabchat and shows a loading cursor for ~15 s.
//! A process without a window belongs to no app, so nothing is started; we pass the click on.
//!
//! It replaces the Node helper (notify-helper.js): same messages, but a native program of a
//! few MB instead of a whole JavaScript engine (~30 MB).
//!
//! Protocol: one JSON object per line.
//!   in  (stdin):  {"type":"show","key":1,"icon":"tabchat","title":"..","body":"..","image":"/tmp/x.png"}
//!                 {"type":"close","id":7}
//!   out (stdout): {"type":"ready"} · {"type":"shown","key":1,"id":7} (id null = failed)
//!                 {"type":"click","id":7} · {"type":"closed","id":7,"reason":2} · {"type":"log","text":".."}
//! When stdin closes (Tabchat quit), the helper exits.

use serde::Deserialize;
use serde_json::{json, Value as Json};
use std::collections::HashMap;
use std::io::{self, BufRead, Write};
use std::sync::Mutex;
use zbus::blocking::{Connection, MessageIterator};
use zbus::zvariant::Value;
use zbus::MatchRule;

const NAME: &str = "org.freedesktop.Notifications";
const PATH: &str = "/org/freedesktop/Notifications";

static OUT: Mutex<()> = Mutex::new(());

/// Write one message to Tabchat. If Tabchat is gone there is nobody to tell, so exit.
fn send(msg: Json) {
    let _lock = OUT.lock().unwrap_or_else(|e| e.into_inner());
    let mut out = io::stdout().lock();
    if writeln!(out, "{msg}").and_then(|_| out.flush()).is_err() {
        std::process::exit(0);
    }
}

fn log(text: impl std::fmt::Display) {
    send(json!({ "type": "log", "text": text.to_string() }));
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum Request {
    Show {
        key: u64,
        #[serde(default)]
        icon: String,
        #[serde(default)]
        title: String,
        #[serde(default)]
        body: String,
        #[serde(default)]
        image: String,
    },
    Close {
        id: u32,
    },
}

fn show(conn: &Connection, icon: &str, title: &str, body: &str, image: &str) -> zbus::Result<u32> {
    let mut hints: HashMap<&str, Value> = HashMap::new();
    if !image.is_empty() {
        hints.insert("image-path", Value::from(image));
    }
    let actions = vec!["default", "Open"];
    let reply = conn.call_method(
        Some(NAME),
        PATH,
        Some(NAME),
        "Notify",
        &("Tabchat", 0u32, icon, title, body, actions, hints, -1i32),
    )?;
    reply.body().deserialize::<u32>()
}

fn close(conn: &Connection, id: u32) -> zbus::Result<()> {
    conn.call_method(Some(NAME), PATH, Some(NAME), "CloseNotification", &(id,))?;
    Ok(())
}

/// Clicks and closes come in as D-Bus signals; pass them on to Tabchat.
fn watch_signals(conn: Connection) {
    let rule = match MatchRule::builder()
        .msg_type(zbus::message::Type::Signal)
        .interface(NAME)
        .map(|b| b.build())
    {
        Ok(r) => r,
        Err(e) => return log(format!("match rule: {e}")),
    };
    let signals = match MessageIterator::for_match_rule(rule, &conn, Some(64)) {
        Ok(s) => s,
        Err(e) => return log(format!("signals: {e}")),
    };
    for msg in signals.flatten() {
        let header = msg.header();
        let member = header.member().map(|m| m.as_str().to_owned()).unwrap_or_default();
        match member.as_str() {
            "ActionInvoked" => {
                if let Ok((id, _action)) = msg.body().deserialize::<(u32, String)>() {
                    send(json!({ "type": "click", "id": id }));
                }
            }
            "NotificationClosed" => {
                if let Ok((id, reason)) = msg.body().deserialize::<(u32, u32)>() {
                    send(json!({ "type": "closed", "id": id, "reason": reason }));
                }
            }
            _ => {}
        }
    }
}

fn main() {
    let conn = match Connection::session() {
        Ok(c) => c,
        Err(_) => std::process::exit(1), // no session bus: Tabchat falls back to its own notifications
    };

    let watcher = conn.clone();
    std::thread::spawn(move || watch_signals(watcher));

    send(json!({ "type": "ready" }));

    for line in io::stdin().lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        match serde_json::from_str::<Request>(&line) {
            Ok(Request::Show { key, icon, title, body, image }) => {
                let id = show(&conn, &icon, &title, &body, &image).ok();
                send(json!({ "type": "shown", "key": key, "id": id }));
            }
            Ok(Request::Close { id }) => {
                if let Err(e) = close(&conn, id) {
                    log(format!("close: {e}"));
                }
            }
            Err(e) => log(format!("bad message: {e}")),
        }
    }
    // stdin closed: Tabchat has quit
}
