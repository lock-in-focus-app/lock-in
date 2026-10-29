//! Quotes people add themselves, in the app's Settings or the extension's. They show up with the
//! bundled ones (packages/quotes): as the Sky's quote for the day here, and on the extension's
//! quote page. They sync with the extension like the profiles do.

use std::collections::HashSet;

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

/// The same limits as the extension's (packages/core/src/quotes.ts).
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

/// Quotes from the extension, tidied the same way: empty ones and repeated ids dropped, and
/// anything past the limits.
pub fn tidy(quotes: Vec<OwnQuote>) -> Vec<OwnQuote> {
    let mut ids = HashSet::new();
    quotes
        .into_iter()
        .filter_map(OwnQuote::cleaned)
        .filter(|quote| ids.insert(quote.id.clone()))
        .take(MAX_OWN_QUOTES)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn quote(id: &str, text: &str, author: Option<&str>) -> OwnQuote {
        OwnQuote {
            id: id.into(),
            text: text.into(),
            author: author.map(Into::into),
        }
    }

    #[test]
    fn new_quotes_are_trimmed_and_need_text() {
        let made = OwnQuote::new("  Ship it.\n", "  Me ").unwrap();
        assert_eq!((made.text.as_str(), made.author.as_deref()), ("Ship it.", Some("Me")));
        assert_eq!(OwnQuote::new("Ship it.", " ").unwrap().author, None);
        assert_eq!(OwnQuote::new(" \n ", "Me"), None);
    }

    #[test]
    fn tidies_quotes_from_the_extension() {
        let long = "é".repeat(MAX_TEXT + 10);
        let tidied = tidy(vec![
            quote("a", "One", Some("")),
            quote("b", "  ", None),
            quote("a", "Same id", None),
            quote("", "No id", None),
            quote("c", &long, None),
        ]);
        assert_eq!(tidied.len(), 2);
        assert_eq!(tidied[0], quote("a", "One", None));
        assert_eq!(tidied[1].text.chars().count(), MAX_TEXT);

        let many = (0..MAX_OWN_QUOTES + 5)
            .map(|i| quote(&i.to_string(), "Line", None))
            .collect();
        assert_eq!(tidy(many).len(), MAX_OWN_QUOTES);
    }
}
