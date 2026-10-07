/**
 * DataVault — Demo network specification (spec §4, §31).
 * 3 hospitals, 3 banks, 3 farm groups + research core. 100% synthetic data.
 */
import type { DatasetSpec } from "./synthetic-data";

export interface OrgSpec {
  name: string;
  slug: string;
  type: string;
  industry: string;
  location: string;
  description: string;
  domain: "HEALTHCARE" | "FINANCE" | "AGRICULTURE" | "RESEARCH";
}

export const ORGS: OrgSpec[] = [
  {
    name: "Apollo Demo Hospital", slug: "hospital-a", type: "Hospital", industry: "Healthcare",
    location: "Chennai, IN", domain: "HEALTHCARE",
    description: "Synthetic demo hospital network with an oncology research division. All patient records are generated synthetic data.",
  },
  {
    name: "AIIMS Demo Center", slug: "hospital-b", type: "Hospital", industry: "Healthcare",
    location: "New Delhi, IN", domain: "HEALTHCARE",
    description: "Synthetic demo medical research center focused on diagnostic biomarkers. All records are generated synthetic data.",
  },
  {
    name: "Max Demo Research Lab", slug: "hospital-c", type: "Research Institution", industry: "Healthcare",
    location: "Mumbai, IN", domain: "HEALTHCARE",
    description: "Synthetic demo clinical research lab. All patient records are generated synthetic data.",
  },
  {
    name: "HDFC Demo Bank", slug: "bank-a", type: "Bank", industry: "Finance",
    location: "Mumbai, IN", domain: "FINANCE",
    description: "Synthetic demo retail bank monitoring card fraud. All transactions are generated synthetic data.",
  },
  {
    name: "ICICI Demo Bank", slug: "bank-b", type: "Bank", industry: "Finance",
    location: "Hyderabad, IN", domain: "FINANCE",
    description: "Synthetic demo universal bank with digital payments telemetry. All transactions are generated synthetic data.",
  },
  {
    name: "SBI Demo Regional", slug: "bank-c", type: "Bank", industry: "Finance",
    location: "Kolkata, IN", domain: "FINANCE",
    description: "Synthetic demo regional banking circle. All transactions are generated synthetic data.",
  },
  {
    name: "Green Valley Farm Group", slug: "farm-a", type: "Agricultural Organization", industry: "Agriculture",
    location: "Nashik, IN", domain: "AGRICULTURE",
    description: "Synthetic demo farmer collective optimizing crop yield. All field data is generated synthetic data.",
  },
  {
    name: "Deccan Agri Collective", slug: "farm-b", type: "Agricultural Organization", industry: "Agriculture",
    location: "Hyderabad, IN", domain: "AGRICULTURE",
    description: "Synthetic demo agri cooperative on precision farming. All field data is generated synthetic data.",
  },
  {
    name: "Punjab Farm Co-op", slug: "farm-c", type: "Agricultural Organization", industry: "Agriculture",
    location: "Ludhiana, IN", domain: "AGRICULTURE",
    description: "Synthetic demo farming cooperative. All field data is generated synthetic data.",
  },
  {
    name: "DataVault Research Core", slug: "datavault-core", type: "Research Institution", industry: "Research",
    location: "Bengaluru, IN", domain: "RESEARCH",
    description: "Platform coordinator organization (demo). Runs the secure aggregator and model registry.",
  },
];

/**
 * Non-IID dataset specs per participant — deliberately biased so the demo
 * shows why siloed models generalize poorly and federation wins.
 */
export const PARTICIPANT_SPECS: Record<string, DatasetSpec> = {
  "hospital-a": {
    domain: "HEALTHCARE", featureNames: [], targetName: "cancer_risk", task: "CLASSIFICATION", samples: 900, seed: 1101,
    bias: { featureShifts: [12, 2.5, 8, 25, 0.6, 1.5, 3, 0, 0.08, 0.4, 0.2, 0.3], classPriorShift: 0.42, noise: 0.26 },
  },
  "hospital-b": {
    domain: "HEALTHCARE", featureNames: [], targetName: "cancer_risk", task: "CLASSIFICATION", samples: 650, seed: 1102,
    bias: { featureShifts: [-6, 4, -10, -18, -0.4, -1.2, -2.5, 0, -0.05, -0.3, -0.1, -0.2], classPriorShift: -0.38, noise: 0.34 },
  },
  "hospital-c": {
    domain: "HEALTHCARE", featureNames: [], targetName: "cancer_risk", task: "CLASSIFICATION", samples: 1100, seed: 1103,
    bias: { featureShifts: [3, -1.5, 4, 10, 0.2, 0.5, 1, 0, 0.02, 0.1, 0, 0.1], classPriorShift: 0.08, noise: 0.22 },
  },
  "bank-a": {
    domain: "FINANCE", featureNames: [], targetName: "is_fraud", task: "CLASSIFICATION", samples: 1400, seed: 2201,
    bias: { featureShifts: [180, 0.12, 3, 0.8, 0.08, 0.05, 2, 0.07], classPriorShift: 0.2, noise: 0.3 },
  },
  "bank-b": {
    domain: "FINANCE", featureNames: [], targetName: "is_fraud", task: "CLASSIFICATION", samples: 1000, seed: 2202,
    bias: { featureShifts: [-220, -0.1, -2, -0.5, -0.06, -0.04, -3, -0.05], classPriorShift: -0.3, noise: 0.36 },
  },
  "bank-c": {
    domain: "FINANCE", featureNames: [], targetName: "is_fraud", task: "CLASSIFICATION", samples: 1200, seed: 2203,
    bias: { featureShifts: [60, 0.03, 1, 0.2, 0, 0, 1, 0.02], classPriorShift: 0.05, noise: 0.27 },
  },
  "farm-a": {
    domain: "AGRICULTURE", featureNames: [], targetName: "yield_t_per_ha", task: "REGRESSION", samples: 800, seed: 3301,
    bias: { featureShifts: [150, 0.06, 0.5, 2.5, 15, 0, 1.5], classPriorShift: 0.14, noise: 0.32 },
  },
  "farm-b": {
    domain: "AGRICULTURE", featureNames: [], targetName: "yield_t_per_ha", task: "REGRESSION", samples: 700, seed: 3302,
    bias: { featureShifts: [-180, -0.05, -0.6, -2, -12, 0, -1.2], classPriorShift: -0.12, noise: 0.35 },
  },
  "farm-c": {
    domain: "AGRICULTURE", featureNames: [], targetName: "yield_t_per_ha", task: "REGRESSION", samples: 950, seed: 3303,
    bias: { featureShifts: [40, 0.02, 0.2, 1, 6, 0, 0.5], classPriorShift: 0.04, noise: 0.28 },
  },
};

