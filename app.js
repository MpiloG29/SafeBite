const allergyCatalog = [
  "Peanuts",
  "Dairy",
  "Gluten",
  "Shellfish",
  "Soy",
  "Eggs",
  "Sesame",
  "Tree Nuts",
];

const seedPlaces = [
  {
    name: "The Grove Eatery",
    type: "Restaurant",
    distance: "0.4 km",
    vibe: "Quiet seating",
    mapsQuery: "The Grove Eatery Sandton",
  },
  {
    name: "Mint Market Hall",
    type: "Mall",
    distance: "0.8 km",
    vibe: "Indoor food court",
    mapsQuery: "Mint Market Hall Johannesburg",
  },
  {
    name: "Coral Table",
    type: "Restaurant",
    distance: "1.2 km",
    vibe: "Allergy-friendly menu",
    mapsQuery: "Coral Table Johannesburg",
  },
  {
    name: "Blue Lantern Centre",
    type: "Mall",
    distance: "1.6 km",
    vibe: "Accessible entrances",
    mapsQuery: "Blue Lantern Centre Johannesburg",
  },
];

const ingredientMatchers = {
  Peanuts: ["peanut", "satay"],
  Dairy: ["cream", "cheese", "parmesan", "milk", "butter"],
  Gluten: ["pasta", "wrap", "bread", "wheat", "noodles"],
  Shellfish: ["shrimp", "prawn", "crab", "lobster"],
  Soy: ["soy", "tofu", "miso"],
  Eggs: ["egg", "mayo", "aioli"],
  Sesame: ["sesame", "tahini"],
  "Tree Nuts": ["almond", "cashew", "walnut", "pecan"],
};

const elements = {
  allergyOptions: document.querySelector("#allergy-options"),
  allergySummary: document.querySelector("#allergy-summary"),
  menuText: document.querySelector("#menu-text"),
  menuResults: document.querySelector("#menu-results"),
  menuPreview: document.querySelector("#menu-preview"),
  placesList: document.querySelector("#places-list"),
  locationStatus: document.querySelector("#location-status"),
  addressStatus: document.querySelector("#address-status"),
  emergencyDialog: document.querySelector("#emergency-dialog"),
  voiceStatus: document.querySelector("#voice-status"),
  commandStatus: document.querySelector("#command-status"),
  startListeningBtn: document.querySelector("#start-listening-btn"),
  analysisStatus: document.querySelector("#analysis-status"),
  orderStatus: document.querySelector("#order-status"),
  selectedPlaceName: document.querySelector("#selected-place-name"),
  orderText: document.querySelector("#order-text"),
};

const selectedAllergies = new Set();
const demoMenuText = `Spicy Prawn Tacos - Prawns, slaw, lime crema, flour tortillas
Peanut Crunch Salad - Lettuce, carrot, peanut dressing, sesame seeds
Roasted Veg Bowl - Quinoa, avocado, chickpeas, mint yogurt
Blueberry Oat Pancakes - Oats, egg, milk, blueberry compote`;
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;
let recognition = null;
let isListening = false;
let uploadedImageFile = null;
let activeCoordinates = null;
let availableVoices = [];
let voiceReady = false;
let nearbyPlaces = [...seedPlaces];
let selectedPlace = null;
let orderRecognition = null;

function updateVoiceStatus(message) {
  elements.voiceStatus.textContent = message;
}

function updateCommandStatus(message) {
  elements.commandStatus.textContent = message;
}

function updateAnalysisStatus(message) {
  elements.analysisStatus.textContent = message;
}

function updateOrderStatus(message) {
  elements.orderStatus.textContent = message;
}

function loadVoices() {
  if (!("speechSynthesis" in window)) {
    return [];
  }

  availableVoices = window.speechSynthesis.getVoices();
  if (availableVoices.length) {
    voiceReady = true;
  }
  return availableVoices;
}

function pickBestVoice() {
  if (!availableVoices.length) {
    loadVoices();
  }

  return (
    availableVoices.find((voice) => /en-ZA/i.test(voice.lang)) ||
    availableVoices.find((voice) => /en-GB|en-US/i.test(voice.lang)) ||
    availableVoices[0] ||
    null
  );
}

