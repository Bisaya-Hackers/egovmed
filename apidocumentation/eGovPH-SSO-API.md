# eGovPH — Single Sign-On (SSO) API

## Overview

Single Sign-On integration for eGov partners.

Base URL: `https://hackathon-sso.e.gov.ph`

## Endpoints

### 1. Generate Access Token

`POST /api/token`

Exchanges an authorization code for an access token using the eGov SSO service. This endpoint is used as part of the OAuth 2.0 authorization code flow. After a user successfully authenticates and an exchange code is issued, the partner system calls this endpoint to obtain an access token that can be used to authenticate subsequent API requests.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| exchange_code | string | Yes | The authorization code received after user authentication. |
| scope | string | Yes | The requested scope. Use `SSO_AUTHENTICATION` for standard SSO login. |
| partner_code | string | Yes | The unique code identifying the partner/agency system. |
| partner_secret | string | Yes | The secret key associated with the partner account. |

**Responses**

| Status | Description |
|---|---|
| 200 OK | Access token successfully generated. |
| 403 Forbidden | The request is forbidden. This may occur if the partner credentials are invalid or the partner is not authorized. |
| 422 Unprocessable Entity | The exchange code is invalid or has already been used/expired. |

**Notes**
- The `exchange_code` is single-use and expires after a short period.
- Store the `partner_secret` securely and never expose it on the client side.
- Use the returned access token in the `Authorization` header of subsequent requests.

**Example Request Body**

```json
{
  "exchange_code": "generated_exchange_code",
  "scope": "SSO_AUTHENTICATION",
  "partner_code": "{{partner_code}}",
  "partner_secret": "{{partner_secret}}"
}
```

**Example cURL**

```bash
curl --request POST \
  --url '{{base_url}}/api/token' \
  --header 'Content-Type: application/json' \
  --data '{
    "exchange_code": "generated_exchange_code",
    "scope": "SSO_AUTHENTICATION",
    "partner_code": "{{partner_code}}",
    "partner_secret": "{{partner_secret}}"
}'
```

### 2. SSO Authentication

`POST /api/partner/sso_authentication`

Resolves the authenticated user's profile for a partner application via Single Sign-On (SSO). Call this after obtaining an access token from `POST /api/token`.

**Authorization**

| Type | Details |
|---|---|
| Bearer Token | Pass the access token in the header: `Authorization: Bearer {{access_token}}` |

**Request Body**

None — this endpoint takes no request body. The caller is identified entirely by the bearer access token.

**Responses**

| Status | Meaning |
|---|---|
| 200 OK | Authentication successful. Returns the authenticated citizen's profile (personal details, national ID, passport, etc.). |
| 401 Unauthorized | The access token is missing, invalid, or expired. |

**Notes**
- Obtain the access token first from `POST /api/token`.

**Example cURL**

```bash
curl --request POST \
  --url '{{base_url}}/api/partner/sso_authentication' \
  --header 'Authorization: Bearer {{access_token}}'
```

## Integration Notes

### Core Technical Requirements
- Active SSL Certificate: Mandatory for end-to-end data security.
- Mobile Responsiveness: Required to optimize user experience across all devices.
- Base URL for SSO: Partners must provide a base URL where eGovPH can append the authentication parameter (exchange_code). Example: `https://test_website.com/egovph/sso?exchange_code=text_exchange_code`

### SSO Implementation Logic
- Existing Users: Match using `uniqid` or personal details (name, birthdate). Bind the `uniqid` to streamline future logins and auto-authenticate.
- New Users: Automatically register using provided SSO details, guide through onboarding if additional info is needed, and auto-authenticate.

### UI / UX Requirements
Disable or hide the following features on the agency website: Login & Registration pages, Profile & Password management pages, External links (e.g., app download pages).

### Integration Checklist
1. SSO Functionality
   - Data Sync: Accurately map eGovPH user info (name, birthdate, address, email, contact number).
   - Auto-Login: Users are logged in automatically upon successful SSO authentication.
   - Profile Locking: Profile updates must occur exclusively through eGovPH (no direct editing on agency site).
   - No Manual Auth: Remove manual login and logout options; manage all sessions via eGovPH.
2. Mobile Responsiveness
   - Layout: Ensure no overlapping or distorted text/images.
   - Screen Fitting: Confirm proper display across various smartphone and tablet screen sizes.
   - Performance & Feature Parity: Verify fast load times, intuitive navigation, and full feature availability on mobile.

### Expected Outcome
Full integration allows authenticated users to access system features seamlessly without needing separate logins or profile management on the partner website.
