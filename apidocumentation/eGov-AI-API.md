"# eGov AI API

Document intelligence, translation and conversational endpoints tuned for government workloads.

Base URL: `{{base}}` (configured per environment: Local, Staging, or Production)

## Endpoint: Generate Access Token

**POST** `{{base}}/api/v1/egov/integration/token`

Generates a short-lived access token for authenticating with the eGov API Docs. The token is automatically saved to the `access_token`/`hackathon_token` environment variable upon a successful response.

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| access_code | string | Yes | The unique access code issued to your team for the hackathon. Stored in the access_code environment variable. |

### Example Request Body
```json
{ "access_code": "{{access_code}}" }
```

### Example cURL
```bash
curl --request POST \
  --url '{{base}}/api/v1/egov/integration/token' \
  --header 'Content-Type: application/json' \
  --data '{ "access_code": "{{access_code}}" }'
```

### Example Responses

**200 - OK**
```json
{
  "access_token": "bebaddec-de7e-4d4e-91b1-ae3a73544b22",
  "expires_in_seconds": 28800,
  "credits_total": 200,
  "credits_remaining": 200
}
```
Errors: 401 Unauthorized.

## Endpoint: AI Assistant

**POST** `{{base}}/api/v1/egov/integration/ai_assistant/generate`

Generates an AI-powered response to a user's query about eGov services. Accepts a natural language prompt and a category/country code, then returns a contextually relevant answer scoped to the specified eGov service region.