function unlockSpeech() {
  if (!("speechSynthesis" in window)) {
    updateVoiceStatus("Speech is not supported in this browser.");
    return false;
  }

  loadVoices();
  window.speechSynthesis.cancel();

  const warmup = new SpeechSynthesisUtterance(" ");
  const voice = pickBestVoice();
  if (voice) {
    warmup.voice = voice;
  }
  warmup.volume = 0;
  window.speechSynthesis.speak(warmup);
  window.speechSynthesis.cancel();

  voiceReady = true;
  updateVoiceStatus("Voice output enabled. You can now test or read the menu aloud.");
  return true;
}

function speakText(text, statusMessage) {
  if (!("speechSynthesis" in window)) {
    updateVoiceStatus("Speech is not supported in this browser.");
    alert("Speech synthesis is not supported in this browser.");
    return false;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    updateVoiceStatus("There is nothing to read yet.");
    return false;
  }

  loadVoices();
  const utterance = new SpeechSynthesisUtterance(trimmed);
  const voice = pickBestVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = "en-US";
  }
  utterance.rate = 0.95;
  utterance.volume = 1;
  utterance.onstart = () => {
    updateVoiceStatus(statusMessage);
  };
  utterance.onend = () => {
    updateVoiceStatus("Finished speaking. You can play another section anytime.");
  };
  utterance.onerror = () => {
    updateVoiceStatus(
      "Speech could not start. Tap Enable voice first, then try Test voice."
    );
  };

  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  window.speechSynthesis.speak(utterance);
  return true;
}

function scrollToSection(sectionId, label) {
  const target = document.getElementById(sectionId);
  if (!target) {
    return;
  }
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  updateVoiceStatus(`Moved to ${label}.`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

async function fetchExactAddress(coords) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
    coords.latitude
  )}&lon=${encodeURIComponent(coords.longitude)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("address lookup failed");
  }
  const data = await response.json();
  return data.display_name || "Exact address not available";
}

async function fetchNearbyPlaces(coords) {
  const radius = 1200;
  const query = `
    [out:json][timeout:20];
    (
      node["amenity"~"restaurant|cafe|fast_food|food_court"](around:${radius},${coords.latitude},${coords.longitude});
      way["amenity"~"restaurant|cafe|fast_food|food_court"](around:${radius},${coords.latitude},${coords.longitude});
      node["shop"="mall"](around:${radius},${coords.latitude},${coords.longitude});
      way["shop"="mall"](around:${radius},${coords.latitude},${coords.longitude});
    );
    out center tags 20;
  `;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
    },
    body: query,
  });

  if (!response.ok) {
    throw new Error("nearby lookup failed");
  }

  const data = await response.json();
  const places = (data.elements || [])
    .map((element) => {
      const lat = element.lat || element.center?.lat;
      const lon = element.lon || element.center?.lon;
      if (!lat || !lon) {
        return null;
      }

      const type =
        element.tags?.shop === "mall"
          ? "Mall"
          : element.tags?.amenity === "food_court"
            ? "Food Court"
            : "Restaurant";

      return {
        name: element.tags?.name || "Nearby place",
        type,
        distance: `${calculateDistanceKm(
          coords.latitude,
          coords.longitude,
          lat,
          lon
        ).toFixed(2)} km`,
        vibe:
          element.tags?.cuisine ||
          element.tags?.description ||
          element.tags?.amenity ||
          "Nearby accessible place",
        mapsQuery: `${lat},${lon}`,
        website: element.tags?.website || "",
        phone: element.tags?.phone || "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance))
    .slice(0, 8);

  return places.length ? places : [...seedPlaces];
}

function renderAllergyOptions() {
  elements.allergyOptions.innerHTML = "";

  allergyCatalog.forEach((allergy) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "allergy-pill";
    button.textContent = allergy;

    button.addEventListener("click", () => {
      if (selectedAllergies.has(allergy)) {
        selectedAllergies.delete(allergy);
        button.classList.remove("active");
      } else {
        selectedAllergies.add(allergy);
        button.classList.add("active");
      }

      updateAllergySummary();
      analyzeMenu();
    });

    elements.allergyOptions.appendChild(button);
  });
}

function updateAllergySummary() {
  if (!selectedAllergies.size) {
    elements.allergySummary.textContent =
      "No allergies selected yet. Add your profile for safer menu checks.";
    return;
  }

  elements.allergySummary.textContent = `Watching for: ${Array.from(
    selectedAllergies
  ).join(", ")}. SafeBite will flag menu items with direct or likely matches.`;
}

function parseMenuText(rawText) {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line) => {
      const normalized = line.replace(/\s+/g, " ").trim();
      const priceMatch = normalized.match(/(?:R|\$|€|£)\s?\d+(?:[.,]\d{2})?|\b\d{1,3}(?:[.,]\d{2})\b/);
      const withoutPrice = priceMatch
        ? normalized.replace(priceMatch[0], "").replace(/\s{2,}/g, " ").trim()
        : normalized;
      const splitMatch = withoutPrice.split(/\s+-\s+|:\s+/);
      const namePart = splitMatch[0] || withoutPrice;
      const detailsPart = splitMatch.slice(1).join(", ");
      const ingredients = detailsPart
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      return {
        name: namePart.trim(),
        ingredients,
        rawLine: normalized,
        price: priceMatch ? priceMatch[0] : "",
      };
    })
    .filter((item) => item.name);
}

