import { useState, type FormEvent } from "react";
import { copy, type CopyKey } from "./copy";
import { mockCareService } from "./services/mockCareService";
import type { CareService, DemoResponse, DemoScenario, Language } from "./services/careTypes";

type Screen = "intake" | "loading" | "result" | "caregivers" | "no-match" | "emergency-demo" | "error";

interface AppProps {
  service?: CareService;
}

const scenarioKeys: Record<DemoScenario, CopyKey> = {
  standard: "scenarioStandard",
  "no-match": "scenarioNoMatch",
  error: "scenarioError",
  emergency: "scenarioEmergency",
};

function Mark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" role="presentation">
        <path d="M20 5.8c3.6 0 4.5 5.8 2.1 10.8 5-2.4 10.8-1.5 10.8 2.1s-5.8 4.5-10.8 2.1c2.4 5 1.5 10.8-2.1 10.8s-4.5-5.8-2.1-10.8c-5 2.4-10.8 1.5-10.8-2.1s5.8-4.5 10.8-2.1C15.5 11.6 16.4 5.8 20 5.8Z" fill="currentColor" />
        <circle cx="20" cy="20" r="2.4" fill="#f7f6f2" />
      </svg>
    </span>
  );
}

function isResult(response: DemoResponse | null): response is Extract<DemoResponse, { kind: "result" }> {
  return response?.kind === "result";
}

