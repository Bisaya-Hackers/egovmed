"# eReport API

Let citizens file and track complaints and reports: submit a complaint, verify by OTP, then list and view report status by case number.

Base URL: `{{base}}` (the base URL of the eReport API)

## Datasets

### GET Report Type List

`GET {{base}}/api/integration/datasets/report_types`

Retrieves a list of all available report types from the eReport integration datasets.

Authentication: Bearer Token — `{{integration_token}}`

No query parameters, path parameters, or request headers required.

Example cURL:
```bash
curl --request GET \
  --url '{{base}}/api/integration/datasets/report_types' \
  --header 'Authorization: Bearer {{integration_token}}'
```

Example response (200 OK) — list of report type objects, each with `code`, `name`, and metadata fields. 9 report types are defined: crime, red_tape, scam, child_abuse, women_abuse, overpricing, fire, accident, gas_station_concerns. Example item:
```json
{
  "type": "report_types",
  "id": "0ef6d51a-75be-4ff5-9259-e7f080504f48",
  "attributes": {
    "code": "crime",
    "name": "Crime",
    "sequence": 1,
    "is_visible": true,
    "is_active": true,
    "created_at": "Nov 04, 2025 06:28:54 PM"
  }
}
```
Errors: 401 Unauthorized, 500 Internal Server Error.

### GET Region List

`GET {{base}}/api/integration/datasets/regions`

Retrieves a list of available regions from the eReport dataset (for dropdowns, filters, or mapping region identifiers).

Authentication: Bearer Token — `{{integration_token}}`. No request body/query params required.

Example cURL:
```bash
curl --request GET \
  --url '{{base}}/api/integration/datasets/regions' \
  --header 'Authorization: Bearer {{integration_token}}'
```

Example response (200 OK) — 18 region objects, e.g.:
```json
{
  "data": [
    { "type": "regions", "id": "010000000", "attributes": { "name": "REGION I (ILOCOS REGION)" } },
    { "type": "regions", "id": "130000000", "attributes": { "name": "NATIONAL CAPITAL REGION (NCR)" } }
  ]
}
```
Errors: 401 Unauthorized, 403 Forbidden, 500 Internal Server Error.

### GET Province List by Params

`GET {{base}}/api/integration/datasets/provinces?region_code=040000000`

Retrieves a list of provinces filtered by a specified region code.

Authentication: Bearer Token — `{{integration_token}}`

Query Parameters:

| Parameter | Type | Required | Description |
|---|---|---|---|
| region_code | string | Yes | The region code used to filter the list of provinces. Example: 040000000 |

Example cURL:
```bash
curl --request GET \
  --url '{{base}}/api/integration/datasets/provinces?region_code=040000000' \
  --header 'Authorization: Bearer {{integration_token}}'
```

Example response (200 OK):
```json
{
  "data": [
    { "type": "provinces", "id": "041000000", "attributes": { "region_code": "040000000", "name": "BATANGAS" } },
    { "type": "provinces", "id": "042100000", "attributes": { "region_code": "040000000", "name": "CAVITE" } }
  ]
}
```
Errors: 401 Unauthorized (invalid/missing region_code).

### GET Municipality List by Params

`GET {{base}}/api/integration/datasets/municipalities?province_code=042100000`

Retrieves a list of municipalities filtered by a given province code.

Authentication: Bearer Token — `{{integration_token}}`

Query Parameters:

| Parameter | Type | Required | Description |
|---|---|---|---|
| province_code | string | Yes | The province code used to filter municipalities (e.g. 042100000) |

Example cURL:
```bash
curl --request GET \
  --url '{{base}}/api/integration/datasets/municipalities?province_code=042100000' \
  --header 'Authorization: Bearer {{integration_token}}'
```

Example response (200 OK):
```json
{
  "data": [
    { "type": "municipalities", "id": "042101000", "attributes": { "region_code": "040000000", "province_code": "042100000", "name": "ALFONSO" } }
  ]
}
```
Errors: 401 Unauthorized (invalid/missing province_code).

### GET Barangay List by Params

`GET {{base}}/api/integration/datasets/barangays?municipality_code=042111000`

Retrieves a list of barangays filtered by a specified municipality code.

Authentication: Bearer Token — `{{integration_token}}`, `{{base}}`

Query Parameters:

| Parameter | Type | Required | Description |
|---|---|---|---|
| municipality_code | string | Yes | The code of the municipality to filter barangays by. Example: 042111000 |

Example cURL:
```bash
curl --request GET \
  --url '{{base}}/api/integration/datasets/barangays?municipality_code=042111000' \
  --header 'Authorization: Bearer {{integration_token}}'
```

