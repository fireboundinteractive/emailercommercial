import { buffer } from 'micro';
import Stripe from 'stripe';
import admin from 'firebase-admin';

// Init Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_KEY))
  });
}
const db = admin.firestore();
const stripe = new Stripe(process.env.STRIPE_KEY);

export const config = { api: { bodyParser: false } }; // Required for webhooks

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata.userId; // Retrieve the User ID

      // Update Firebase
      await db.collection('users').doc(userId).set({ 
        isPro: true,
        usageCount: 0 // Optional: Reset usage on upgrade
      }, { merge: true });
    }

    res.json({ received: true });
  } else {
    res.status(405).end();
  }
}
