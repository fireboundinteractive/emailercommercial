import nodemailer from 'nodemailer';
import admin from 'firebase-admin';

// Initialize Firebase (Standard Check)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_KEY))
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { userId, to, subject, body } = req.body;

    // 2. Get User
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) return res.status(404).json({ error: 'Invalid User ID' });
    const userData = userDoc.data();

    // 3. Usage Limits (Free Tier)
    if (!userData.isPro) {
      if ((userData.usageCount || 0) >= 750) {
        return res.status(403).json({ error: 'Monthly limit reached (750 emails). Please upgrade.' });
      }
      // Increment Count
      await userRef.update({ usageCount: admin.firestore.FieldValue.increment(1) });
    }

    // 4. Send Email
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

    return res.status(200).json({ success: true });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
