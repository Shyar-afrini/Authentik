export type Actions = "manage" | "create" | "read" | "update" | "delete";

/** Actions shown in the Desk permission matrix and Nest `@RequireAbility`. */
export const PERMISSION_ACTIONS = [
  "read",
  "create",
  "update",
  "delete",
  "manage",
] as const satisfies readonly Actions[];

export const DOMAIN_SUBJECTS = [
  "Organization",
  "Accounting",
  "Inventory",
  "Hrm",
  "Crm",
  "Pos",
  "Manufacturing",
  "Projects",
  "Community",
  "Files",
] as const;

export type DomainSubject = (typeof DOMAIN_SUBJECTS)[number];

export const ACCOUNTING_FEATURES = [
  "Account",
  "Approval",
  "AuditLog",
  "Budget",
  "CompanySetup",
  "CostCenter",
  "Currency",
  "Customer",
  "EmailDigest",
  "Expense",
  "Install",
  "AccountingInventory",
  "Journal",
  "Party",
  "AccountingPayroll",
  "Period",
  "PurchaseInvoice",
  "Report",
  "SalesInvoice",
  "Supplier",
  "Tax",
  "TransactionDeletion",
  "Voucher",
] as const;

export const CRM_FEATURES = [
  "CrmActivity",
  "Commission",
  "CrmCustomer",
  "CrmDashboard",
  "Lead",
  "Marketing",
  "CrmOrganization",
  "PurchaseOrder",
  "Quotation",
  "RequestForQuotation",
  "CrmSale",
  "SalesOrder",
  "SupplierQuotation",
  "SupportTicket",
] as const;

export const HRM_FEATURES = [
  "Attendance",
  "Development",
  "Employee",
  "Employment",
  "ExpenseClaim",
  "Leave",
  "HrmOps",
  "HrmOrganization",
  "HrmPayroll",
  "Recruitment",
] as const;

export const INVENTORY_FEATURES = [
  "Catalog",
  "InventoryOperation",
  "Logistics",
  "StockDocument",
  "Warehouse",
] as const;

export const POS_FEATURES = [
  "PosAudit",
  "BusinessDay",
  "Cash",
  "PosCatalog",
  "PosConfiguration",
  "PosCustomer",
  "PosDashboard",
  "PosDocument",
  "PosProfile",
  "Discount",
  "Exchange",
  "Offline",
  "PaymentMethod",
  "Payment",
  "Promotion",
  "Receipt",
  "Register",
  "PosReport",
  "Return",
  "PosSale",
  "PosSession",
  "Store",
  "Terminal",
] as const;

export const MANUFACTURING_FEATURES = ["Bom", "WorkOrder", "MfgMaster", "MfgDocument"] as const;

export const COMMUNITY_FEATURES = ["Community", "CommunityMaster", "CommunityDocument"] as const;
export const PROJECTS_FEATURES = ["Project", "ProjectTask", "Timesheet", "ProjectMaster", "ProjectDocument"] as const;

export const FILES_FEATURES = ["File"] as const;

export const FEATURES_BY_DOMAIN = {
  Accounting: ACCOUNTING_FEATURES,
  Crm: CRM_FEATURES,
  Hrm: HRM_FEATURES,
  Inventory: INVENTORY_FEATURES,
  Pos: POS_FEATURES,
  Manufacturing: MANUFACTURING_FEATURES,
  Projects: PROJECTS_FEATURES,
  Community: COMMUNITY_FEATURES,
  Files: FILES_FEATURES,
} as const satisfies Record<
  Exclude<DomainSubject, "Organization">,
  readonly string[]
>;

export type AccountingFeature = (typeof ACCOUNTING_FEATURES)[number];
export type CrmFeature = (typeof CRM_FEATURES)[number];
export type HrmFeature = (typeof HRM_FEATURES)[number];
export type InventoryFeature = (typeof INVENTORY_FEATURES)[number];
export type PosFeature = (typeof POS_FEATURES)[number];
export type ManufacturingFeature = (typeof MANUFACTURING_FEATURES)[number];
export type CommunityFeature = (typeof COMMUNITY_FEATURES)[number];
export type ProjectsFeature = (typeof PROJECTS_FEATURES)[number];
export type FilesFeature = (typeof FILES_FEATURES)[number];