function looksLikeMenu(rawText) {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 2);

  if (lines.length < 3) {
    return {
      isMenu: false,
      reason: "I could not find enough readable lines to confirm this is a menu.",
    };
  }

  const priceLines = lines.filter((line) =>
    /(?:R|\$|€|£)\s?\d+(?:[.,]\d{2})?|\b\d{1,3}(?:[.,]\d{2})\b/.test(line)
  ).length;
  const foodStructureLines = lines.filter((line) =>
    /-|:|,/.test(line) || line.split(" ").length <= 8
  ).length;
  const headingLines = lines.filter((line) =>
    /breakfast|lunch|dinner|starter|main|dessert|beverage|special|combo|menu/i.test(
      line
    )
  ).length;

  const score = priceLines * 2 + foodStructureLines + headingLines * 2;

  if (score >= 6) {
    return {
      isMenu: true,
      reason: "The uploaded image looks like a menu based on repeated dish-style lines and menu-like structure.",
    };
  }

  return {
    isMenu: false,
    reason:
      "The uploaded image does not look enough like a menu yet. Try a clearer food menu photo with visible dish lines or prices.",
  };
}

async function runImageOcr() {
  if (!uploadedImageFile) {
    return {
      ok: false,
      text: elements.menuText.value.trim(),
      reason: "No image was uploaded, so SafeBite used the current text box instead.",
    };
  }

  if (!window.Tesseract) {
    return {
      ok: false,
      text: elements.menuText.value.trim(),
      reason: "OCR library did not load, so SafeBite could not read the uploaded image.",
    };
  }

  updateAnalysisStatus(`Reading text from ${uploadedImageFile.name}. This may take a few seconds.`);
  updateVoiceStatus("Reading text from the uploaded image.");

  const result = await window.Tesseract.recognize(uploadedImageFile, "eng");
  const text = result.data.text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  return {
    ok: true,
    text,
    reason: `Text extracted from ${uploadedImageFile.name}.`,
  };
}

function detectRisks(item) {
  const hits = [];
  const itemText = `${item.name} ${item.ingredients.join(" ")}`.toLowerCase();

  selectedAllergies.forEach((allergy) => {
    const matchers = ingredientMatchers[allergy] || [];
    if (matchers.some((matcher) => itemText.includes(matcher))) {
      hits.push(allergy);
    }
  });

  if (hits.length) {
    return {
      label: "Avoid",
      className: "risk-danger",
      detail: `Potential trigger: ${hits.join(", ")}`,
    };
  }

  const possibleUnknown = item.ingredients.length < 2;
  if (possibleUnknown) {
    return {
      label: "Ask Staff",
      className: "risk-warn",
      detail: "Ingredients are incomplete. Confirm before ordering.",
    };
  }

  return {
    label: "Looks Safer",
    className: "risk-safe",
    detail: "No selected allergy matches found in the visible ingredients.",
  };
}

