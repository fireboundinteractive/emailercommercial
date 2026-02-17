import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { to, inviterName } = req.body;

  // SYSTEM EMAIL CONFIG (Use Env Vars in Vercel!)
  const transporter = nodemailer.createTransport({
    host: "smtp.livemail.co.uk", 
    port: 587,
    auth: {
      user: "emailer@fireboundinteractive.uk",
      pass: process.env.SYSTEM_EMAIL_PASSWORD 
    }
  });

  try {
    await transporter.sendMail({
      from: '"Firebound Team" <emailer@fireboundinteractive.uk>',
      to: to,
      subject: `Team Invitation from ${inviterName}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #2dd4bf;">You're Invited!</h2>
            <p><b>${inviterName}</b> has invited you to join their Pro Team on Emailer.</p>
            <p>1. Log in or Sign Up at <a href="https://emailercommercial.vercel.app">Emailer Dashboard</a></p>
            <p>2. Ask ${inviterName} for their <b>User ID</b>.</p>
            <p>3. Use that ID in your code to access Pro features.</p>
        </div>
      `
    });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