export type FeatureSubject =
  | AccountingFeature
  | CrmFeature
  | HrmFeature
  | InventoryFeature
  | PosFeature
  | ManufacturingFeature
  | ProjectsFeature
  | CommunityFeature
  | FilesFeature;

export type Subjects = "all" | DomainSubject | FeatureSubject;

export type PermissionEffect = "allow" | "deny";

export type PermissionGrant = {
  action: Actions;
  subject: Subjects;
  effect?: PermissionEffect;
};

const ALL_FEATURE_SUBJECTS: FeatureSubject[] = [
  ...ACCOUNTING_FEATURES,
  ...CRM_FEATURES,
  ...HRM_FEATURES,
  ...INVENTORY_FEATURES,
  ...POS_FEATURES,
  ...MANUFACTURING_FEATURES,
  ...PROJECTS_FEATURES,
  ...COMMUNITY_FEATURES,
  ...FILES_FEATURES,
];

const SUBJECT_SET = new Set<string>([
  "all",
  ...DOMAIN_SUBJECTS,
  ...ALL_FEATURE_SUBJECTS,
]);

const ACTION_SET = new Set<string>([
  "manage",
  "create",
  "read",
  "update",
  "delete",
]);

export function isDomainSubject(subject: string): subject is DomainSubject {
  return (DOMAIN_SUBJECTS as readonly string[]).includes(subject);
}

export function isFeatureSubject(subject: string): subject is FeatureSubject {
  return ALL_FEATURE_SUBJECTS.includes(subject as FeatureSubject);
}

export function isValidSubject(subject: string): subject is Subjects {
  return SUBJECT_SET.has(subject);
}

export function isValidAction(action: string): action is Actions {
  return ACTION_SET.has(action);
}

export function domainForFeature(subject: FeatureSubject): Exclude<
  DomainSubject,
  "Organization"
> | null {
  for (const [domain, features] of Object.entries(FEATURES_BY_DOMAIN)) {
    if ((features as readonly string[]).includes(subject)) {
      return domain as Exclude<DomainSubject, "Organization">;
    }
  }
  return null;
}

/**
 * Product rules: when a feature is granted, also grant companions at least
 * `read` (and `manage` when the source grant is `manage`).
 *
 * Extend only for **required sell/invoice companions**, not whole domains.
 * PosSale companions cover sell-screen bootstrap (stores, terminals,
 * registers, sessions, catalog, tender, customers) so cashiers never 403
 * after only being given Sales read/create.
 *
 * See `packages/auth/PERMISSIONS.md` § Feature implies.
 */
export const FEATURE_IMPLIES: Partial<
  Record<FeatureSubject, readonly FeatureSubject[]>
> = {
  PosSale: [
    "PosDashboard",
    "Store",
    "Terminal",
    "Register",
    "PosSession",
    "PaymentMethod",
    "PosCatalog",
    "PosCustomer",
    "Receipt",
    "Discount",
  ],
  /** CRM sell-side features unlock the CRM overview. */
  SalesOrder: ["CrmDashboard"],
  CrmSale: ["CrmDashboard"],
};

/**
 * Subjects that also receive create/update when the source feature is granted
 * create, update, or manage (e.g. open/close a POS register session while selling).
 */
export const FEATURE_IMPLIES_WRITE: Partial<
  Record<FeatureSubject, readonly FeatureSubject[]>
> = {
  PosSale: ["PosSession"],
};

function manageDomain(domain: Exclude<DomainSubject, "Organization">): PermissionGrant[] {
  return [{ action: "manage", subject: domain }];
}

function manageFeatures(features: readonly FeatureSubject[]): PermissionGrant[] {
  return features.map((subject) => ({ action: "manage" as const, subject }));
}