function renderMenuResults(menuItems) {
  elements.menuResults.innerHTML = menuItems
    .map((item) => {
      const risk = detectRisks(item);
      const ingredients = item.ingredients.length
        ? item.ingredients
            .map((ingredient) => `<span class="tag">${escapeHtml(ingredient)}</span>`)
            .join("")
        : '<span class="tag">Ingredients not listed</span>';
      const description = item.ingredients.length
        ? risk.detail
        : "SafeBite could read the dish name, but the ingredient detail is limited.";

      return `
        <article class="result-card">
          <div class="result-top">
            <div>
              <h3>${escapeHtml(item.name)}</h3>
              <p class="result-copy">${escapeHtml(description)}</p>
            </div>
            <span class="risk-pill ${risk.className}">${escapeHtml(risk.label)}</span>
          </div>
          <div class="ingredients">${ingredients}</div>
          ${item.price ? `<p class="result-copy">Price detected: ${escapeHtml(item.price)}</p>` : ""}
        </article>
      `;
    })
    .join("");
}

function renderNotMenuState(reason) {
  elements.menuResults.innerHTML = `
    <article class="result-card">
      <div class="result-top">
        <div>
          <h3>Image does not look like a food menu</h3>
          <p class="result-copy">${escapeHtml(reason)}</p>
        </div>
        <span class="risk-pill risk-warn">Not a menu</span>
      </div>
    </article>
  `;
}

async function analyzeMenu() {
  updateAnalysisStatus("Starting menu analysis.");

  let sourceText = elements.menuText.value.trim();

  if (uploadedImageFile) {
    try {
      const ocrResult = await runImageOcr();
      if (ocrResult.text) {
        sourceText = ocrResult.text;
        elements.menuText.value = ocrResult.text;
      }
      updateAnalysisStatus(ocrResult.reason);
    } catch (error) {
      updateAnalysisStatus(
        "Image reading failed, so SafeBite kept the current text box content."
      );
    }
  }

  const menuItems = parseMenuText(sourceText);
  const menuCheck = looksLikeMenu(sourceText);

  if (!menuItems.length) {
    elements.menuResults.innerHTML =
      '<div class="result-card"><p class="result-copy">Add or paste menu text to begin the analysis.</p></div>';
    updateVoiceStatus("Menu analysis is empty because no menu text was found.");
    updateAnalysisStatus("No readable text was found to analyze.");
    return;
  }

  if (!menuCheck.isMenu) {
    renderNotMenuState(menuCheck.reason);
    updateVoiceStatus(menuCheck.reason);
    updateAnalysisStatus(menuCheck.reason);
    return;
  }

  renderMenuResults(menuItems);

  updateVoiceStatus(
    `Analyzed ${menuItems.length} menu items. You can now read the results aloud.`
  );
  updateAnalysisStatus(
    `${menuCheck.reason} SafeBite analyzed ${menuItems.length} detected menu lines.`
  );
}

function speakMenu() {
  const text = elements.menuText.value.trim();
  speakText(
    `SafeBite menu summary. ${text.replaceAll("\n", ". ")}`,
    "Reading the menu aloud now."
  );
}

function stopSpeaking() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    window.speechSynthesis.pause();
  }
  updateVoiceStatus("Speech stopped.");
  updateCommandStatus("Speech stopped.");
}

function testVoice() {
  if (!voiceReady) {
    unlockSpeech();
  }

  speakText(
    "Voice test successful. SafeBite is ready to read menus and guidance aloud.",
    "Running a voice test now."
  );
}

function readAnalysis() {
  const menuItems = parseMenuText(elements.menuText.value);
  if (!menuItems.length) {
    updateVoiceStatus("There are no analyzed dishes to read.");
    return;
  }

  const summary = menuItems
    .map((item) => {
      const risk = detectRisks(item);
      return `${item.name}. ${risk.label}. ${risk.detail}.`;
    })
    .join(" ");

  speakText(summary, "Reading dish analysis and allergy guidance.");
}

function readNearbyPlaces() {
  const locationLead = activeCoordinates
    ? `Your exact location is latitude ${activeCoordinates.latitude} and longitude ${activeCoordinates.longitude}. `
    : "";
  const summary = nearbyPlaces
    .map(
      (place) =>
        `${place.name}. ${place.type}. ${place.distance} away. ${place.vibe}.`
    )
    .join(" ");

  speakText(
    `${locationLead}${summary}`,
    "Reading nearby restaurants and malls."
  );
}

