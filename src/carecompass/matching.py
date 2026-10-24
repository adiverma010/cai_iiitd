import csv
import math
import re
from dataclasses import dataclass
from datetime import datetime, time
from pathlib import Path
from zoneinfo import ZoneInfo

from .schemas import CareType, Location


IST = ZoneInfo("Asia/Kolkata")
_ROLE_BY_CARE = {
    CareType.PARAMEDIC_HOME_VISIT: "medic",
    CareType.HOME_NURSING: "medic",
    CareType.LAB_TEST_HOME: "phlebotomist",
    CareType.TELECONSULTATION: "doctor",
}
_QUALIFICATION_BY_ROLE = {
    "medic": {"GNM Nursing", "B.Sc Nursing"},
    "doctor": {"MBBS"},
    "phlebotomist": {"DMLT"},
}
_LANGUAGE_HINTS = {
    "auto": "auto",
    "english": "English",
    "hindi": "Hindi",
    "hinglish": "Hinglish",
}
_ROMAN_HINDI = re.compile(
    r"\b(?:hai|hain|ho|ko|ke|ki|ka|se|ghar|chahiye|bukhar|dard|papa|mummy|mujhe|karwana|karani|nahi|nahin)\b",
    re.IGNORECASE,
)
_ENGLISH_CUES = re.compile(
    r"\b(?:i|we|my|our|have|has|need|want|please|for|with|the|and|or|doctor|nurse|home|visit|test|fever|cough|symptom)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Caregiver:
    caregiver_id: str
    role: str
    qualification: str
    languages: frozenset[str]
    skills: frozenset[str]
    base_lat: float
    base_lng: float
    max_radius_km: float
    tier: str
    rating: float
    free_from: time
    free_until: time
    active: bool


def load_caregivers(path: str | Path) -> list[Caregiver]:
    with Path(path).open(encoding="utf-8-sig", newline="") as source:
        rows = csv.DictReader(source)
        required = {
            "caregiver_id", "role", "qualification", "languages", "skills",
            "base_lat", "base_lng", "max_radius_km", "tier", "rating",
            "free_from", "free_until", "active",
        }
        if rows.fieldnames is None or not required.issubset(rows.fieldnames):
            raise ValueError("caregivers.csv is missing required columns")
        caregivers: list[Caregiver] = []
        seen: set[str] = set()
        for row in rows:
            caregiver_id = row["caregiver_id"].strip()
            if not caregiver_id or caregiver_id in seen:
                raise ValueError("caregiver IDs must be present and unique")
            seen.add(caregiver_id)
            role = row["role"].strip()
            if role not in _QUALIFICATION_BY_ROLE:
                raise ValueError(f"unsupported caregiver role for {caregiver_id}")
            if row["qualification"].strip() not in _QUALIFICATION_BY_ROLE[role]:
                raise ValueError(f"qualification does not match role for {caregiver_id}")
            active_text = row["active"].strip().casefold()
            if active_text not in {"true", "false"}:
                raise ValueError(f"invalid active value for {caregiver_id}")
            base_lat, base_lng = float(row["base_lat"]), float(row["base_lng"])
            radius, rating = float(row["max_radius_km"]), float(row["rating"])
            free_from, free_until = time.fromisoformat(row["free_from"]), time.fromisoformat(row["free_until"])
            if not -90 <= base_lat <= 90 or not -180 <= base_lng <= 180:
                raise ValueError(f"invalid coordinates for {caregiver_id}")
            if radius <= 0 or not 0 <= rating <= 5:
                raise ValueError(f"invalid radius or rating for {caregiver_id}")
            if free_from >= free_until:
                raise ValueError(f"invalid availability window for {caregiver_id}")
            caregivers.append(
                Caregiver(
                    caregiver_id=caregiver_id,
                    role=role,
                    qualification=row["qualification"].strip(),
                    languages=frozenset(x.strip() for x in row["languages"].split(";") if x.strip()),
                    skills=frozenset(x.strip() for x in row["skills"].split(";") if x.strip()),
                    base_lat=base_lat,
                    base_lng=base_lng,
                    max_radius_km=radius,
                    tier=row["tier"].strip(),
                    rating=rating,
                    free_from=free_from,
                    free_until=free_until,
                    active=active_text == "true",
                )
            )
    return caregivers


def detect_language(text: str, requested_language: str) -> str:
    normalized = requested_language.strip().casefold()
    if normalized in _LANGUAGE_HINTS and normalized != "auto":
        return _LANGUAGE_HINTS[normalized]
    if normalized != "auto":
        return requested_language.strip()
    if re.search(r"[\u0900-\u097f]", text):
        if _ENGLISH_CUES.search(text):
            return "Hinglish"
        return "Hindi"
    if _ROMAN_HINDI.search(text):
        return "Hinglish"
    return "English"


def _language_match(request_language: str, caregiver_languages: frozenset[str]) -> bool:
    if request_language == "Hinglish":
        return {"Hindi", "English"}.issubset(caregiver_languages)
    return request_language in caregiver_languages


def _haversine_km(lat_a: float, lng_a: float, lat_b: float, lng_b: float) -> float:
    earth_radius_km = 6371.0
    phi_a, phi_b = math.radians(lat_a), math.radians(lat_b)
    delta_phi = math.radians(lat_b - lat_a)
    delta_lambda = math.radians(lng_b - lng_a)
    value = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi_a) * math.cos(phi_b) * math.sin(delta_lambda / 2) ** 2
    )
    return 2 * earth_radius_km * math.asin(math.sqrt(value))


