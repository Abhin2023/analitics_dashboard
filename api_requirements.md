# API Requirements — Break Protection Analytics

**Project:** Break Protection Analytics Dashboard  
**Prepared:** 21 August 2026  
**Base URL:** `/api/v1`  
**Auth:** Bearer token (JWT) in `Authorization` header

---

## Global Conventions

### Date Filtering

Every report API that involves dates **must** accept the following query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `from_date` | `string` (`YYYY-MM-DD`) | Start of the date range (inclusive) |
| `to_date` | `string` (`YYYY-MM-DD`) | End of the date range (inclusive) |

**Supported usage patterns (frontend will send):**

- **Single day:** `from_date=2026-08-15&to_date=2026-08-15`
- **Full month:** `from_date=2026-08-01&to_date=2026-08-31`
- **Custom range:** `from_date=2026-07-21&to_date=2026-08-21`

### Data Completeness

We do not have full visibility into all the columns stored in each database table. For every API:

- **Return ALL columns/fields** from the respective database table.
- The fields listed in each section are the **minimum known fields**. If the table has more columns, include them all.
- Similarly, the **query parameters/filters** listed are the minimum known ones. If additional columns exist that can be used as filters, support them as well.
- Use clear, consistent field naming (snake_case) for all fields.

---

## 1. Daily Sales Data (Dashboard Feed)

The analytics dashboard currently reads daily store-level performance data from Google Sheets. This needs to be replaced with **live data from the application**.

### `GET /api/v1/daily-sales`

**Source table:** Daily Sales / Store Operations table — return **all columns** from this table.

#### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `from_date` | Start date (`YYYY-MM-DD`) |
| `to_date` | End date (`YYYY-MM-DD`) |
| `store` | Filter by store name |
| `tl` | Filter by team leader name |
| `country` | Filter by country |
| `...` | **+ any other filterable columns from this table** |

#### Minimum Expected Fields (include all columns from this table)

| Field | Type | Description |
|-------|------|-------------|
| `date` | `string` (`YYYY-MM-DD`) | The date this record belongs to |
| `store` | `string` | Store name |
| `tl` | `string` | Team Leader name assigned to the store |
| `country` | `string` | Country where the store is located |
| `revenue` | `number` | Daily revenue in local currency |
| `monthly_target` | `number` | Monthly revenue target for the store |
| `units_sold` | `integer` | Number of units/devices sold |
| `care_plus_attached` | `integer` | Number of Care+ protection plans sold |
| `new_leads` | `integer` | New leads generated on this day |
| `active_leads` | `integer` | Currently active leads count |
| `calls_made` | `integer` | Total outbound calls made |
| `calls_connected` | `integer` | Calls that were answered/connected |
| `walk_ins` | `integer` | Number of customers who walked into the store |
| `walk_in_conversions` | `integer` | Walk-ins that converted into sales |
| `staff_on_duty` | `integer` | Number of staff working on this day |
| `training_done` | `boolean` | Whether staff training was conducted |
| `training_topic` | `string` | Topic of the training (if any) |
| `stock_opening` | `integer` | Opening stock count for the day |
| `stock_received` | `integer` | New stock received during the day |
| `stock_sold` | `integer` | Stock sold during the day |
| `stock_closing` | `integer` | Closing stock count |
| `stock_variance` | `integer` | Variance between expected and actual stock |
| `cash_opening` | `number` | Cash register opening balance |
| `cash_sales` | `number` | Total cash sales amount |
| `bank_deposit` | `number` | Amount deposited to bank |
| `petty_cash_note` | `string` | Notes about petty cash usage |
| `cash_closing` | `number` | Cash register closing balance |
| `installations` | `integer` | Number of installations completed |
| `service_calls` | `integer` | Number of service calls attended |
| `complaints_in` | `integer` | Number of complaints received |
| `complaints_resolved` | `integer` | Number of complaints resolved |
| `app_updated` | `boolean` | Whether the system app was updated |
| `notes` | `string` | Any additional operational notes |
| `...` | | **+ all other columns from this table** |

#### What the dashboard calculates from this data