Example response (200 OK):
```json
{
  "data": [
    { "type": "barangays", "id": "042111014", "attributes": { "region_code": "040000000", "province_code": "042100000", "municipality_code": "042111000", "name": "Balsahan-Bisita" } }
  ]
}
```
Errors: 401 Unauthorized (invalid/missing municipality_code).

## Endpoint: Generate Token

**POST** `{{base}}/api/integration/token`

Generates an integration access token used to authenticate subsequent API requests.

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| access_code | string | Yes | A pre-issued access code that identifies and authorizes the integration. Set the access_code variable in your active environment before sending this request. |

Note: The included test script automatically captures the access_token from the response and saves it to the integration_token environment variable.

### Example Request Body
```json
{ "access_code": "{{access_code}}" }
```

### Example cURL
```bash
curl --request POST \
  --url '{{base}}/api/integration/token' \
  --header 'Content-Type: application/json' \
  --data '{ "access_code": "{{access_code}}" }'
```

### Example Responses

**200 - OK**
```json
{
  "access_token": "00000000-0000-0000-0000-000000000000",
  "expires_at": "2026-07-19T23:08:06.672+08:00"
}
```
Errors: 401 Unauthorized.

## Endpoint: Submit Complaint

**POST** `{{base}}/api/integration/submit_complaint`

Submits a new complaint report to the eReport system. Accepts complainant details, report classification, and optional evidence attachments along with the geographic location of the incident.

Authorization: Bearer Token — `{{integration_token}}`

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| mobile | string | Yes | Mobile number of the complainant (e.g. 639XXXXXXXXX). |
| first_name | string | Yes | First name of the complainant. |
| last_name | string | Yes | Last name of the complainant. |
| gender | string | Yes | Gender of the complainant (e.g. Male, Female). |
| complainant_email | string | Yes | Email address of the complainant. |
| report_type | string | Yes | Type/category of the report (e.g. crime). |
| subject | string | Yes | Brief subject or title of the complaint. |
| message | string | Yes | Detailed description of the complaint. |
| evidences | array of strings | No | List of image URLs to attach as evidence. |
| region_code | string | Yes | PSA region code of the incident location. |
| province_code | string | Yes | PSA province code of the incident location. |
| municipality_code | string | Yes | PSA municipality/city code of the incident location. |
| barangay_code | string | Yes | PSA barangay code of the incident location. |
| latitude | string | No | Latitude coordinate of the incident location. |
| longitude | string | No | Longitude coordinate of the incident location. |

### Example Request Body
```json
{
  "mobile": "639999999999",
  "first_name": "Juan",
  "last_name": "Dela Cruz",
  "gender": "Male",
  "complainant_email": "juan.delacruz@email.com",
  "report_type": "crime",
  "subject": "Test subject",
  "message": "Test message",
  "evidences": ["https://yavuzceliker.github.io/sample-images/image-1021.jpg"],
  "region_code": "040000000",
  "province_code": "042100000",
  "municipality_code": "042111000",
  "barangay_code": "042111011",
  "latitude": "14.60",
  "longitude": "120.98"
}
```

### Example cURL
```bash
curl --request POST \
  --url '{{base}}/api/integration/submit_complaint' \
  --header 'Authorization: Bearer {{integration_token}}' \
  --header 'Content-Type: application/json' \
  --data '{ ... see example body above ... }'
```

### Example Responses

**200 - OK**
```json
{
  "code": 200,
  "message": "We received your report. We'll get back to you.",
  "case_number": "PFM-071826-0014"
}
```
Errors: 401 Unauthorized (missing/invalid fields).

## Endpoint: Verify - Request OTP

**POST** `{{base}}/api/integration/verify/request`

Initiates an OTP (One-Time Password) verification flow by sending an OTP to the specified email address. First step in the email verification process.

Authorization: Bearer Token — `{{integration_token}}`

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| email | string | Yes | The email address to which the OTP will be sent. |

### Example Request Body
```json
{ "email": "juan.delacruz@email.com" }
```

### Example cURL
```bash
curl --request POST \
  --url '{{base}}/api/integration/verify/request' \
  --header 'Authorization: Bearer {{integration_token}}' \
  --header 'Content-Type: application/json' \
  --data '{ "email": "juan.delacruz@email.com" }'
```

### Example Responses

**200 - OK**
```json
{
  "code": 200,
  "already_verified": false,
  "message": "A 6-digit verification code has been sent to juan.delacruz@email.com. It expires in 5 minutes."
}
```
Errors: 401 Unauthorized (invalid/malformed email).

## Endpoint: Verify - Confirm OTP

**POST** `{{base}}/api/integration/verify/confirm`

Confirms an OTP sent to the user's email address as part of the integration verification flow. On success, returns a `report_view_token` which is automatically saved to the `integration_report_view_token` environment variable.

Authorization: Bearer Token — `{{integration_token}}`

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| email | string | Yes | The email address associated with the integration account. |
| otp | string | Yes | The one-time password received via email. |

