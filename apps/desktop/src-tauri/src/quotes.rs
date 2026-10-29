//! Quotes people add themselves, in the app's Settings. They show up with the bundled ones
//! (packages/quotes) as the Sky's quote for the day.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::session::truncate;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct OwnQuote {
    pub id: String,
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub author: Option<String>,
}

/// The same limits as packages/core/src/quotes.ts.
pub const MAX_OWN_QUOTES: usize = 200;
const MAX_TEXT: usize = 280;
const MAX_AUTHOR: usize = 80;

impl OwnQuote {
    /// A new quote from what was typed, or None if there's no quote in it.
    pub fn new(text: &str, author: &str) -> Option<Self> {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            text: text.into(),
            author: Some(author.into()),
        }
        .cleaned()
    }

    /// Trimmed and cut down to the limits, or None if the text is empty.
    fn cleaned(mut self) -> Option<Self> {
        self.text = trimmed(&self.text, MAX_TEXT)?;
        self.author = self.author.and_then(|author| trimmed(&author, MAX_AUTHOR));
        (!self.id.is_empty()).then_some(self)
    }
}

fn trimmed(text: &str, max_chars: usize) -> Option<String> {
    let mut text = text.trim().to_owned();
    truncate(&mut text, max_chars);
    let text = text.trim_end().to_owned();
    (!text.is_empty()).then_some(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_quotes_are_trimmed_and_need_text() {
        let made = OwnQuote::new("  Ship it.\n", "  Me ").unwrap();
        assert_eq!((made.text.as_str(), made.author.as_deref()), ("Ship it.", Some("Me")));
        assert_eq!(OwnQuote::new("Ship it.", " ").unwrap().author, None);
        assert_eq!(OwnQuote::new(" \n ", "Me"), None);
    }

    #[test]
    fn new_quotes_keep_to_the_limits() {
        let made = OwnQuote::new(&"é".repeat(MAX_TEXT + 10), &"a".repeat(MAX_AUTHOR + 10)).unwrap();
        assert_eq!(made.text.chars().count(), MAX_TEXT);
        assert_eq!(made.author.unwrap().chars().count(), MAX_AUTHOR);
    }
}
