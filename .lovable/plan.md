
## Fix Step 3 contract signing jump/flash/dead-space (Option A)

Stop re-rendering the contract iframe on every signature stroke. The contract preview will render once without a signature; after the user finishes signing, a small confirmation appears next to the pad; the fully-signed contract is only generated on submit (as it already is for the PDF).

### Changes

**1. `src/components/public/BookingFlow/Step3.tsx`**
- Remove `liveSignatureData` state and the `onEnd={syncSignaturePreview}` wiring that pushes signature strokes into the contract preview.
- Pass `signatureData={''}` (or omit) to `<DirectContractDisplay>` so the contract HTML is loaded exactly once and never rebuilt while the user signs.
- Track a lightweight `hasSignature` boolean (set on pad `onEnd`, cleared by `clear()`) purely to show a "✓ Signature captured" chip next to the Clear button. No effect on the iframe.

**2. `src/components/public/BookingFlow/DirectContractDisplay.tsx`**
- Tighten the iframe height math so the "dead space" below the contract disappears:
  - In the injected script, post `Math.max(scrollHeight, offsetHeight)` with no `+100` buffer.
  - In the parent `onMessage`, set height to `Math.max(400, Math.ceil(height))` — drop the `+24`.
- Leave the rest of the component untouched (still supports a signature prop for other callers/PDF path).

### Out of scope
- No change to `contractPdfService` — the final signed PDF is still generated on submit from the real signature (`handleSignAndProceed` already does this).
- No change to Step 1/2/4, backend, or contract template.

### Expected result
- No page jump or scroll shift while drawing the signature.
- No white flash of the contract iframe mid-stroke.
- No large empty space under the rendered contract.
- Final signed PDF is still produced correctly on "Continue to pay".