- Total Revenue / Target / Achievement %
- Store-wise MTD achievement rankings
- Team Leader performance comparison
- Walk-in conversion rates
- Revenue trend over date range
- RAG status distribution (Green ≥65%, Amber 35–64%, Red <35%)

---

## 2. Sales Report

### `GET /api/v1/reports/sales`

**Source table:** Sales / Purchase table — return **all columns** from this table.

#### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `from_date` | Start date (`YYYY-MM-DD`) |
| `to_date` | End date (`YYYY-MM-DD`) |
| `company` | Filter by company |
| `shop` | Filter by shop |
| `purchase_type` | Filter by purchase type (e.g., `New Sale`, `Replacement`) |
| `sale_type` | Filter by sale type |
| `terms_condition` | Filter by terms condition |
| `model` | Filter by device model |
| `invoice_only` | If `true`, return only invoiced sales |
| `...` | **+ any other filterable columns from this table** |

#### Minimum Expected Fields (include all columns from this table)

| Field | Type | Description |
|-------|------|-------------|
| `shop_name` | `string` | Name of the shop where the sale occurred, including location |
| `purchase_id` | `integer` | Unique identifier for the purchase/transaction |
| `created_date` | `string` (`YYYY-MM-DD`) | Date when the sale was created |
| `customer_name` | `string` | Full name of the customer |
| `mobile_number` | `string` | Customer's mobile/phone number |
| `model` | `string` | Device model name |
| `purchase_category` | `string` | Category of the purchase — values like `New Sale`, `Replacement` |
| `...` | | **+ all other columns from this table** |

---

## 3. Device Damage Report

### `GET /api/v1/reports/device-damage`

**Source table:** Device Damage table — return **all columns** from this table.

#### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `from_date` | Start date (`YYYY-MM-DD`) |
| `to_date` | End date (`YYYY-MM-DD`) |
| `country` | Filter by country (e.g., `UAE`, `INDIA`). Omit or send `all` for all countries |
| `...` | **+ any other filterable columns from this table** |

#### Minimum Expected Fields (include all columns from this table)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `integer` | Unique identifier for the damage record |
| `device_name` | `string` | Name/model of the damaged device |
| `imei_number` | `string` | IMEI number of the device |
| `shop_name` | `string` | Shop that reported the damage |
| `purchased_shop` | `string` | Shop where the device was originally purchased |
| `country` | `string` | Country of the shop |
| `purchase_date` | `string` (`YYYY-MM-DD`) | Date of original purchase |
| `service_fee` | `number` | Service fee amount |
| `service_completed` | `string` | Current service status — values like `Pending`, `Completed` |
| `...` | | **+ all other columns from this table** |

---

## 4. Sales Return Report (Refund & Cancel)

### `GET /api/v1/reports/sales-return`

**Source table:** Sales Return / Refund & Cancel table — return **all columns** from this table.

#### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `from_date` | Start date (`YYYY-MM-DD`) |
| `to_date` | End date (`YYYY-MM-DD`) |
| `company` | Filter by company |
| `shop` | Filter by shop |
| `status` | Filter by status (e.g., `Pending`, `Approved`, `Rejected`). Omit or send `all` for all statuses |
| `...` | **+ any other filterable columns from this table** |

#### Minimum Expected Fields (include all columns from this table)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `integer` | Row number / sequential identifier |
| `purchase_id` | `integer` | Original purchase/transaction ID |
| `customer_name` | `string` | Full name of the customer |
| `imei` | `string` | IMEI number of the returned device |
| `model` | `string` | Device model name |
| `product_name` | `string` | Name of the product/protection plan |
| `purchased_shop` | `string` | Shop where the original purchase was made |
| `shop` | `string` | Shop initiating the return request |
| `amount` | `number` | Refund/return amount |
| `status` | `string` | Current status — `Pending`, `Approved`, `Rejected` |
| `request_date` | `string` (`YYYY-MM-DD`) | Date the return was requested |
| `requested_by` | `string` | Name of the person/shop who requested the return |
| `processed_date` | `string` or `null` | Date the return was processed (null if not yet processed) |
| `approved_by` | `string` or `null` | Name of the person who approved/rejected (null if not yet actioned) |
| `rejection_reason` | `string` or `null` | Reason for rejection (null if not rejected) |
| `...` | | **+ all other columns from this table** |

