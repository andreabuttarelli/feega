use crate::display_list::Rgba;

const BYTE: f32 = 255.0;
const PERCENT: f32 = 100.0;

fn from_hex(digits: &str) -> Option<Rgba> {
    let full: String = if digits.len() <= 4 { digits.chars().flat_map(|d| [d, d]).collect() } else { digits.into() };
    if full.len() != 6 && full.len() != 8 {
        return None;
    }
    let bytes: Vec<f32> = (0..full.len()).step_by(2).map(|i| u8::from_str_radix(&full[i..i + 2], 16).map(|b| b as f32 / BYTE)).collect::<Result<_, _>>().ok()?;
    Some([bytes[0], bytes[1], bytes[2], bytes.get(3).copied().unwrap_or(1.0)])
}

fn number(v: &str) -> f32 {
    let end = v.find(|c: char| !(c.is_ascii_digit() || c == '.' || c == '-' || c == '+' || c == 'e')).unwrap_or(v.len());
    v[..end].parse().unwrap_or(f32::NAN)
}

fn channel(v: &str) -> f32 {
    if v.ends_with('%') {
        number(v) / PERCENT
    } else {
        number(v) / BYTE
    }
}

fn from_functional(args: &str) -> Rgba {
    let parts: Vec<&str> = args.split(|c: char| c.is_whitespace() || c == ',' || c == '/').filter(|p| !p.is_empty()).collect();
    let alpha = match parts.get(3) {
        None => 1.0,
        Some(a) if a.ends_with('%') => number(a) / PERCENT,
        Some(a) => number(a),
    };
    let at = |i: usize| parts.get(i).map_or(f32::NAN, |p| channel(p));
    [at(0), at(1), at(2), alpha]
}

pub fn rgba_of(css: &str) -> Option<Rgba> {
    let value = css.trim();
    if value == "transparent" {
        return Some([0.0; 4]);
    }
    if let Some(hex) = value.strip_prefix('#') {
        return if (3..=8).contains(&hex.len()) && hex.chars().all(|c| c.is_ascii_hexdigit()) { from_hex(hex) } else { None };
    }
    let lower = value.to_ascii_lowercase();
    let inner = lower.strip_prefix("rgba(").or_else(|| lower.strip_prefix("rgb(")).and_then(|r| r.strip_suffix(')'))?;
    Some(from_functional(inner))
}
