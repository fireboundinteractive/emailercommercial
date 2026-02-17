import nodemailer from 'nodemailer';
import admin from 'firebase-admin';

// 1. Initialize Firebase
// We use an Environment Variable to keep your keys safe
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_KEY))
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  // 2. Set CORS Headers (Crucial for external access)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle browser pre-flight check
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { userId, to, subject, body } = req.body;

    // 3. Get User Settings from Database
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User ID not found' });
    }

    const userData = userDoc.data();

    // 4. Check if they are a Paid User
    if (!userData.isPro) {
      return res.status(403).json({ error: 'Upgrade to Pro required to send emails.' });
    }

    // 5. Connect to User's SMTP
    const transporter = nodemailer.createTransport({
      host: userData.smtp_host,
      port: Number(userData.smtp_port),
      secure: Number(userData.smtp_port) === 465, // True if port is 465
      auth: {
        user: userData.smtp_user,
        pass: userData.smtp_pass,
      },
      tls: {
        rejectUnauthorized: false // Helps avoid errors on some shared hosting
      }
    });

    // 6. Send the Email
    await transporter.sendMail({
      from: userData.smtp_user, // Always send FROM their verified email
      to: to,
      subject: subject,
      html: body,
    });

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("Send Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
