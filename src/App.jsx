import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";

const STORAGE_KEYS = {
  session: "safebite.session",
  preference: "safebite.preference",
  allergies: "safebite.allergies",
  emergencyProfile: "safebite.emergencyProfile",
  reservationProfile: "safebite.reservationProfile",
  placeUsage: "safebite.placeUsage",
};

const EMERGENCY_CONFIG = {
  test: {
    label: "Safe Test Number",
    number: "+27791825118",
    phrases: [
      "This is a safe test call.",
      "Please ignore this call.",
      "I am checking that the relay script works.",
      "The phone is on speaker.",
      "The message will repeat automatically.",
    ],
  },
  police: {
    label: "Police",
    phrases: [
      "I am in danger and cannot speak.",
      "There is a break-in right now.",
      "Someone has a weapon.",
      "Please send police urgently.",
    ],
    number: "10111",
  },
  ambulance: {
    label: "Ambulance",
    phrases: [
      "Someone is unconscious.",
      "There is severe bleeding.",
      "The person cannot breathe properly.",
      "Please send an ambulance urgently.",
    ],
    number: "10177",
  },
  fire: {
    label: "Fire / Rescue",
    phrases: [
      "There is a fire in the building.",
      "Smoke is filling the room.",
      "Someone is trapped inside.",
      "Please send fire and rescue urgently.",
    ],
    number: "10177",
  },
};

const DEFAULT_EMERGENCY_PROFILE = {
  selectedCategory: "test",
  selectedPhrases: [],
  testNumber: EMERGENCY_CONFIG.test.number,
  locationText: "",
  speakDelayMs: 7000,
  repeatCount: 7,
  repeatGapMs: 3000,
  scriptText: "",
};

const RESERVATION_QUICK_PHRASES = [
  "Quiet seating please.",
  "I need staff who can support allergy questions.",
  "Please seat us near the entrance.",
  "Please confirm by SMS if possible.",
  "We may arrive a few minutes early.",
  "Please keep the route easy to navigate.",
];

const DEFAULT_RESERVATION_PROFILE = {
  selectedPlaceName: "",
  guestCount: "2",
  reservationDate: "",
  reservationTime: "19:00",
  selectedPhrases: [],
  customRequest: "",
  scriptText: "",
};

const ALLERGIES = [
  "Peanuts",
  "Dairy",
  "Gluten",
  "Shellfish",
  "Soy",
  "Eggs",
  "Fish",
  "Tree Nuts",
];

const SEED_PLACES = [
  {
    name: "Ocean Basket Sandton",
    type: "Seafood restaurant",
    distance: "0.7 km",
    vibe: "Bright seating, easy mall access, and staff used to allergy questions.",
    mapsQuery: "Ocean Basket Sandton City Johannesburg",
    website: "https://www.oceanbasket.com/",
  },
  {
    name: "Mugg & Bean Nelson Mandela Square",
    type: "Cafe",
    distance: "0.9 km",
    vibe: "Large-print style menu boards, calm space, and simple landmark-based access.",
    mapsQuery: "Mugg and Bean Nelson Mandela Square Johannesburg",
    website: "https://www.muggandbean.co.za/",
  },
  {
    name: "Sandton City Food Court",
    type: "Mall dining hub",
    distance: "0.4 km",
    vibe: "Multiple food counters in one accessible indoor route.",
    mapsQuery: "Sandton City Food Court Johannesburg",
    website: "https://sandtoncity.com/",
  },
];

const DEMO_MENU = `Spicy Prawn Tacos - Prawns, slaw, lime crema, flour tortillas
Peanut Crunch Salad - Lettuce, carrot, peanut dressing, sesame seeds
Roasted Veg Bowl - Quinoa, avocado, chickpeas, mint yogurt
Blueberry Oat Pancakes - Oats, egg, milk, blueberry compote`;

const MATCHERS = {
  Peanuts: ["peanut", "satay"],
  Dairy: ["cream", "cheese", "parmesan", "milk", "butter", "yogurt", "crema"],
  Gluten: ["pasta", "wrap", "bread", "wheat", "noodles", "bun", "naan", "tortilla"],
  Shellfish: ["shrimp", "prawn", "crab", "lobster"],
  Soy: ["soy", "tofu", "miso"],
  Eggs: ["egg", "mayo", "aioli"],
  Fish: ["salmon", "tuna", "anchovy"],
  "Tree Nuts": ["almond", "cashew", "walnut", "pecan"],
};

function readStoredValue(key, fallback) {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch {
    return fallback;
  }
}

