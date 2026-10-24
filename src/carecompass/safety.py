import re

from .schemas import RedFlag


_PATTERNS: dict[RedFlag, tuple[str, ...]] = {
    RedFlag.CHEST_PAIN: (
        r"\bchest\s+pain\b",
        r"\bchest\s+(?:me|mein)\s+dard\b",
        r"\bseene\s+(?:me|mein)\s+dard\b",
        r"सीने\s+में\s+(?:तेज\s+)?दर्द",
        r"छाती\s+में\s+(?:तेज\s+)?दर्द",
    ),
    RedFlag.BREATHLESSNESS: (
        r"\b(?:breathlessness|shortness\s+of\s+breath|difficulty\s+breathing|trouble\s+breathing)\b",
        r"\b(?:can't|cannot)\s+breathe\b",
        r"\bsaans\s+(?:nahi|nahin)\s+(?:aa|aati|le)\w*\b",
        r"\bsaans\s+lene\s+me\s+(?:takleef|dikkat)\b",
        r"सांस\s+नहीं\s+आ\w*",
        r"सांस\s+लेने\s+में\s+(?:तकलीफ|दिक्कत)",
        r"दम\s+घुट\w*",
    ),
    RedFlag.UNCONSCIOUSNESS: (
        r"\b(?:unconscious|unresponsive|not\s+responding|not\s+responsive|passed\s+out|not\s+waking\s+up)\b",
        r"\bcollapsed.{0,45}\b(?:not\s+responding|unconscious|unresponsive)\b",
        r"\b(?:behosh|hush\s+nahi|response\s+nahi\s+de\s+rahe)\b",
        r"\bbehoshi\b",
        r"बेहोश",
        r"होश\s+में\s+नहीं",
        r"जवाब\s+नहीं\s+दे\s+रहे",
    ),
    RedFlag.SEVERE_BLEEDING: (
        r"\b(?:heavy|severe|uncontrolled)\s+bleeding\b",
        r"\bbleeding.{0,35}\b(?:won't|will\s+not|doesn't|does\s+not)\s+stop\b",
        r"\bbleeding\s+that\s+won't\s+stop\b",
        r"\bbleeding.{0,20}\bruk\s+(?:nahi|nahin)\b",
        r"\b(?:khun|khoon)\s+(?:nahi|nahin)\s+(?:ruk|rukh)\w*\b",
        r"\bbleeding.{0,20}\bruk\s+(?:nahi|nahin)\b",
        r"खून\s+नहीं\s+रुक\w*",
        r"बहुत\s+खून\s+बह\w*",
    ),
    RedFlag.STROKE_SYMPTOMS: (
        r"\bstroke\s+symptoms?\b",
        r"\b(?:face|facial)\s+droop\w*\b",
        r"\bslurred\s+speech\b",
        r"\bone\s+side\s+(?:weakness|numbness)\b",
        r"\bface\s+is\s+drooping\b",
        r"\b(?:chehra|muh)\s+tedha\b",
        r"\bek\s+taraf.{0,25}\b(?:kamzori|sunn)\w*\b",
        r"\bbol(?:ne| nahi pa)\s+me\s+(?:dikkat|takleef)\b",
        r"\bbol\s+nahi\s+pa\w*\b",
        r"चेहरा\s+टेढ़ा",
        r"एक\s+तरफ.{0,25}(?:कमजोरी|सुन्न)",
        r"बोलने\s+में\s+(?:दिक्कत|तकलीफ)",
        r"लकवा",
    ),
    RedFlag.SEIZURE: (
        r"\b(?:seizure|convulsion|fits|fit|convulsing)\b",
        r"\b(?:daura|daure|jhatke\s+pad)\w*\b",
        r"दौरे?",
        r"झटके\s+पड़\w*",
        r"मिर्गी\s+का\s+दौरा",
    ),
    RedFlag.HIGH_FEVER_INFANT: (
        r"\b(?:baby|infant|newborn|new-born)\b.{0,50}\b(?:high|very\s+high|severe)\s+fever\b",
        r"\b(?:high|very\s+high|severe)\s+fever\b.{0,50}\b(?:baby|infant|newborn|new-born)\b",
        r"\b(?:shishu|navjat|chhota\s+bacha|chhoti\s+bachi)\b.{0,50}\b(?:bahut\s+tez|tez)\s+bukhar\b",
        r"\b(?:baby|infant|newborn|new-born)\b.{0,50}\b(?:bahut\s+tez|tez)\s+bukhar\b",
        r"\b(?:bahut\s+tez|tez)\s+bukhar\b.{0,50}\b(?:shishu|navjat|chhota\s+bacha|chhoti\s+bachi)\b",
        r"\b(?:bahut\s+tez|tez)\s+bukhar\b.{0,50}\b(?:baby|infant|newborn|new-born)\b",
        r"(?:शिशु|नवजात|छोटे\s+बच्चे).{0,50}(?:बहुत\s+तेज[़]?|तेज[़]?)\s+बुखार",
        r"(?:बहुत\s+तेज[़]?|तेज[़]?)\s+बुखार.{0,50}(?:शिशु|नवजात|छोटे\s+बच्चे)",
    ),
    RedFlag.SUICIDAL_IDEATION: (
        r"\b(?:suicid\w*|kill\s+myself|end\s+my\s+life|want\s+to\s+die|harm\s+myself|self[- ]harm)\b",
        r"\b(?:don't|do\s+not)\s+want\s+to\s+live\b",
        r"\b(?:khudkushi|aatmhatya|apni\s+jaan\s+(?:lena|dene)|mar\s+jana\s+chahta)\b",
        r"आत्महत्या|खुदकुशी|अपनी\s+जान\s+(?:लेना|देना)|मरना\s+चाहता\s+हूं|जीना\s+नहीं\s+चाहता",
    ),
    RedFlag.SEVERE_DEHYDRATION: (
        r"\b(?:severe|seriously|badly)\s+dehydrat\w*\b",
        r"\b(?:dehydrat\w*|dehydration)\b",
        r"\b(?:not\s+urinating|no\s+urine|unable\s+to\s+keep\s+(?:water|fluids?)\s+down)\b",
        r"\b(?:peshab| पेशाब)\s+(?:nahi|nahin)\s+(?:aa|ho)\w*\b",
        r"\b(?:pani|paani)\s+ki\s+kami\b",
        r"\b(?:bahut\s+kam|nahi)\s+peshab\b",
        r"पेशाब\s+नहीं\s+आ\w*",
        r"बहुत\s+कम\s+पेशाब",
        r"पानी\s+की\s+कमी|पानी\s+नहीं\s+पी\s+पा",
    ),
}

