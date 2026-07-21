"# eMessage API

Deliver SMS, email and in-app notices to citizens through a single messaging API.

Base URL: `https://ws-message.e.gov.ph`

## Endpoint: Push SMS

**POST** `{{base_url}}/messaging/v1/sms/push`

Sends an SMS message to a recipient number.

### Headers

| Header | Value | Required | Description |
|---|---|---|---|
| X-EMESSAGE-Auth | <API-TOKEN> | Yes | eMessage API auth token. |
| Content-Type | application/json | Yes | Request body is JSON. |

### Body Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| number | string | Yes | Recipient mobile number in E.164 format, e.g. +639090000000. |
| message | string | Yes | The SMS message body. |

### Example Request Body

```json
{
  "number": "+639090000000",
  "message": "Test message"
}
```

### Example cURL

```bash
curl --request POST \
  --url '{{base_url}}/messaging/v1/sms/push' \
  --header 'X-EMESSAGE-Auth: {{api_token}}' \
  --header 'Content-Type: application/json' \
  --data '{ "number": "+639090000000", "message": "Test message" }'
```

### Example Responses

**201 - Created**
```json
{
  "data": {
    "message": "SMS was successfully created."
  }
}
```

**400 - Bad Request**

**422 - Unprocessable Entity**
"