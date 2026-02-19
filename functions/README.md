# ArrowPrompt Standard – License verification (Firebase Cloud Functions)

## Setup

1. Install dependencies: `npm install`
2. Set your Gumroad product ID:
   - Create a `.env` file (or use Firebase Console → Functions → Environment config) with:
     - `GUMROAD_PRODUCT_ID=your_gumroad_product_id`
   - For Firebase local emulator, create `functions/.env` with `GUMROAD_PRODUCT_ID=...`
   - For deployed functions, set the same in Firebase project settings / secrets.
3. Build: `npm run build`
4. Deploy: from repo root run `firebase deploy --only functions` (requires `firebase.json` and Firebase project).

## Endpoint

- **verifyLicense** (HTTP): `POST` with body `{ "licenseKey": "..." }`. Returns `{ "valid": true }` or `{ "valid": false, "message": "..." }`.

Update `VERIFY_LICENSE_URL` in the extension's `src/utils/constants.ts` to your deployed function URL.