function selectPlaceForOrder(placeName) {
  const place = nearbyPlaces.find((entry) => entry.name === placeName);
  if (!place) {
    return;
  }

  selectedPlace = place;
  elements.selectedPlaceName.textContent = place.name;
  updateOrderStatus(
    `Selected ${place.name}. You can now speak your order, type it, copy it, or open an order link.`
  );
  updateVoiceStatus(`${place.name} selected for ordering.`);
}

function copyOrderText() {
  const text = elements.orderText.value.trim();
  if (!text) {
    updateOrderStatus("There is no order text to copy yet.");
    return;
  }

  navigator.clipboard
    .writeText(text)
    .then(() => {
      updateOrderStatus(
        "Order text copied. You can paste it into WhatsApp, email, chat, or a delivery app."
      );
    })
    .catch(() => {
      updateOrderStatus("Copy failed in this browser. Please copy the order text manually.");
    });
}

function openOrderLink() {
  if (!selectedPlace) {
    updateOrderStatus("Select a nearby restaurant first.");
    return;
  }

  const url =
    selectedPlace.website ||
    `https://www.google.com/search?q=${encodeURIComponent(
      `${selectedPlace.name} online order`
    )}`;
  window.open(url, "_blank", "noopener,noreferrer");
  updateOrderStatus(`Opening ordering options for ${selectedPlace.name}.`);
}

function startOrderVoice() {
  if (!SpeechRecognition) {
    updateOrderStatus("Voice ordering is not supported in this browser.");
    return;
  }

  if (!selectedPlace) {
    updateOrderStatus("Select a nearby restaurant before starting voice order.");
    return;
  }

  if (!orderRecognition) {
    orderRecognition = new SpeechRecognition();
    orderRecognition.lang = "en-US";
    orderRecognition.interimResults = true;
    orderRecognition.maxAlternatives = 1;

    orderRecognition.onstart = () => {
      updateOrderStatus(`Listening for your order to ${selectedPlace?.name || "the selected restaurant"}.`);
      updateVoiceStatus("Listening for your order.");
    };

    orderRecognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ");
      elements.orderText.value = transcript.trim();
      updateOrderStatus("Order captured. You can edit it, copy it, or open an order link.");
    };

    orderRecognition.onerror = () => {
      updateOrderStatus("Voice order capture failed. Try again or type the order.");
    };
  }

  orderRecognition.start();
}

function loadDemoAnalysis() {
  elements.menuText.value = demoMenuText;
  analyzeMenu();
  updateVoiceStatus("Demo menu loaded. Analysis has been refreshed.");
}

function readVoiceHelp() {
  const helpText =
    "Voice help. You can say read menu, analyze menu, read analysis, read nearby places, use my location, load demo, open scanner, open nearby, emergency help, or stop.";
  updateCommandStatus("Reading voice command help.");
  speakText(helpText, "Reading voice command help.");
}

function announceEmergencyAction(message) {
  updateVoiceStatus(message);
  speakText(message, message);
}

function toggleAllergyByName(allergyName) {
  const button = Array.from(document.querySelectorAll(".allergy-pill")).find(
    (entry) => entry.textContent.toLowerCase() === allergyName.toLowerCase()
  );

  if (!button) {
    return false;
  }

  button.click();
  return true;
}

function executeVoiceCommand(command) {
  const normalized = command.toLowerCase().trim();
  updateCommandStatus(`Heard: ${normalized}`);

  if (!normalized) {
    return;
  }

  if (normalized.includes("read menu")) {
    speakMenu();
    return;
  }

  if (normalized.includes("analyze")) {
    analyzeMenu();
    speakText("Menu analyzed.", "Confirming menu analysis.");
    return;
  }

  if (normalized.includes("read analysis")) {
    readAnalysis();
    return;
  }

  if (normalized.includes("read nearby")) {
    readNearbyPlaces();
    return;
  }

  if (normalized.includes("use my location") || normalized.includes("location")) {
    useLocation();
    return;
  }

  if (normalized.includes("load demo")) {
    loadDemoAnalysis();
    speakText("Demo menu loaded.", "Confirming demo menu load.");
    return;
  }

  if (normalized.includes("open scanner")) {
    scrollToSection("scanner", "the scanner section");
    return;
  }

  if (normalized.includes("open nearby")) {
    scrollToSection("nearby", "the nearby section");
    return;
  }

  if (normalized.includes("emergency")) {
    elements.emergencyDialog.showModal();
    announceEmergencyAction(
      "Emergency support opened. You can call emergency services or text a trusted contact."
    );
    return;
  }

  if (normalized.includes("stop")) {
    stopSpeaking();
    if (recognition) {
      recognition.stop();
    }
    return;
  }

  const allergyMatch = allergyCatalog.find((allergy) =>
    normalized.includes(allergy.toLowerCase())
  );
  if (allergyMatch && normalized.includes("allergy")) {
    const changed = toggleAllergyByName(allergyMatch);
    if (changed) {
      speakText(`${allergyMatch} allergy updated.`, `Updated ${allergyMatch} allergy.`);
      return;
    }
  }

  speakText(
    "Sorry, I did not recognize that command. Try saying read menu, analyze menu, or read nearby places.",
    "Command not recognized."
  );
}

