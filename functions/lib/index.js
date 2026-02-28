"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyLicense = void 0;
const https_1 = require("firebase-functions/v2/https");
const GUMROAD_VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';
/**
 * Verify ArrowPrompt Standard license key with Gumroad.
 * Extension sends POST { licenseKey: string }; we call Gumroad and return { valid: boolean, message?: string }.
 * Set GUMROAD_PRODUCT_ID in Firebase config: firebase functions:config:set gumroad.product_id="YOUR_PRODUCT_ID"
 */
exports.verifyLicense = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    var _a, _b, _c, _d, _e;
    console.log('[ArrowPrompt] verifyLicense request received', { method: req.method });
    if (req.method !== 'POST') {
        res.status(405).json({ valid: false, message: 'Method not allowed' });
        return;
    }
    // v2 onRequest does not auto-parse JSON; body may be string or Buffer
    let body = {};
    if (typeof req.body === 'object' && req.body !== null && !Buffer.isBuffer(req.body)) {
        body = req.body;
    }
    else if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
        try {
            body = (_a = JSON.parse(typeof req.body === 'string' ? req.body : req.body.toString())) !== null && _a !== void 0 ? _a : {};
        }
        catch (_f) {
            res.status(400).json({ valid: false, message: 'Invalid request body' });
            return;
        }
    }
    const licenseKey = typeof body.licenseKey === 'string' ? body.licenseKey.trim() : '';
    console.log('[ArrowPrompt] licenseKey length:', (_b = licenseKey === null || licenseKey === void 0 ? void 0 : licenseKey.length) !== null && _b !== void 0 ? _b : 0);
    if (!licenseKey || licenseKey.length < 4) {
        res.status(400).json({ valid: false, message: 'Invalid license key format' });
        return;
    }
    const productId = process.env.GUMROAD_PRODUCT_ID;
    console.log('[ArrowPrompt] GUMROAD_PRODUCT_ID set:', !!productId, 'length:', (_c = productId === null || productId === void 0 ? void 0 : productId.length) !== null && _c !== void 0 ? _c : 0);
    if (!productId) {
        console.error('[ArrowPrompt] GUMROAD_PRODUCT_ID not set');
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
        console.log('[ArrowPrompt] Gumroad response:', { success: data.success, test: (_d = data.purchase) === null || _d === void 0 ? void 0 : _d.test, msg: data.message });
        if (!data.success) {
            console.log('[ArrowPrompt] Returning: License key invalid or expired (Gumroad success=false)');
            res.status(200).json({ valid: false, message: 'License key invalid or expired' });
            return;
        }
        // Optionally reject test purchases in production
        if (((_e = data.purchase) === null || _e === void 0 ? void 0 : _e.test) === true) {
            console.log('[ArrowPrompt] Returning: Test license rejected');
            res.status(200).json({ valid: false, message: 'Test licenses are not valid for activation' });
            return;
        }
        console.log('[ArrowPrompt] Returning: valid');
        res.status(200).json({ valid: true });
    }
    catch (err) {
        console.error('[ArrowPrompt] Gumroad verify error:', err);
        res.status(500).json({ valid: false, message: 'Verification failed' });
    }
});
//# sourceMappingURL=index.js.map