# Mugnee CRM Office Handover

## Production URL

https://crm.mugnee.com

## Admin Login

- User: admin@crm.com
- Password: Crm@admin1234

The admin account is auto-created or activated on first successful admin login.

## User Creation Flow

- Admin can create Supervisor and Marketer users from `Admin > Users`.
- Supervisor can create Marketer users from `Supervisor > Team`.
- Team users log in with their email address and receive an OTP by email.

## Required Server Environment

Set these values on the production server:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB_NAME?schema=public"
AUTH_EMAIL_REDIRECT_TO="https://crm.mugnee.com"
RESEND_API_KEY="your-resend-api-key"
RESEND_FROM_EMAIL="no-reply@worklog.mugnee.com"
CRM_SHOW_LOGIN_OTP="false"
CRM_ADMIN_EMAIL="admin@crm.com"
CRM_ADMIN_PASSWORD="Crm@admin1234"
```

## Production Start

Run after uploading the latest code:

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start
```

## Vercel Deploy

1. Import the GitHub repo in Vercel.
2. Add a Postgres database:
   - Vercel project -> Storage -> Create Database -> Postgres -> Connect to project
   - Copy the generated connection string into `DATABASE_URL`
3. Or add `DATABASE_URL` manually in Project -> Settings -> Environment Variables.
4. Add the other production env vars from the section above.
5. Deploy. Vercel runs `npm run vercel-build`, which applies migrations and builds Next.js.

Admin login after deploy:

- Email: `admin@crm.com`
- Password: value of `CRM_ADMIN_PASSWORD` (default `Crm@admin1234`)

If email OTP is not configured yet, keep `CRM_SHOW_LOGIN_OTP="true"` so OTP appears on the login screen.

## Notes

- Do not commit `.env` or database backup files.
- If email sending fails, set `CRM_SHOW_LOGIN_OTP="true"` temporarily to display OTP on the login screen.
