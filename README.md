# super-awesome-web-tools

privacy focused web tools for the 21st century

https://3ln.me/

## Tools

all tools have the option to be zero knowledge/e2e encrypted

- url shortener
  - this url shortener is intended to be as few characters as possible (hence the domain 3ln.me)
- pastebin
- encrypted text chat
- file drop
- qr code generator
  - NO middleman, generates direct qr codes to links or text

## Data Collected

link shortener: ip address of creator (for rate limiting), uuid cookie of creator (for rate limiting), number of uses for each link, and the last used timestamp

## Configuration

### Email Verification & Password Reset

The application supports optional email verification and password reset functionality. To enable these features, configure SMTP settings in your `config/config.yaml`:

```yaml
smtp:
  host: smtp.example.com        # Your SMTP server hostname
  port: 587                      # SMTP port (587 for STARTTLS, 465 for SSL/TLS)
  secure: false                  # true for port 465, false for STARTTLS on 587
  auth:
    user: your-email@example.com # SMTP authentication username
    pass: your-smtp-password     # SMTP authentication password
  from: noreply@example.com      # From email address for outgoing emails
```

**Features when SMTP is configured:**
- Email verification on registration (24-hour token expiration)
- Password reset functionality (1-hour token expiration)
- Automatic verification emails sent to new users
- Resend verification email option

**Without SMTP configuration:**
- Users can still register and use the application
- Email verification is not required or enforced
- Password reset is unavailable (users cannot recover accounts)

**Security considerations:**
- Verification tokens are cryptographically secure (32 random bytes)
- Tokens are stored hashed in the database
- Password reset follows best practices (doesn't reveal if email exists)
- Email validation prevents obviously malformed addresses
