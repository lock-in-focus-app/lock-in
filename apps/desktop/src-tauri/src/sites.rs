//! Site rules: how a profile treats each site, set in the extension or in the app's Profiles ›
//! Sites. The extension does the taming and redirecting. The app keeps them in the profile, which
//! syncs, and makes sure a change during a Hard session only makes things stricter.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// How a site behaves during a session: left alone, tamed with its recipe, redirected to a page
/// you can get through with a pass, or restricted with no way through. In order of strictness.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum SiteLevel {
    Allowed,
    Tamed,
    Redirected,
    Restricted,
}

/// A different level for some pages of a site, e.g. redirecting YouTube's /shorts while the
/// rest of YouTube is tamed.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct PathRule {
    /// "/" is the home page only. Any other path also covers everything under it, and `*`
    /// matches within one part of the path. Matching ignores case.
    pub path: String,
    pub level: SiteLevel,
}

/// How one site is treated by a profile. Built-in sites go by their recipe's id, like "reddit";
/// ones people add themselves by their address, like "site:example.com".
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SiteRule {
    pub recipe_id: String,
    pub level: SiteLevel,
    /// Overrides for the recipe's toggle defaults, keyed by toggle id.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional, as = "Option<std::collections::HashMap<String, bool>>")]
    pub toggles: Option<BTreeMap<String, bool>>,
    /// Pages that don't follow the site's level. The most specific match wins.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub paths: Option<Vec<PathRule>>,
}

/// The most sites a profile keeps, and page rules and toggles a site keeps, so a bad sync can't
/// make each check slow. The same as the extension's limits, with room to spare.
const MAX_SITES: usize = 200;
const MAX_PATHS: usize = 50;
const MAX_PATH_LENGTH: usize = 200;
const MAX_TOGGLES: usize = 50;

/// Drops site rules that can't be right (an id that isn't a site, a page path that isn't a
/// path), and anything past the limits.
pub fn tidy(sites: Vec<SiteRule>) -> Vec<SiteRule> {
    let mut sites: Vec<SiteRule> = sites.into_iter().filter(|site| is_site_id(&site.recipe_id)).collect();
    sites.truncate(MAX_SITES);
    for site in &mut sites {
        if let Some(paths) = &mut site.paths {
            paths.retain(|page| {
                page.path.starts_with('/') && page.path.len() <= MAX_PATH_LENGTH && page.path.is_ascii()
            });
            paths.truncate(MAX_PATHS);
        }
        if let Some(toggles) = &mut site.toggles {
            while toggles.len() > MAX_TOGGLES {
                toggles.pop_last();
            }
        }
    }
    sites
}

/// A built-in recipe's id ("reddit"), or "site:" and an address ("site:example.com").
fn is_site_id(id: &str) -> bool {
    let word = |part: &str| {
        !part.is_empty()
            && part.len() <= 63
            && part
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
    };
    match id.strip_prefix("site:") {
        None => word(id),
        Some(domain) => {
            let labels: Vec<&str> = domain.split('.').collect();
            domain.len() <= 253
                && labels.len() >= 2
                && labels.iter().all(|label| word(label))
                && !labels.last().is_some_and(|tld| tld.bytes().all(|b| b.is_ascii_digit()))
        }
    }
}

/// Whether `new` lets through anything `old` kept away: a site or page at a looser level, or
/// one taken off. A new page rule can't be looser than anything already set on its site. Not
/// allowed during a Hard session. The extension checks the same (packages/core/src/sites.ts).
pub fn looser(old: &[SiteRule], new: &[SiteRule]) -> bool {
    let same_path = |a: &PathRule, b: &PathRule| a.path.eq_ignore_ascii_case(&b.path);
    old.iter().any(|before| {
        let kept = new.iter().find(|site| site.recipe_id == before.recipe_id);
        let level = kept.map_or(SiteLevel::Allowed, |site| site.level);
        let old_pages = before.paths.as_deref().unwrap_or_default();
        let pages = kept.and_then(|site| site.paths.as_deref()).unwrap_or_default();

        let page_loosened = old_pages.iter().any(|page| {
            let now = pages.iter().find(|p| same_path(p, page)).map_or(level, |p| p.level);
            now < page.level
        });
        let strictest = old_pages
            .iter()
            .map(|page| page.level)
            .fold(before.level, SiteLevel::max);
        let new_page_looser = pages
            .iter()
            .any(|page| !old_pages.iter().any(|p| same_path(p, page)) && page.level < strictest);
        level < before.level || page_loosened || new_page_looser
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use SiteLevel::*;

    fn site(id: &str, level: SiteLevel, paths: &[(&str, SiteLevel)]) -> SiteRule {
        SiteRule {
            recipe_id: id.into(),
            level,
            toggles: None,
            paths: (!paths.is_empty()).then(|| {
                paths
                    .iter()
                    .map(|&(path, level)| PathRule {
                        path: path.into(),
                        level,
                    })
                    .collect()
            }),
        }
    }

    #[test]
    fn reads_what_the_extension_saves_and_writes_it_back_the_same() {
        let saved = r#"[{"recipeId":"youtube","level":"tamed","toggles":{"hideShorts":true},"paths":[{"path":"/shorts","level":"restricted"}]},{"recipeId":"site:example.com","level":"redirected"}]"#;
        let sites: Vec<SiteRule> = serde_json::from_str(saved).unwrap();
        assert_eq!(sites[0].level, Tamed);
        assert_eq!(sites[1].paths, None);
        assert_eq!(serde_json::to_string(&sites).unwrap(), saved);
    }

    #[test]
    fn tidying_drops_what_cant_be_a_site_or_a_page() {
        let sites = tidy(vec![
            site("reddit", Tamed, &[("/r/all", Restricted), ("no-slash", Restricted)]),
            site("site:example.com", Restricted, &[]),
            site("site:192.168.1.1", Restricted, &[]),
            site("site:localhost", Restricted, &[]),
            site("Not a site", Restricted, &[]),
            site("", Restricted, &[]),
        ]);
        let ids: Vec<&str> = sites.iter().map(|s| s.recipe_id.as_str()).collect();
        assert_eq!(ids, ["reddit", "site:example.com"]);
        assert_eq!(sites[0].paths.as_ref().unwrap().len(), 1);
    }

    #[test]
    fn stricter_changes_and_new_sites_are_not_looser() {
        let old = vec![
            site("youtube", Tamed, &[("/shorts", Restricted)]),
            site("site:a.com", Redirected, &[]),
        ];
        assert!(!looser(&old, &old));
        let new = vec![
            site("youtube", Redirected, &[("/SHORTS", Restricted)]),
            site("site:a.com", Restricted, &[]),
            site("site:b.com", Redirected, &[]),
        ];
        assert!(!looser(&old, &new));
    }

    #[test]
    fn loosening_a_site_or_page_or_taking_one_off_is_looser() {
        let old = vec![
            site("youtube", Tamed, &[("/shorts", Restricted)]),
            site("site:a.com", Redirected, &[]),
        ];
        let youtube = |paths: &[(&str, SiteLevel)]| vec![site("youtube", Tamed, paths), old[1].clone()];
        assert!(looser(&old, &[old[0].clone()]));
        assert!(looser(&old, &[old[0].clone(), site("site:a.com", Allowed, &[])]));
        assert!(looser(&old, &youtube(&[("/shorts", Redirected)])));
        assert!(looser(&old, &youtube(&[])));
        assert!(looser(
            &old,
            &youtube(&[("/shorts", Restricted), ("/shorts/abc", Tamed)])
        ));
    }
}