function saveStoredValue(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function parseMenuText(rawText) {
  return rawText
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((line) => {
      const [namePart, ingredientPart = ""] = line.split(" - ");
      const ingredients = ingredientPart
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      return {
        name: namePart.trim(),
        ingredients,
      };
    });
}

function detectRisks(item, selectedAllergies) {
  const hits = selectedAllergies.filter((allergy) =>
    MATCHERS[allergy]?.some((token) =>
      `${item.name} ${item.ingredients.join(" ")}`.toLowerCase().includes(token)
    )
  );

  if (hits.length) {
    return {
      label: "Avoid",
      className: "risk-danger",
      detail: `Possible match for ${hits.join(", ")}.`,
    };
  }

  if (item.ingredients.length < 2) {
    return {
      label: "Ask Staff",
      className: "risk-warn",
      detail: "SafeBite needs more detail before calling this safe.",
    };
  }

  return {
    label: "Looks Safer",
    className: "risk-safe",
    detail: "No direct matches were found in the visible text.",
  };
}

function createAvatarLabel(name) {
  return (name || "SafeBite User")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatPhoneLink(number) {
  return number.replace(/[^\d+]/g, "");
}

function formatDuration(value) {
  const totalSeconds = Math.round(Number(value) / 1000);
  return `${totalSeconds}s`;
}

function readEmergencyProfileValue() {
  const storedValue = readStoredValue(STORAGE_KEYS.emergencyProfile, DEFAULT_EMERGENCY_PROFILE);
  const selectedCategory = EMERGENCY_CONFIG[storedValue?.selectedCategory] ? storedValue.selectedCategory : "test";

  return {
    ...DEFAULT_EMERGENCY_PROFILE,
    ...storedValue,
    selectedCategory,
    selectedPhrases: Array.isArray(storedValue?.selectedPhrases) ? storedValue.selectedPhrases.filter(Boolean) : [],
    testNumber: String(storedValue?.testNumber || DEFAULT_EMERGENCY_PROFILE.testNumber),
    locationText: String(storedValue?.locationText || ""),
    scriptText: String(storedValue?.scriptText || ""),
    speakDelayMs: Number(storedValue?.speakDelayMs) || DEFAULT_EMERGENCY_PROFILE.speakDelayMs,
    repeatCount: Number(storedValue?.repeatCount) || DEFAULT_EMERGENCY_PROFILE.repeatCount,
    repeatGapMs: Number(storedValue?.repeatGapMs) || DEFAULT_EMERGENCY_PROFILE.repeatGapMs,
  };
}

function readReservationProfileValue() {
  const storedValue = readStoredValue(STORAGE_KEYS.reservationProfile, DEFAULT_RESERVATION_PROFILE);

  return {
    ...DEFAULT_RESERVATION_PROFILE,
    ...storedValue,
    selectedPlaceName: String(storedValue?.selectedPlaceName || ""),
    guestCount: String(storedValue?.guestCount || DEFAULT_RESERVATION_PROFILE.guestCount),
    reservationDate: String(storedValue?.reservationDate || ""),
    reservationTime: String(storedValue?.reservationTime || DEFAULT_RESERVATION_PROFILE.reservationTime),
    customRequest: String(storedValue?.customRequest || ""),
    scriptText: String(storedValue?.scriptText || ""),
    selectedPhrases: Array.isArray(storedValue?.selectedPhrases) ? storedValue.selectedPhrases.filter(Boolean) : [],
  };
}

function buildEmergencyRelayScript(categoryKey, selectedPhrases, locationText) {
  const config = EMERGENCY_CONFIG[categoryKey] || EMERGENCY_CONFIG.test;
  const normalizedPhrases = selectedPhrases.filter(Boolean);

  if (categoryKey === "test") {
    return [
      "This is a test emergency relay call.",
      `Location ${locationText || "not added yet"}.`,
      ...normalizedPhrases,
      "Please ignore this test.",
    ].join("\n");
  }

  return [
    "The caller cannot speak and is using an emergency relay.",
    `Send ${config.label.toLowerCase()} to ${locationText || "the saved location"}.`,
    ...normalizedPhrases,
    "Please treat this as urgent.",
  ].join("\n");
}

function formatReservationDate(value) {
  if (!value) {
    return "a date you will confirm";
  }

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatReservationTime(value) {
  if (!value) {
    return "a time you will confirm";
  }

  const [hours = "19", minutes = "00"] = String(value).split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-ZA", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function buildReservationScript(profile, placeName, userName) {
  const guestLabel = `${profile.guestCount || "2"} ${Number(profile.guestCount || 2) === 1 ? "person" : "people"}`;
  const phraseText = profile.selectedPhrases.join(" ").trim();
  const customRequest = profile.customRequest.trim();
  const intro = userName ? `Hello, my name is ${userName}.` : "Hello.";
  const placeLine = placeName
    ? `I would like to book a table at ${placeName} for ${guestLabel} on ${formatReservationDate(profile.reservationDate)} at ${formatReservationTime(profile.reservationTime)}.`
    : `I would like to book a table for ${guestLabel} on ${formatReservationDate(profile.reservationDate)} at ${formatReservationTime(profile.reservationTime)}.`;

  return [intro, placeLine, phraseText, customRequest, "Please confirm whether this reservation is available."].filter(Boolean).join("\n");
}

function toSpokenDigits(value) {
  const words = {
    0: "zero",
    1: "one",
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    9: "nine",
  };

  return String(value)
    .split("")
    .map((character) => {
      if (character === "-") return "minus";
      if (character === ".") return "point";
      return words[character] || character;
    })
    .join(" ");
}

function locationToSpeech(location) {
  if (location.address) {
    return `My location is ${location.address}.`;
  }

  return `My location is near latitude ${toSpokenDigits(location.latitude)} and longitude ${toSpokenDigits(location.longitude)}.`;
}

function loadVoices() {
  if (!("speechSynthesis" in window)) {
    return [];
  }

  return window.speechSynthesis.getVoices();
}

function pickBestVoice() {
  const availableVoices = loadVoices();

  return (
    availableVoices.find((voice) => /en-ZA/i.test(voice.lang)) ||
    availableVoices.find((voice) => /en-GB|en-US/i.test(voice.lang)) ||
    availableVoices[0] ||
    null
  );
}

async function verifyGoogleCredential(credential) {
  const response = await fetch("/api/auth/google", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ credential }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Google verification failed.");
  }

  return data.user;
}

async function fetchNearbyPlaces(coords) {
  const radius = 1800;
  const query = `[out:json];(node[amenity=restaurant](around:${radius},${coords.latitude},${coords.longitude});node[shop=mall](around:${radius},${coords.latitude},${coords.longitude}););out center 12;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query,
  });

  if (!response.ok) {
    throw new Error("Nearby places lookup failed.");
  }

  const data = await response.json();

  return data.elements.slice(0, 6).map((item, index) => ({
    name: item.tags?.name || `Nearby place ${index + 1}`,
    type: item.tags?.shop === "mall" ? "Mall" : "Restaurant",
    distance: "Live nearby result",
    vibe: item.tags?.cuisine
      ? `${item.tags.cuisine} option with live location routing.`
      : "Live nearby place found from your current location.",
    mapsQuery: item.tags?.name || `Nearby place ${index + 1}`,
    website: item.tags?.website || "",
    phone: item.tags?.phone || "",
  }));
}

function speakText(text, setVoiceStatus, statusMessage = "SafeBite is speaking.") {
  if (!("speechSynthesis" in window)) {
    setVoiceStatus("Speech is not supported in this browser.");
    return false;
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    setVoiceStatus("There is nothing to read yet.");
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(trimmedText);
  const voice = pickBestVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = "en-US";
  }
  utterance.rate = 0.95;
  utterance.onstart = () => setVoiceStatus(statusMessage);
  utterance.onend = () => setVoiceStatus("Finished speaking.");
  utterance.onerror = () => setVoiceStatus("Speech could not start.");
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

export default function App() {
  const [user, setUser] = useState(() => readStoredValue(STORAGE_KEYS.session, null));
  const [preference, setPreference] = useState(() => readStoredValue(STORAGE_KEYS.preference, null));
  const [allergies, setAllergies] = useState(() => readStoredValue(STORAGE_KEYS.allergies, []));
  const [emergencyProfile, setEmergencyProfile] = useState(readEmergencyProfileValue);
  const [reservationProfile, setReservationProfile] = useState(readReservationProfileValue);
  const [placeUsage, setPlaceUsage] = useState(() => readStoredValue(STORAGE_KEYS.placeUsage, {}));
  const [activeTab, setActiveTab] = useState("home");
  const [authStatus, setAuthStatus] = useState("Sign in with your verified Gmail account to continue.");
  const [analysisStatus, setAnalysisStatus] = useState("Upload a menu image or paste menu text to start analysis.");
  const [voiceStatus, setVoiceStatus] = useState("Voice assistant ready. Enable voice to hear the menu aloud.");
  const [commandStatus, setCommandStatus] = useState("Voice commands are ready to be started.");
  const [locationStatus, setLocationStatus] = useState("Nearby suggestions are centered on Sandton City until you share your location.");
  const [addressStatus, setAddressStatus] = useState("Exact address will appear here after location is enabled.");
  const [orderStatus, setOrderStatus] = useState("Select a restaurant from the nearby list, then build your order.");
  const [menuText, setMenuText] = useState(DEMO_MENU);
  const [menuPreview, setMenuPreview] = useState("");
  const [places, setPlaces] = useState(SEED_PLACES);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [orderText, setOrderText] = useState("");
  const [reservationStatus, setReservationStatus] = useState(
    "Pick a restaurant, choose quick phrases, and build a reservation request you can read, copy, or call from."
  );
  const [recordingTarget, setRecordingTarget] = useState("");
  const [recordingStatus, setRecordingStatus] = useState("Recorder ready. Use it to dictate reservation or emergency text.");
  const [emergencyLocationStatus, setEmergencyLocationStatus] = useState("Location not detected yet.");
  const [emergencyCallStatus, setEmergencyCallStatus] = useState(
    "Emergency relay is ready. Choose a category, add the location, and start the call when ready."
  );
  const [showSettings, setShowSettings] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef(null);
  const orderRecognitionRef = useRef(null);
  const recordingRecognitionRef = useRef(null);
  const emergencyDelayTimeoutRef = useRef(null);
  const emergencyRepeatTimeoutRef = useRef(null);
  const emergencySessionRef = useRef(0);

  const isVoiceMode = preference === "voice";
  const allowPreviewLogin = String(import.meta.env.VITE_ALLOW_PREVIEW_LOGIN || "true") !== "false";
  const hasGoogleClientId = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  const menuItems = useMemo(() => parseMenuText(menuText), [menuText]);
  const analyzedItems = useMemo(
    () => menuItems.map((item) => ({ ...item, risk: detectRisks(item, allergies) })),
    [menuItems, allergies]
  );
  const availableReservationPlaces = useMemo(() => {
    const placeMap = new Map();

    [selectedPlace, ...places, ...SEED_PLACES].filter(Boolean).forEach((place) => {
      if (!placeMap.has(place.name)) {
        placeMap.set(place.name, place);
      }
    });

    return Array.from(placeMap.values());
  }, [places, selectedPlace]);
  const selectedReservationPlace = useMemo(
    () => availableReservationPlaces.find((place) => place.name === reservationProfile.selectedPlaceName) || null,
    [availableReservationPlaces, reservationProfile.selectedPlaceName]
  );
  const topUsedPlaces = useMemo(() => {
    const sortedPlaces = [...availableReservationPlaces].sort((left, right) => {
      const usageDifference = (placeUsage[right.name] || 0) - (placeUsage[left.name] || 0);
      if (usageDifference !== 0) {
        return usageDifference;
      }

      return left.name.localeCompare(right.name);
    });

    return sortedPlaces.slice(0, 4);
  }, [availableReservationPlaces, placeUsage]);
  const selectedEmergencyConfig = useMemo(
    () => EMERGENCY_CONFIG[emergencyProfile.selectedCategory] || EMERGENCY_CONFIG.test,
    [emergencyProfile.selectedCategory]
  );
  const emergencyDialTarget = useMemo(() => {
    if (emergencyProfile.selectedCategory === "test") {
      return formatPhoneLink(emergencyProfile.testNumber) || "Enter a safe test number";
    }

    return formatPhoneLink(selectedEmergencyConfig.number);
  }, [emergencyProfile.selectedCategory, emergencyProfile.testNumber, selectedEmergencyConfig.number]);
  const isEmergencyReadyToCall = useMemo(
    () => Boolean(emergencyProfile.locationText.trim() && emergencyDialTarget && !emergencyDialTarget.startsWith("Enter")),
    [emergencyDialTarget, emergencyProfile.locationText]
  );
  const emergencyTargetNote = useMemo(
    () => `The phone dials ${emergencyDialTarget}, waits ${formatDuration(emergencyProfile.speakDelayMs)}, then repeats the message ${emergencyProfile.repeatCount} times.`,
    [emergencyDialTarget, emergencyProfile.repeatCount, emergencyProfile.speakDelayMs]
  );
  const emergencyScriptPreview = useMemo(() => {
    return emergencyProfile.scriptText || "Add a location and select one or more relay phrases to build the emergency script.";
  }, [emergencyProfile.scriptText]);
  const reservationScriptPreview = useMemo(() => {
    return reservationProfile.scriptText || "Choose a place, date, time, and quick phrases to build the reservation request.";
  }, [reservationProfile.scriptText]);
  const isReservationReady = useMemo(
    () => Boolean(selectedReservationPlace && reservationProfile.reservationDate && reservationProfile.reservationTime),
    [reservationProfile.reservationDate, reservationProfile.reservationTime, selectedReservationPlace]
  );

  useEffect(() => {
    if (user) {
      saveStoredValue(STORAGE_KEYS.session, user);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.session);
    }
  }, [user]);

  useEffect(() => {
    if (preference) {
      saveStoredValue(STORAGE_KEYS.preference, preference);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.preference);
    }
  }, [preference]);

  useEffect(() => {
    saveStoredValue(STORAGE_KEYS.allergies, allergies);
  }, [allergies]);

  useEffect(() => {
    saveStoredValue(STORAGE_KEYS.emergencyProfile, emergencyProfile);
  }, [emergencyProfile]);

  useEffect(() => {
    saveStoredValue(STORAGE_KEYS.reservationProfile, reservationProfile);
  }, [reservationProfile]);

  useEffect(() => {
    saveStoredValue(STORAGE_KEYS.placeUsage, placeUsage);
  }, [placeUsage]);

  useEffect(() => {
    setEmergencyProfile((current) => {
      const rebuiltScript = buildEmergencyRelayScript(
        current.selectedCategory,
        current.selectedPhrases,
        current.locationText.trim()
      );

      return current.scriptText === rebuiltScript ? current : { ...current, scriptText: rebuiltScript };
    });
  }, [emergencyProfile.locationText, emergencyProfile.selectedCategory, emergencyProfile.selectedPhrases]);

  useEffect(() => {
    setReservationProfile((current) => {
      const rebuiltScript = buildReservationScript(current, current.selectedPlaceName, user?.name || "");

      return current.scriptText === rebuiltScript ? current : { ...current, scriptText: rebuiltScript };
    });
  }, [reservationProfile.customRequest, reservationProfile.guestCount, reservationProfile.reservationDate, reservationProfile.reservationTime, reservationProfile.selectedPhrases, reservationProfile.selectedPlaceName, user?.name]);

  useEffect(() => {
    return () => {
      recordingRecognitionRef.current?.stop?.();
      if (emergencyDelayTimeoutRef.current) {
        window.clearTimeout(emergencyDelayTimeoutRef.current);
      }
      if (emergencyRepeatTimeoutRef.current) {
        window.clearTimeout(emergencyRepeatTimeoutRef.current);
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return undefined;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setIsListening(true);
      setCommandStatus("Listening for a command.");
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      setCommandStatus(`Heard: ${transcript}`);

      if (transcript.includes("read menu")) {
        speakText(menuText, setVoiceStatus);
      } else if (transcript.includes("read nearby")) {
        speakText(places.map((place) => `${place.name}. ${place.type}. ${place.vibe}`).join(" "), setVoiceStatus);
      } else if (transcript.includes("analyze")) {
        setAnalysisStatus(`SafeBite analyzed ${menuItems.length} menu items.`);
        setActiveTab("scan");
      } else if (transcript.includes("open emergency") || transcript.includes("emergency help")) {
        setActiveTab("emergency");
        setEmergencyCallStatus("Emergency relay opened. Confirm the location, then start the call when ready.");
      } else if (transcript.includes("preview emergency")) {
        setActiveTab("emergency");
        speakText(emergencyProfile.scriptText, setVoiceStatus, "Previewing the emergency relay message.");
      } else if (transcript.includes("start emergency") || transcript.includes("call emergency")) {
        setActiveTab("emergency");
        setEmergencyCallStatus("Emergency relay opened. Press Start Relay Call when you are ready.");
      } else if (transcript.includes("open reservation") || transcript.includes("book reservation")) {
        setActiveTab("reservation");
        setReservationStatus("Reservation assistant opened. Pick a place and confirm the details.");
      } else if (transcript.includes("preview reservation")) {
        setActiveTab("reservation");
        speakText(reservationProfile.scriptText, setVoiceStatus, "Previewing the reservation request.");
      } else if (transcript.includes("profile")) {
        setActiveTab("profile");
      } else if (transcript.includes("stop")) {
        window.speechSynthesis.cancel();
        setVoiceStatus("Speech stopped.");
      }
    };
    recognition.onend = () => {
      setIsListening(false);
      setCommandStatus("Voice listener stopped. Tap Start listening to try again.");
    };
    recognition.onerror = () => {
      setCommandStatus("Voice recognition had a problem. Try again.");
    };

    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, [emergencyProfile.scriptText, menuItems.length, menuText, places, reservationProfile.scriptText]);

  function handlePreviewLogin() {
    if (!allowPreviewLogin) {
      setAuthStatus("Preview login is disabled. Use a verified Google account instead.");
      return;
    }

    setUser({
      name: "Preview Guest",
      email: "preview@safebite.local",
      picture: "",
      provider: "preview",
    });
    setAuthStatus("Preview login enabled. Choose your experience mode next.");
  }

  async function handleGoogleSuccess(tokenResponse) {
    try {
      const verifiedUser = await verifyGoogleCredential(tokenResponse.credential);
      setUser(verifiedUser);
      setAuthStatus(`Signed in as ${verifiedUser.email}. Choose your experience mode next.`);
    } catch (error) {
      setAuthStatus(error.message);
    }
  }

  function handleGoogleError() {
    setAuthStatus("Google sign-in did not complete. Try again.");
  }

  function handlePreferenceChange(nextPreference) {
    setPreference(nextPreference);
    setActiveTab("home");
    if (nextPreference === "voice") {
      setVoiceStatus("Voice experience enabled. SafeBite Assistant is ready.");
      speakText("Voice experience enabled. SafeBite Assistant is ready.", setVoiceStatus);
    } else {
      window.speechSynthesis?.cancel();
      setVoiceStatus("Text-first experience enabled. Voice controls are hidden.");
    }
  }

  function signOut() {
    window.speechSynthesis?.cancel();
    setUser(null);
    setPreference(null);
    setActiveTab("home");
    setShowSettings(false);
  }

  function toggleAllergy(allergy) {
    setAllergies((current) =>
      current.includes(allergy) ? current.filter((item) => item !== allergy) : [...current, allergy]
    );
  }

  function updatePlaceUsage(placeName) {
    if (!placeName) {
      return;
    }

    setPlaceUsage((current) => ({
      ...current,
      [placeName]: (current[placeName] || 0) + 1,
    }));
  }

  async function handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setMenuPreview(URL.createObjectURL(file));
    setAnalysisStatus(`Uploading ${file.name} for menu extraction. This may take a few seconds.`);
    setIsAnalyzingImage(true);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/menu/extract", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Menu image extraction failed.");
      }

      const text = String(data.text || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n");

      setMenuText(text || DEMO_MENU);
      setAnalysisStatus(`Text extracted from ${file.name} with the Claude API. SafeBite refreshed the analysis.`);
    } catch (error) {
      setAnalysisStatus(error.message || "Image reading failed, so SafeBite kept the current menu text.");
    } finally {
      setIsAnalyzingImage(false);
    }
  }

  async function handleUseLocation() {
    if (!("geolocation" in navigator)) {
      setLocationStatus("Geolocation is not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setLocationStatus(
          `Exact location active. Latitude ${coords.latitude.toFixed(4)}, longitude ${coords.longitude.toFixed(4)}.`
        );
        setAddressStatus("Finding your nearby address and live places.");

        try {
          const [nearbyResponse, addressResponse] = await Promise.all([
            fetchNearbyPlaces(coords),
            fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`,
              { headers: { Accept: "application/json" } }
            ),
          ]);
          const addressData = await addressResponse.json();
          setPlaces(nearbyResponse.length ? nearbyResponse : SEED_PLACES);
          setAddressStatus(`Exact address: ${addressData.display_name || "Address not available."}`);
          setOrderStatus("Nearby places refreshed from your real location. Select one to order.");
          setReservationStatus("Nearby places refreshed. Pick one to book or use the top-used places list.");
        } catch {
          setPlaces(SEED_PLACES);
          setAddressStatus("Live address or nearby lookup failed, so SafeBite kept the backup list.");
        }
      },
      () => {
        setLocationStatus("Location permission was denied, so SafeBite kept the backup nearby list.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  function startListening() {
    if (!isVoiceMode) {
      setCommandStatus("Text mode is active. Open Settings if you want to use the voice assistant.");
      return;
    }

    recognitionRef.current?.start();
  }

  function startOrderVoice() {
    if (!isVoiceMode) {
      setOrderStatus("Voice ordering is disabled in text mode.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setOrderStatus("Voice ordering is not supported in this browser.");
      return;
    }

    if (!selectedPlace) {
      setOrderStatus("Select a nearby restaurant before starting voice order.");
      return;
    }

    if (!orderRecognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => setOrderStatus(`Listening for your order to ${selectedPlace.name}.`);
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join(" ");
        setOrderText(transcript);
        setOrderStatus("Order captured. You can edit it, copy it, or open an order link.");
      };
      recognition.onerror = () => setOrderStatus("Voice order capture failed. Try again or type the order.");
      orderRecognitionRef.current = recognition;
    }

    orderRecognitionRef.current.start();
  }

  function stopScriptRecording() {
    recordingRecognitionRef.current?.stop?.();
    setRecordingTarget("");
    setRecordingStatus("Recording stopped.");
  }

  function startScriptRecording(target) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setRecordingStatus("Speech recording is not supported in this browser.");
      return;
    }

    if (recordingTarget === target) {
      stopScriptRecording();
      return;
    }

    if (recordingRecognitionRef.current) {
      recordingRecognitionRef.current.stop();
      recordingRecognitionRef.current = null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let finalTranscript = "";

    recognition.onstart = () => {
      setRecordingTarget(target);
      setRecordingStatus(`Recording ${target === "reservation" ? "reservation" : "emergency"} text now.`);
    };

    recognition.onresult = (event) => {
      finalTranscript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ")
        .trim();

      if (!finalTranscript) {
        return;
      }

      if (target === "reservation") {
        setReservationProfile((current) => ({
          ...current,
          scriptText: finalTranscript,
        }));
        setReservationStatus("Reservation text captured. You can edit it, preview it, or copy it.");
      } else {
        setEmergencyProfile((current) => ({
          ...current,
          scriptText: finalTranscript,
        }));
        setEmergencyCallStatus("Emergency relay text captured. You can edit it or preview it before the call.");
      }
    };

    recognition.onend = () => {
      setRecordingStatus(finalTranscript ? "Recording finished and text was inserted." : "Recording stopped before any text was captured.");
      setRecordingTarget((current) => (current === target ? "" : current));
      recordingRecognitionRef.current = null;
    };

    recognition.onerror = () => {
      setRecordingStatus("Recording failed. Try again or type the text manually.");
      setRecordingTarget("");
      recordingRecognitionRef.current = null;
    };

    recordingRecognitionRef.current = recognition;
    recognition.start();
  }

  function copyOrder() {
    if (!orderText.trim()) {
      setOrderStatus("There is no order text to copy yet.");
      return;
    }

    navigator.clipboard.writeText(orderText);
    setOrderStatus("Order text copied to the clipboard.");
  }

  function openOrderLink() {
    if (!selectedPlace) {
      setOrderStatus("Select a nearby restaurant first.");
      return;
    }

    const url =
      selectedPlace.website ||
      `https://www.google.com/search?q=${encodeURIComponent(`${selectedPlace.name} online order`)}`;

    window.open(url, "_blank", "noopener,noreferrer");
    updatePlaceUsage(selectedPlace.name);
    setOrderStatus(`Opening ordering options for ${selectedPlace.name}.`);
  }

  function selectPlaceForOrder(place) {
    setSelectedPlace(place);
    setActiveTab("order");
    updatePlaceUsage(place.name);
    setOrderStatus(`Selected ${place.name}. You can now ${isVoiceMode ? "speak or type" : "type"} your order.`);
  }

  function updateReservationProfile(field, value) {
    setReservationProfile((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function selectPlaceForReservation(place) {
    setReservationProfile((current) => ({
      ...current,
      selectedPlaceName: place.name,
    }));
    setActiveTab("reservation");
    updatePlaceUsage(place.name);
    setReservationStatus(`Selected ${place.name}. Confirm the date, time, and quick phrases for the reservation.`);
  }

  function toggleReservationPhrase(phrase) {
    setReservationProfile((current) => {
      const selectedPhrases = current.selectedPhrases.includes(phrase)
        ? current.selectedPhrases.filter((entry) => entry !== phrase)
        : [...current.selectedPhrases, phrase];

      return {
        ...current,
        selectedPhrases,
      };
    });
    setReservationStatus("Reservation quick phrases updated.");
  }

  function copyReservationRequest() {
    if (!reservationProfile.scriptText.trim()) {
      setReservationStatus("There is no reservation request to copy yet.");
      return;
    }

    navigator.clipboard.writeText(reservationProfile.scriptText);
    setReservationStatus("Reservation request copied to the clipboard.");
  }

  function previewReservationRequest() {
    if (!speakText(reservationProfile.scriptText, setVoiceStatus, "Previewing the reservation request.")) {
      setReservationStatus("There is no reservation request to preview yet.");
      return;
    }

    setReservationStatus("Previewing the reservation request.");
  }

  function openReservationLink() {
    if (!selectedReservationPlace) {
      setReservationStatus("Pick a restaurant before opening booking options.");
      return;
    }

    const url =
      selectedReservationPlace.website ||
      `https://www.google.com/search?q=${encodeURIComponent(`${selectedReservationPlace.name} reservation`)}`;

    window.open(url, "_blank", "noopener,noreferrer");
    updatePlaceUsage(selectedReservationPlace.name);
    setReservationStatus(`Opening reservation options for ${selectedReservationPlace.name}.`);
  }

  function callReservationPlace() {
    if (!selectedReservationPlace) {
      setReservationStatus("Pick a restaurant before starting the reservation call.");
      return;
    }

    if (!selectedReservationPlace.phone) {
      setReservationStatus(`${selectedReservationPlace.name} does not have a phone number in the current listing. Use the booking link instead.`);
      return;
    }

    updatePlaceUsage(selectedReservationPlace.name);
    setReservationStatus(`Opening the dialer for ${selectedReservationPlace.name}.`);
    window.location.href = `tel:${formatPhoneLink(selectedReservationPlace.phone)}`;
  }

  function updateEmergencyProfile(field, value) {
    setEmergencyProfile((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function selectEmergencyCategory(categoryKey) {
    setEmergencyProfile((current) => ({
      ...current,
      selectedCategory: categoryKey,
      selectedPhrases: [],
    }));
    setEmergencyCallStatus(`${(EMERGENCY_CONFIG[categoryKey] || EMERGENCY_CONFIG.test).label} selected. Add the location and choose relay phrases.`);
  }

  function toggleEmergencyPhrase(phrase) {
    setEmergencyProfile((current) => {
      const selectedPhrases = current.selectedPhrases.includes(phrase)
        ? current.selectedPhrases.filter((entry) => entry !== phrase)
        : [...current.selectedPhrases, phrase];

      return {
        ...current,
        selectedPhrases,
      };
    });
    setEmergencyCallStatus("Relay phrases updated.");
  }

  async function getCurrentEmergencyLocation() {
    if (!("geolocation" in navigator)) {
      throw new Error("Location is not supported in this browser.");
    }

    const coords = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      });
    });

    let address = "";

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.coords.latitude}&lon=${coords.coords.longitude}`,
        { headers: { Accept: "application/json" } }
      );
      const data = await response.json();
      address = data.display_name || "";
    } catch {
      address = "";
    }

    return {
      latitude: coords.coords.latitude.toFixed(5),
      longitude: coords.coords.longitude.toFixed(5),
      address,
    };
  }

  async function detectEmergencyScriptLocation() {
    try {
      setEmergencyLocationStatus("Getting location...");
      const location = await getCurrentEmergencyLocation();
      const locationText = location.address || `GPS coordinates: ${location.latitude}, ${location.longitude}`;
      setEmergencyProfile((current) => ({
        ...current,
        locationText,
      }));
      setEmergencyLocationStatus(location.address ? location.address : `Using GPS coordinates: ${locationText}`);
      setEmergencyCallStatus("Location added to the emergency relay script.");
    } catch (error) {
      setEmergencyLocationStatus(error.message || "Could not get location. Type it manually.");
    }
  }

  function stopEmergencyFlow(silent = false) {
    if (emergencyDelayTimeoutRef.current) {
      window.clearTimeout(emergencyDelayTimeoutRef.current);
      emergencyDelayTimeoutRef.current = null;
    }
    if (emergencyRepeatTimeoutRef.current) {
      window.clearTimeout(emergencyRepeatTimeoutRef.current);
      emergencyRepeatTimeoutRef.current = null;
    }

    emergencySessionRef.current += 1;
    window.speechSynthesis?.cancel();

    if (!silent) {
      setEmergencyCallStatus("Relay audio stopped.");
    }
  }

  function playEmergencyRelayScript(sessionId, scriptText, repeatCount, repeatGapMs) {
    if (!("speechSynthesis" in window)) {
      setEmergencyCallStatus("The call opened, but speech playback is not supported in this browser.");
      return;
    }

    let repeatIndex = 0;

    const speakOnce = () => {
      if (sessionId !== emergencySessionRef.current || repeatIndex >= repeatCount) {
        if (repeatIndex >= repeatCount) {
          setEmergencyCallStatus("Relay message finished repeating.");
        }
        return;
      }

      const utterance = new SpeechSynthesisUtterance(scriptText.trim());
      const voice = pickBestVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = "en-ZA";
      }
      utterance.rate = 0.9;
      setEmergencyCallStatus(`Speaking ${repeatIndex + 1} of ${repeatCount}.`);

      utterance.onend = () => {
        if (sessionId !== emergencySessionRef.current) {
          return;
        }

        repeatIndex += 1;
        if (repeatIndex < repeatCount) {
          emergencyRepeatTimeoutRef.current = window.setTimeout(speakOnce, repeatGapMs);
        } else {
          setEmergencyCallStatus("Relay message finished repeating.");
        }
      };

      utterance.onerror = () => {
        setEmergencyCallStatus("Speech playback failed.");
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    };

    speakOnce();
  }

  function previewEmergencyScript() {
    stopEmergencyFlow(true);
    if (!speakText(emergencyProfile.scriptText, setVoiceStatus, "Previewing the emergency relay message.")) {
      setEmergencyCallStatus("There is no relay script to preview yet.");
      return;
    }

    setEmergencyCallStatus("Previewing the relay script.");
  }

  function startEmergencyFlow() {
    if (!isEmergencyReadyToCall) {
      setEmergencyCallStatus("Add the location and a valid number first.");
      return;
    }

    stopEmergencyFlow(true);

    const sessionId = emergencySessionRef.current + 1;
    emergencySessionRef.current = sessionId;
    setEmergencyCallStatus(`Opening the phone dialer for ${emergencyDialTarget}...`);
    setVoiceStatus(`Opening the phone dialer for ${emergencyDialTarget}. Keep the phone on speaker for the relay message.`);

    emergencyDelayTimeoutRef.current = window.setTimeout(() => {
      playEmergencyRelayScript(
        sessionId,
        emergencyProfile.scriptText,
        emergencyProfile.repeatCount,
        emergencyProfile.repeatGapMs
      );
    }, emergencyProfile.speakDelayMs);

    try {
      window.location.href = `tel:${emergencyDialTarget}`;
    } catch {
      window.open(`tel:${emergencyDialTarget}`, "_self");
    }
  }

  if (!user) {
    return (
      <div className="auth-shell">
        <section className="auth-card panel">
          <p className="eyebrow">SafeBite Sign In</p>
          <h1>Choose your accessible dining experience</h1>
          <p className="lead">
            Sign in with Gmail first, then choose whether SafeBite should guide you with voice or stay text-first across the app.
          </p>

          <div className="auth-actions">
            {hasGoogleClientId ? (
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} useOneTap={false} theme="filled_blue" shape="pill" text="signin_with" />
            ) : (
              <div className="placeholder-login">Add VITE_GOOGLE_CLIENT_ID to enable Google sign-in.</div>
            )}

            <button className="button button-secondary" type="button" onClick={handlePreviewLogin}>
              Continue in preview mode
            </button>
          </div>

          <p className="status-text">{authStatus}</p>
        </section>
      </div>
    );
  }

  if (!preference) {
    return (
      <div className="auth-shell">
        <section className="auth-card panel">
          <p className="eyebrow">Accessibility Setup</p>
          <h1>How should SafeBite work for you?</h1>
          <p className="lead">
            You can switch this later in Settings. The workflow stays the same, but the interface changes to match how you want to use the app.
          </p>

          <div className="choice-grid">
            <button className="choice-card" type="button" onClick={() => handlePreferenceChange("voice")}>
              <span className="eyebrow">Voice Experience</span>
              <strong>SafeBite Assistant plus spoken guidance</strong>
              <span>Keeps the assistant, read-aloud controls, and voice ordering visible.</span>
            </button>
            <button className="choice-card" type="button" onClick={() => handlePreferenceChange("text")}>
              <span className="eyebrow">Text Experience</span>
              <strong>Text-first navigation plus quieter interface</strong>
              <span>Removes visible voice controls while keeping the same dining workflow.</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`app-shell ${isVoiceMode ? "voice-mode" : "text-mode"}`}>
      <div className="app-frame">
        <header className="topbar panel">
          <div className="identity-block">
            {user.picture ? (
              <img className="avatar-image" src={user.picture} alt={user.name} referrerPolicy="no-referrer" />
            ) : (
              <div className="avatar-fallback">{createAvatarLabel(user.name)}</div>
            )}
            <div>
              <p className="eyebrow">SafeBite</p>
              <h2>{user.name}</h2>
              <p className="meta-copy">{user.email}</p>
            </div>
          </div>

          <div className="topbar-actions">
            <button className="button button-danger compact" type="button" onClick={() => setActiveTab("emergency") }>
              Emergency
            </button>
            <span className="mode-pill">{isVoiceMode ? "Voice mode" : "Text mode"}</span>
            <button className="button button-secondary compact" type="button" onClick={() => setShowSettings(true)}>
              Settings
            </button>
            <button className="button button-ghost compact" type="button" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>

        <main className="screen-area">
          {activeTab === "home" && (
            <section className="screen-stack">
              <section className="hero-panel panel">
                <div>
                  <p className="eyebrow">Accessible dining, built for confidence</p>
                  <h1>SafeBite</h1>
                  <p className="lead">
                    Scan menus, check allergy risks, find nearby places, and order with an experience that adapts to voice-first or text-first use.
                  </p>
                  <div className="hero-actions">
                    <button className="button button-primary" type="button" onClick={() => setActiveTab("scan")}>
                      Scan a Menu
                    </button>
                    <button className="button button-secondary" type="button" onClick={() => setActiveTab("nearby")}>
                      Explore Nearby
                    </button>
                  </div>
                </div>

                <div className="feature-orbs">
                  <span className="orb coral">Voice + Text Ready</span>
                  <span className="orb blue">Allergy Aware</span>
                  <span className="orb mint">Navigation Support</span>
                </div>
              </section>

              <section className="two-up-grid">
                <article className="panel card">
                  <p className="eyebrow">Quick Status</p>
                  <h3>{isVoiceMode ? "Voice experience active" : "Text experience active"}</h3>
                  <p className="meta-copy">
                    {isVoiceMode
                      ? "SafeBite Assistant stays visible, spoken guidance stays on, and voice ordering remains available."
                      : "The workflow stays the same, but the visible assistant and read-aloud controls are removed."}
                  </p>
                </article>
                <article className="panel card">
                  <p className="eyebrow">Your Protections</p>
                  <h3>{allergies.length ? `${allergies.length} allergies selected` : "0 allergies selected"}</h3>
                  <p className="meta-copy">
                    {allergies.length ? `Currently tracking: ${allergies.join(", ")}.` : "Add allergies in Profile so dish checks can flag them automatically."}
                  </p>
                </article>
              </section>

              <section className="panel card">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Quick Actions</p>
                    <h2>Jump into the workflow</h2>
                  </div>
                </div>
                <div className="action-grid">
                  {[
                    ["Scan Menu", "Capture a menu and extract readable text.", "scan"],
                    ["Nearby Places", "Find accessible restaurants or malls near you.", "nearby"],
                    ["Order", "Build an order for the selected place.", "order"],
                    ["Reservation", "Book a table with quick phrases and top-used places.", "reservation"],
                    ["Emergency", "Call, message, and share your live location quickly.", "emergency"],
                    ["Profile", "Change allergies, mode, and accessibility preferences.", "profile"],
                  ].map(([title, copy, tab]) => (
                    <button key={title} className="action-tile" type="button" onClick={() => setActiveTab(tab)}>
                      <strong>{title}</strong>
                      <span>{copy}</span>
                    </button>
                  ))}
                </div>
              </section>

              {isVoiceMode ? (
                <section className="panel card">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Voice Assistant</p>
                      <h2>Use spoken commands with SafeBite Assistant</h2>
                    </div>
                    <div className="inline-actions">
                      <button className={`button button-primary ${isListening ? "active-listening" : ""}`} type="button" onClick={startListening}>
                        {isListening ? "Listening now" : "Start listening"}
                      </button>
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() =>
                          speakText(
                            "Voice help. You can say read menu, analyze, read nearby, open reservation, preview reservation, open emergency, preview emergency, profile, or stop.",
                            setVoiceStatus
                          )
                        }
                      >
                        Read voice help
                      </button>
                    </div>
                  </div>
                  <p className="status-text">{commandStatus}</p>
                </section>
              ) : (
                <section className="panel card">
                  <p className="eyebrow">Text-First Guidance</p>
                  <h2>Move through SafeBite with clear visual steps</h2>
                  <p className="meta-copy">Text mode keeps the same menu analysis, nearby places, and ordering tools with a quieter interface.</p>
                </section>
              )}
            </section>
          )}

          {activeTab === "scan" && (
            <section className="screen-stack">
              <section className="panel card">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Menu Accessibility</p>
                    <h2>Scan a menu and make it readable</h2>
                  </div>
                  {isVoiceMode && (
                    <div className="inline-actions">
                      <button className="button button-primary" type="button" onClick={() => speakText(menuText, setVoiceStatus)}>
                        Read menu aloud
                      </button>
                      <button className="button button-secondary" type="button" onClick={() => window.speechSynthesis.cancel()}>
                        Stop speaking
                      </button>
                    </div>
                  )}
                </div>

                <div className="scan-grid">
                  <label className="upload-tile" htmlFor="menu-image-input">
                    <input id="menu-image-input" type="file" accept="image/*" onChange={handleImageUpload} />
                    <strong>Upload a menu image</strong>
                    <span>Add a photo from your phone to preview it here.</span>
                  </label>

                  <div className="preview-tile">
                    {menuPreview ? <img src={menuPreview} alt="Uploaded menu preview" /> : <div className="placeholder-preview">Menu preview appears here</div>}
                  </div>
                </div>

                <div className="text-panel">
                  <div className="section-head compact-head">
                    <div>
                      <p className="eyebrow">Image Extraction Result</p>
                      <h3>Extracted menu text and analysis</h3>
                    </div>
                    <button className="button button-primary" type="button" onClick={() => setAnalysisStatus(`SafeBite analyzed ${menuItems.length} detected menu lines.`)}>
                      Analyze menu
                    </button>
                  </div>
                  <p className="status-text">{isAnalyzingImage ? "Sending the uploaded image to the server for Claude extraction now." : analysisStatus}</p>
                  <textarea value={menuText} rows={9} onChange={(event) => setMenuText(event.target.value)} />
                </div>

                {isVoiceMode && <p className="status-text accent-text">{voiceStatus}</p>}
              </section>

              <section className="panel card">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Dish Insights</p>
                    <h2>Ingredient and allergy guidance</h2>
                  </div>
                  <div className="inline-actions">
                    <button className="button button-secondary" type="button" onClick={() => setMenuText(DEMO_MENU)}>
                      Load demo analysis
                    </button>
                    {isVoiceMode && (
                      <button className="button button-ghost" type="button" onClick={() => speakText(analyzedItems.map((item) => `${item.name}. ${item.risk.label}. ${item.risk.detail}`).join(" "), setVoiceStatus)}>
                        Read analysis
                      </button>
                    )}
                  </div>
                </div>

                <div className="result-grid">
                  {analyzedItems.map((item) => (
                    <article key={item.name} className="result-card">
                      <div className="result-head">
                        <div>
                          <h3>{item.name}</h3>
                          <p className="meta-copy">{item.risk.detail}</p>
                        </div>
                        <span className={`pill ${item.risk.className}`}>{item.risk.label}</span>
                      </div>
                      <div className="tag-row">
                        {item.ingredients.map((ingredient) => (
                          <span key={ingredient} className="tag-chip">
                            {ingredient}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </section>
          )}

          {activeTab === "nearby" && (
            <section className="screen-stack">
              <section className="panel card">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Navigation & Recommendations</p>
                    <h2>Nearby restaurants and malls</h2>
                  </div>
                  <div className="inline-actions">
                    <button className="button button-primary" type="button" onClick={handleUseLocation}>
                      Use my location
                    </button>
                    {isVoiceMode && (
                      <button className="button button-secondary" type="button" onClick={() => speakText(places.map((place) => `${place.name}. ${place.type}. ${place.distance}. ${place.vibe}`).join(" "), setVoiceStatus)}>
                        Read nearby places
                      </button>
                    )}
                  </div>
                </div>

                <p className="status-text">{locationStatus}</p>
                <p className="status-text">{addressStatus}</p>

                <div className="places-grid">
                  {places.map((place) => (
                    <article key={place.name} className="place-card">
                      <div className="result-head">
                        <div>
                          <h3>{place.name}</h3>
                          <p className="meta-copy">{place.vibe}</p>
                        </div>
                        <span className="pill risk-safe">{place.distance}</span>
                      </div>
                      <div className="tag-row">
                        <span className="tag-chip">{place.type}</span>
                        <span className="tag-chip">Accessible route</span>
                      </div>
                      <div className="inline-actions full-width-actions">
                        <a className="button button-primary" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.mapsQuery)}`} target="_blank" rel="noreferrer">
                          Directions
                        </a>
                        <button className="button button-secondary" type="button" onClick={() => selectPlaceForReservation(place)}>
                          Reserve
                        </button>
                        <button
                          className="button button-ghost"
                          type="button"
                          onClick={() => selectPlaceForOrder(place)}
                        >
                          Select to order
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </section>
          )}

          {activeTab === "order" && (
            <section className="screen-stack">
              <section className="panel card">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Accessible Ordering</p>
                    <h2>{isVoiceMode ? "Order with voice or text" : "Order with text-first guidance"}</h2>
                  </div>
                  <div className="inline-actions">
                    {isVoiceMode && (
                      <button className="button button-primary" type="button" onClick={startOrderVoice}>
                        Start order voice
                      </button>
                    )}
                    <button className="button button-secondary" type="button" onClick={copyOrder}>
                      Copy order text
                    </button>
                  </div>
                </div>

                <p className="status-text">{orderStatus}</p>

                <div className="text-panel">
                  <div className="section-head compact-head">
                    <div>
                      <p className="eyebrow">Selected Restaurant</p>
                      <h3>{selectedPlace?.name || "No restaurant selected yet"}</h3>
                    </div>
                    <button className="button button-ghost" type="button" onClick={openOrderLink}>
                      Open order link
                    </button>
                  </div>
                  <textarea
                    rows={5}
                    value={orderText}
                    onChange={(event) => setOrderText(event.target.value)}
                    placeholder={
                      isVoiceMode
                        ? "Example: Hello, I would like one chicken burger with no peanuts and one orange juice."
                        : "Type the order you want to show, copy, or send to the restaurant staff."
                    }
                  />
                </div>
              </section>
            </section>
          )}

          {activeTab === "reservation" && (
            <section className="screen-stack">
              <section className="panel card emergency-hero">
                <div>
                  <p className="eyebrow">Booking Reservation</p>
                  <h2>Reservation Assistant</h2>
                  <p className="lead">
                    Choose a restaurant, fill in the booking details, add quick phrases, and let SafeBite prepare a clear reservation request you can read aloud, copy, or use when calling.
                  </p>
                </div>
                <div className="emergency-badge">Table Booking</div>
              </section>

              <section className="panel card">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Top Used Places</p>
                    <h2>Start with places you use most</h2>
                  </div>
                </div>

                <div className="action-grid reservation-place-grid">
                  {topUsedPlaces.map((place) => (
                    <button
                      key={place.name}
                      className={`action-tile ${reservationProfile.selectedPlaceName === place.name ? "selected-card" : ""}`}
                      type="button"
                      onClick={() => selectPlaceForReservation(place)}
                    >
                      <strong>{place.name}</strong>
                      <span>{place.type}</span>
                      <span>{place.distance}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="panel card">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Reservation Details</p>
                    <h2>Set the booking request</h2>
                  </div>
                </div>

                <div className="emergency-form-grid">
                  <label className="field-block emergency-field-wide">
                    <span>Restaurant</span>
                    <select value={reservationProfile.selectedPlaceName} onChange={(event) => updateReservationProfile("selectedPlaceName", event.target.value)}>
                      <option value="">Choose a restaurant</option>
                      {availableReservationPlaces.map((place) => (
                        <option key={place.name} value={place.name}>
                          {place.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-block">
                    <span>Guests</span>
                    <input type="number" min="1" max="12" value={reservationProfile.guestCount} onChange={(event) => updateReservationProfile("guestCount", event.target.value)} />
                  </label>
                  <label className="field-block">
                    <span>Date</span>
                    <input type="date" value={reservationProfile.reservationDate} onChange={(event) => updateReservationProfile("reservationDate", event.target.value)} />
                  </label>
                  <label className="field-block">
                    <span>Time</span>
                    <input type="time" value={reservationProfile.reservationTime} onChange={(event) => updateReservationProfile("reservationTime", event.target.value)} />
                  </label>
                  <label className="field-block emergency-field-wide">
                    <span>Extra Request</span>
                    <input
                      type="text"
                      value={reservationProfile.customRequest}
                      onChange={(event) => updateReservationProfile("customRequest", event.target.value)}
                      placeholder="Add any extra note you want the host to hear"
                    />
                  </label>
                </div>

                <div className="tag-row emergency-phrase-row">
                  {RESERVATION_QUICK_PHRASES.map((phrase) => (
                    <button
                      key={phrase}
                      className={`tag-chip emergency-phrase-chip ${reservationProfile.selectedPhrases.includes(phrase) ? "selected-chip" : ""}`}
                      type="button"
                      onClick={() => toggleReservationPhrase(phrase)}
                    >
                      {phrase}
                    </button>
                  ))}
                </div>

                <div className="text-panel">
                  <div className="section-head compact-head">
                    <div>
                      <p className="eyebrow">Reservation Preview</p>
                      <h3>{selectedReservationPlace?.name || "No restaurant selected yet"}</h3>
                    </div>
                    <div className="inline-actions">
                      <button
                        className={`button ${recordingTarget === "reservation" ? "button-danger" : "button-secondary"} compact`}
                        type="button"
                        onClick={() => startScriptRecording("reservation")}
                      >
                        {recordingTarget === "reservation" ? "Stop Recording" : "Record Request"}
                      </button>
                      <button className="button button-secondary compact" type="button" onClick={copyReservationRequest}>
                        Copy Request
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={7}
                    value={reservationProfile.scriptText}
                    onChange={(event) => updateReservationProfile("scriptText", event.target.value)}
                    placeholder="The generated reservation request appears here"
                  />
                  <p className="status-text">Recorder: {recordingTarget === "reservation" ? "Listening now." : recordingStatus}</p>
                  <p className="status-text">Preview request: {reservationScriptPreview}</p>
                  <p className="status-text">
                    {selectedReservationPlace
                      ? `${selectedReservationPlace.type}. ${selectedReservationPlace.distance}. ${selectedReservationPlace.vibe}`
                      : "Choose a place to see its reservation context here."}
                  </p>
                </div>

                <div className="action-grid emergency-action-grid">
                  <button className="action-tile emergency-action" type="button" onClick={previewReservationRequest}>
                    <strong>Preview Request</strong>
                    <span>Reads the reservation request aloud before you contact the restaurant.</span>
                  </button>
                  <button className="action-tile emergency-action" type="button" onClick={openReservationLink} disabled={!selectedReservationPlace}>
                    <strong>Open Booking Link</strong>
                    <span>Opens the restaurant site or a reservation search in a new tab.</span>
                  </button>
                  <button className="action-tile emergency-action" type="button" onClick={callReservationPlace} disabled={!selectedReservationPlace}>
                    <strong>Call Restaurant</strong>
                    <span>Opens the dialer if a phone number is available in the listing.</span>
                  </button>
                  <button className="action-tile emergency-action" type="button" onClick={() => setActiveTab("nearby")}>
                    <strong>Browse Nearby</strong>
                    <span>Return to nearby places and choose a different restaurant.</span>
                  </button>
                  <button
                    className="action-tile emergency-action"
                    type="button"
                    onClick={() => {
                      if (!selectedReservationPlace) {
                        return;
                      }

                      setSelectedPlace(selectedReservationPlace);
                      setActiveTab("order");
                      setOrderStatus(`Selected ${selectedReservationPlace.name}. You can now ${isVoiceMode ? "speak or type" : "type"} your order.`);
                    }}
                    disabled={!selectedReservationPlace}
                  >
                    <strong>Switch to Order</strong>
                    <span>Move to the order screen for the same restaurant after booking.</span>
                  </button>
                  <button className="action-tile emergency-action" type="button" onClick={() => setActiveTab("profile")}>
                    <strong>Back to Profile</strong>
                    <span>Return to your accessibility and allergy settings.</span>
                  </button>
                </div>

                <p className="status-text emergency-status">{isReservationReady ? reservationStatus : "Choose a place, date, and time to make the reservation request ready."}</p>
              </section>
            </section>
          )}

          {activeTab === "emergency" && (
            <section className="screen-stack">
              <section className="panel card emergency-hero">
                <div>
                  <p className="eyebrow">Contact Emergency</p>
                  <h2>Emergency Relay</h2>
                  <p className="lead">
                    Choose the relay category, add the location, select the exact phrases you want, then let SafeBite open the dialer and repeat the relay message on speaker.
                  </p>
                </div>
                <div className="emergency-badge">Relay Call</div>
              </section>

              <section className="panel card">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Emergency Category</p>
                    <h2>Choose the relay target first</h2>
                  </div>
                </div>

                <div className="action-grid emergency-preset-grid">
                  {Object.entries(EMERGENCY_CONFIG).map(([categoryKey, config]) => (
                    <button
                      key={categoryKey}
                      className={`action-tile emergency-action ${emergencyProfile.selectedCategory === categoryKey ? "selected-card" : ""}`}
                      type="button"
                      onClick={() => selectEmergencyCategory(categoryKey)}
                    >
                      <strong>{config.label}</strong>
                      <span>{categoryKey === "test" ? "Uses your safe test number" : `Dials ${config.number}`}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="panel card">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Relay Script</p>
                    <h2>Location, phrases, and playback</h2>
                  </div>
                </div>

                <div className="emergency-form-grid">
                  {emergencyProfile.selectedCategory === "test" ? (
                    <label className="field-block">
                      <span>Safe Test Number</span>
                      <input
                        type="tel"
                        value={emergencyProfile.testNumber}
                        onChange={(event) => updateEmergencyProfile("testNumber", event.target.value)}
                        placeholder="Enter a safe test number"
                      />
                    </label>
                  ) : null}
                  <label className="field-block">
                    <span>Selected Number</span>
                    <input type="text" value={emergencyDialTarget} readOnly />
                  </label>
                  <label className="field-block emergency-field-wide">
                    <span>Emergency Location</span>
                    <input
                      type="text"
                      value={emergencyProfile.locationText}
                      onChange={(event) => {
                        updateEmergencyProfile("locationText", event.target.value);
                        setEmergencyLocationStatus(event.target.value.trim() ? "Location ready." : "Location not detected yet.");
                      }}
                      placeholder="Type the location manually or detect it now"
                    />
                  </label>
                </div>

                <div className="tag-row emergency-phrase-row">
                  {selectedEmergencyConfig.phrases.map((phrase) => (
                    <button
                      key={phrase}
                      className={`tag-chip emergency-phrase-chip ${emergencyProfile.selectedPhrases.includes(phrase) ? "selected-chip" : ""}`}
                      type="button"
                      onClick={() => toggleEmergencyPhrase(phrase)}
                    >
                      {phrase}
                    </button>
                  ))}
                </div>

                <div className="text-panel">
                  <div className="section-head compact-head">
                    <div>
                      <p className="eyebrow">Relay Preview</p>
                      <h3>SafeBite waits 7 seconds, then repeats this 7 times</h3>
                    </div>
                    <div className="inline-actions">
                      <button
                        className={`button ${recordingTarget === "emergency" ? "button-danger" : "button-secondary"} compact`}
                        type="button"
                        onClick={() => startScriptRecording("emergency")}
                      >
                        {recordingTarget === "emergency" ? "Stop Recording" : "Record Relay"}
                      </button>
                      <button className="button button-secondary compact" type="button" onClick={detectEmergencyScriptLocation}>
                        Detect Location
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={7}
                    value={emergencyProfile.scriptText}
                    onChange={(event) => updateEmergencyProfile("scriptText", event.target.value)}
                    placeholder="The generated relay message appears here"
                  />
                  <p className="status-text">Recorder: {recordingTarget === "emergency" ? "Listening now." : recordingStatus}</p>
                  <p className="status-text">Preview script: {emergencyScriptPreview}</p>
                  <p className="status-text">Location status: {emergencyLocationStatus}</p>
                  <p className="status-text">{emergencyTargetNote}</p>
                </div>

                <div className="action-grid emergency-action-grid">
                  <button className="action-tile emergency-action" type="button" onClick={previewEmergencyScript}>
                    <strong>Preview Relay</strong>
                    <span>Reads the emergency relay script before you place the call.</span>
                  </button>
                  <button className="action-tile emergency-action danger-action" type="button" onClick={startEmergencyFlow} disabled={!isEmergencyReadyToCall}>
                    <strong>Start Relay Call</strong>
                    <span>Opens the dialer, waits 7 seconds, and repeats the relay script on speaker.</span>
                  </button>
                  <button className="action-tile emergency-action" type="button" onClick={() => stopEmergencyFlow(false)}>
                    <strong>Stop Relay Audio</strong>
                    <span>Stops all delayed and repeating speaker playback.</span>
                  </button>
                  <button className="action-tile emergency-action" type="button" onClick={detectEmergencyScriptLocation}>
                    <strong>Detect Location Now</strong>
                    <span>Requests GPS permission and fills the location field with a readable address.</span>
                  </button>
                  <button
                    className="action-tile emergency-action"
                    type="button"
                    disabled={!isEmergencyReadyToCall}
                    onClick={() => {
                      window.location.href = `tel:${emergencyDialTarget}`;
                    }}
                  >
                    <strong>Open Dialer Only</strong>
                    <span>Opens the phone dialer manually without starting the delayed speaker playback.</span>
                  </button>
                  <button className="action-tile emergency-action" type="button" onClick={() => setActiveTab("profile")}>
                    <strong>Back to Profile</strong>
                    <span>Return to your accessibility and allergy preferences.</span>
                  </button>
                </div>

                <p className="status-text emergency-status">{emergencyCallStatus}</p>
              </section>
            </section>
          )}

          {activeTab === "profile" && (
            <section className="screen-stack">
              <section className="panel card">
                <p className="eyebrow">Accessibility Profile</p>
                <h2>Choose how SafeBite should behave</h2>
                <div className="choice-grid profile-grid">
                  {[
                    ["voice", "Voice Experience", "Assistant visible", "SafeBite speaks guidance, exposes listening controls, and supports spoken ordering."],
                    ["text", "Text Experience", "Text-first interface", "SafeBite keeps the same workflow with a quieter interface and no visible assistant."],
                  ].map(([mode, eyebrow, title, copy]) => (
                    <button
                      key={mode}
                      className={`choice-card ${preference === mode ? "selected-card" : ""}`}
                      type="button"
                      onClick={() => handlePreferenceChange(mode)}
                    >
                      <span className="eyebrow">{eyebrow}</span>
                      <strong>{title}</strong>
                      <span>{copy}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="panel card">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Personalized Safety</p>
                    <h2>Your allergy profile</h2>
                  </div>
                </div>
                <div className="allergy-grid">
                  {ALLERGIES.map((allergy) => (
                    <button
                      key={allergy}
                      className={`allergy-chip ${allergies.includes(allergy) ? "selected-chip" : ""}`}
                      type="button"
                      onClick={() => toggleAllergy(allergy)}
                    >
                      {allergy}
                    </button>
                  ))}
                </div>
              </section>

              <section className="panel card">
                <p className="eyebrow">Support</p>
                <h2>Emergency and account actions</h2>
                <div className="inline-actions full-width-actions">
                  <button className="button button-danger" type="button" onClick={() => setActiveTab("emergency")}>
                    Contact Emergency
                  </button>
                  <button className="button button-secondary" type="button" onClick={() => setShowSettings(true)}>
                    Open Settings
                  </button>
                </div>
              </section>
            </section>
          )}
        </main>

        <nav className="bottom-nav panel" aria-label="Primary">
          {[
            ["home", "Home"],
            ["scan", "Scan"],
            ["nearby", "Nearby"],
            ["order", "Order"],
            ["reservation", "Reserve"],
            ["emergency", "Emergency"],
            ["profile", "Profile"],
          ].map(([tabId, label]) => (
            <button
              key={tabId}
              className={`nav-button ${activeTab === tabId ? "nav-active" : ""}`}
              type="button"
              onClick={() => setActiveTab(tabId)}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {showSettings && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowSettings(false)}>
          <div className="modal-card panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <p className="eyebrow">Settings</p>
            <h2>Change how SafeBite behaves</h2>
            <p className="meta-copy">
              Voice mode keeps the assistant visible. Text mode keeps the same workflow with a quieter interface.
            </p>
            <div className="choice-grid">
              {[
                ["voice", "Voice Experience", "Assistant visible", "Read-aloud controls, spoken guidance, and voice ordering stay on."],
                ["text", "Text Experience", "Assistant removed", "Text-first prompts stay visible and voice controls are hidden."],
              ].map(([mode, eyebrow, title, copy]) => (
                <button
                  key={mode}
                  className={`choice-card ${preference === mode ? "selected-card" : ""}`}
                  type="button"
                  onClick={() => handlePreferenceChange(mode)}
                >
                  <span className="eyebrow">{eyebrow}</span>
                  <strong>{title}</strong>
                  <span>{copy}</span>
                </button>
              ))}
            </div>
            <div className="inline-actions full-width-actions top-gap">
              <button className="button button-secondary" type="button" onClick={signOut}>
                Sign out
              </button>
              <button className="button button-ghost" type="button" onClick={() => setShowSettings(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}