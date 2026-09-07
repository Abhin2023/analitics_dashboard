## Break Protection

Response to Analytics Dashboard API Requirements v1.0

What we can provide from the live system, and known gaps

## Analytics API — Deliverable Scope

| Prepared | 29 August 2026 |
| --- | --- |
| Base URL | /api/v1 |
| Authentication | OAuth 2.1 (Bearer JWT) — same auth as the MCP service |
| Version | 1.0 (scope response) |


## How to Read This Document

This document is our response to the Analytics Dashboard API Requirements. It maps each requested endpoint to what our live application can actually provide. We have prioritised returning accurate data we hold over matching every requested field, so the dashboard is built

- on real figures rather than placeholders. Each endpoint is marked with one of three statuses: ● AVAILABLE — we can deliver this from live data, close to as requested. ● PARTIAL — we can deliver part of it; some requested fields have no source in our system and are listed as gaps.

- NOT AVAILABLE — the underlying data is not captured in our application today.

## Two cross-cutting points that apply to every endpoint:

- Filters are ID-based, backed by master-data endpoints. Instead of free-text filters (e.g. shop=Kochi), report endpoints accept IDs (e.g. shop_id=42). The dropdown/option endpoints (Section 7) supply the {id, name} pairs the frontend uses to populate filters and send back IDs. This avoids ambiguity (duplicate names) and matches how our data is keyed.

- We return a defined field set, not “all columns”. For data-protection and stability reasons we expose a documented list of fields per endpoint rather than every raw database column (which include internal flags, audit and soft-delete columns, and customer PII). We are happy to add specific fields on request.


## Contents


## Global Conventions

## Authentication

All endpoints require a valid OAuth 2.1 bearer token, issued by the same authorization server used for the MCP service (validated against our AdminUsers). Unauthenticated requests receive 401 Unauthorized. Tokens are read-only scoped.

## Date filtering

Date-based endpoints accept from_date and to_date (both YYYY-MM-DD, inclusive), supporting single-day, full-month, and custom ranges, exactly as specified.

## Currency

Monetary values are returned in each shop's local currency. Amounts are not converted or normalised in these report endpoints; the country/currency is included so the dashboard can format and, if needed, convert. (Cross-currency normalisation exists in our MCP layer but is out of scope for these REST reports.)

## Naming

All fields use snake_case, as requested.


## 1. Daily Sales Data (Dashboard Feed)

## ● NOT AVAILABLE (as specified) — PARTIAL alternative offered

GET /api/v1/daily-sales

This is the most significant gap and needs discussion. The requested “Daily Sales / Store Operations” table does not exist in our application. As the requirement notes, this data currently lives in Google Sheets, and most of its fields are operational / call-centre / manual-entry data that our system does not capture.

Fields we CAN provide (derived from live data)

We can assemble a daily store-performance feed from our real tables (Purchases, ShopMonthlyTargets, ShopStockNew, CashBook/DayBook):

| Requested field | Source / note |
| --- | --- |
| date | Purchases.CreatedOn (aggregated per day) |
| store / store_id | Shopes |
| country / country_id | Countries |
| revenue | Sum of Purchases.Amount for the day (local currency) |
| monthly_target | ShopMonthlyTargets.TargetSale |
| units_sold | Count of Purchases for the day |
| care_plus_attached | Count where IsCarePlusCovered = true |
| installations | Count where InstallationStatus = done |
| stock_opening / received / | Partial — only if daily stock movement is logged; see Section |
| sold / closing | 6 note |
| cash_opening / cash_sales / | DayBook / CashBook (per shop, per day) |
| cash_closing |   |

Fields we CANNOT provide (no source in our system)

These are captured only in the current Google Sheet / manual process, not in the application:

tl (team leader), new_leads, active_leads, calls_made, calls_connected, walk_ins, walk_in_conversions, staff_on_duty, training_done, training_topic, service_calls, complaints_in, complaints_resolved, app_updated, petty_cash_note, stock_variance, notes.

Recommendation: split this feed into (a) the performance metrics we can serve live, and (b) the operational/CRM fields, which either stay in the Sheet or require a new data-capture process to be agreed. The dashboard’s revenue / target / achievement / RAG calculations can be fully supported from our data; the leads/calls/walk-ins/training analytics cannot, today.


## 2. Sales Report

- AVAILABLE — strong fit. Maps directly to our Purchases table.

GET /api/v1/reports/sales

## Filters (ID-based)

| Parameter | Type | Note |
| --- | --- | --- |
| from_date / to_date | date | Required range |
| company_id | int | was company (text) → now ID |
| shop_id | int | was shop |
| country_id | int | added |
| purchase_category_id | int | was purchase_type — New Sale/Replacement/etc. |
| purchase_type_id | int | was sale_type — Care Plus/BP/etc. |
| model_id | int | was model |
| payment_status | bool | paid / unpaid |

Note: the requested sale_type vs purchase_type distinction maps to our PurchaseType (product line) vs PurchaseCategory (transaction type). terms_condition and invoice_only are not currently modelled as filters — flagged as a minor gap.

## Fields returned

purchase_id, shop_name, shop_id, country, created_date, customer_name, mobile_number, model, model_id, purchase_category, purchase_type, amount, discount, sale_amount, payment_status, installation_status, is_care_plus_covered, imei_number.

Gap: terms_condition and invoice_only filtering — confirm whether these exist in the source system before we commit to them.


