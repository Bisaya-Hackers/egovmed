# NationalID / eVerify API

## Overview

NIDAS eVerify Authentication Services (National ID) REST API for Relying Parties — Tier 1 and Tier 2 identity authentication.

Flow: (1) obtain an `access_token` from the Authentication endpoint, (2) secure a `face_liveness_session_id` via the Face Liveness Web SDK, (3) submit demographics + `face_liveness_session_id` to the Verify endpoint.

Base URL: `https://hackathon-everify-api.e.gov.ph`

## Endpoints

### 1. Authenticate (Generate Access Token)

`POST /api/auth`

Generates a server-to-server access_token for the NIDAS eVerify API. Every call to the verification endpoints requires this token.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| client_id | string | Yes | Your assigned API Client ID. |
| client_secret | string | Yes | Your assigned API Client Secret. |

**Responses**

| Status | Description |
|---|---|
| 200 OK | Access token successfully generated. |
| 403 Forbidden | Invalid client credentials. |

**Notes**
- Use the returned access_token as a Bearer token in the Authorization header of the verify endpoints.
- Store client_secret securely and never expose it on the client side.

**Example Request Body**

```json
{
  "client_id": "{{client_id}}",
  "client_secret": "{{client_secret}}"
}
```

**Example cURL**

```bash
curl --request POST \
  --url '{{base_url}}/api/auth' \
  --header 'Content-Type: application/json' \
  --data '{
    "client_id": "{{client_id}}",
    "client_secret": "{{client_secret}}"
}'
```

### 2. Verify Personal Information

`POST /api/query`

Compares the user's demographic input and biometrics (Face Liveness) against the NIDAS database.

**Headers**

| Header | Value |
|---|---|
| Authorization | Bearer <access_token> |

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| first_name | string | Yes | |
| middle_name | string | No | |
| last_name | string | Yes | |
| suffix | string | No | |
| birth_date | string (YYYY-MM-DD) | Yes | |
| face_liveness_session_id | string (UUID) | Yes | The session_id from the Liveness Web SDK. |

**Notes**
- `face_liveness_session_id` is secured via the eVerify Face Liveness Web SDK: call `window.eKYC().start({ pubKey })` and pass the returned `result.session_id` as `face_liveness_session_id`.

**Example Request Body**

```json
{
  "first_name": "Juan",
  "middle_name": "Santos",
  "last_name": "Dela Cruz",
  "suffix": "JR",
  "birth_date": "1989-09-12",
  "face_liveness_session_id": "a1b3fae6-af74-4896-bd58-32a81604de01"
}
```

**Example cURL**

```bash
curl --request POST \
  --url '{{base_url}}/api/query' \
  --header 'Authorization: Bearer {{access_token}}' \
  --header 'Content-Type: application/json' \
  --data '{
    "first_name": "Juan",
    "middle_name": "Santos",
    "last_name": "Dela Cruz",
    "suffix": "JR",
    "birth_date": "1989-09-12",
    "face_liveness_session_id": "a1b3fae6-af74-4896-bd58-32a81604de01"
}'
```

### 3. QR Check

`POST /api/query/qr/check`

Checks and decodes the scanned National ID QR code value. Decrypts and returns the verified demographics stored inside the QR code.

**Headers**

| Header | Value |
|---|---|
| Authorization | Bearer <access_token> |

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| value | string | Yes | Raw string value scanned from the National ID QR code. |

**Responses**

| Status | Description |
|---|---|
| 200 OK | Valid QR code. Returns decrypted profile data. |
| 422 Unprocessable Content | Invalid QR code format. |

**Example Request Body**

```json
{
  "value": "RAW_QR_CODE_VALUE"
}
```

**Example cURL**

```bash
curl --request POST \
  --url '{{base_url}}/api/query/qr/check' \
  --header 'Authorization: Bearer {{access_token}}' \
  --header 'Content-Type: application/json' \
  --data '{
    "value": "RAW_QR_CODE_VALUE"
}'
```

### 4. QR Verify

`POST /api/query/qr`

Performs full identity verification using the scanned National ID QR code value and matching biometrics (Face Liveness).

**Headers**

| Header | Value |
|---|---|
| Authorization | Bearer <access_token> |

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| value | string | Yes | Raw string value scanned from the National ID QR code. |
| face_liveness_session_id | string (UUID) | Yes | The session_id from the Liveness Web SDK. |

**Responses**

| Status | Description |
|---|---|
| 200 OK | Verification processed successfully. Returns profile data if matched. |

**Example Request Body**

```json
{
  "value": "RAW_QR_CODE_VALUE",
  "face_liveness_session_id": "a1b3fae6-af74-4896-bd58-32a81604de01"
}
```

**Example cURL**

```bash
curl --request POST \
  --url '{{base_url}}/api/query/qr' \
  --header 'Authorization: Bearer {{access_token}}' \
  --header 'Content-Type: application/json' \
  --data '{
    "value": "RAW_QR_CODE_VALUE",
    "face_liveness_session_id": "a1b3fae6-af74-4896-bd58-32a81604de01"
}'
```