_NEGATION_BEFORE = re.compile(
    r"(?:\bno\b|\bnot\b|\bwithout\b|\bden(?:y|ies|ied)\b|\bdoes\s+not\s+have\b|\bdo\s+not\s+have\b)"
    r"(?:\W+\w+){0,2}\W*$",
    re.IGNORECASE,
)
_NEGATION_AFTER = re.compile(r"^\s*(?:nahi|nahin|नहीं)\b", re.IGNORECASE)


def _negated(text: str, start: int, end: int) -> bool:
    before = text[max(0, start - 35) : start]
    after = text[end : end + 20]
    return bool(_NEGATION_BEFORE.search(before) or _NEGATION_AFTER.search(after))


def detect_red_flags(text: str) -> list[RedFlag]:
    """Detect documented emergency categories using transparent phrase rules.

    These rules are a conservative hackathon prototype, not a validated clinical
    detector. The source labels are not used because their red-flag assignments
    are inconsistent with several example messages.
    """
    normalized = text.casefold()
    detected: list[RedFlag] = []
    for flag, patterns in _PATTERNS.items():
        for pattern in patterns:
            match = re.search(pattern, normalized, re.IGNORECASE)
            if match and not _negated(normalized, match.start(), match.end()):
                detected.append(flag)
                break
    return detected
