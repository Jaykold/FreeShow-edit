export interface InferredScriptureReference {
    reference: string
    confidence: number
    transcript: string
}

const BOOK_ALIASES: { canonical: string; aliases: string[] }[] = [
    { canonical: "Genesis", aliases: ["genesis", "gen"] },
    { canonical: "Exodus", aliases: ["exodus", "exo", "exod"] },
    { canonical: "Leviticus", aliases: ["leviticus", "lev"] },
    { canonical: "Numbers", aliases: ["numbers", "num"] },
    { canonical: "Deuteronomy", aliases: ["deuteronomy", "deut"] },
    { canonical: "Joshua", aliases: ["joshua", "josh"] },
    { canonical: "Judges", aliases: ["judges", "judg"] },
    { canonical: "Ruth", aliases: ["ruth"] },
    { canonical: "1 Samuel", aliases: ["1 samuel", "first samuel", "one samuel"] },
    { canonical: "2 Samuel", aliases: ["2 samuel", "second samuel", "two samuel"] },
    { canonical: "1 Kings", aliases: ["1 kings", "first kings", "one kings"] },
    { canonical: "2 Kings", aliases: ["2 kings", "second kings", "two kings"] },
    { canonical: "1 Chronicles", aliases: ["1 chronicles", "first chronicles", "one chronicles"] },
    { canonical: "2 Chronicles", aliases: ["2 chronicles", "second chronicles", "two chronicles"] },
    { canonical: "Ezra", aliases: ["ezra"] },
    { canonical: "Nehemiah", aliases: ["nehemiah", "neh"] },
    { canonical: "Esther", aliases: ["esther"] },
    { canonical: "Job", aliases: ["job"] },
    { canonical: "Psalms", aliases: ["psalm", "psalms", "ps"] },
    { canonical: "Proverbs", aliases: ["proverbs", "prov"] },
    { canonical: "Ecclesiastes", aliases: ["ecclesiastes", "eccl"] },
    { canonical: "Song of Solomon", aliases: ["song of solomon", "song of songs", "songs"] },
    { canonical: "Isaiah", aliases: ["isaiah", "isa"] },
    { canonical: "Jeremiah", aliases: ["jeremiah", "jer"] },
    { canonical: "Lamentations", aliases: ["lamentations", "lam"] },
    { canonical: "Ezekiel", aliases: ["ezekiel", "ezek"] },
    { canonical: "Daniel", aliases: ["daniel", "dan"] },
    { canonical: "Hosea", aliases: ["hosea", "hos"] },
    { canonical: "Joel", aliases: ["joel"] },
    { canonical: "Amos", aliases: ["amos"] },
    { canonical: "Obadiah", aliases: ["obadiah", "obad"] },
    { canonical: "Jonah", aliases: ["jonah"] },
    { canonical: "Micah", aliases: ["micah"] },
    { canonical: "Nahum", aliases: ["nahum"] },
    { canonical: "Habakkuk", aliases: ["habakkuk", "hab"] },
    { canonical: "Zephaniah", aliases: ["zephaniah", "zeph"] },
    { canonical: "Haggai", aliases: ["haggai", "hag"] },
    { canonical: "Zechariah", aliases: ["zechariah", "zech"] },
    { canonical: "Malachi", aliases: ["malachi", "mal"] },
    { canonical: "Matthew", aliases: ["matthew", "matt"] },
    { canonical: "Mark", aliases: ["mark"] },
    { canonical: "Luke", aliases: ["luke"] },
    { canonical: "John", aliases: ["john"] },
    { canonical: "Acts", aliases: ["acts"] },
    { canonical: "Romans", aliases: ["romans", "rom"] },
    { canonical: "1 Corinthians", aliases: ["1 corinthians", "first corinthians", "one corinthians"] },
    { canonical: "2 Corinthians", aliases: ["2 corinthians", "second corinthians", "two corinthians"] },
    { canonical: "Galatians", aliases: ["galatians", "gal"] },
    { canonical: "Ephesians", aliases: ["ephesians", "eph"] },
    { canonical: "Philippians", aliases: ["philippians", "phil"] },
    { canonical: "Colossians", aliases: ["colossians", "col"] },
    { canonical: "1 Thessalonians", aliases: ["1 thessalonians", "first thessalonians", "one thessalonians"] },
    { canonical: "2 Thessalonians", aliases: ["2 thessalonians", "second thessalonians", "two thessalonians"] },
    { canonical: "1 Timothy", aliases: ["1 timothy", "first timothy", "one timothy"] },
    { canonical: "2 Timothy", aliases: ["2 timothy", "second timothy", "two timothy"] },
    { canonical: "Titus", aliases: ["titus"] },
    { canonical: "Philemon", aliases: ["philemon"] },
    { canonical: "Hebrews", aliases: ["hebrews", "heb"] },
    { canonical: "James", aliases: ["james"] },
    { canonical: "1 Peter", aliases: ["1 peter", "first peter", "one peter"] },
    { canonical: "2 Peter", aliases: ["2 peter", "second peter", "two peter"] },
    { canonical: "1 John", aliases: ["1 john", "first john", "one john"] },
    { canonical: "2 John", aliases: ["2 john", "second john", "two john"] },
    { canonical: "3 John", aliases: ["3 john", "third john", "three john"] },
    { canonical: "Jude", aliases: ["jude"] },
    { canonical: "Revelation", aliases: ["revelation", "rev"] }
]

