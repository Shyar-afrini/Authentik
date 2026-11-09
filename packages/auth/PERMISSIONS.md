# Nexus permission subjects

Feature-level RBAC uses CASL **actions** (`manage`, `create`, `read`, `update`, `delete`) on **subjects**.

## Domain subjects

| Subject | Meaning |
| --- | --- |
| `Organization` | Org settings, members, invitations |
| `Accounting` | All accounting features (inheritance) |
| `Inventory` | All inventory features |
| `Hrm` | All HRM features |
| `Crm` | All CRM features |
| `Pos` | All POS features |
| `Manufacturing` | All manufacturing features (Bom, WorkOrder, MfgMaster, MfgDocument) |
| `Projects` | All project features (Project, ProjectTask, Timesheet) |
| `Community` | Gated-community features (Community, CommunityMaster, CommunityDocument) |
| `Files` | File uploads and attachments (File) |
| `all` | Platform-wide (platform admin only) |

Managing a domain subject grants the same action on every feature listed below.

## Accounting features

Account, Approval, AuditLog, Budget, CostCenter, Currency, Customer, Expense, Install, AccountingInventory, Journal, Party, AccountingPayroll, Period, PurchaseInvoice, Report, SalesInvoice, Supplier, Tax, Voucher

## CRM features

CrmActivity, Commission, CrmCustomer, CrmDashboard, Lead, Marketing, CrmOrganization, PurchaseOrder, Quotation, RequestForQuotation, CrmSale, SalesOrder, SupplierQuotation, SupportTicket

Role templates: **`sales`** → sell-side features; **`buyer`** → PurchaseOrder / RFQ / SupplierQuotation (+ CrmCustomer).

## HRM features

Attendance, Development, Employee, Employment, ExpenseClaim, Leave, HrmOps, HrmOrganization, HrmPayroll, Recruitment

## Inventory features

Catalog, InventoryOperation, StockDocument, Warehouse

## POS features

PosAudit, BusinessDay, Cash, PosCatalog, PosConfiguration, PosCustomer, PosDashboard, PosDocument, PosProfile, Discount, Exchange, Offline, PaymentMethod, Payment, Promotion, Receipt, Register, PosReport, Return, PosSale, PosSession, Store, Terminal

## Role baselines

| Role | Baseline |
| --- | --- |
| `owner` / `admin` | `manage` on every domain |
| `member` | **least privilege**: `read` on every domain only — writes via matrix allow cells |
| `accountant`, `cashier`, `warehouse`, `sales`, `buyer`, `hr`, `expense_clerk` | job templates in `ROLE_TEMPLATES` |

Unknown free-text roles still map via `ROLE_ALIASES` or fall back to full `manage` (legacy). Prefer assigning a catalog `MEMBER_ROLES` value.

## Member overrides

Org owners/admins edit a Desk matrix (**Users → Permissions**) backed by `auth.member_permission`. Cells: inherit (role) | allow | deny. **Deny** wins over role grants; **allow** adds grants beyond the role. `manage` covers approve/post-style Nest routes. Catalog: `GET /auth/permission-catalog`; preview: `GET /auth/members/:id/permissions/effective`.

## Feature implies (companions)

**Product rules** (`FEATURE_IMPLIES` / `FEATURE_IMPLIES_WRITE` in `catalog.ts`): unlock only companions required to sell or invoice — not whole domains. Granting an operational feature unlocks:

| Grant | Also gets (`read`, + `manage` if source is manage) |
| --- | --- |
| `PosSale` | `PosDashboard`, `Store`, `Terminal`, `Register`, `PosSession`, `PaymentMethod`, `PosCatalog`, `PosCustomer`, `Receipt`, `Discount` |
| `PosSale` create/update/manage | also `create` + `update` on `PosSession` (open/close register) |
| `SalesOrder` / `CrmSale` | `CrmDashboard` |

POS matrix **Sales** read/create is enough for the sell screen bootstrap and dashboard summary.

## Route × ability CI

`node scripts/check-require-ability.mjs` fails if a mutating Nest route (`@Post`/`@Patch`/`@Put`/`@Delete`) under Accounting/CRM/HRM/IMS/POS only inherits class-level `read`. Every write must declare create/update/delete/manage.