Authentication: Bearer Token — `{{hackathon_token}}`

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| prompt | string | Yes | The user's natural language question or query directed to the AI assistant. |
| category | string | Yes | The category/country code used to scope the AI response (e.g. \"PH\" for Philippines). |

### Example Request Body
```json
{
  "prompt": "how can i get my digital tin id here in egov",
  "category": "PH"
}
```

### Example cURL
```bash
curl --request POST \
  --url '{{base}}/api/v1/egov/integration/ai_assistant/generate' \
  --header 'Authorization: Bearer {{hackathon_token}}' \
  --header 'Content-Type: application/json' \
  --data '{ "prompt": "how can i get my digital tin id here in egov", "category": "PH" }'
```

### Example Responses

**200 - OK** — returns `{ "data": "<AI-generated answer text>", "session_id": "<uuid>" }`. Sample answer explains how to access a Digital TIN ID via the eGovPH app (download app, register/verify identity, log in with OTP + MPIN, open Digital ID wallet, select BIR Digital TIN ID; requires prior registration in BIR's ORUS system).

Errors: 401 Unauthorized.

## Endpoint: Speech Maker

**POST** `{{base}}/api/v1/egov/integration/speech_maker/generate`

Generates a speech based on a given prompt and category, producing a well-structured, contextually relevant speech tailored to the topic and locale/category.

Authentication: Bearer Token — `{{hackathon_token}}`

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| prompt | string | Yes | The topic or instruction describing what the speech should be about. |
| category | string | Yes | The category or locale context for the speech (e.g. \"PH\"). |

### Example Request Body
```json
{
  "prompt": "Give me a speech about current trends in PH",
  "category": "PH"
}
```

### Example cURL
```bash
curl --request POST \
  --url '{{base}}/api/v1/egov/integration/speech_maker/generate' \
  --header 'Authorization: Bearer {{hackathon_token}}' \
  --header 'Content-Type: application/json' \
  --data '{ "prompt": "Give me a speech about current trends in PH", "category": "PH" }'
```

### Example Responses

**200 - OK** — returns `{ "data": "<AI-generated speech text, in Filipino, covering economic, technological, environmental and political/social trends>", "session_id": "<uuid>" }`.

Errors: 401 Unauthorized.

## Endpoint: Tourism (Content Generator)

**POST** `{{base}}/api/v1/egov/integration/tourism/generate`

Generates AI-powered tourism and travel content based on a user-provided prompt and a destination category. Returns a detailed, narrative-style response (e.g. multi-day travel itinerary, cultural insights, activity recommendations) plus a session ID.

Authentication: Bearer Token — `{{hackathon_token}}`

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| prompt | string | Yes | A natural language instruction describing the tourism content to generate (e.g. \"Provide travel itinerary for Boracay\"). |
| category | string | Yes | A country or region code to scope the response to a specific destination (e.g. \"PH\"). |

### Response Fields

| Field | Type | Description |
|---|---|---|
| data | string | The AI-generated tourism content (itinerary, cultural background, activity suggestions). Supports Markdown formatting. |
| session_id | string | UUID identifying the session, useful for follow-up/conversation tracking. |

### Example Request Body
```json
{
  "prompt": "Provide travel itinerary for Boracay",
  "category": "PH"
}
```

### Example cURL
```bash
curl --request POST \
  --url '{{base}}/api/v1/egov/integration/tourism/generate' \
  --header 'Authorization: Bearer {{hackathon_token}}' \
  --header 'Content-Type: application/json' \
  --data '{ "prompt": "Provide travel itinerary for Boracay", "category": "PH" }'
```

### Example Responses

**200 - OK** — sample response begins: `{ "data": "Boracay Island, located in Aklan province in Western Visayas...", "session_id": "525d4e90-245c-4415-91a3-9cc1f1dd4497" }` (full itinerary broken into day-by-day Markdown sections).

Errors: 401 Unauthorized.

## Endpoint: Laws & Regulations

**POST** `{{base}}/api/v1/egov/integration/laws_and_regulations/generate`

Generates an AI-powered response related to laws and regulations based on a given prompt and category. Intended for querying legal/regulatory information using natural language.

Authentication: Bearer Token — `{{hackathon_token}}`

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| prompt | string | Yes | A natural language question or instruction related to laws and regulations. |
| category | string | Yes | The jurisdiction/category code for the laws to query (e.g. \"PH\"). |

### Example Request Body
```json
{
  "prompt": "Can you explain your purpose?",
  "category": "PH"
}
```

### Example cURL
```bash
curl --request POST \
  --url '{{base}}/api/v1/egov/integration/laws_and_regulations/generate' \
  --header 'Authorization: Bearer {{hackathon_token}}' \
  --header 'Content-Type: application/json' \
  --data '{ "prompt": "Can you explain your purpose?", "category": "PH" }'
```

### Example Responses

**200 - OK**
```json
{
  "data": "Ako ay isang eGovPH AI Assistant na nilikha upang tulungan ang mga mamamayang Pilipino...",
  "session_id": "6220bc87-0ba9-4fd9-9fda-d5c44b31a061"
}
```
Errors: 401 Unauthorized.

## Endpoint: Translator

**POST** `{{base}}/api/v1/egov/integration/translator/generate`

Translates a given text prompt from one language to another. Accepts a source language, a target language, and the text to be translated, then returns the translated (and transliterated) output.

Authentication: Bearer Token — `{{hackathon_token}}`

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| prompt | string | Yes | The text content to be translated. |
| source_lang | string | Yes | The language code of the input text (e.g. \"en\"), ISO 639-1. |
| target_lang | string | Yes | The language code of the desired output language (e.g. \"fil\"), ISO 639-1. |

### Example Request Body
```json
{
  "prompt": "How should the education system adapt to prepare future generations to thrive in a world when human AI collaboration is a norm?",
  "source_lang": "en",
  "target_lang": "fil"
}
```

### Example cURL
```bash
curl --request POST \
  --url '{{base}}/api/v1/egov/integration/translator/generate' \
  --header 'Authorization: Bearer {{hackathon_token}}' \
  --header 'Content-Type: application/json' \
  --data '{ "prompt": "...", "source_lang": "en", "target_lang": "fil" }'
```

### Example Responses

**200 - OK**
```json
{
  "original_prompt": "How should the education system adapt to prepare future generations to thrive in a world when human AI collaboration is a norm?",
  "source_lang": "en",
  "target_lang": "fil",
  "translate_from": { "code": "en", "label": "English" },
  "translated_prompt": "Paano dapat umangkop ang sistema ng edukasyon...",
  "transliterated_prompt": "Paano dapat umangkop ang sistema ng edukasyon..."
}
```
Errors: 401 Unauthorized.

## Endpoint: Document Extractor

**POST** `{{base}}/api/v1/egov/integration/document_extractor/generate`

Extracts structured information from an uploaded document image or file using AI-powered OCR and document analysis (e.g. photo of an ID, driver's license, or other government document).

Authentication: Bearer Token — `{{hackathon_token}}`

### Request Body (multipart/form-data)

| Field | Type | Required | Description |
|---|---|---|---|
| file | File | Yes | The document file to be processed (e.g. image of an ID, license, or any government document). Supported types typically include JPEG, PNG, and PDF. |

### Example cURL
```bash
curl --request POST \
  --url '{{base}}/api/v1/egov/integration/document_extractor/generate' \
  --header 'Authorization: Bearer {{hackathon_token}}'
```

### Example Responses

**200 - OK** — returns `{ "data": "<HTML-formatted string listing extracted fields>" }`. Sample extraction from a Philippine driver's license includes fields such as Document Type, Issuing Authority, License Type, Name, Nationality, Sex, Date of Birth, Address, License No., Expiration Date, Blood Type, Restrictions, and Conditions.

Errors: 401 Unauthorized.

## Endpoint: Token Credits

**GET** `{{base}}/api/v1/egov/integration/credits`

Retrieves the current token credit balance associated with the authenticated hackathon participant or team, for monitoring API usage.

Authentication: Bearer Token — `{{hackathon_token}}`

No request body/query parameters required.

### Example cURL
```bash
curl --request GET \
  --url '{{base}}/api/v1/egov/integration/credits' \
  --header 'Authorization: Bearer {{hackathon_token}}'
```

### Example Responses

**200 - OK**
```json
{
  "credits_total": 200,
  "credits_used": 5,
  "credits_remaining": 195,
  "expires_at": "2026-07-10T23:33:34.000+08:00"
}
```
Errors: 401 Unauthorized.
"