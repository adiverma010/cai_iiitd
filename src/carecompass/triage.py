import re
from datetime import datetime

from .matching import Caregiver, match_caregivers
from .safety import detect_red_flags
from .schemas import CareType, Location, TriageRequest, TriageResponse, Urgency


_HOME_NURSING = re.compile(
    r"\b(?:injection|injections|insulin|dressing|bedsore|wound|catheter|post[- ]?op|post[- ]?surgical)\b"
    r"|इंजेक्शन|ड्रेसिंग|पट्टी|घाव|कैथेटर|ऑपरेशन के बाद",
    re.IGNORECASE,
)
_LAB_TEST = re.compile(
    r"\b(?:sample\s+collection|home\s+collection|blood\s+test|cbc|thyroid\s+test|sugar\s+test|full\s+body\s+checkup)\b"
    r"|\b(?:test|sample)\s+(?:ghar|home)\b|\bghar\s+se\s+sample\b"
    r"|सीबीसी|थायराइड\s+टेस्ट|शुगर\s+टेस्ट|सैंपल|नमूना",
    re.IGNORECASE,
)
_TELECONSULT = re.compile(
    r"\b(?:consult\s+(?:a\s+)?doctor|talk\s+to\s+(?:a\s+)?doctor|doctor\s+consult|second\s+opinion|review\s+my\s+reports?)\b"
    r"|\b(?:doctor\s+se\s+(?:salah|baat)|reports?\s+ke\s+baare)\b"
    r"|डॉक्टर\s+से\s+(?:सलाह|बात)|रिपोर्ट\s+के\s+बारे|सेकंड\s+ओपिनियन",
    re.IGNORECASE,
)
_HOME_ASSESSMENT = re.compile(
    r"\b(?:home\s+(?:visit|check[- ]?up|assessment)|check\s+(?:bp|blood\s+pressure)|bp\s+(?:and\s+)?sugar|blood\s+pressure\s+(?:and\s+)?sugar|check\s+vitals)\b"
    r"|\b(?:ghar\s+(?:pe|par)\s+(?:check|dikh)|ghar\s+pe\s+bp|bp\s+sugar\s+ghar|ghar\s+pe\s+checkup)\b"
    r"|घर\s+(?:पर|पे)\s+(?:जांच|चेक)|बीपी\s+(?:और|तथा)\s+शुगर",
    re.IGNORECASE,
)
_SYMPTOM_CUES = re.compile(
    r"\b(?:fever|cough|weak|weakness|not\s+eating|pain|vomit\w*|diarrh\w*|bukhar|khansi|kamzori|dard)\b"
    r"|बुखार|खांसी|कमजोरी|दर्द|उल्टी|दस्त",
    re.IGNORECASE,
)
_VAGUE = re.compile(
    r"^(?:hi|hello|hey|help|i\s+need\s+help|help\s+chahiye|madad\s+chahiye|mujhe\s+madad\s+chahiye|doctor\s+chahiye|need\s+a\s+doctor|i\s+want\s+to\s+book\s+something|i\s+want\s+to\s+book\s+something\s+for\s+my\s+mother|mummy\s+ke\s+liye\s+kuch\s+book\s+karna\s+hai|मदद\s+चाहिए|डॉक्टर\s+चाहिए|कुछ\s+बुक\s+करना\s+है|नमस्ते\s*,?\s*कोई\s+है\s*\??)$",
    re.IGNORECASE,
)
_FOLLOW_UP = "What kind of care do you need, and what is the main concern?"


def _request_context(request: TriageRequest) -> str:
    earlier_user_text: list[str] = []
    for turn in request.conversation_history:
        if turn.get("role") != "user":
            continue
        text = turn.get("text") or turn.get("user_input")
        if isinstance(text, str) and text.strip():
            earlier_user_text.append(text.strip())
    return " ".join([*earlier_user_text, request.user_input])


def classify_care_type(text: str) -> CareType | None:
    if _HOME_NURSING.search(text):
        return CareType.HOME_NURSING
    if _LAB_TEST.search(text):
        return CareType.LAB_TEST_HOME
    if _TELECONSULT.search(text):
        return CareType.TELECONSULTATION
    if _HOME_ASSESSMENT.search(text) or _SYMPTOM_CUES.search(text):
        return CareType.PARAMEDIC_HOME_VISIT
    if _VAGUE.fullmatch(" ".join(text.casefold().split())):
        return None
    return None


def decide(
    request: TriageRequest,
    caregivers: list[Caregiver],
    now: datetime | None = None,
) -> TriageResponse:
    context = _request_context(request)
    flags = detect_red_flags(context)
    if flags:
        names = ", ".join(flag.value.replace("_", " ") for flag in flags)
        return TriageResponse(
            follow_up_question=None,
            care_type=CareType.EMERGENCY_112,
            urgency=Urgency.EMERGENCY,
            red_flags=flags,
            reasoning=f"Potential emergency signs ({names}). Call 112 now. This prototype is not emergency medical care.",
            matched_caregivers=[],
        )

    care_type = classify_care_type(context)
    if care_type is None:
        return TriageResponse(
            follow_up_question=_FOLLOW_UP,
            care_type=None,
            urgency=None,
            red_flags=[],
            reasoning="The request does not contain enough information to select a care service.",
            matched_caregivers=[],
        )

    urgency = Urgency.SCHEDULED if care_type == CareType.LAB_TEST_HOME else Urgency.SAME_DAY
    matches = match_caregivers(
        care_type=care_type,
        text=context,
        requested_language=request.language,
        location=request.location,
        caregivers=caregivers,
        now=now,
    )
    return TriageResponse(
        follow_up_question=None,
        care_type=care_type,
        urgency=urgency,
        red_flags=[],
        reasoning=(
            f"The request was routed to {care_type.value.replace('_', ' ')} using explicit service-intent rules. "
            "This rule-based prototype is not a clinical assessment."
        ),
        matched_caregivers=matches,
    )