## 3. Device Damage Report

● PARTIAL — core data available; some service-workflow fields need confirmation.

GET /api/v1/reports/device-damage

Device-damage records live in Purchases under PurchaseCategory = DeviceDamage. We can filter by date and country_id. Fields we can provide

id, device_name (model), imei_number, shop_name, purchased_shop, country, purchase_date, service_fee, service_completed (status). Gap: service_fee and service_completed depend on whether a dedicated

device-damage/service table captures them. If damage service is only recorded as a purchase category without a fee/status workflow, those two fields may be limited or unavailable — to be

confirmed during build.


## 4. Sales Return Report (Refund & Cancel)

● PARTIAL — return records available; approval-workflow fields depend on what is captured.

GET /api/v1/reports/sales-return

Returns map to Purchases under PurchaseCategory = Return, linked to the original purchase via ParentPurchaseId, with reasons from ReplacementReasons. Filters: date, company_id, shop_id, status. Fields we can provide

id, purchase_id, customer_name, imei, model, product_name, purchased_shop, shop, amount, request_date. Gap: the approval-workflow fields — status, requested_by, processed_date, approved_by,

rejection_reason — are only available if a return-approval process is recorded in the database. If returns are captured as transactions without a formal approval trail, these fields will be null or

omitted. Needs confirmation against the returns/approval table.


## 5. Material Damage Report

- NEEDS INVESTIGATION — source table not yet confirmed.

GET /api/v1/reports/material-damage

“Material damage” (damage to the protective film/material rather than the device) is not clearly a distinct table in the reporting scope we have mapped. It may correspond to a design-position / replacement record, or to a category we have not yet catalogued.

Action: we need to identify the exact source table before committing. If it maps to replacement/design-position data we can likely serve id, model, purchase_date, design, shop, salesman; if it is a separate operational log, it may fall in the same category as Section 1 (not in the application). To be confirmed.


## 6. Stock Request

- AVAILABLE — maps to ShopStockRequestNew + status table.

GET /api/v1/stock/requests

Filter: status_id (from the stock-request status list, Section 7). Statuses come from our ShopStockRequestStatuses table — we will confirm the exact status values match the requested set (Pending, Approved, AdminRejected, Dispatched, Received).

## Fields returned

id, shop_name, shop_id, warehouse_name, warehouse_id, request_date, status,

processed_date.

Note: daily stock opening/received/sold/closing/variance (referenced in Section 1) is a different concern from stock *requests*. Request-level data is available; day-by-day stock movement per SKU may be limited depending on how movements are logged.


## 7. Filter / Dropdown Option Endpoints

- AVAILABLE — all master-data lookups exist. These underpin the ID-based filtering.

Each returns a list of { id, name } (plus relevant extra fields). The frontend populates dropdowns from these and sends the selected id back to the report endpoints.

| Endpoint | Returns | Source table |
| --- | --- | --- |
| /filters/companies | id, name, country_id | Companies |
| /filters/shops | id, name, company_id, | Shopes (optional company_id |
|   | country_id | filter) |
| /filters/brands | id, name | Brands |
| /filters/models | id, name, brand_id | Models (optional brand_id |
|   |   | filter) |
| /filters/countries | id, name, currency | Countries |
| /filters/purchase-categories | id, name | PurchaseCategory |
| /filters/purchase-types | id, name | PurchaseTypes |
| /filters/material-types | id, name | MaterialTypes |
| /filters/design-positions | id, name | DesignPositions |
| /filters/stock-request-statuse | id, name | ShopStockRequestStatuses |
| s |   |   |

Note: the requested /filters/damagetypes — we do not currently have a distinct “damage type” master table. To be confirmed alongside Section 5 (Material Damage).


## Summary of Deliverable Scope

| # Endpoint |   | Status | Note |
| --- | --- | --- | --- |
| 1 | /daily-sales | NOT AVAILABLE | Performance metrics yes; |
|   |   | (partial alt.) | leads/calls/walk-ins/training no |
| 2 | /reports/sales | AVAILABLE | Strong fit; minor gaps: |
|   |   |   | terms_condition, invoice_only |
| 3 | /reports/device-damage | PARTIAL | service_fee / service_completed |
|   |   |   | to confirm |
| 4 | /reports/sales-return | PARTIAL | approval-workflow fields to |
|   |   |   | confirm |
| 5 | /reports/material-damage NEEDS |   | source table not confirmed |
|   |   | INVESTIGATION |   |
| 6 | /stock/requests | AVAILABLE | status values to confirm |
| 7 | /filters/* | AVAILABLE | damagetypes to confirm |

## Open questions for the vendor

- Confirm the frontend will send IDs (not names) for all filters, populated from the Section 7 endpoints.

- For Daily Sales (Section 1): which fields must be live from our system vs. which can remain in the current Sheet / a separate process? The leads, calls, walk-ins, training, and complaints data is not in our application.

- For Device Damage / Sales Return: confirm whether service fees, service status, and the return approval trail (approved_by, rejection_reason, processed_date) are recorded, so we know if those fields can be populated.

- For Material Damage (Section 5) and damage types (Section 7): clarify the exact meaning and source so we can locate or rule out the data.

This document reflects the data available in the live application at time of writing. Fields marked “to confirm” will be resolved during implementation; fields marked “not available” require either a new data-capture process or a decision to source them elsewhere.