export interface ModelSpec {
  name: string;
  slug: string;
  useCase: string;
  industry: string;
  taskType: "CLASSIFICATION" | "REGRESSION";
  description: string;
  participants: string[]; // org slugs
  seedRounds: number; // historical rounds run at demo-init time
}

export const MODELS: ModelSpec[] = [
  {
    name: "Cancer Risk Prediction", slug: "cancer-risk",
    useCase: "Binary classification of elevated cancer risk from synthetic biomarkers",
    industry: "Healthcare", taskType: "CLASSIFICATION",
    description: "Federated cancer-risk classifier trained across three hospital environments without any patient record leaving a hospital. 100% synthetic data.",
    participants: ["hospital-a", "hospital-b", "hospital-c"],
    seedRounds: 7,
  },
  {
    name: "Card Fraud Detection", slug: "fraud-detection",
    useCase: "Real-time fraud vs legitimate transaction classification",
    industry: "Finance", taskType: "CLASSIFICATION",
    description: "Cross-bank federated fraud model — banks co-train on their own synthetic transaction streams, sharing only protected model updates.",
    participants: ["bank-a", "bank-b", "bank-c"],
    seedRounds: 4,
  },
  {
    name: "Crop Yield Prediction", slug: "crop-yield",
    useCase: "Regional crop yield regression (t/ha) from soil & weather features",
    industry: "Agriculture", taskType: "REGRESSION",
    description: "Federated yield prediction across farmer collectives. Rewards redeem for seed & fertilizer subsidies (demo concept).",
    participants: ["farm-a", "farm-b", "farm-c"],
    seedRounds: 5,
  },
];

export interface DemoUserSpec {
  email: string;
  name: string;
  role: "ADMIN" | "ORG_ADMIN" | "ML_OPERATOR" | "PARTICIPANT" | "VIEWER";
  org: string; // slug
  password: string;
}

export const DEMO_USERS: DemoUserSpec[] = [
  { email: "admin@datavault.demo", name: "Ada Platform", role: "ADMIN", org: "datavault-core", password: "demo1234" },
  { email: "alice@apollo.demo", name: "Alice Rao", role: "ORG_ADMIN", org: "hospital-a", password: "demo1234" },
  { email: "arjun@aiims.demo", name: "Arjun Mehta", role: "ORG_ADMIN", org: "hospital-b", password: "demo1234" },
  { email: "priya@max.demo", name: "Priya Nair", role: "ORG_ADMIN", org: "hospital-c", password: "demo1234" },
  { email: "vikram@hdfc.demo", name: "Vikram Shah", role: "ORG_ADMIN", org: "bank-a", password: "demo1234" },
  { email: "meera@greenvalley.demo", name: "Meera Iyer", role: "ORG_ADMIN", org: "farm-a", password: "demo1234" },
  { email: "raj@datavault.demo", name: "Raj Malhotra", role: "ML_OPERATOR", org: "datavault-core", password: "demo1234" },
  { email: "sunita@aiims.demo", name: "Sunita Devi", role: "PARTICIPANT", org: "hospital-b", password: "demo1234" },
  { email: "karan@icici.demo", name: "Karan Patel", role: "PARTICIPANT", org: "bank-b", password: "demo1234" },
  { email: "viewer@datavault.demo", name: "Guest Viewer", role: "VIEWER", org: "datavault-core", password: "demo1234" },
];

export const DATASETS: Record<string, { name: string; privacyClassification: string }> = {
  "hospital-a": { name: "Apollo Synthetic Oncology Records", privacyClassification: "RESTRICTED" },
  "hospital-b": { name: "AIIMS Synthetic Biomarker Cohort", privacyClassification: "RESTRICTED" },
  "hospital-c": { name: "Max Synthetic Clinical Trials", privacyClassification: "CONFIDENTIAL" },
  "bank-a": { name: "HDFC Synthetic Card Transactions", privacyClassification: "RESTRICTED" },
  "bank-b": { name: "ICICI Synthetic Payment Streams", privacyClassification: "RESTRICTED" },
  "bank-c": { name: "SBI Synthetic Regional Transactions", privacyClassification: "CONFIDENTIAL" },
  "farm-a": { name: "Green Valley Synthetic Field Data", privacyClassification: "INTERNAL" },
  "farm-b": { name: "Deccan Synthetic Crop Telemetry", privacyClassification: "INTERNAL" },
  "farm-c": { name: "Punjab Synthetic Farm Records", privacyClassification: "INTERNAL" },
};
