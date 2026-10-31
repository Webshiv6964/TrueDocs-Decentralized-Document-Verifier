"""
email_service.py
Sends email notifications via SMTP (async).

If SMTP credentials are not configured the function logs a warning
and returns without raising — email failure never corrupts app state.

Development mode: set SMTP_DEV_MODE=true in .env to skip sending
and just print the notification to stdout.
"""

import os
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SMTP_HOST      = os.getenv("SMTP_HOST", "")
SMTP_PORT      = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME  = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD  = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM      = os.getenv("SMTP_FROM_EMAIL", "noreply@truedocs.local")
ADMIN_EMAIL    = os.getenv("ADMIN_EMAIL", "")
DEV_MODE       = os.getenv("SMTP_DEV_MODE", "false").lower() == "true"

_smtp_configured = bool(SMTP_HOST and SMTP_USERNAME and SMTP_PASSWORD)


async def _send(to: str, subject: str, html: str) -> None:
    """Low-level async send. Never raises — failures are logged only."""
    if DEV_MODE or not _smtp_configured:
        if not _smtp_configured and not DEV_MODE:
            logger.warning(
                "[EMAIL] SMTP not configured — email NOT sent to %s | Subject: %s",
                to, subject,
            )
        else:
            logger.info(
                "[EMAIL DEV] Would send to: %s | Subject: %s\n%s",
                to, subject, html,
            )
        return

    try:
        import aiosmtplib

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = SMTP_FROM
        msg["To"]      = to
        msg.attach(MIMEText(html, "html"))

        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USERNAME,
            password=SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info("[EMAIL] Sent to %s | %s", to, subject)
    except Exception as exc:
        logger.error("[EMAIL] Failed to send to %s: %s", to, exc)


# ── Public functions ───────────────────────────────────────────────────────────

async def notify_admin_new_request(
    org_name: str,
    org_email: str,
    contact_person: str,
    request_date: str,
    admin_dashboard_url: str = "http://localhost:5173/admin",
) -> None:
    """Notify the admin that a new org access request was submitted."""
    if not ADMIN_EMAIL:
        logger.warning("[EMAIL] ADMIN_EMAIL not set — admin notification skipped.")
        return

    subject = f"[TrueDocs] New Access Request: {org_name}"
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;background:#0B171B;color:#F4FAF8;padding:32px;border-radius:12px;">
      <h2 style="color:#18C7B0;margin-bottom:8px;">New Organization Access Request</h2>
      <p style="color:#A9BBB9;margin-bottom:24px;">
        A new organization has submitted an access request on TrueDocs.
      </p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#718785;font-size:14px;">Organization</td>
            <td style="padding:8px 0;font-weight:600;">{org_name}</td></tr>
        <tr><td style="padding:8px 0;color:#718785;font-size:14px;">Email</td>
            <td style="padding:8px 0;">{org_email}</td></tr>
        <tr><td style="padding:8px 0;color:#718785;font-size:14px;">Contact Person</td>
            <td style="padding:8px 0;">{contact_person}</td></tr>
        <tr><td style="padding:8px 0;color:#718785;font-size:14px;">Submitted</td>
            <td style="padding:8px 0;">{request_date}</td></tr>
      </table>
      <a href="{admin_dashboard_url}" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#18C7B0;color:#071014;border-radius:8px;text-decoration:none;font-weight:700;">
        Review in Admin Dashboard
      </a>
      <p style="margin-top:32px;color:#718785;font-size:12px;">
        This is an automated notification from TrueDocs. Do not reply to this email.
      </p>
    </div>
    """
    await _send(ADMIN_EMAIL, subject, html)


async def notify_org_approved(
    org_name: str,
    org_email: str,
    login_url: str = "http://localhost:5173/org/login",
) -> None:
    subject = "[TrueDocs] Your access request has been approved"
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;background:#0B171B;color:#F4FAF8;padding:32px;border-radius:12px;">
      <h2 style="color:#18C7B0;margin-bottom:8px;">Access Request Approved</h2>
      <p>Hello <strong>{org_name}</strong>,</p>
      <p style="color:#A9BBB9;margin:16px 0;">
        Your TrueDocs access request has been <strong style="color:#10B981;">approved</strong>.
        You can now log in and start registering documents.
      </p>
      <a href="{login_url}" style="display:inline-block;padding:12px 24px;background:#18C7B0;color:#071014;border-radius:8px;text-decoration:none;font-weight:700;">
        Log In to TrueDocs
      </a>
      <p style="margin-top:32px;color:#718785;font-size:12px;">
        TrueDocs — Decentralized Document Verification
      </p>
    </div>
    """
    await _send(org_email, subject, html)


async def notify_org_rejected(
    org_name: str,
    org_email: str,
) -> None:
    subject = "[TrueDocs] Your access request status"
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;background:#0B171B;color:#F4FAF8;padding:32px;border-radius:12px;">
      <h2 style="color:#EF5B68;margin-bottom:8px;">Access Request Not Approved</h2>
      <p>Hello <strong>{org_name}</strong>,</p>
      <p style="color:#A9BBB9;margin:16px 0;">
        We regret to inform you that your TrueDocs access request has been
        <strong style="color:#EF5B68;">rejected</strong>.
        If you believe this is an error, please contact the administrator.
      </p>
      <p style="margin-top:32px;color:#718785;font-size:12px;">
        TrueDocs — Decentralized Document Verification
      </p>
    </div>
    """
    await _send(org_email, subject, html)
