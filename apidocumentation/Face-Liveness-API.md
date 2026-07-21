# Face Liveness API

## Overview

Confirm a live person is present during identity capture: create a liveness session, then fetch the verification result. Two endpoints with automatic session-token propagation.

Base URL: `https://hackathon-face-liveness-api.e.gov.ph`

Auth: every request sends `x-api-key: <API_KEY>`.

## Endpoints

### 1. Create Session

`POST {{baseUrl}}/v1/liveness/session`

Initializes a liveness session. Send the payload configuring the action (redirect, post, close) to run when verification completes. Returns a `token` and a hosted `url` where the user performs the liveness check.

**Headers**

| Key | Value |
|---|---|
| x-api-key | `{{apiKey}}` |
| Content-Type | application/json |

**Request Body Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| action | string | Yes | User-flow action to run when verification completes. Supported values: `redirect`, `post`, `close`. |
| callback_url | string | Yes (for `redirect` flow) | Destination URL where the user is redirected. Only applicable when `action` is `redirect`. |
| delay | integer | No | Delay in ms to show the completion-check screen before redirecting/closing. Defaults to `3000`. |

**Example Request Body**

```json
{ "action": "redirect", "callback_url": "https://your-app.com/callback", "delay": 3000 }
```

**Example cURL**

```bash
curl --request POST \
  --url '{{baseUrl}}/v1/liveness/session' \
  --header 'x-api-key: {{apiKey}}' \
  --header 'Content-Type: application/json' \
  --data '{ "action": "redirect", "callback_url": "https://your-app.com/callback", "delay": 3000 }'
```

**Responses**

| Status | Description |
|---|---|
| 201 Created | Session created. Returns `token` + hosted `url`. (Examples: Redirect Flow, Post Message Flow, Close Flow.) |

```json
{
  "token": "00000000-0000-0000-0000-000000000000",
  "url": "https://hackathon-face-liveness.e.gov.ph/..."
}
```

### 2. Get Verification Result

`GET {{baseUrl}}/v1/liveness/result/{{sessionToken}}`

Protected backend-to-backend endpoint to retrieve the final verification result (status, confidence score, and pre-signed selfie url) for a session using the verification token.

**Recommended Security Threshold**
- **Verification Status:** must be exactly `"SUCCEEDED"`.
- **Confidence Score:** must be `95.0` or higher (out of `100.0`).
- **Spoof Handling:** if the score is below `95.0`, reject the session as high-risk and request a retry.

**Headers**

| Key | Value |
|---|---|
| x-api-key | `{{apiKey}}` |

**Example cURL**

```bash
curl --request GET \
  --url '{{baseUrl}}/v1/liveness/result/{{sessionToken}}' \
  --header 'x-api-key: {{apiKey}}'
```

**Example Response — 200 OK**

```json
{
  "status": "SUCCEEDED",
  "confidence_score": 98.71,
  "reference_image_url": "https://face-liveness-audit-staging-tokyo.s3.ap-northeast-1.amazonaws.com/liveness-audits/00000000-0000-0000-0000-000000000000/reference.jpg?AWSAccessKeyId=..."
}
```

## Integration Notes

- Flow: (1) backend `POST /v1/liveness/session` → `{ token, url }`; (2) send the user to `url` to complete the liveness capture (redirect/post-message/close per `action`); (3) backend `GET /v1/liveness/result/{token}` → status + confidence; (4) accept only when `status === "SUCCEEDED"` and `confidence_score >= 95.0`.
- The session `token` is the value passed to National ID eVerify `/api/query` as `face_liveness_session_id`.
- The `reference_image_url` is a short-lived pre-signed URL to the captured selfie (audit only) — do not store the raw image.