function setupVoiceCommands() {
  loadVoices();
  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      loadVoices();
    };
  }

  if (!SpeechRecognition) {
    updateCommandStatus(
      "Voice commands are not supported in this browser. Speech output still works."
    );
    elements.startListeningBtn.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true;
    elements.startListeningBtn.textContent = "Listening now";
    elements.startListeningBtn.classList.add("listening");
    updateCommandStatus("Listening for a command.");
    updateVoiceStatus("Listening for your voice command.");
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    executeVoiceCommand(transcript);
  };

  recognition.onerror = () => {
    updateCommandStatus("Voice recognition had a problem. Try again.");
    updateVoiceStatus("Voice recognition had a problem. Try again.");
  };

  recognition.onend = () => {
    isListening = false;
    elements.startListeningBtn.textContent = "Start listening";
    elements.startListeningBtn.classList.remove("listening");
    updateCommandStatus("Voice listener stopped. Tap Start listening to try again.");
  };
}

function renderPlaces() {
  elements.placesList.innerHTML = nearbyPlaces
    .map(
      (place) => `
        <article class="place-card">
          <div class="place-top">
            <div>
              <h3>${place.name}</h3>
              <p class="place-copy">${place.vibe}</p>
            </div>
            <span class="risk-pill risk-safe">${place.distance}</span>
          </div>
          <div class="place-meta">
            <span class="tag">${place.type}</span>
            <span class="tag">Accessible route</span>
          </div>
          <div class="place-actions">
            <a class="primary-btn" target="_blank" rel="noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              place.mapsQuery
            )}">Directions</a>
            <button class="secondary-btn announce-place-btn" type="button" data-place="${place.name}">
              Read details
            </button>
            <button class="icon-btn select-place-btn" type="button" data-place="${place.name}">
              Select to order
            </button>
            <a class="secondary-btn" target="_blank" rel="noreferrer" href="${
              place.website ||
              `https://www.google.com/search?q=${encodeURIComponent(
                `${place.name} online order`
              )}`
            }">Order online</a>
          </div>
        </article>
      `
    )
    .join("");

  document.querySelectorAll(".announce-place-btn").forEach((button) => {
    button.addEventListener("click", () => {
      if (!("speechSynthesis" in window)) {
        return;
      }

      const place = nearbyPlaces.find((entry) => entry.name === button.dataset.place);
      if (!place) {
        return;
      }

      const utterance = new SpeechSynthesisUtterance(
        `${place.name}. ${place.type}. ${place.distance} away. ${place.vibe}.`
      );
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      updateVoiceStatus(`Reading details for ${place.name}.`);
    });
  });

  document.querySelectorAll(".select-place-btn").forEach((button) => {
    button.addEventListener("click", () => {
      selectPlaceForOrder(button.dataset.place);
    });
  });
}

function updatePreview(event) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  uploadedImageFile = file;

  const reader = new FileReader();
  reader.onload = () => {
    elements.menuPreview.src = reader.result;
    updateVoiceStatus(
      `Image loaded: ${file.name}. Tap Analyze menu and SafeBite will read the image.`
    );
    updateAnalysisStatus(
      `${file.name} is ready. Tap Analyze menu to run OCR and validate whether it is a menu.`
    );
  };
  reader.readAsDataURL(file);
}