---

## 5. Material Damage Report

### `GET /api/v1/reports/material-damage`

**Source table:** Material Damage table — return **all columns** from this table.

#### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `from_date` | Start date (`YYYY-MM-DD`) |
| `to_date` | End date (`YYYY-MM-DD`) |
| `company` | Filter by company |
| `shop` | Filter by shop |
| `brand` | Filter by device brand |
| `model` | Filter by device model |
| `damage_type` | Filter by type of damage |
| `...` | **+ any other filterable columns from this table** |

#### Minimum Expected Fields (include all columns from this table)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `integer` | Unique identifier / purchase reference number |
| `model` | `string` | Device model name |
| `purchase_date` | `string` (`YYYY-MM-DD`) | Date of the original purchase |
| `design` | `string` | Type of protection material/design applied |
| `shop` | `string` | Shop where the damage was reported |
| `salesman` | `string` | Name of the salesman or sales branch |
| `...` | | **+ all other columns from this table** |

---

## 6. Stock Request

### `GET /api/v1/stock/requests`

**Source table:** Stock Request table — return **all columns** from this table.

#### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `status` | Filter by request status — `Pending`, `Approved`, `AdminRejected`, `Dispatched`, `Received`, `All` |
| `...` | **+ any other filterable columns from this table** |

#### Minimum Expected Fields (include all columns from this table)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `integer` | Unique stock request ID |
| `shop_name` | `string` | Name of the shop that placed the stock request |
| `warehouse_name` | `string` | Name of the warehouse the request is directed to |
| `request_date` | `string` (`YYYY-MM-DD`) | Date of the request |
| `status` | `string` | Current status — `Pending`, `Approved`, `AdminRejected`, `Dispatched`, `Received` |
| `...` | | **+ all other columns from this table** |

---

## 7. Filter/Dropdown Option Endpoints

The frontend uses several dropdown filters. The backend needs to provide endpoints that return the available options.

| Endpoint | Returns |
|----------|---------|
| `GET /api/v1/filters/companies` | List of all companies |
| `GET /api/v1/filters/shops` | List of shops (optional `company` param to filter by company) |
| `GET /api/v1/filters/brands` | List of all device brands |
| `GET /api/v1/filters/models` | List of device models (optional `brand` param to filter by brand) |
| `GET /api/v1/filters/countries` | List of all countries |
| `GET /api/v1/filters/damage-types` | List of damage types |
| `GET /api/v1/filters/purchase-types` | List of purchase types |
| `GET /api/v1/filters/stock-request-statuses` | List of stock request status values |

---

## 8. Export Endpoints

Some reports support data export (Excel). Provide download endpoints that accept the **same filters** as their respective list endpoints but return a file instead of JSON.

| Endpoint | Format | Notes |
|----------|--------|-------|
| `GET /api/v1/reports/sales/export` | `.xlsx` | Same query params as Sales Report |
| `GET /api/v1/reports/device-damage/export` | `.xlsx` | Same query params as Device Damage Report |
| `GET /api/v1/reports/material-damage/export` | `.xlsx` | Same query params as Material Damage Report |

---

## Summary Table

| # | Endpoint | Method | Date Filter | Other Filters |
|---|----------|--------|-------------|---------------|
| 1 | `/api/v1/daily-sales` | GET | ✅ | store, tl, country, etc. |
| 2 | `/api/v1/reports/sales` | GET | ✅ | company, shop, purchase_type, sale_type, model, etc. |
| 3 | `/api/v1/reports/device-damage` | GET | ✅ | country, etc. |
| 4 | `/api/v1/reports/sales-return` | GET | ✅ | company, shop, status, etc. |
| 5 | `/api/v1/reports/material-damage` | GET | ✅ | company, shop, brand, model, damage_type, etc. |
| 6 | `/api/v1/stock/requests` | GET | — | status, etc. |
| 7 | `/api/v1/filters/*` | GET | — | Dropdown option lists |
| 8 | `/api/v1/reports/*/export` | GET | Same as parent | Same as parent |