### Example Request Body
```json
{ "email": "juan.delacruz@email.com", "otp": "000000" }
```

### Example cURL
```bash
curl --request POST \
  --url '{{base}}/api/integration/verify/confirm' \
  --header 'Authorization: Bearer {{integration_token}}' \
  --header 'Content-Type: application/json' \
  --data '{ "email": "juan.delacruz@email.com", "otp": "000000" }'
```

### Example Responses

**200 - OK**
```json
{
  "code": 200,
  "report_view_token": "00000000-0000-0000-0000-000000000000",
  "expires_at": "2026-07-19T01:36:59.944+08:00"
}
```
Errors: 401 Unauthorized (invalid/expired OTP).

## Endpoint: Reports List

**GET** `{{base}}/api/integration/reports`

Retrieves a paginated list of reports available to the integration.

### Headers

| Key | Value | Description |
|---|---|---|
| X-EReport-View-Token | {{integration_report_view_token}} | Integration report view token for authentication |

### Query Parameters

| Parameter | Default | Description |
|---|---|---|
| q | — | Optional search/filter string to narrow down results |
| page | 1 | Page number for pagination |
| limit | 25 | Number of reports to return per page |

### Example cURL
```bash
curl --request GET \
  --url '{{base}}/api/integration/reports' \
  --header 'X-EReport-View-Token: {{integration_report_view_token}}'
```

### Example Responses

**200 - OK**
```json
{
  "meta": { "pagination": { "total": 1, "per_page": 25, "current_page": 1, "total_pages": 1 } },
  "data": [
    {
      "type": "reports",
      "id": "00000000-0000-0000-0000-000000000000",
      "attributes": {
        "case_number": "PFM-071826-0014",
        "complainant": { "first_name": "Erick", "last_name": "Mann", "fullname": "Erick Mann", "phone_number": "639000000000", "gender": "Male", "email": "juan.delacruz@example.com" },
        "report_type": { "id": "0ef6d51a-75be-4ff5-9259-e7f080504f48", "code": "crime", "name": "Crime" },
        "subject": "consequatur",
        "message": "Quaerat consequatur vel eaque est ea nobis.",
        "address": {
          "region": { "code": "040000000", "name": "REGION IV-A (CALABARZON)" },
          "province": { "code": "042100000", "name": "CAVITE" },
          "municipality": { "code": "042111000", "name": "KAWIT" },
          "barangay": { "code": "042111011", "name": "Toclong" },
          "latitude": "14.60", "longitude": "120.98",
          "country_code": "PH", "country_name": "Philippines"
        },
        "status": "PENDING",
        "formatted_status": "Pending",
        "history": [],
        "created_at": "Jul 18, 2026 11:41:22 PM"
      }
    }
  ]
}
```
Errors: 401 Unauthorized (invalid/missing token).

## Endpoint: View Report by Case Number

**GET** `{{base}}/api/integration/reports/:case_number`

Retrieves the full details of a specific report using its case number.

### Headers

| Key | Value | Description |
|---|---|---|
| X-EReport-View-Token | {{integration_report_view_token}} | Required. Authorizes access to the report. |

### Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| case_number | string | Yes | The unique case number of the report to retrieve. |

### Example cURL
```bash
curl --request GET \
  --url '{{base}}/api/integration/reports/:case_number' \
  --header 'X-EReport-View-Token: {{integration_report_view_token}}'
```

### Example Responses

**200 - OK**
```json
{
  "data": {
    "id": "00000000-0000-0000-0000-000000000000",
    "case_number": "PFM-071826-0014",
    "complainant": { "first_name": "Erick", "last_name": "Mann", "fullname": "Erick Mann", "phone_number": "639000000000", "gender": "Male", "email": "juan.delacruz@example.com" },
    "report_type": { "id": "0ef6d51a-75be-4ff5-9259-e7f080504f48", "code": "crime", "name": "Crime" },
    "subject": "consequatur",
    "message": "Quaerat consequatur vel eaque est ea nobis.",
    "address": {
      "region": { "code": "040000000", "name": "REGION IV-A (CALABARZON)" },
      "province": { "code": "042100000", "name": "CAVITE" },
      "municipality": { "code": "042111000", "name": "KAWIT" },
      "barangay": { "code": "042111011", "name": "Toclong" },
      "latitude": "14.60", "longitude": "120.98",
      "country_code": "PH", "country_name": "Philippines"
    },
    "status": "PENDING",
    "formatted_status": "Pending",
    "history": [
      { "status": "PENDING", "formatted_status": "Pending", "remarks": null, "created_at": "Jul 18, 2026 11:41:22 PM" }
    ],
    "created_at": "Jul 18, 2026 11:41:22 PM"
  }
}
```
Errors: 401 Unauthorized (report not found or invalid token).
"