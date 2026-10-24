import type { Language } from "./services/careTypes";

export const copy = {
  en: {
    brand: "CareCompass", prototype: "Backend prototype", demoBadge: "PROTOTYPE · SYNTHETIC DATA", eyebrow: "A calmer first step",
    title: "Tell us what kind of support you’re looking for.", intro: "Describe what support you are looking for. The connected backend is a deterministic prototype, not a clinical assessment.",
    languageLabel: "Choose your language", languageEn: "English", languageHi: "हिन्दी", languageHinglish: "Hinglish",
    descriptionLabel: "What would you like support with?", descriptionHint: "Your description and location are sent to the configured CareCompass backend. Share only what you are comfortable sharing.", placeholder: "Write a short description…",
    locationLabel: "Your approximate location (required for matching)", latitude: "Latitude", longitude: "Longitude", submit: "Send to CareCompass", loading: "Contacting CareCompass…",
    validation: "Enter a short description and valid latitude/longitude to continue.", errorTitle: "We could not get a verified response", errorMessage: "Check that the backend is running and try again. This prototype cannot assess your situation.",
    resultTitle: "CareCompass response", mockLabel: "Backend prototype · synthetic roster", noMatchTitle: "No matching profiles returned", emergencyTitle: "Backend emergency response",
    emergencyNote: "The prototype backend flagged this request as an emergency. Call 112 now. Do not rely on this prototype for medical assessment.", caregiverTitle: "Returned caregiver matches",
    caregiverIntro: "These IDs and match details come from a synthetic development roster. They do not represent real people or availability.", profileBadge: "SYNTHETIC PROFILE",
    showCaregivers: "View returned caregiver matches", backToResult: "Back to response", startOver: "Start again", clarificationTitle: "More detail needed",
    clarificationHint: "Answer the question in your own words. Your earlier message will be included as conversation context.", careType: "Care type", urgency: "Prototype urgency", reasoning: "Backend explanation", redFlags: "Backend red flags", followUp: "Continue with clarification",
    footer: "Backend prototype · Synthetic caregiver data · Not a clinical assessment",
  },
  hi: {
    brand: "CareCompass", prototype: "बैकएंड प्रोटोटाइप", demoBadge: "प्रोटोटाइप · कृत्रिम डेटा", eyebrow: "सहायता की एक सरल शुरुआत",
    title: "बताइए, आपको किस तरह की सहायता चाहिए।", intro: "बताइए कि आपको किस सहायता की ज़रूरत है। जुड़ा हुआ बैकएंड एक नियम-आधारित प्रोटोटाइप है, चिकित्सीय आकलन नहीं।",
    languageLabel: "अपनी भाषा चुनें", languageEn: "English", languageHi: "हिन्दी", languageHinglish: "Hinglish",
    descriptionLabel: "आपको किस बात में सहायता चाहिए?", descriptionHint: "आपका विवरण और स्थान कॉन्फ़िगर किए गए CareCompass बैकएंड को भेजे जाते हैं। केवल वही साझा करें जिसमें आप सहज हों।", placeholder: "संक्षेप में लिखें…",
    locationLabel: "आपका अनुमानित स्थान (मिलान के लिए आवश्यक)", latitude: "अक्षांश", longitude: "देशांतर", submit: "CareCompass को भेजें", loading: "CareCompass से संपर्क हो रहा है…",
    validation: "आगे बढ़ने के लिए छोटा विवरण और सही अक्षांश/देशांतर भरें।", errorTitle: "सत्यापित परिणाम नहीं मिल सका", errorMessage: "बैकएंड चालू है या नहीं जाँचें और फिर प्रयास करें। यह प्रोटोटाइप आपकी स्थिति का आकलन नहीं कर सकता।",
    resultTitle: "CareCompass का जवाब", mockLabel: "बैकएंड प्रोटोटाइप · कृत्रिम रोस्टर", noMatchTitle: "कोई मिलती प्रोफ़ाइल नहीं मिली", emergencyTitle: "बैकएंड आपातकालीन जवाब",
    emergencyNote: "प्रोटोटाइप बैकएंड ने इस अनुरोध को आपातकालीन बताया है। अभी 112 पर कॉल करें। चिकित्सीय आकलन के लिए इस प्रोटोटाइप पर निर्भर न रहें।", caregiverTitle: "मिली हुई देखभालकर्ता प्रोफ़ाइल",
    caregiverIntro: "ये आईडी और मिलान विवरण विकास के कृत्रिम रोस्टर से हैं। ये वास्तविक व्यक्ति या उपलब्धता नहीं दिखाते।", profileBadge: "कृत्रिम प्रोफ़ाइल",
    showCaregivers: "मिली हुई प्रोफ़ाइल देखें", backToResult: "जवाब पर वापस जाएँ", startOver: "फिर से शुरू करें", clarificationTitle: "थोड़ी और जानकारी चाहिए",
    clarificationHint: "अपने शब्दों में जवाब दें। पिछला संदेश बातचीत के संदर्भ के रूप में भेजा जाएगा।", careType: "देखभाल का प्रकार", urgency: "प्रोटोटाइप तात्कालिकता", reasoning: "बैकएंड का विवरण", redFlags: "बैकएंड संकेत", followUp: "जवाब देकर आगे बढ़ें",
    footer: "बैकएंड प्रोटोटाइप · कृत्रिम देखभालकर्ता डेटा · चिकित्सीय आकलन नहीं",
  },
  hinglish: {
    brand: "CareCompass", prototype: "Backend prototype", demoBadge: "PROTOTYPE · SYNTHETIC DATA", eyebrow: "Support ke liye ek simple shuruaat",
    title: "Batayein, aapko kis tarah ki support chahiye.", intro: "Batayein aapko kis support ki zaroorat hai. Connected backend ek deterministic prototype hai, clinical assessment nahi.",
    languageLabel: "Apni language chunein", languageEn: "English", languageHi: "हिन्दी", languageHinglish: "Hinglish",
    descriptionLabel: "Aapko kis baat mein support chahiye?", descriptionHint: "Aapka description aur location configured CareCompass backend ko bheja jayega. Sirf wahi share karein jismein aap comfortable hain.", placeholder: "Chhota sa description likhein…",
    locationLabel: "Aapki approximate location (matching ke liye zaroori)", latitude: "Latitude", longitude: "Longitude", submit: "CareCompass ko bhejein", loading: "CareCompass se connect ho raha hai…",
    validation: "Aage badhne ke liye short description aur sahi latitude/longitude bharein.", errorTitle: "Verified response nahi mil saka", errorMessage: "Backend running hai ya nahi check karke dobara try karein. Yeh prototype aapki situation assess nahi kar sakta.",
    resultTitle: "CareCompass response", mockLabel: "Backend prototype · synthetic roster", noMatchTitle: "Koi matching profile nahi mili", emergencyTitle: "Backend emergency response",
    emergencyNote: "Prototype backend ne is request ko emergency bataya hai. Abhi 112 par call karein. Medical assessment ke liye is prototype par rely na karein.", caregiverTitle: "Returned caregiver matches",
    caregiverIntro: "Yeh IDs aur match details synthetic development roster se hain. Yeh real log ya availability nahi dikhate.", profileBadge: "SYNTHETIC PROFILE",
    showCaregivers: "Returned caregiver matches dekhein", backToResult: "Response par wapas jaayein", startOver: "Dobara shuru karein", clarificationTitle: "Thodi aur detail chahiye",
    clarificationHint: "Apne words mein answer dein. Aapka pehla message conversation context ke saath bheja jayega.", careType: "Care type", urgency: "Prototype urgency", reasoning: "Backend explanation", redFlags: "Backend red flags", followUp: "Clarification ke saath aage badhein",
    footer: "Backend prototype · Synthetic caregiver data · Clinical assessment nahi",
  },
} satisfies Record<Language, Record<string, string>>;

export type CopyKey = keyof typeof copy.en;
