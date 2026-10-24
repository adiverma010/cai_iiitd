import re
from datetime import datetime

from .matching import Caregiver, detect_language, match_caregivers
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
    r"|\b(?:ghar\s+(?:pe|par)\s+(?:check|dikh\w*)|ghar\s+pe\s+bp|bp\s+sugar\s+ghar|ghar\s+pe\s+checkup)\b"
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
_NURSE_INTENT = re.compile(r"\b(?:nurse|nursing)\b|नर्स|नर्सिंग", re.IGNORECASE)
_DOCTOR_INTENT = re.compile(r"\b(?:doctor|physician|gp)\b|डॉक्टर", re.IGNORECASE)
_LAB_INTENT = re.compile(r"\b(?:lab|laboratory|test)\b|लैब|जांच|टेस्ट", re.IGNORECASE)


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


def _clarification_question(text: str, language: str, care_type: CareType | None) -> str:
    has_symptom = bool(_SYMPTOM_CUES.search(text))
    explicit_home_visit = bool(_HOME_ASSESSMENT.search(text))
    if _NURSE_INTENT.search(text) and care_type is None:
        questions = {
            "English": "What nursing task is needed at home, such as an injection or wound dressing?",
            "Hindi": "घर पर किस नर्सिंग सहायता की ज़रूरत है, जैसे इंजेक्शन या घाव की ड्रेसिंग?",
            "Hinglish": "Ghar par kaunsi nursing help chahiye, jaise injection ya wound dressing?",
        }
    elif care_type == CareType.PARAMEDIC_HOME_VISIT and has_symptom and not explicit_home_visit:
        questions = {
            "English": "Would you prefer a home visit or a doctor consultation for this concern?",
            "Hindi": "इस परेशानी के लिए आप घर पर विज़िट चाहेंगे या डॉक्टर से परामर्श?",
            "Hinglish": "Is concern ke liye home visit chahiye ya doctor consultation?",
        }
    elif _DOCTOR_INTENT.search(text) and care_type is None:
        questions = {
            "English": "What is the main concern or symptom you want the doctor to help with?",
            "Hindi": "डॉक्टर से किस मुख्य परेशानी या लक्षण के बारे में मदद चाहिए?",
            "Hinglish": "Doctor se kis main concern ya symptom ke liye help chahiye?",
        }
    elif _LAB_INTENT.search(text) and care_type is None:
        questions = {
            "English": "Which test or sample collection do you need?",
            "Hindi": "आपको कौन-सा टेस्ट या सैंपल कलेक्शन चाहिए?",
            "Hinglish": "Kaunsa test ya sample collection chahiye?",
        }
    else:
        questions = {
            "English": "What is the main health concern or type of care you need?",
            "Hindi": "मुख्य स्वास्थ्य परेशानी या किस तरह की देखभाल चाहिए?",
            "Hinglish": "Main health concern ya kis tarah ki care chahiye?",
        }
    return questions.get(language, questions["English"])


def _localized_reasoning(care_type: CareType, language: str) -> str:
    care_names = {
        CareType.PARAMEDIC_HOME_VISIT: ("home medic visit", "घर पर पैरामेडिक विज़िट", "home medic visit"),
        CareType.HOME_NURSING: ("home nursing", "घर पर नर्सिंग", "home nursing"),
        CareType.LAB_TEST_HOME: ("home lab test", "घर पर लैब टेस्ट", "home lab test"),
        CareType.TELECONSULTATION: ("teleconsultation", "टेली-परामर्श", "teleconsultation"),
        CareType.EMERGENCY_112: ("emergency services", "आपातकालीन सहायता", "emergency support"),
    }
    if language == "Hindi":
        care_name = care_names[care_type][1]
        return f"आपके अनुरोध को स्पष्ट सेवा-आशय के आधार पर {care_name} के लिए भेजा गया है। यह नियम-आधारित प्रोटोटाइप चिकित्सकीय आकलन नहीं है।"
    if language == "Hinglish":
        care_name = care_names[care_type][2]
        return f"Aapki request ko clear service intent ke basis par {care_name} ke liye route kiya gaya hai. Yeh rule-based prototype medical assessment nahi hai."
    care_name = care_names[care_type][0]
    return f"The request was routed to {care_name} using explicit service-intent rules. This rule-based prototype is not a clinical assessment."


def decide(
    request: TriageRequest,
    caregivers: list[Caregiver],
    now: datetime | None = None,
) -> TriageResponse:
    context = _request_context(request)
    language = detect_language(context, request.language)
    flags = detect_red_flags(context)
    if flags:
        names = ", ".join(flag.value.replace("_", " ") for flag in flags)
        emergency_reasoning = {
            "Hindi": f"आपातकाल के संकेत ({names}) मिले हैं। अभी 112 पर कॉल करें। यह प्रोटोटाइप आपातकालीन चिकित्सा सेवा नहीं है।",
            "Hinglish": f"Emergency ke signs ({names}) mile hain. Abhi 112 par call karein. Yeh prototype emergency medical care nahi hai.",
        }
        return TriageResponse(
            follow_up_question=None,
            care_type=CareType.EMERGENCY_112,
            urgency=Urgency.EMERGENCY,
            red_flags=flags,
            reasoning=emergency_reasoning.get(
                language,
                f"Potential emergency signs ({names}). Call 112 now. This prototype is not emergency medical care.",
            ),
            matched_caregivers=[],
        )

    care_type = classify_care_type(context)
    needs_care_mode_clarification = (
        care_type == CareType.PARAMEDIC_HOME_VISIT
        and _SYMPTOM_CUES.search(context)
        and not _HOME_ASSESSMENT.search(context)
    )
    if care_type is None or needs_care_mode_clarification:
        question = _clarification_question(context, language, care_type)
        return TriageResponse(
            follow_up_question=question,
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
        reasoning=_localized_reasoning(care_type, language),
        matched_caregivers=matches,
    )
