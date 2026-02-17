import nodemailer from 'nodemailer';
import admin from 'firebase-admin';

// Initialize Firebase
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

    // 1. GET USER
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) return res.status(404).json({ error: 'User ID invalid' });
    
    let userData = userDoc.data();

    // 2. ROBUST STATUS CHECK (Fixes "memerbship" typo automatically)
    let status = userData.membership || userData.memerbship || 'Free';
    
    // If we found the typo, let's fix it in the background
    if (userData.memerbship) {
        await userRef.update({ membership: userData.memerbship, memerbship: admin.firestore.FieldValue.delete() });
    }

    // 3. TEAM INHERITANCE (Check if they are in a Pro Team)
    if (status !== 'Pro' && userData.teamId) {
        const teamOwner = await db.collection('users').doc(userData.teamId).get();
        if (teamOwner.exists) {
            const ownerData = teamOwner.data();
            // Check owner status (handling typo there too)
            const ownerStatus = ownerData.membership || ownerData.memerbship || 'Free';
            if (ownerStatus === 'Pro') status = 'Pro';
        }
    }

    // 4. ENFORCE LIMITS
    if (status !== 'Pro') {
      if ((userData.usageCount || 0) >= 750) {
        return res.status(403).json({ error: 'Free Limit Reached (750/mo). Upgrade to Pro.' });
      }
      // Increment Usage
      await userRef.update({
          usageCount: admin.firestore.FieldValue.increment(1)
      });
    }

    // 5. SEND EMAIL
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

    return res.status(200).json({ success: true, status: status });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
