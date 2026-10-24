import re

from .schemas import RedFlag


_PATTERNS: dict[RedFlag, tuple[str, ...]] = {
    RedFlag.CHEST_PAIN: (
        r"\bchest\s+pain\b",
        r"\bchest\s+(?:pressure|heaviness|tightness|constriction)\b",
        r"\b(?:pressure|heaviness|tightness)\s+in\s+(?:the\s+)?chest\b",
        r"\b(?:chest\s+(?:pain|pressure|heaviness)|seene\s+mein\s+dard).{0,40}\b(?:cold\s+sweats?|sweating|thanda\s+paseena)\b",
        r"\bchest\s+(?:me|mein)\s+dard\b",
        r"\bseene\s+(?:me|mein)\s+dard\b",
        r"सीने\s+में\s+(?:तेज\s+)?(?:दर्द|दबाव|भारीपन)",
        r"छाती\s+में\s+(?:तेज\s+)?(?:दर्द|दबाव|भारीपन)",
    ),
    RedFlag.BREATHLESSNESS: (
        r"\b(?:breathlessness|shortness\s+of\s+breath|difficulty\s+breathing|trouble\s+breathing|gasping\s+for\s+air)\b",
        r"\b(?:can't|cannot)\s+breathe\b",
        r"\bsaans\s+(?:nahi|nahin)\s+(?:aa|aati|le)\w*\b",
        r"\bsaans\s+lene\s+me\s+(?:takleef|dikkat)\b",
        r"\bsaans\s+(?:phool|fool)\s+(?:rahi|raha)\b",
        r"सांस\s+नहीं\s+आ\w*",
        r"सांस\s+लेने\s+में\s+(?:तकलीफ|दिक्कत)",
        r"सांस\s+फूल\s+(?:रही|रहा)",
        r"दम\s+घुट\w*",
    ),
    RedFlag.UNCONSCIOUSNESS: (
        r"\b(?:unconscious|unconcious|unresponsive|not\s+responding|not\s+responsive|passed\s+out|not\s+waking\s+up|loss\s+of\s+consciousness|blacked\s+out)\b",
        r"\bcollapsed.{0,45}\b(?:not\s+responding|unconscious|unconcious|unresponsive)\b",
        r"\b(?:behosh|behoshi|hosh\s+nahi|hush\s+nahi|response\s+nahi\s+de\s+rahe)\b",
        r"बेहोश[़]?",
        r"बेहोशी",
        r"होश\s+में\s+नहीं",
        r"जवाब\s+नहीं\s+दे\s+रहे",
    ),
    RedFlag.SEVERE_BLEEDING: (
        r"\b(?:heavy|severe|uncontrolled)\s+bleeding\b",
        r"\bbleeding.{0,35}\b(?:won't|will\s+not|doesn't|does\s+not)\s+stop\b",
        r"\bbleeding\s+that\s+won't\s+stop\b",
        r"\bbleeding.{0,20}\bruk\s+(?:nahi|nahin)\b",
        r"\b(?:vomit(?:ing|ed)?\s+blood|throwing\s+up\s+blood|blood\s+in\s+vomit|hematemesis|coughing\s+(?:up\s+)?blood|hemoptysis)\b",
        r"\b(?:khun|khoon)\s+(?:nahi|nahin)\s+(?:ruk|rukh)\w*\b",
        r"\b(?:khun|khoon)\s+ki\s+ulti\b",
        r"खून\s+नहीं\s+रुक\w*",
        r"बहुत\s+खून\s+बह\w*",
        r"खून\s+की\s+उल्टी",
        r"उल्टी\s+में\s+खून",
    ),
    RedFlag.STROKE_SYMPTOMS: (
        r"\b(?:having\s+(?:a\s+)?stroke|suffering\s+(?:from\s+)?(?:a\s+)?stroke|got\s+(?:a\s+)?stroke|signs?\s+of\s+(?:a\s+)?stroke|stroke\s+symptoms?)\b",
        r"\b(?:father|mother|dad|mom|patient|he|she)\s+is\s+having\s+a\s+stroke\b",
        r"\b(?:face|facial)\s+droop\w*\b",
        r"\bslurred\s+speech\b",
        r"\bone[- ]side\s+(?:weakness|numbness|paralysis)\b",
        r"\bface\s+is\s+drooping\b",
        r"\b(?:chehra|muh)\s+tedha\b",
        r"\bek\s+taraf.{0,25}\b(?:kamzori|sunn)\w*\b",
        r"\bbol(?:ne| nahi pa)\s+me\s+(?:dikkat|takleef)\b",
        r"\bbol\s+nahi\s+pa\w*\b",
        r"\bstroke\s+(?:aaya|hua|ho\s+gaya)\b",
        r"स्ट्रोक",
        r"चेहरा\s+टेढ़ा",
        r"एक\s+तरफ.{0,25}(?:कमजोरी|सुन्न)",
        r"बोलने\s+में\s+(?:दिक्कत|तकलीफ)",
        r"लकवा",
    ),
    RedFlag.SEIZURE: (
        r"\b(?:seizure|convulsion|convulsing|epileptic\s+fit|fits\b|having\s+(?:a\s+)?fit)\b",
        r"\b(?:daura|daure|jhatke\s+pad)\w*\b",
        r"दौरे?",
        r"झटके\s+पड़\w*",
        r"मिर्गी\s+का\s+दौरा",
    ),
    RedFlag.HIGH_FEVER_INFANT: (
        r"\b(?:baby|infant|newborn|new-born|toddler|shishu|navjat|chhot[aei]\s+bach[hc]*[aei]|(?:[0-9]|1[0-2])\s*(?:month|mo|week|day)s?[- ]old)\b.{0,50}\b(?:(?:10[0-9](?:\.[0-9])?|39(?:\.[0-9])?|40(?:\.[0-9])?|41)\s*(?:[°\s]*(?:f|c|fahrenheit|celsius))?|high|very\s+high|severe|bahut\s+tez|tez)\s*(?:fever|temperature|temp|bukhar)\b",
        r"\b(?:(?:10[0-9](?:\.[0-9])?|39(?:\.[0-9])?|40(?:\.[0-9])?|41)\s*(?:[°\s]*(?:f|c|fahrenheit|celsius))?|high|very\s+high|severe|bahut\s+tez|tez)\s*(?:fever|temperature|temp|bukhar)\b.{0,50}\b(?:baby|infant|newborn|new-born|toddler|shishu|navjat|chhot[aei]\s+bach[hc]*[aei]|(?:[0-9]|1[0-2])\s*(?:month|mo|week|day)s?[- ]old)\b",
        r"\b(?:baby|infant|newborn|new-born)\b.{0,50}\b(?:high|very\s+high|severe)\s+fever\b",
        r"\b(?:high|very\s+high|severe)\s+fever\b.{0,50}\b(?:baby|infant|newborn|new-born)\b",
        r"\b(?:shishu|navjat|chhota\s+bacha|chhoti\s+bachi)\b.{0,50}\b(?:bahut\s+tez|tez)\s+bukhar\b",
        r"\b(?:baby|infant|newborn|new-born)\b.{0,50}\b(?:bahut\s+tez|tez)\s+bukhar\b",
        r"\b(?:bahut\s+tez|tez)\s+bukhar\b.{0,50}\b(?:shishu|navjat|chhota\s+bacha|chhoti\s+bachi)\b",
        r"\b(?:bahut\s+tez|tez)\s+bukhar\b.{0,50}\b(?:baby|infant|newborn|new-born)\b",
        r"(?:शिशु|नवजात|छोटे\s+बच्चे).{0,50}(?:बहुत\s+तेज[़]?|तेज[़]?|[0-9]{3})\s+बुखार",
        r"(?:बहुत\s+तेज[़]?|तेज[़]?|[0-9]{3})\s+बुखार.{0,50}(?:शिशु|नवजात|छोटे\s+बच्चे)",
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
    r"(?:\bno\b|\bnot\b|\bnever\b|\bwithout\b|\bden(?:y|ies|ied)\b|\bdoes\s+not\s+have\b|\bdo\s+not\s+have\b|\bhas\s+not\s+had\b|\bno\s+history\s+of\b|\bnegative\s+for\b|\bruled\s+out\b)"
    r"(?:\W+\w+){0,3}\W*$",
    re.IGNORECASE,
)
_NEGATION_AFTER = re.compile(r"^\s*(?:nahi|nahin|नहीं)\b", re.IGNORECASE)
_HISTORICAL = re.compile(
    r"(?:\b(?:years?|months?)\s+ago\b|\bin\s+(?:19\d\d|20[0-1]\d|202[0-4])\b|\bpast\s+history\s+of\b|\bchildhood\b|\bresolved\b)",
    re.IGNORECASE,
)
_FIT_FALSE_POSITIVE = re.compile(
    r"\b(?:fit\s+and\s+fine|physically\s+fit|keep\s+fit|stay\s+fit|fit\s+to\s+travel|fit\s+for\s+work|fit\s+note|clothes?\s+fit)\b",
    re.IGNORECASE,
)


def _negated(text: str, start: int, end: int) -> bool:
    before = text[max(0, start - 45) : start]
    after = text[end : min(len(text), end + 30)]
    context = text[max(0, start - 30) : min(len(text), end + 30)]
    if _HISTORICAL.search(context):
        return True
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
        if flag == RedFlag.SEIZURE and _FIT_FALSE_POSITIVE.search(normalized):
            # Check if there is also an actual seizure pattern that isn't the false positive
            pass
        for pattern in patterns:
            match = re.search(pattern, normalized, re.IGNORECASE)
            if match and not _negated(normalized, match.start(), match.end()):
                if flag == RedFlag.SEIZURE and _FIT_FALSE_POSITIVE.search(normalized):
                    # Ensure the match itself isn't within a fit and fine phrase
                    m_start, m_end = match.start(), match.end()
                    fp_match = _FIT_FALSE_POSITIVE.search(normalized)
                    if fp_match and fp_match.start() <= m_start and m_end <= fp_match.end():
                        continue
                detected.append(flag)
                break
    return detected
