import { useState, type FormEvent } from "react";
import { copy, type CopyKey } from "./copy";
import { apiCareService } from "./services/apiCareService";
import type { CareService, Language, TriageResponse } from "./services/careTypes";

type Screen = "intake" | "loading" | "result" | "caregivers" | "clarification" | "no-match" | "emergency" | "error";
interface AppProps { service?: CareService }

function Mark() {
  return <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40" role="presentation"><path d="M20 5.8c3.6 0 4.5 5.8 2.1 10.8 5-2.4 10.8-1.5 10.8 2.1s-5.8 4.5-10.8 2.1c2.4 5 1.5 10.8-2.1 10.8s-4.5-5.8-2.1-10.8c-5 2.4-10.8 1.5-10.8-2.1s5.8-4.5 10.8-2.1C15.5 11.6 16.4 5.8 20 5.8Z" fill="currentColor" /><circle cx="20" cy="20" r="2.4" fill="#f7f6f2" /></svg></span>;
}

function nextScreen(response: TriageResponse): Screen {
  if (response.red_flags.length > 0 || response.care_type === "emergency_112") return "emergency";
  if (response.follow_up_question) return "clarification";
  if (response.matched_caregivers.length === 0) return "no-match";
  return "result";
}

export default function App({ service = apiCareService }: AppProps) {
  const [language, setLanguage] = useState<Language>("en");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [screen, setScreen] = useState<Screen>("intake");
  const [response, setResponse] = useState<TriageResponse | null>(null);
  const [history, setHistory] = useState<Array<{ role: string; text: string }>>([]);
  const [validationMessage, setValidationMessage] = useState("");
  const t = (key: CopyKey) => copy[language][key];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!description.trim() || !latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setValidationMessage(t("validation"));
      return;
    }

    setValidationMessage("");
    setScreen("loading");
    try {
      const result = await service.triage({
        user_input: description.trim(),
        language: language === "en" ? "english" : language === "hi" ? "hindi" : "hinglish",
        location: { lat, lng },
        conversation_history: history,
      });
      setResponse(result);
      setHistory((previous) => [...previous, { role: "user", text: description.trim() }]);
      setDescription("");
      setScreen(nextScreen(result));
    } catch {
      setScreen("error");
    }
  }

  function startOver() {
    setDescription("");
    setHistory([]);
    setResponse(null);
    setValidationMessage("");
    setScreen("intake");
  }

  const responseHeader = (step: string) => <div className="card-heading"><span className="card-kicker">BACKEND RESPONSE · PROTOTYPE</span><span className="card-step">{step}</span></div>;
  const responseSummary = response && <><p className="mock-label">{t("mockLabel")}</p><p className="outcome-copy">{response.reasoning}</p>{response.care_type && <p className="data-line"><strong>{t("careType")}:</strong> {response.care_type}</p>}{response.urgency && <p className="data-line"><strong>{t("urgency")}:</strong> {response.urgency}</p>}</>;

  return (
    <div className="site-shell">
      <header className="topbar"><a className="brand" href="#top" aria-label={`${t("brand")} home`}><Mark /><span>{t("brand")}</span></a><div className="topbar-meta"><span className="prototype-label">{t("prototype")}</span><span className="demo-badge"><span className="badge-dot" />{t("demoBadge")}</span></div></header>
      <main id="top" className="main-layout">
        <section className="intro-column" aria-labelledby="page-title"><div className="eyebrow"><span className="eyebrow-line" />{t("eyebrow")}</div><h1 id="page-title">{t("title")}</h1><p className="intro-copy">{t("intro")}</p><div className="privacy-note"><span className="note-icon" aria-hidden="true">i</span><p>{t("descriptionHint")}</p></div><div className="steps" aria-label="CareCompass flow"><span className={screen === "intake" || screen === "loading" || screen === "clarification" ? "step active" : "step complete"}><b>01</b><span>Intake</span></span><span className="step-rule" /><span className={screen === "result" || screen === "no-match" || screen === "emergency" || screen === "error" ? "step active" : "step"}><b>02</b><span>Response</span></span><span className="step-rule" /><span className={screen === "caregivers" ? "step active" : "step"}><b>03</b><span>Matches</span></span></div></section>
        <section className="flow-column" aria-label="CareCompass intake and results">
          {(screen === "intake" || screen === "loading") && <form className="intake-card" onSubmit={handleSubmit} noValidate>
            <div className="card-heading"><span className="card-kicker">CARE INTAKE</span><span className="card-step">01 / 03</span></div>
            <label className="field-label" htmlFor="language">{t("languageLabel")}</label><select id="language" className="select-control" value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="en">{t("languageEn")}</option><option value="hi">{t("languageHi")}</option><option value="hinglish">{t("languageHinglish")}</option></select>
            {history.length > 0 && response?.follow_up_question && <div className="follow-up-box"><strong>{t("clarificationTitle")}</strong><p>{response.follow_up_question}</p><p className="field-hint">{t("clarificationHint")}</p></div>}
            <label className="field-label description-label" htmlFor="description">{t("descriptionLabel")}</label><textarea id="description" className="text-control" value={description} onChange={(event) => { setDescription(event.target.value); if (validationMessage) setValidationMessage(""); }} placeholder={t("placeholder")} rows={4} aria-invalid={Boolean(validationMessage)} aria-describedby={validationMessage ? "validation-message" : "description-help"} />
            {validationMessage ? <p id="validation-message" className="field-error" role="alert">{validationMessage}</p> : <p id="description-help" className="field-hint">{t("descriptionHint")}</p>}
            <fieldset className="location-fields"><legend className="field-label">{t("locationLabel")}</legend><div className="coordinate-grid"><div><label className="field-label" htmlFor="latitude">{t("latitude")}</label><input id="latitude" className="select-control" type="number" inputMode="decimal" min="-90" max="90" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} /></div><div><label className="field-label" htmlFor="longitude">{t("longitude")}</label><input id="longitude" className="select-control" type="number" inputMode="decimal" min="-180" max="180" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} /></div></div></fieldset>
            <button className="primary-button" type="submit" disabled={screen === "loading"}>{screen === "loading" ? <><span className="loading-dot" aria-hidden="true" />{t("loading")}</> : <>{history.length > 0 ? t("followUp") : t("submit")}<span aria-hidden="true">↗</span></>}</button>{screen === "loading" && <p className="loading-status" role="status" aria-live="polite">{t("loading")}</p>}
          </form>}
          {screen === "result" && response && <section className="outcome-card" aria-labelledby="result-title" aria-live="polite">{responseHeader("02 / 03")}<div className="outcome-icon result-icon" aria-hidden="true">✳</div><h2 id="result-title">{t("resultTitle")}</h2>{responseSummary}<p className="outcome-disclaimer">This rule-based prototype is not clinical advice or a validated clinical assessment.</p><button className="primary-button" type="button" onClick={() => setScreen("caregivers")}>{t("showCaregivers")}<span aria-hidden="true">↗</span></button><button className="text-button" type="button" onClick={startOver}>{t("startOver")}</button></section>}
          {screen === "caregivers" && response && <section className="outcome-card caregivers-card" aria-labelledby="caregiver-title" aria-live="polite">{responseHeader("03 / 03")}<p className="mock-label">{t("mockLabel")}</p><h2 id="caregiver-title">{t("caregiverTitle")}</h2><p className="outcome-copy">{t("caregiverIntro")}</p><div className="profile-list">{response.matched_caregivers.map((profile, index) => <article className="profile-card" key={`${profile.caregiver_id}-${index}`}><span className="profile-number">0{index + 1}</span><div><span className="profile-badge">{t("profileBadge")}</span><h3>{profile.caregiver_id}</h3><p><strong>Match score:</strong> {profile.score.toFixed(2)}</p><p>{profile.reason}</p></div></article>)}</div><button className="text-button" type="button" onClick={() => setScreen("result")}>{t("backToResult")}</button></section>}
          {screen === "clarification" && response?.follow_up_question && <section className="outcome-card" aria-labelledby="clarification-title"><div className="card-heading"><span className="card-kicker">BACKEND RESPONSE · PROTOTYPE</span><span className="card-step">01 / 03</span></div><h2 id="clarification-title">{t("clarificationTitle")}</h2><p className="outcome-copy">{response.follow_up_question}</p><p className="outcome-disclaimer">No care type, urgency, or caregiver matches were returned. The interface does not add a recommendation.</p><button className="primary-button" type="button" onClick={() => { setDescription(""); setScreen("intake"); }}>{t("followUp")}<span aria-hidden="true">↗</span></button><button className="text-button" type="button" onClick={startOver}>{t("startOver")}</button></section>}
          {screen === "no-match" && <section className="outcome-card" aria-labelledby="no-match-title" aria-live="polite">{responseHeader("02 / 03")}<div className="outcome-icon muted-icon" aria-hidden="true">○</div><p className="mock-label">{t("mockLabel")}</p><h2 id="no-match-title">{t("noMatchTitle")}</h2>{response && <>{responseSummary}<p className="outcome-disclaimer">No caregiver match was returned. No alternative was invented by the interface.</p></>}<button className="text-button" type="button" onClick={startOver}>{t("startOver")}</button></section>}
          {screen === "emergency" && response && <section className="outcome-card emergency-card" aria-labelledby="emergency-title" role="alert">{responseHeader("02 / 03")}<div className="outcome-icon emergency-icon" aria-hidden="true">!</div><h2 id="emergency-title">{t("emergencyTitle")}</h2><p className="outcome-copy">{t("emergencyNote")}</p>{response.red_flags.length > 0 && <p className="data-line"><strong>{t("redFlags")}:</strong> {response.red_flags.join(", ")}</p>}<p className="outcome-disclaimer">{response.reasoning} No caregiver matches are shown for this emergency response.</p><a className="primary-button call-button" href="tel:112">Call 112</a><button className="text-button" type="button" onClick={startOver}>{t("startOver")}</button></section>}
          {screen === "error" && <section className="outcome-card error-card" aria-labelledby="error-title" role="alert"><div className="card-heading"><span className="card-kicker">BACKEND RESPONSE · PROTOTYPE</span><span className="card-step">02 / 03</span></div><div className="outcome-icon error-icon" aria-hidden="true">!</div><h2 id="error-title">{t("errorTitle")}</h2><p className="outcome-copy">{t("errorMessage")}</p><button className="text-button" type="button" onClick={startOver}>{t("startOver")}</button></section>}
        </section>
      </main>
      <footer className="footer"><span>{t("footer")}</span><span className="footer-mark" aria-hidden="true">CC / 01</span></footer>
    </div>
  );
}
