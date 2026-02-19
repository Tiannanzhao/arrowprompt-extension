"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyLicense = void 0;
const https_1 = require("firebase-functions/v2/https");
const GUMROAD_VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';
/**
 * Verify ArrowPrompt Pro license key with Gumroad.
 * Extension sends POST { licenseKey: string }; we call Gumroad and return { valid: boolean, message?: string }.
 * Set GUMROAD_PRODUCT_ID in Firebase config: firebase functions:config:set gumroad.product_id="YOUR_PRODUCT_ID"
 */
exports.verifyLicense = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    var _a, _b;
    if (req.method !== 'POST') {
        res.status(405).json({ valid: false, message: 'Method not allowed' });
        return;
    }
    const licenseKey = typeof ((_a = req.body) === null || _a === void 0 ? void 0 : _a.licenseKey) === 'string'
        ? req.body.licenseKey.trim()
        : '';
    if (!licenseKey || licenseKey.length < 4) {
        res.status(400).json({ valid: false, message: 'Invalid license key format' });
        return;
    }
    const productId = process.env.GUMROAD_PRODUCT_ID;
    if (!productId) {
        console.error('GUMROAD_PRODUCT_ID not set');
        res.status(500).json({ valid: false, message: 'Server configuration error' });
        return;
    }
    try {
        const body = new URLSearchParams();
        body.append('product_id', productId);
        body.append('license_key', licenseKey);
        body.append('increment_uses_count', 'true');
        const gumroadRes = await fetch(GUMROAD_VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });
        const data = (await gumroadRes.json());
        if (!data.success) {
            res.status(200).json({ valid: false, message: 'License key invalid or expired' });
            return;
        }
        // Optionally reject test purchases in production
        if (((_b = data.purchase) === null || _b === void 0 ? void 0 : _b.test) === true) {
            res.status(200).json({ valid: false, message: 'Test licenses are not valid for activation' });
            return;
        }
        res.status(200).json({ valid: true });
    }
    catch (err) {
        console.error('Gumroad verify error:', err);
        res.status(500).json({ valid: false, message: 'Verification failed' });
    }
});
//# sourceMappingURL=index.js.map