function crudDomains(
  domains: Exclude<DomainSubject, "Organization">[],
  actions: Actions[],
): PermissionGrant[] {
  const grants: PermissionGrant[] = [];
  for (const domain of domains) {
    for (const action of actions) {
      grants.push({ action, subject: domain });
    }
  }
  return grants;
}

/** CRM sell-side features (not buying). */
export const CRM_SALES_FEATURES = [
  "CrmActivity",
  "Commission",
  "CrmCustomer",
  "CrmDashboard",
  "Lead",
  "Marketing",
  "CrmOrganization",
  "Quotation",
  "CrmSale",
  "SalesOrder",
  "SupportTicket",
] as const satisfies readonly CrmFeature[];

/** CRM buying / procurement features. */
export const CRM_BUYING_FEATURES = [
  "CrmCustomer",
  "PurchaseOrder",
  "RequestForQuotation",
  "SupplierQuotation",
] as const satisfies readonly CrmFeature[];

/**
 * Synonyms for free-text `member.role` → canonical {@link ROLE_TEMPLATES} keys.
 * Product names (`pos`, `crm`) map to job-style templates (`cashier`, `sales`).
 */
export const ROLE_ALIASES: Record<string, string> = {
  accounting: "accountant",
  pos: "cashier",
  inventory: "warehouse",
  crm: "sales",
  hrm: "hr",
  purchasing: "buyer",
  procurement: "buyer",
};

/** Default grants applied when memberRole is not owner/admin/member. */
export const ROLE_TEMPLATES: Record<string, PermissionGrant[]> = {
  accountant: manageDomain("Accounting"),
  expense_clerk: [
    { action: "read", subject: "Account" },
    { action: "read", subject: "Period" },
    { action: "read", subject: "Currency" },
    { action: "read", subject: "CostCenter" },
    { action: "read", subject: "Expense" },
    { action: "create", subject: "Expense" },
    { action: "update", subject: "Expense" },
  ],
  cashier: crudDomains(["Pos", "Inventory", "Crm"], ["read", "create", "update"]),
  warehouse: manageDomain("Inventory"),
  sales: manageFeatures(CRM_SALES_FEATURES),
  buyer: manageFeatures(CRM_BUYING_FEATURES),
  hr: manageDomain("Hrm"),
};

/** Roles assignable via Desk Users admin (org membership). */
export const MEMBER_ROLES = [
  "owner",
  "admin",
  "member",
  "accountant",
  "expense_clerk",
  "cashier",
  "warehouse",
  "sales",
  "buyer",
  "hr",
] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];

export function isMemberRole(value: string): value is MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(value);
}

/** Resolve `member.role` to a {@link ROLE_TEMPLATES} key (aliases applied). */
export function resolveRoleTemplateKey(memberRole: string): string {
  const role = memberRole.toLowerCase();
  return ROLE_ALIASES[role] ?? role;
}

/**
 * Raw template grants for a member role.
 * owner/admin → manage all domains; member → read all (least privilege);
 * job roles → {@link ROLE_TEMPLATES}. Writes for `member` come from matrix overrides.
 */
export function templateGrantsForRole(
  memberRole: string | null | undefined,
): PermissionGrant[] {
  const role = String(memberRole ?? "").toLowerCase();
  if (!role) return [];
  if (role === "owner" || role === "admin") {
    return DOMAIN_SUBJECTS.map((subject) => ({
      action: "manage" as const,
      subject,
    }));
  }
  if (role === "member") {
    return DOMAIN_SUBJECTS.map((subject) => ({
      action: "read" as const,
      subject,
    }));
  }
  const key = resolveRoleTemplateKey(role);
  return ROLE_TEMPLATES[key] ? [...ROLE_TEMPLATES[key]] : [];
}

/** Matrix catalog payload for Desk Users admin. */
export function permissionCatalogPayload() {
  const domains = (
    Object.keys(FEATURES_BY_DOMAIN) as Array<keyof typeof FEATURES_BY_DOMAIN>
  ).map((domain) => ({
    domain,
    features: [...FEATURES_BY_DOMAIN[domain]],
  }));
  return {
    actions: [...PERMISSION_ACTIONS],
    domains,
  };
}
