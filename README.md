# SafeBite

SafeBite is a mobile-first accessibility prototype for blind and deaf diners. It lets users:

- upload a menu photo
- review editable OCR-style text
- read the menu aloud with browser text-to-speech
- select allergies and flag risky dishes
- explore nearby restaurants or malls
- open directions in Google Maps
- access a quick emergency help panel

## Run locally

This prototype is dependency-free.

1. Open [index.html](./index.html) in a browser.
2. Upload a menu image if you want to preview your own menu photo.
3. Edit the menu text and press `Analyze menu`.

## Notes

- OCR is currently represented by editable extracted text so the flow works immediately.
- Text-to-speech uses the browser `speechSynthesis` API.
- Nearby places are seeded demo data with live Google Maps search links.
- The next upgrade would be replacing the editable OCR box with a real OCR service such as Tesseract, Google Vision, or Azure Vision.