function useLocation() {
  if (!navigator.geolocation) {
    elements.locationStatus.textContent =
      "Geolocation is not supported in this browser. Showing the default Johannesburg list instead.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      activeCoordinates = coords;
      elements.locationStatus.textContent = `Exact location active. Latitude ${coords.latitude}, longitude ${coords.longitude}, accuracy ${coords.accuracy} meters. Open Directions to continue in Maps.`;
      updateVoiceStatus("Exact location detected. Nearby suggestions were updated.");
      elements.addressStatus.textContent =
        "Looking up your exact address and real nearby places.";

      try {
        const [address, livePlaces] = await Promise.all([
          fetchExactAddress(coords),
          fetchNearbyPlaces(coords),
        ]);
        elements.addressStatus.textContent = `Exact address: ${address}`;
        nearbyPlaces = livePlaces;
        renderPlaces();
        updateOrderStatus(
          "Nearby places refreshed from your real location. Select one to order."
        );
      } catch (error) {
        elements.addressStatus.textContent =
          "Live address or nearby lookup could not be completed, so SafeBite kept the backup nearby list.";
        nearbyPlaces = [...seedPlaces];
        renderPlaces();
      }
    },
    () => {
      elements.locationStatus.textContent =
        "Location permission was not granted, so SafeBite is still showing the default nearby list.";
      updateVoiceStatus(
        "Location permission was not granted. Keeping the default nearby suggestions."
      );
    },
    {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    }
  );
}

function wireEvents() {
  document
    .querySelector("#start-listening-btn")
    .addEventListener("click", () => {
      if (!recognition) {
        updateCommandStatus(
          "Voice commands are not available in this browser. Use the buttons instead."
        );
        return;
      }

      if (isListening) {
        recognition.stop();
        return;
      }

      recognition.start();
    });
  document
    .querySelector("#read-help-btn")
    .addEventListener("click", readVoiceHelp);
  document
    .querySelector("#menu-image")
    .addEventListener("change", updatePreview);
  document
    .querySelector("#camera-image")
    .addEventListener("change", updatePreview);
  document
    .querySelector("#analyze-menu-btn")
    .addEventListener("click", () => {
      analyzeMenu();
    });
  document
    .querySelector("#enable-voice-btn")
    .addEventListener("click", unlockSpeech);
  document
    .querySelector("#test-voice-btn")
    .addEventListener("click", testVoice);
  document
    .querySelector("#read-menu-btn")
    .addEventListener("click", speakMenu);
  document
    .querySelector("#stop-speaking-btn")
    .addEventListener("click", stopSpeaking);
  document
    .querySelector("#quick-demo-btn")
    .addEventListener("click", loadDemoAnalysis);
  document
    .querySelector("#read-results-btn")
    .addEventListener("click", readAnalysis);
  document
    .querySelector("#locate-btn")
    .addEventListener("click", useLocation);
  document
    .querySelector("#read-nearby-btn")
    .addEventListener("click", readNearbyPlaces);
  document
    .querySelector("#start-order-voice-btn")
    .addEventListener("click", startOrderVoice);
  document
    .querySelector("#copy-order-btn")
    .addEventListener("click", copyOrderText);
  document
    .querySelector("#open-order-link-btn")
    .addEventListener("click", openOrderLink);
  document
    .querySelector("#emergency-btn")
    .addEventListener("click", () => {
      elements.emergencyDialog.showModal();
      announceEmergencyAction(
        "Emergency support opened. You can call emergency services or text a trusted contact."
      );
    });
  document
    .querySelector("#call-help-btn")
    .addEventListener("click", () =>
      announceEmergencyAction("Calling emergency services now.")
    );
  document
    .querySelector("#text-help-btn")
    .addEventListener("click", () =>
      announceEmergencyAction("Opening a message to your trusted contact now.")
    );

  document.querySelectorAll("[data-scroll-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const sectionId = button.dataset.scrollTarget;
      scrollToSection(sectionId, `the ${button.textContent.trim()} section`);
    });
  });

  elements.menuText.addEventListener("input", () => {
    updateVoiceStatus("Menu text updated. Tap Analyze menu to refresh the guidance.");
    updateAnalysisStatus(
      "Menu text changed. Analyze again to refresh OCR validation and dish guidance."
    );
  });

  elements.orderText.addEventListener("input", () => {
    updateOrderStatus("Order text updated. You can copy it or open an order link.");
  });
}

setupVoiceCommands();
renderAllergyOptions();
updateAllergySummary();
renderPlaces();
analyzeMenu();
wireEvents();
