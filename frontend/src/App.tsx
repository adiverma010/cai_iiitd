import { useEffect, useRef, useState, type FormEvent } from "react";
import { copy, type CopyKey } from "./copy";
import {
  apiCareService,
  CareApiError,
  getBrowserLocation,
} from "./services/triageService";
import type {
  CareService,
  Location,
  ProviderRecord,
  TriageResponse,
  TriageRequest,
  UiLanguage,
  RedFlag,
} from "./services/careTypes";
import { detectUiLanguage } from "./services/languageDetection";

type Screen = "intake" | "loading" | "follow-up" | "follow-up-loading" | "result" | "no-match" | "emergency" | "error";
type ErrorMessage = "network" | "service" | "invalid" | "location";

interface AppProps {
  service?: CareService;
  locate?: () => Promise<Location>;
}

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

function isEmergency(response: TriageResponse): boolean {
  return (
    response.red_flags.length > 0 ||
    response.care_type === "emergency_112" ||
    response.urgency === "emergency"
  );
}

function careTypeCopy(careType: NonNullable<TriageResponse["care_type"]>): CopyKey {
  switch (careType) {
    case "paramedic_home_visit": return "careParamedic";
    case "home_nursing": return "careNursing";
    case "lab_test_home": return "careLab";
    case "teleconsultation": return "careTele";
    case "emergency_112": return "careEmergency";
  }
}

function urgencyCopy(urgency: NonNullable<TriageResponse["urgency"]>): CopyKey {
  switch (urgency) {
    case "emergency": return "urgencyEmergency";
    case "same_day": return "urgencySameDay";
    case "scheduled": return "urgencyScheduled";
  }
}

function redFlagCopy(flag: RedFlag): CopyKey {
  const keys: Record<RedFlag, CopyKey> = {
    chest_pain: "flagChestPain",
    breathlessness: "flagBreathlessness",
    unconsciousness: "flagUnconsciousness",
    severe_bleeding: "flagSevereBleeding",
    stroke_symptoms: "flagStrokeSymptoms",
    seizure: "flagSeizure",
    high_fever_infant: "flagHighFeverInfant",
    suicidal_ideation: "flagSuicidalIdeation",
    severe_dehydration: "flagSevereDehydration",
  };
  return keys[flag];
}

function ConversationLog({
  turns,
  pendingText,
  title,
  youLabel,
}: {
  turns: TriageRequest["conversation_history"];
  pendingText?: string;
  title: string;
  youLabel: string;
}) {
  const visibleTurns = pendingText ? [...turns, { role: "user" as const, text: pendingText }] : turns;
  if (visibleTurns.length === 0) return null;
  return (
    <section className="conversation-log" aria-label={title}>
      <h3>{title}</h3>
      {visibleTurns.map((turn, index) => (
        <div className="conversation-turn" key={`${index}-${turn.text}`}>
          <strong>{youLabel}</strong>
          <p>{turn.text}</p>
        </div>
      ))}
    </section>
  );
}

function buildInitialConsultationNote(
  history: TriageRequest["conversation_history"],
  response: TriageResponse | null
): string {
  const lines = [
    "CARECOMPASS — CONSULTATION PREPARATION NOTE",
    "=========================================",
    `Recommended Route: ${response?.care_type ? response.care_type.replace(/_/g, " ").toUpperCase() : "N/A"} (${response?.urgency ? response.urgency.toUpperCase() : "N/A"})`,
    `Triage Reasoning: ${response?.reasoning || "N/A"}`,
    "",
    "Reported Symptoms & Timeline:",
    ...history.map((turn, idx) => `  ${idx + 1}. ${turn.text}`),
    "",
    "Questions to Ask the Doctor / Caregiver:",
    "  - What is the expected recovery timeline for these symptoms?",
    "  - What warning signs should prompt immediate emergency care?",
    "  - Are there any specific medication precautions or tests needed?",
  ];
  return lines.join("\n");
}

function errorCopy(error: unknown): ErrorMessage {
  if (error instanceof Error && error.message === "location-unavailable") return "location";
  if (!(error instanceof CareApiError)) return "service";
  if (error.kind === "network") return "network";
  if (error.kind === "invalid-json" || error.kind === "invalid-response") return "invalid";
  return "service";
}

