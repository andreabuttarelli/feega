use url::Url;

pub const PRODUCTION_URL: &str = "https://oh.feega.app";
pub const BUNDLE: &str = "bundle";
const DEEP_LINK_SCHEME: &str = "feega";
const AUTH_HOST: &str = "auth";
const AUTH_CALLBACK_PATH: &str = "/callback";
const SHELL_SCHEMES: [&str; 3] = ["tauri", "about", "data"];
const BUNDLE_HOST: &str = "tauri.localhost";

#[derive(Debug, PartialEq)]
pub enum Start {
    Hosted(Url),
    Bundle,
}

pub fn start(configured: Option<&str>) -> Start {
    let wanted = configured.map(str::trim).filter(|v| !v.is_empty()).unwrap_or(PRODUCTION_URL);
    if wanted == BUNDLE {
        return Start::Bundle;
    }
    match Url::parse(wanted) {
        Ok(url) => Start::Hosted(url),
        Err(_) => Start::Hosted(Url::parse(PRODUCTION_URL).expect("production url parses")),
    }
}

pub fn hosted_app(configured: Option<&str>) -> Url {
    let production = || Url::parse(PRODUCTION_URL).expect("production url parses");
    configured.map(str::trim).filter(|v| !v.is_empty()).and_then(|v| Url::parse(v).ok()).unwrap_or_else(production)
}

pub fn auth_return(deep: &Url, app: &Url) -> Option<Url> {
    if deep.scheme() != DEEP_LINK_SCHEME || deep.host_str() != Some(AUTH_HOST) || deep.path() != AUTH_CALLBACK_PATH {
        return None;
    }
    let mut target = app.join("/auth/callback").ok()?;
    target.set_query(deep.query());
    Some(target)
}

pub fn stays_inside(target: &Url, app: &Url) -> bool {
    if SHELL_SCHEMES.contains(&target.scheme()) || target.host_str() == Some(BUNDLE_HOST) {
        return true;
    }
    target.origin() == app.origin()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    #[test]
    fn production_is_the_default_start() {
        assert_eq!(start(None), Start::Hosted(url(PRODUCTION_URL)));
        assert_eq!(start(Some(" ")), Start::Hosted(url(PRODUCTION_URL)));
    }

    #[test]
    fn a_dev_url_or_the_bundle_can_be_configured() {
        assert_eq!(start(Some("http://localhost:5173")), Start::Hosted(url("http://localhost:5173")));
        assert_eq!(start(Some("bundle")), Start::Bundle);
    }

    #[test]
    fn the_oauth_deep_link_returns_to_the_web_callback_with_its_code() {
        let back = auth_return(&url("feega://auth/callback?code=abc&invite_token=t"), &url("https://oh.feega.app/p/x")).unwrap();
        assert_eq!(back.as_str(), "https://oh.feega.app/auth/callback?code=abc&invite_token=t");
    }

    #[test]
    fn other_deep_links_are_not_auth_returns() {
        let app = url("https://oh.feega.app");
        assert_eq!(auth_return(&url("feega://p/123"), &app), None);
        assert_eq!(auth_return(&url("other://auth/callback?code=x"), &app), None);
    }

    #[test]
    fn the_bundle_talks_to_production_unless_told_otherwise() {
        assert_eq!(hosted_app(None), url(PRODUCTION_URL));
        assert_eq!(hosted_app(Some("http://localhost:5173")), url("http://localhost:5173"));
        assert_eq!(hosted_app(Some("not a url")), url(PRODUCTION_URL));
    }

    #[test]
    fn the_bundle_origin_stays_in_the_window_on_every_platform() {
        let app = url("https://oh.feega.app");
        assert!(stays_inside(&url("tauri://localhost/app"), &app));
        assert!(stays_inside(&url("http://tauri.localhost/app"), &app));
        assert!(!stays_inside(&url("http://evil.localhost/app"), &app));
    }

    #[test]
    fn only_the_app_origin_stays_in_the_window() {
        let app = url("https://oh.feega.app");
        assert!(stays_inside(&url("https://oh.feega.app/login"), &app));
        assert!(!stays_inside(&url("https://accounts.google.com/o/oauth2"), &app));
        assert!(!stays_inside(&url("https://klnswzhhgrqvbfjzioul.supabase.co/auth/v1/authorize"), &app));
    }
}