export default function App({ service = mockCareService }: AppProps) {
  const [language, setLanguage] = useState<Language>("en");
  const [description, setDescription] = useState("");
  const [scenario, setScenario] = useState<DemoScenario>("standard");
  const [screen, setScreen] = useState<Screen>("intake");
  const [response, setResponse] = useState<DemoResponse | null>(null);
  const [validationMessage, setValidationMessage] = useState("");
  const t = (key: CopyKey) => copy[language][key];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!description.trim()) {
      setValidationMessage(t("validation"));
      return;
    }

    setValidationMessage("");
    setResponse(null);
    setScreen("loading");

    try {
      const nextResponse = await service.submit({
        description: description.trim(),
        language,
        scenario,
      });
      setResponse(nextResponse);
      setScreen(nextResponse.kind === "result" ? "result" : nextResponse.kind);
    } catch {
      setScreen("error");
    }
  }

  function startOver() {
    setResponse(null);
    setDescription("");
    setValidationMessage("");
    setScenario("standard");
    setScreen("intake");
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label={`${t("brand")} home`}>
          <Mark />
          <span>{t("brand")}</span>
        </a>
        <div className="topbar-meta">
          <span className="prototype-label">{t("prototype")}</span>
          <span className="demo-badge"><span className="badge-dot" />{t("demoBadge")}</span>
        </div>
      </header>

      <main id="top" className="main-layout">
        <section className="intro-column" aria-labelledby="page-title">
          <div className="eyebrow"><span className="eyebrow-line" />{t("eyebrow")}</div>
          <h1 id="page-title">{t("title")}</h1>
          <p className="intro-copy">{t("intro")}</p>
          <div className="privacy-note">
            <span className="note-icon" aria-hidden="true">i</span>
            <p>{t("descriptionHint")}</p>
          </div>
          <div className="steps" aria-label="Demonstration flow">
            <span className={screen === "intake" || screen === "loading" ? "step active" : "step complete"}><b>01</b><span>Intake</span></span>
            <span className="step-rule" />
            <span className={screen === "result" || screen === "no-match" || screen === "emergency-demo" || screen === "error" ? "step active" : "step"}><b>02</b><span>Mock result</span></span>
            <span className="step-rule" />
            <span className={screen === "caregivers" ? "step active" : "step"}><b>03</b><span>Examples</span></span>
          </div>
        </section>

        <section className="flow-column" aria-label="CareCompass demonstration">
          {screen === "intake" || screen === "loading" ? (
            <form className="intake-card" onSubmit={handleSubmit} noValidate>
              <div className="card-heading">
                <span className="card-kicker">CARE INTAKE</span>
                <span className="card-step">01 / 03</span>
              </div>
              <label className="field-label" htmlFor="language">{t("languageLabel")}</label>
              <select id="language" className="select-control" value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
                <option value="en">{t("languageEn")}</option>
                <option value="hi">{t("languageHi")}</option>
                <option value="hinglish">{t("languageHinglish")}</option>
              </select>

              <label className="field-label description-label" htmlFor="description">{t("descriptionLabel")}</label>
              <textarea
                id="description"
                className="text-control"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  if (validationMessage) setValidationMessage("");
                }}
                placeholder={t("placeholder")}
                rows={5}
                aria-invalid={Boolean(validationMessage)}
                aria-describedby={validationMessage ? "validation-message" : "description-help"}
              />
              {validationMessage ? <p id="validation-message" className="field-error" role="alert">{validationMessage}</p> : <p id="description-help" className="field-hint">{t("descriptionHint")}</p>}

              <label className="field-label scenario-label" htmlFor="scenario">{t("scenarioLabel")}</label>
              <select id="scenario" className="select-control" value={scenario} onChange={(event) => setScenario(event.target.value as DemoScenario)}>
                {(Object.keys(scenarioKeys) as DemoScenario[]).map((key) => <option key={key} value={key}>{t(scenarioKeys[key])}</option>)}
              </select>
              <p className="field-hint scenario-hint">{t("scenarioHint")}</p>

              <button className="primary-button" type="submit" disabled={screen === "loading"}>
                {screen === "loading" ? <><span className="loading-dot" aria-hidden="true" />{t("loading")}</> : <>{t("submit")}<span aria-hidden="true">↗</span></>}
              </button>
              {screen === "loading" && <p className="loading-status" role="status" aria-live="polite">{t("loading")}</p>}
            </form>
          ) : null}

          {screen === "result" && isResult(response) && (
            <section className="outcome-card" aria-labelledby="result-title" aria-live="polite">
              <div className="card-heading"><span className="card-kicker">MOCK RESPONSE</span><span className="card-step">02 / 03</span></div>
              <div className="outcome-icon result-icon" aria-hidden="true">✳</div>
              <p className="mock-label">{t("mockLabel")}</p>
              <h2 id="result-title">{t("resultTitle")}</h2>
              <p className="outcome-copy">{response.message}</p>
              <p className="outcome-disclaimer">No urgency category, clinical assessment, or real routing is provided.</p>
              <button className="primary-button" type="button" onClick={() => setScreen("caregivers")}>{t("showCaregivers")}<span aria-hidden="true">↗</span></button>
              <button className="text-button" type="button" onClick={startOver}>{t("startOver")}</button>
            </section>
          )}

          {screen === "caregivers" && isResult(response) && (
            <section className="outcome-card caregivers-card" aria-labelledby="caregiver-title" aria-live="polite">
              <div className="card-heading"><span className="card-kicker">MOCK RESPONSE</span><span className="card-step">03 / 03</span></div>
              <p className="mock-label">{t("mockLabel")}</p>
              <h2 id="caregiver-title">{t("caregiverTitle")}</h2>
              <p className="outcome-copy">{t("caregiverIntro")}</p>
              <div className="profile-list">
                {response.caregivers.map((profile, index) => (
                  <article className="profile-card" key={profile.id}>
                    <span className="profile-number">0{index + 1}</span>
                    <div><span className="profile-badge">{t("profileBadge")}</span><h3>{profile.label}</h3><p>{profile.description}</p></div>
                  </article>
                ))}
              </div>
              <button className="text-button" type="button" onClick={() => setScreen("result")}>{t("backToResult")}</button>
            </section>
          )}

          {screen === "no-match" && response?.kind === "no-match" && (
            <section className="outcome-card" aria-labelledby="no-match-title" aria-live="polite">
              <div className="card-heading"><span className="card-kicker">MOCK RESPONSE</span><span className="card-step">02 / 03</span></div>
              <div className="outcome-icon muted-icon" aria-hidden="true">○</div>
              <p className="mock-label">{t("mockLabel")}</p>
              <h2 id="no-match-title">{t("noMatchTitle")}</h2>
              <p className="outcome-copy">{response.message}</p>
              <button className="text-button" type="button" onClick={startOver}>{t("startOver")}</button>
            </section>
          )}

          {screen === "emergency-demo" && response?.kind === "emergency-demo" && (
            <section className="outcome-card emergency-card" aria-labelledby="emergency-title" role="status" aria-live="polite">
              <div className="card-heading"><span className="card-kicker">MOCK RESPONSE</span><span className="card-step">02 / 03</span></div>
              <div className="outcome-icon emergency-icon" aria-hidden="true">!</div>
              <p className="mock-label">{t("mockLabel")}</p>
              <h2 id="emergency-title">{t("emergencyTitle")}</h2>
              <p className="outcome-copy">{t("emergencyNote")}</p>
              <p className="outcome-disclaimer">{response.message}</p>
              <button className="text-button" type="button" onClick={startOver}>{t("startOver")}</button>
            </section>
          )}

          {screen === "error" && (
            <section className="outcome-card error-card" aria-labelledby="error-title" role="alert">
              <div className="card-heading"><span className="card-kicker">MOCK RESPONSE</span><span className="card-step">02 / 03</span></div>
              <div className="outcome-icon error-icon" aria-hidden="true">!</div>
              <p className="mock-label">{t("mockLabel")}</p>
              <h2 id="error-title">{t("errorTitle")}</h2>
              <p className="outcome-copy">{t("errorMessage")}</p>
              <button className="text-button" type="button" onClick={startOver}>{t("startOver")}</button>
            </section>
          )}
        </section>
      </main>

      <footer className="footer"><span>{t("footer")}</span><span className="footer-mark" aria-hidden="true">CC / 01</span></footer>
    </div>
  );
}