export default function App({ service = apiCareService, locate = getBrowserLocation }: AppProps) {
  const [language, setLanguage] = useState<UiLanguage>("en");
  const [description, setDescription] = useState("");
  const [conversationHistory, setConversationHistory] = useState<TriageRequest["conversation_history"]>([]);
  const [screen, setScreen] = useState<Screen>("intake");
  const [response, setResponse] = useState<TriageResponse | null>(null);
  const [error, setError] = useState<ErrorMessage>("service");
  const [validationMessage, setValidationMessage] = useState("");
  const [retryFollowUp, setRetryFollowUp] = useState(false);

  // Outbound action & TinyFish discovery state
  const [discoveredProviders, setDiscoveredProviders] = useState<ProviderRecord[]>([]);
  const [bookedCaregiverId, setBookedCaregiverId] = useState<string | null>(null);
  const [prepNote, setPrepNote] = useState("");
  const [noteCopied, setNoteCopied] = useState(false);
  const [reminderConsent, setReminderConsent] = useState(false);
  const [reminderTime, setReminderTime] = useState("");
  const [reminderSaved, setReminderSaved] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Voice speech-to-text state
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState("");

  const followUpInput = useRef<HTMLTextAreaElement>(null);
  const submitting = useRef(false);
  const t = (key: CopyKey) => copy[language][key];

  // Initialize consultation prep note when care response arrives
  useEffect(() => {
    if (response && (screen === "result" || screen === "no-match")) {
      setPrepNote(buildInitialConsultationNote(conversationHistory, response));
    }
  }, [response, screen, conversationHistory]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const userInput = description;
    if (!userInput.trim()) {
      setValidationMessage(t("validation"));
      return;
    }

    const answeringFollowUp = screen === "follow-up";
    submitting.current = true;
    setValidationMessage("");
    if (!answeringFollowUp) setResponse(null);
    setScreen(answeringFollowUp ? "follow-up-loading" : "loading");

    try {
      const location = await locate();
      const request: TriageRequest = {
        user_input: userInput,
        language: "auto",
        location,
        conversation_history: conversationHistory,
      };
      const nextResponse = await service.submit(request);
      setResponse(nextResponse);
      const updatedHistory = [...conversationHistory, { role: "user" as const, text: userInput }];
      setConversationHistory(updatedHistory);
      setDescription("");

      if (isEmergency(nextResponse)) {
        setScreen("emergency");
        setDiscoveredProviders([]);
      } else if (nextResponse.follow_up_question !== null) {
        setScreen("follow-up");
      } else {
        if (nextResponse.matched_caregivers.length === 0) {
          setScreen("no-match");
        } else {
          setScreen("result");
        }
      }
    } catch (submitError) {
      setRetryFollowUp(answeringFollowUp);
      setError(errorCopy(submitError));
      setScreen("error");
    } finally {
      submitting.current = false;
    }
  }

  function handleVoiceInput() {
    type WebkitWindow = Window & {
      webkitSpeechRecognition?: new () => any;
      SpeechRecognition?: new () => any;
    };
    const speechConstructor =
      (window as unknown as WebkitWindow).SpeechRecognition ||
      (window as unknown as WebkitWindow).webkitSpeechRecognition;

    if (!speechConstructor) {
      setVoiceNotice(t("voiceUnsupported"));
      return;
    }
    if (isListening) return;

    try {
      const recognition = new speechConstructor();
      recognition.lang = language === "hi" ? "hi-IN" : "en-IN";
      recognition.interimResults = false;
      recognition.onstart = () => {
        setIsListening(true);
        setVoiceNotice(t("voiceListening"));
      };
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      recognition.onerror = () => {
        setIsListening(false);
        setVoiceNotice("");
      };
      recognition.onend = () => {
        setIsListening(false);
        setVoiceNotice("");
      };
      recognition.start();
    } catch {
      setVoiceNotice(t("voiceUnsupported"));
    }
  }

  function handleSimulateDemoBooking(caregiverId: string) {
    setBookedCaregiverId(`DEMO-REQ-${caregiverId}-${Math.floor(1000 + Math.random() * 9000)}`);
  }

  async function handleDiscoverProviders() {
    if (!response?.care_type || !service.discoverProviders) return;
    setIsDiscovering(true);
    try {
      const disc = await service.discoverProviders(response.care_type);
      if (disc?.providers) setDiscoveredProviders(disc.providers);
    } catch {
      setDiscoveredProviders([]);
    } finally {
      setIsDiscovering(false);
    }
  }

  async function handleCopyNote() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prepNote);
        setNoteCopied(true);
        setTimeout(() => setNoteCopied(false), 3000);
      }
    } catch {
      // Fallback if clipboard API is not permitted
    }
  }

  function handleSaveReminder(event: FormEvent) {
    event.preventDefault();
    if (reminderConsent && reminderTime) {
      setReminderSaved(true);
    }
  }

  function answerFollowUp() {
    followUpInput.current?.focus();
  }

  function startOver() {
    setResponse(null);
    setDescription("");
    setConversationHistory([]);
    setValidationMessage("");
    setError("service");
    setRetryFollowUp(false);
    setLanguage("en");
    setDiscoveredProviders([]);
    setBookedCaregiverId(null);
    setPrepNote("");
    setNoteCopied(false);
    setReminderConsent(false);
    setReminderTime("");
    setReminderSaved(false);
    setVoiceNotice("");
    setScreen("intake");
  }

  function retrySubmission() {
    setScreen(retryFollowUp && response?.follow_up_question ? "follow-up" : "intake");
  }

  function updateDescription(value: string) {
    setDescription(value);
    if (validationMessage) setValidationMessage("");
  }

  const intakeScreen = screen === "intake" || screen === "loading";
  const resultScreen = screen === "result" || screen === "no-match" || screen === "follow-up" || screen === "follow-up-loading" || screen === "emergency" || screen === "error";

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label={`${t("brand")} home`}>
          <Mark />
          <span>{t("brand")}</span>
        </a>
        <div className="topbar-meta">
          <span className="prototype-label">{t("prototype")}</span>
          <span className="demo-badge"><span className="badge-dot" />{t("badge")}</span>
        </div>
      </header>

      <main id="top" className="main-layout">
        <section className="intro-column" aria-labelledby="page-title">
          <div className="eyebrow"><span className="eyebrow-line" />{t("eyebrow")}</div>
          <h1 id="page-title">{t("title")}</h1>
          <p className="intro-copy">{t("intro")}</p>
          <div className="privacy-note safety-note" role="note">
            <span className="note-icon" aria-hidden="true">!</span>
            <p>{t("safetyNote")}</p>
          </div>
          <div className="steps" aria-label="Care request flow">
            <span className={intakeScreen ? "step active" : "step complete"}><b>01</b><span>Intake</span></span>
            <span className="step-rule" />
            <span className={resultScreen ? "step active" : "step"}><b>02</b><span>Care response</span></span>
          </div>
        </section>

        <section className="flow-column" aria-label="CareCompass request flow">
          {intakeScreen && (
            <form className="intake-card" onSubmit={handleSubmit} noValidate>
              <div className="card-heading">
                <span className="card-kicker">CARE INTAKE</span>
                <span className="card-step">01 / 02</span>
              </div>
              <label className="field-label" htmlFor="language">{t("languageLabel")}</label>
              <select id="language" className="select-control" value={language} onChange={(event) => setLanguage(event.target.value as UiLanguage)}>
                <option value="en">{t("languageEn")}</option>
                <option value="hi">{t("languageHi")}</option>
                <option value="hinglish">{t("languageHinglish")}</option>
              </select>

              <div className="field-header-row">
                <label className="field-label description-label" htmlFor="description">
                  {conversationHistory.length > 0 ? t("answerLabel") : t("descriptionLabel")}
                </label>
                <button
                  type="button"
                  className="voice-input-btn"
                  onClick={handleVoiceInput}
                  disabled={screen === "loading"}
                >
                  {isListening ? `🔴 ${t("voiceListening")}` : `🎤 ${t("voiceButton")}`}
                </button>
              </div>

              {voiceNotice && <p className="voice-notice" role="status">{voiceNotice}</p>}

              <textarea
                id="description"
                className="text-control"
                value={description}
                onChange={(event) => updateDescription(event.target.value)}
                placeholder={conversationHistory.length > 0 ? t("answerPlaceholder") : t("placeholder")}
                rows={5}
                aria-invalid={Boolean(validationMessage)}
                aria-describedby={validationMessage ? "validation-message" : "description-help"}
              />
              {validationMessage ? (
                <p id="validation-message" className="field-error" role="alert">{validationMessage}</p>
              ) : (
                <div className="field-hint-row">
                  <p id="description-help" className="field-hint">{t("descriptionHint")}</p>
                  {description.trim() && (
                    <span className="language-badge" data-testid="detected-language">
                      {detectUiLanguage(description, language) === "hi" ? "हिन्दी" : detectUiLanguage(description, language) === "hinglish" ? "Hinglish" : "English"}
                    </span>
                  )}
                </div>
              )}

              <button className="primary-button" type="submit" disabled={screen === "loading"}>
                {screen === "loading" ? <><span className="loading-dot" aria-hidden="true" />{t("loading")}</> : <>{conversationHistory.length > 0 ? t("submitFollowUp") : t("submit")}<span aria-hidden="true">↗</span></>}
              </button>
              {screen === "loading" && <p className="loading-status" role="status" aria-live="polite">{t("loading")}</p>}
            </form>
          )}

          {(screen === "follow-up" || screen === "follow-up-loading") && response?.follow_up_question && (
            <section className="outcome-card" aria-labelledby="follow-up-title" aria-live="polite">
              <div className="card-heading"><span className="card-kicker">FOLLOW-UP</span><span className="card-step">02 / 02</span></div>
              <h2 id="follow-up-title">{t("followUpTitle")}</h2>
              <p className="outcome-copy" data-testid="follow-up-question">{response.follow_up_question}</p>
              <ConversationLog turns={conversationHistory} title={t("conversationTitle")} youLabel={t("youLabel")} />
              <form className="follow-up-form" onSubmit={handleSubmit} noValidate>
                <div className="field-header-row">
                  <label className="field-label" htmlFor="follow-up-answer">{t("answerLabel")}</label>
                  <button
                    type="button"
                    className="voice-input-btn"
                    onClick={handleVoiceInput}
                    disabled={screen === "follow-up-loading"}
                  >
                    {isListening ? `🔴 ${t("voiceListening")}` : `🎤 ${t("voiceButton")}`}
                  </button>
                </div>
                {voiceNotice && <p className="voice-notice" role="status">{voiceNotice}</p>}
                <textarea
                  ref={followUpInput}
                  id="follow-up-answer"
                  className="text-control"
                  value={description}
                  onChange={(event) => updateDescription(event.target.value)}
                  placeholder={t("answerPlaceholder")}
                  rows={3}
                  aria-invalid={Boolean(validationMessage)}
                  aria-describedby={validationMessage ? "follow-up-validation" : undefined}
                />
                {validationMessage && <p id="follow-up-validation" className="field-error" role="alert">{validationMessage}</p>}
                <button className="primary-button" type="submit" disabled={screen === "follow-up-loading"}>
                  {screen === "follow-up-loading" ? t("loading") : t("submitFollowUp")}<span aria-hidden="true">↗</span>
                </button>
                {screen === "follow-up-loading" && <p className="loading-status" role="status" aria-live="polite">{t("loading")}</p>}
              </form>
              <p className="outcome-disclaimer">{t("disclaimer")}</p>
              {screen === "follow-up" && <button className="text-button" type="button" onClick={answerFollowUp}>{t("answerFollowUp")}</button>}
              <button className="text-button" type="button" onClick={startOver}>{t("startOver")}</button>
            </section>
          )}

          {screen === "emergency" && response && (
            <section className="outcome-card emergency-card" aria-labelledby="emergency-title" role="alert">
              <div className="card-heading"><span className="card-kicker">EMERGENCY</span><span className="card-step">02 / 02</span></div>
              <div className="outcome-icon emergency-icon" aria-hidden="true">!</div>
              <h2 id="emergency-title">{t("emergencyTitle")}</h2>
              <p className="outcome-copy">{t("emergencyGuidance")}</p>
              <a className="primary-button emergency-call" href="tel:112">{t("call112")}<span aria-hidden="true">↗</span></a>
              {response.red_flags.length > 0 && (
                <div className="emergency-flags">
                  <h3>{t("redFlagsLabel")}</h3>
                  <ul>{response.red_flags.map((flag) => <li key={flag}>{t(redFlagCopy(flag))}</li>)}</ul>
                </div>
              )}
              <ConversationLog turns={conversationHistory} title={t("conversationTitle")} youLabel={t("youLabel")} />
              <p className="outcome-disclaimer">{response.reasoning}</p>
              <button className="text-button" type="button" onClick={startOver}>{t("startOver")}</button>
            </section>
          )}

          {(screen === "result" || screen === "no-match") && response && response.care_type && response.urgency && (
            <section className="outcome-card" aria-labelledby="result-title" aria-live="polite">
              <div className="card-heading"><span className="card-kicker">CARE RESPONSE</span><span className="card-step">02 / 02</span></div>
              <p className="mock-label result-label">{t("resultTitle")}</p>
              <h2 id="result-title">{t(careTypeCopy(response.care_type))}</h2>
              <dl className="decision-details">
                <div><dt>{t("careTypeLabel")}</dt><dd>{response.care_type}</dd></div>
                <div><dt>{t("urgencyLabel")}</dt><dd>{t(urgencyCopy(response.urgency))}</dd></div>
              </dl>
              <p className="outcome-copy"><strong>{t("reasoningLabel")}:</strong> {response.reasoning}</p>
              <ConversationLog turns={conversationHistory} title={t("conversationTitle")} youLabel={t("youLabel")} />

              {screen === "result" && (
                <div className="matches-section">
                  <h3>{t("matchedTitle")}</h3>
                  <div className="profile-list">
                    {response.matched_caregivers.map((match) => (
                      <article className="profile-card" key={match.caregiver_id}>
                        <span className="profile-number" aria-hidden="true">✓</span>
                        <div className="profile-content">
                          <div className="profile-header-meta">
                            <span className="profile-badge">{match.caregiver_id}</span>
                            <span className="synthetic-pill">{t("syntheticBadge")}</span>
                          </div>
                          <h3>Score: {match.score.toFixed(2)}</h3>
                          <p>{match.reason}</p>

                          <div className="action-row">
                            <a className="action-pill call-pill" href="tel:+911140001000">
                              📞 {t("callAction")}
                            </a>
                            <a
                              className="action-pill directions-pill"
                              href="https://maps.google.com/?q=28.54,77.27"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              📍 {t("directionsAction")}
                            </a>
                            <button
                              type="button"
                              className="action-pill demo-booking-pill"
                              onClick={() => handleSimulateDemoBooking(match.caregiver_id)}
                              disabled={Boolean(bookedCaregiverId)}
                            >
                              📅 {t("bookDemoAction")}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  {bookedCaregiverId && (
                    <div className="demo-booking-banner" role="status">
                      <span className="badge-dot" />
                      <div>
                        <strong>{t("demoBookedStatus")}</strong>
                        <p>Reference ID: <code>{bookedCaregiverId}</code> · Retain for demo verification</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {screen === "no-match" && (
                <p className="outcome-copy no-match-copy">{t("noMatchTitle")}. {t("noMatches")}</p>
              )}

              {/* Public Healthcare Provider Discovery (TinyFish / Directory) */}
              <div className="providers-section">
                <div className="field-header-row">
                  <h3>{t("providersTitle")}</h3>
                  <button
                    type="button"
                    className="action-pill discover-providers-btn"
                    onClick={handleDiscoverProviders}
                    disabled={isDiscovering}
                  >
                    {isDiscovering ? `⌛ ${t("loading")}` : `🔍 Find live providers (TinyFish)`}
                  </button>
                </div>
                {discoveredProviders.length > 0 ? (
                  <div className="profile-list">
                    {discoveredProviders.map((p) => (
                      <article className="profile-card live-provider-card" key={p.provider_id}>
                        <span className="profile-number live-provider-number" aria-hidden="true">🌐</span>
                        <div className="profile-content">
                          <div className="profile-header-meta">
                            <span className="provider-name">{p.provider_name}</span>
                            <span className="live-verified-pill">{t("providerVerified")}</span>
                          </div>
                          {p.address && <p className="provider-meta">📍 {p.address}</p>}
                          {p.published_hours && <p className="provider-meta">⏰ {p.published_hours}</p>}
                          <div className="action-row">
                            {p.phone && (
                              <a className="action-pill call-pill" href={`tel:${p.phone}`}>
                                📞 {p.phone}
                              </a>
                            )}
                            <a
                              className="action-pill official-pill"
                              href={p.booking_url || p.official_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              🌐 {t("officialSiteAction")} ↗
                            </a>
                          </div>
                          <p className="provenance-note">
                            Source: <code>{p.official_url}</code> · Availability: <em>unknown (verify directly)</em>
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="field-hint">
                    Click above to query public healthcare providers for this care route via TinyFish web search.
                  </p>
                )}
              </div>

              {/* Consultation Preparation Handoff */}
              <section className="consultation-section">
                <h3>{t("consultationTitle")}</h3>
                <p className="consultation-desc">{t("consultationCopy")}</p>
                <textarea
                  className="text-control prep-textarea"
                  value={prepNote}
                  onChange={(e) => setPrepNote(e.target.value)}
                  rows={6}
                  aria-label="Editable consultation preparation note"
                />
                <button type="button" className="action-pill copy-prep-btn" onClick={handleCopyNote}>
                  📋 {noteCopied ? t("noteCopied") : t("copyNoteButton")}
                </button>
              </section>

              {/* Optional Local Reminder */}
              <section className="reminder-section">
                <h3>{t("reminderTitle")}</h3>
                <form onSubmit={handleSaveReminder} className="reminder-form">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={reminderConsent}
                      onChange={(e) => setReminderConsent(e.target.checked)}
                    />
                    <span>{t("reminderConsent")}</span>
                  </label>
                  {reminderConsent && (
                    <div className="reminder-input-row">
                      <input
                        type="datetime-local"
                        className="select-control reminder-datetime"
                        value={reminderTime}
                        onChange={(e) => setReminderTime(e.target.value)}
                        required
                      />
                      <button type="submit" className="action-pill schedule-reminder-btn">
                        ⏰ {t("scheduleReminder")}
                      </button>
                    </div>
                  )}
                  {reminderSaved && (
                    <p className="reminder-confirm" role="status">
                      ✓ {t("reminderConfirmed")} ({new Date(reminderTime).toLocaleString()})
                    </p>
                  )}
                </form>
              </section>

              <p className="outcome-disclaimer">{t("disclaimer")}</p>
              <button className="text-button" type="button" onClick={startOver}>{t("startOver")}</button>
            </section>
          )}

          {screen === "error" && (
            <section className="outcome-card error-card" aria-labelledby="error-title" role="alert">
              <div className="card-heading"><span className="card-kicker">SERVICE STATUS</span><span className="card-step">02 / 02</span></div>
              <div className="outcome-icon error-icon" aria-hidden="true">!</div>
              <h2 id="error-title">{t("errorTitle")}</h2>
              <p className="outcome-copy">{t(error === "location" ? "errorLocation" : error === "network" ? "errorNetwork" : error === "invalid" ? "errorInvalid" : "errorService")}</p>
              <ConversationLog turns={conversationHistory} pendingText={description || undefined} title={t("conversationTitle")} youLabel={t("youLabel")} />
              <button className="primary-button" type="button" onClick={retrySubmission}>{t("tryAgain")}<span aria-hidden="true">↗</span></button>
              <button className="text-button" type="button" onClick={startOver}>{t("startOver")}</button>
            </section>
          )}
        </section>
      </main>

      <footer className="footer"><span>{t("footer")}</span><span className="footer-mark" aria-hidden="true">CC / 01</span></footer>
    </div>
  );
}
