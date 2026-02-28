import { onRequest } from 'firebase-functions/v2/https';

const GUMROAD_VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';

/**
 * Verify ArrowPrompt Standard license key with Gumroad.
 * Extension sends POST { licenseKey: string }; we call Gumroad and return { valid: boolean, message?: string }.
 * Set GUMROAD_PRODUCT_ID in Firebase config: firebase functions:config:set gumroad.product_id="YOUR_PRODUCT_ID"
 */
export const verifyLicense = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ valid: false, message: 'Method not allowed' });
      return;
    }

    // v2 onRequest does not auto-parse JSON; body may be string or Buffer
    let body: { licenseKey?: string } = {};
    if (typeof req.body === 'object' && req.body !== null && !Buffer.isBuffer(req.body)) {
      body = req.body;
    } else if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
      try {
        body = JSON.parse(typeof req.body === 'string' ? req.body : req.body.toString()) ?? {};
      } catch {
        res.status(400).json({ valid: false, message: 'Invalid request body' });
        return;
      }
    }

    const licenseKey =
      typeof body.licenseKey === 'string' ? body.licenseKey.trim() : '';

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

      const data = (await gumroadRes.json()) as {
        success?: boolean;
        purchase?: { test?: boolean };
        uses?: number;
      };

      if (!data.success) {
        res.status(200).json({ valid: false, message: 'License key invalid or expired' });
        return;
      }

      // Optionally reject test purchases in production
      if (data.purchase?.test === true) {
        res.status(200).json({ valid: false, message: 'Test licenses are not valid for activation' });
        return;
      }

      res.status(200).json({ valid: true });
    } catch (err) {
      console.error('Gumroad verify error:', err);
      res.status(500).json({ valid: false, message: 'Verification failed' });
    }
  }
);
