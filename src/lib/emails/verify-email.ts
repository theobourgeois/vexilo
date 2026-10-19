/** Inline styles and a table layout keep the email readable across mail clients. */
export function verificationEmail(code: string) {
  if (!/^\d{6}$/.test(code)) throw new Error('Invalid verification code');
  return {
    subject: 'Verify your email for Vexilo',
    text: `Vexilo\n\nVerify your email\n\nYour verification code is: ${code}\n\nEnter this code in Vexilo to finish setting up your account. It expires in 10 minutes and can only be used once.\n\nIf you didn’t request this code, you can ignore this email.\n\nVexilo — A community flag encyclopedia\nhttps://vexilo.org`,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>Verify your email for Vexilo</title></head>
<body style="margin:0;padding:0;background:#f4f3ef;color:#202124;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">Your Vexilo verification code expires in 10 minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3ef;"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding:0 8px 24px;"><a href="https://vexilo.org" style="color:#202124;text-decoration:none;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:middle;"><img src="https://vexilo.org/logo.png" width="34" height="34" alt="" style="display:block;border:0;"></td><td style="padding-left:10px;vertical-align:middle;font-size:18px;font-weight:600;letter-spacing:-0.5px;">Vexilo</td></tr></table></a></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e3e2dc;border-radius:20px;padding:36px 28px;">
<h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;font-weight:700;letter-spacing:-0.8px;">Verify your email</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#5e626a;">Enter this code in Vexilo to finish signing up.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;background:#eef1fc;border:1px solid #e1e6f6;border-radius:12px;font-family:Consolas,Monaco,monospace;font-size:34px;font-weight:700;letter-spacing:7px;line-height:1.3;color:#283f78;">${code}</td></tr></table>
<p style="margin:14px 0 28px;text-align:center;font-size:12px;line-height:1.6;color:#70747c;">Valid for 10 minutes · One-time use</p>
<p style="margin:0;padding-top:24px;border-top:1px solid #eeede8;font-size:12px;line-height:1.8;color:#70747c;">If you didn’t request this code, you can ignore this email. Your account won’t be activated without verification.</p>
</td></tr>
<tr><td style="padding:24px 8px 0;font-size:11px;line-height:1.8;color:#777b82;">A community flag encyclopedia.<br><a href="https://vexilo.org" style="color:#626a7d;text-decoration:underline;">vexilo.org</a></td></tr>
</table></td></tr></table></body></html>`,
  };
}