def _required_skills(care_type: CareType, text: str) -> set[str]:
    text = text.casefold()
    if care_type == CareType.TELECONSULTATION:
        return {"teleconsultation"}
    if care_type == CareType.LAB_TEST_HOME:
        return {"sample_collection", "home_phlebotomy"}
    if care_type == CareType.PARAMEDIC_HOME_VISIT:
        if re.search(r"\b(?:bp|blood pressure)\b.{0,25}\b(?:sugar|glucose)\b|\b(?:sugar|glucose)\b.{0,25}\b(?:bp|blood pressure)\b", text):
            return {"bp_sugar_check"}
        return {"vitals_monitoring"}
    if re.search(r"\b(?:iv|intravenous)\s+injection\b|\b(?:injection|sui)\s+iv\b", text):
        return {"injection_iv"}
    if re.search(r"\b(?:injection|insulin|injections)\b|इंजेक्शन", text):
        return {"injection_im", "injection_iv"}
    if re.search(r"\b(?:catheter|catheterization)\b|कैथेटर", text):
        return {"catheter_care"}
    if re.search(r"\b(?:post[- ]?op|post[- ]?surgical|after surgery|operation ke baad)\b|ऑपरेशन के बाद", text):
        return {"post_surgical_care", "wound_dressing"}
    if re.search(r"\b(?:dressing|bedsore|wound)\b|ड्रेसिंग|पट्टी|घाव", text):
        return {"wound_dressing"}
    return set()


def _has_required_skill(caregiver: Caregiver, required: set[str]) -> bool:
    return not required or bool(caregiver.skills.intersection(required))


def _available(caregiver: Caregiver, now: datetime) -> bool:
    local_time = now.astimezone(IST).time() if now.tzinfo else now.replace(tzinfo=IST).time()
    return caregiver.free_from <= local_time <= caregiver.free_until


def match_caregivers(
    care_type: CareType,
    text: str,
    requested_language: str,
    location: Location,
    caregivers: list[Caregiver],
    now: datetime | None = None,
    limit: int = 3,
) -> list[dict[str, object]]:
    if care_type == CareType.EMERGENCY_112:
        return []
    now = now or datetime.now(IST)
    language = detect_language(text, requested_language)
    role = _ROLE_BY_CARE[care_type]
    required_skills = _required_skills(care_type, text)
    ranked: list[tuple[float, Caregiver, float | None]] = []
    for caregiver in caregivers:
        if not caregiver.active or caregiver.role != role:
            continue
        if caregiver.qualification not in _QUALIFICATION_BY_ROLE[role]:
            continue
        if not _language_match(language, caregiver.languages):
            continue
        if not _has_required_skill(caregiver, required_skills) or not _available(caregiver, now):
            continue
        distance: float | None = None
        if care_type != CareType.TELECONSULTATION:
            distance = _haversine_km(location.lat, location.lng, caregiver.base_lat, caregiver.base_lng)
            if distance > caregiver.max_radius_km:
                continue
            proximity_score = max(0.0, 1.0 - distance / caregiver.max_radius_km)
            score = 0.35 + 0.30 * proximity_score + 0.20 + 0.15 * (caregiver.rating / 5)
        else:
            # Distance does not apply to virtual care; renormalize the other weights.
            score = (0.35 + 0.20 + 0.15 * (caregiver.rating / 5)) / 0.70
        ranked.append((round(score, 4), caregiver, distance))
    ranked.sort(key=lambda item: (-item[0], item[1].caregiver_id))
    matches: list[dict[str, object]] = []
    for score, caregiver, distance in ranked[: max(1, min(limit, 3))]:
        if distance is None:
            if language == "Hindi":
                reason = f"टेली-परामर्श के लिए उपलब्ध, रेटिंग {caregiver.rating:.1f}/5"
            elif language == "Hinglish":
                reason = f"Teleconsultation ke liye available, rating {caregiver.rating:.1f}/5"
            else:
                reason = f"English-speaking, available for teleconsultation, rating {caregiver.rating:.1f}/5"
        else:
            until = caregiver.free_until.strftime("%H:%M")
            if language == "Hindi":
                reason = f"हिंदी बोलते हैं, {distance:.1f} किमी दूर, {until} IST तक उपलब्ध"
            elif language == "Hinglish":
                reason = f"Hindi aur English bolte hain, {distance:.1f} km door, {until} IST tak available"
            else:
                reason = f"English-speaking, {distance:.1f} km away, available until {until} IST"
            if required_skills:
                reason += ", has a relevant skill"
        matches.append({"caregiver_id": caregiver.caregiver_id, "score": score, "reason": reason})
    return matches
