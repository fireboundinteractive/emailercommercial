import nodemailer from 'nodemailer';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_KEY))
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { userId, to, subject, body } = req.body;

    // 1. Get User Data
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
    const userData = userDoc.data();

    // 2. CHECK QUOTAS (The Logic Change)
    if (!userData.isPro) {
      // Get current month key (e.g., "2023-10")
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Check if month changed, reset counter if needed
      if (userData.usageMonth !== currentMonth) {
         await userRef.update({ usageMonth: currentMonth, usageCount: 0 });
         userData.usageCount = 0;
      }

      // Check Limit (750 emails)
      if ((userData.usageCount || 0) >= 750) {
        return res.status(403).json({ error: 'Free limit reached (750/mo). Upgrade to Pro.' });
      }

      // Increment Counter
      await userRef.update({ usageCount: admin.firestore.FieldValue.increment(1) });
    }

    // 3. Connect & Send
    const transporter = nodemailer.createTransport({
      host: userData.smtp_host,
      port: Number(userData.smtp_port),
      secure: Number(userData.smtp_port) === 465,
      auth: {
        user: userData.smtp_user,
        pass: userData.smtp_pass,
      },
      tls: { rejectUnauthorized: false }
    });

    await transporter.sendMail({
      from: userData.smtp_user,
      to: to,
      subject: subject,
      html: body,
    });

    return res.status(200).json({ success: true, usage: userData.isPro ? 'Unlimited' : `${userData.usageCount + 1}/750` });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
