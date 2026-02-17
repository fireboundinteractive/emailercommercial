import nodemailer from 'nodemailer';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_KEY))
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { to, teamName, inviterName } = req.body;

  // SYSTEM EMAIL CONFIG
  const transporter = nodemailer.createTransport({
    host: "smtp.livemail.co.uk", // Update if different
    port: 587,
    auth: {
      user: "emailer@fireboundinteractive.uk",
      pass: process.env.SYSTEM_EMAIL_PASSWORD // Add this to Vercel Env Vars
    }
  });

  try {
    await transporter.sendMail({
      from: '"Firebound Team" <emailer@fireboundinteractive.uk>',
      to: to,
      subject: `You've been invited to join ${teamName}`,
      html: `
        <h2>Team Invitation</h2>
        <p><b>${inviterName}</b> has invited you to join their team on Emailer.</p>
        <p>Log in or Sign up to accept the invitation and access Pro features.</p>
        <a href="https://emailercommercial.vercel.app">Click here to join</a>
      `
    });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