const SMALL_NUMBERS: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19
}
const TENS: Record<string, number> = {
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90
}
const ORDINALS: Record<string, number> = {
    first: 1,
    second: 2,
    third: 3
}

function normalizeTranscript(value: string) {
    return (value || "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s:-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function isNumericWord(word: string) {
    return !!SMALL_NUMBERS[word] || !!TENS[word] || word === "hundred"
}

function parseNumericWordSequence(words: string[]): number | null {
    let value = 0
    let current = 0
    for (const word of words) {
        if (word === "hundred") {
            if (!current) current = 1
            current *= 100
            continue
        }
        if (SMALL_NUMBERS[word] !== undefined) {
            current += SMALL_NUMBERS[word]
            continue
        }
        if (TENS[word] !== undefined) {
            current += TENS[word]
            continue
        }
        return null
    }
    value += current
    return value > 0 ? value : null
}

function convertNumberWordsToDigits(value: string) {
    const words = value.split(" ")
    const normalizedWords: string[] = []

    for (let i = 0; i < words.length; i++) {
        const word = words[i]
        if (ORDINALS[word]) {
            normalizedWords.push(String(ORDINALS[word]))
            continue
        }

        if (!isNumericWord(word)) {
            normalizedWords.push(word)
            continue
        }

        let j = i
        const numericWords: string[] = []
        while (j < words.length && isNumericWord(words[j])) {
            numericWords.push(words[j])
            j++
        }
        const hasCompoundWords = numericWords.some((n) => n === "hundred" || TENS[n] !== undefined)
        if (!hasCompoundWords && numericWords.length > 1) {
            normalizedWords.push(...numericWords.map((n) => String(SMALL_NUMBERS[n])))
            i = j - 1
            continue
        }
        const parsed = parseNumericWordSequence(numericWords)
        if (parsed !== null) {
            normalizedWords.push(String(parsed))
            i = j - 1
            continue
        }

        normalizedWords.push(word)
    }

    return normalizedWords.join(" ")
}

function parseVerseSection(value: string): { chapter: number; startVerse?: number; endVerse?: number; usedColon: boolean } | null {
    const match = value.match(/^(\d+)(?:(:|\s+)(\d+)(?:\s*(?:-|to|through)\s*(\d+))?)?/)
    if (!match) return null

    const chapter = Number(match[1])
    if (!chapter) return null

    const startVerse = match[3] ? Number(match[3]) : undefined
    const endVerse = match[4] ? Number(match[4]) : undefined

    return { chapter, startVerse, endVerse, usedColon: match[2] === ":" }
}

function getBookCandidates(text: string): { canonical: string; rest: string }[] {
    const matches: { canonical: string; rest: string; aliasLength: number }[] = []
    for (const book of BOOK_ALIASES) {
        for (const alias of book.aliases) {
            const match = text.match(new RegExp(`\\b${alias}\\b\\s+(.+)`))
            if (match?.[1]) {
                matches.push({ canonical: book.canonical, rest: match[1].trim(), aliasLength: alias.length })
                break
            }
        }
    }
    return matches.sort((a, b) => b.aliasLength - a.aliasLength).map(({ canonical, rest }) => ({ canonical, rest }))
}

export function inferScriptureReferenceFromTranscript(transcript: string): InferredScriptureReference | null {
    const normalized = convertNumberWordsToDigits(normalizeTranscript(transcript))
    if (!normalized) return null

    const candidates = getBookCandidates(normalized)
    for (const candidate of candidates) {
        const parsed = parseVerseSection(candidate.rest)
        if (!parsed) continue

        let reference = `${candidate.canonical} ${parsed.chapter}`
        let confidence = 0.7
        if (parsed.startVerse) {
            reference += `:${parsed.startVerse}`
            confidence = parsed.usedColon ? 0.9 : 0.82
            if (parsed.endVerse && parsed.endVerse >= parsed.startVerse) {
                reference += `-${parsed.endVerse}`
                confidence = Math.min(1, confidence + 0.03)
            }
        }

        return { reference, confidence, transcript: transcript.trim() }
    }

    return null
}
