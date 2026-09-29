// Ported from opl-data/crates/opltypes/src/username.rs + writing_system.rs.
// When updating the Rust source, update this file in tandem.

const HIRAGANA_START = 0x3041;
const HIRAGANA_END = 0x3096;
const KATAKANA_OFFSET = 0x60; // KATAKANA_START (0x30A1) - HIRAGANA_START (0x3041)

function isEastAsian(name: string): boolean {
    for (const c of name) {
        // biome-ignore lint/style/noNonNullAssertion: for...of yields single characters; codePointAt(0) always returns a number
        const cp = c.codePointAt(0)!;
        if (
            // Japanese
            (cp >= 0x3005 && cp <= 0x3006) || // Japanese iteration marks
            (cp >= 0x3040 && cp <= 0x309f) || // Hiragana
            (cp >= 0x30a0 && cp <= 0x30ff) || // Katakana (full-width)
            (cp >= 0xff65 && cp <= 0xff9f) || // Half-width Katakana
            // CJK
            (cp >= 0x2e80 && cp <= 0x2eff) || // CJK Radicals Supplement
            (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Extension A
            (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs
            (cp >= 0xf900 && cp <= 0xfaff) || // CJK Compatibility Ideographs
            (cp >= 0xfe30 && cp <= 0xfe4f) || // CJK Compatibility Forms
            (cp >= 0x20000 && cp <= 0x2a6df) || // CJK Extension B
            (cp >= 0x2a700 && cp <= 0x2ceaf) || // CJK Extensions C, D, E
            (cp >= 0x2f800 && cp <= 0x2fa1f) || // CJK Compatibility Supplement
            // Korean
            (cp >= 0xac00 && cp <= 0xd7af) || // Hangul Syllables
            (cp >= 0x1100 && cp <= 0x11ff) || // Hangul Jamo
            (cp >= 0x3130 && cp <= 0x318f) || // Hangul Compatibility Jamo
            (cp >= 0xa960 && cp <= 0xa97f) || // Hangul Jamo Extended-A
            (cp >= 0xd7b0 && cp <= 0xd7ff) // Hangul Jamo Extended-B
        ) {
            return true;
        }
    }
    return false;
}

function hiraToKata(c: string): string {
    // biome-ignore lint/style/noNonNullAssertion: always called with a single character; codePointAt(0) always returns a number
    const cp = c.codePointAt(0)!;
    if (cp >= HIRAGANA_START && cp <= HIRAGANA_END) {
        return String.fromCodePoint(cp + KATAKANA_OFFSET);
    }
    return c;
}

// Characters silently omitted per opl-data is_exception().
const EXCEPTIONS = new Set([' ', '\\', '#', '.', '-', "'"]);

// Verbatim match of the match arms in convert_to_ascii().
const CHAR_MAP: Record<string, string> = {
    á: 'a',
    ä: 'a',
    å: 'a',
    ą: 'a',
    ã: 'a',
    à: 'a',
    â: 'a',
    ā: 'a',
    ắ: 'a',
    ấ: 'a',
    ầ: 'a',
    ặ: 'a',
    ạ: 'a',
    ă: 'a',
    ả: 'a',
    ậ: 'a',
    ằ: 'a',
    ẩ: 'a',
    æ: 'ae',
    ć: 'c',
    ç: 'c',
    č: 'c',
    ĉ: 'c',
    ċ: 'c',
    đ: 'd',
    ð: 'd',
    ď: 'd',
    é: 'e',
    ê: 'e',
    ë: 'e',
    è: 'e',
    ě: 'e',
    ę: 'e',
    ē: 'e',
    ế: 'e',
    ễ: 'e',
    ể: 'e',
    ề: 'e',
    ệ: 'e',
    ė: 'e',
    ə: 'e',
    ğ: 'g',
    ģ: 'g',
    î: 'i',
    í: 'i',
    ï: 'i',
    ì: 'i',
    ї: 'i',
    ī: 'i',
    ĩ: 'i',
    ị: 'i',
    ı: 'i',
    į: 'i',
    ķ: 'k',
    ľ: 'l',
    ĺ: 'l',
    ļ: 'l',
    ŀ: 'l',
    ł: 'l',
    ñ: 'n',
    ń: 'n',
    ň: 'n',
    ņ: 'n',
    ø: 'o',
    ô: 'o',
    ö: 'o',
    ó: 'o',
    ő: 'o',
    õ: 'o',
    ò: 'o',
    ỗ: 'o',
    ọ: 'o',
    ơ: 'o',
    ồ: 'o',
    ớ: 'o',
    ố: 'o',
    ō: 'o',
    ŏ: 'o',
    ờ: 'o',
    ộ: 'o',
    ợ: 'o',
    ř: 'r',
    ß: 'ss',
    š: 's',
    ś: 's',
    ș: 's',
    ş: 's',
    ț: 't',
    ť: 't',
    ţ: 't',
    þ: 'th',
    ü: 'u',
    ů: 'u',
    ú: 'u',
    ù: 'u',
    ū: 'u',
    ű: 'u',
    ư: 'u',
    ứ: 'u',
    ũ: 'u',
    ữ: 'u',
    ự: 'u',
    ừ: 'u',
    ử: 'u',
    ý: 'y',
    ỳ: 'y',
    ỹ: 'y',
    ỷ: 'y',
    ұ: 'y',
    ž: 'z',
    ż: 'z',
    ź: 'z',
    '\u0307': '', // Turkish combining dot — dropped
};

export function nameToSlug(name: string): string {
    if (!name) return '';

    if (isEastAsian(name)) {
        const eaId = [...name]
            .filter((c) => !/\s/.test(c))
            .map(hiraToKata)
            .map((c) => c.codePointAt(0)?.toString())
            .join('');
        return `ea-${eaId}`;
    }

    let result = '';
    for (const c of name.toLowerCase()) {
        if (EXCEPTIONS.has(c)) continue;
        if (/^[a-z0-9]$/.test(c)) {
            result += c;
            continue;
        }
        const mapped = CHAR_MAP[c];
        if (mapped !== undefined) result += mapped;
        // Unrecognised characters (e.g. raw Cyrillic) are silently dropped.
        // In the Rust source these return Err; that validation happens at import
        // time, not at URL generation time.
    }
    return result;
}
