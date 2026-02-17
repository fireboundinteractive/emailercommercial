import nodemailer from 'nodemailer';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_KEY))
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { userId, to, subject, body } = req.body;

    // 1. Get User Data
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found in database. Please log in to dashboard once to fix.' });
    
    let userData = userDoc.data();

    // 2. CHECK TEAM STATUS (Inherit Pro from Team Owner)
    if (userData.membership !== 'Pro' && userData.teamId) {
        const teamOwnerDoc = await db.collection('users').doc(userData.teamId).get();
        if (teamOwnerDoc.exists && teamOwnerDoc.data().membership === 'Pro') {
            userData.membership = 'Pro'; // Grant temporary Pro status for this send
        }
    }

    // 3. CHECK LIMITS (If still Free)
    if (userData.membership !== 'Pro') {
      if ((userData.usageCount || 0) >= 750) {
        return res.status(403).json({ error: 'Monthly limit reached (750). Upgrade to Pro.' });
      }
      // Increment Usage
      await db.collection('users').doc(userId).update({ 
          usageCount: admin.firestore.FieldValue.increment(1) 
      });
    }

    // 4. SEND EMAIL
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
      to, subject, html: body
    });

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
