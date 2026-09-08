export const APP_NAME = "Lyca Fleet Tracker";
export const COMPANY = "Lyca Mobile";

/**
 * Feature switches.
 *
 * `photoCapture` — odometer snaps & fuel receipt uploads on the driver entry
 * form. Disabled for now; flip to `true` to restore capture everywhere
 * (form fields, upload validation and the API payload) with no other change.
 * Historical photos already on file stay viewable in the manager preview.
 */
export const FEATURES = {
  photoCapture: false,
} as const;

/** Roles permitted to approve / flag a mileage entry. */
export const APPROVER_ROLES = ["branch_manager", "super_admin"] as const;
export const APPROVER_LABEL = "Local office manager or fleet manager";

export const TRIP_PURPOSES = [
  { value: "guest_driver", label: "Guest Driver", hint: "Covering for a colleague" },
  { value: "emergency", label: "Emergency Trip", hint: "Urgent unplanned travel" },
  { value: "maintenance_transport", label: "Maintenance Transport", hint: "Workshop / service run" },
  { value: "branch_support", label: "Branch Support", hint: "Assisting another office" },
  { value: "official_errand", label: "Official Errand", hint: "Authorised company task" },
] as const;

export type TripPurposeValue = (typeof TRIP_PURPOSES)[number]["value"];

export const purposeLabel = (v: string | null | undefined) =>
  TRIP_PURPOSES.find((p) => p.value === v)?.label ?? "—";

export const ENTRY_TYPES = [
  { value: "morning", label: "Morning Start" },
  { value: "evening", label: "Evening End" },
  { value: "refuel", label: "Refuel" },
] as const;

export const entryTypeLabel = (v: string) =>
  ENTRY_TYPES.find((t) => t.value === v)?.label ?? v;

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Admin",
  branch_manager: "Branch Manager",
  driver: "Driver",
};

export const STATUS_STYLES: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  approved: {
    label: "Approved",
    className: "bg-green/15 text-green-deep border-green/30",
    dot: "#08dc7d",
  },
  pending: {
    label: "Pending",
    className: "bg-yellow/25 text-[#8a6210] border-yellow/60",
    dot: "#c2930a",
  },
  flagged: {
    label: "Flagged",
    className: "bg-red/10 text-red border-red/30",
    dot: "#e5484d",
  },
};

export const STATIONS = ["Eni", "IP", "Esso", "Q8", "Tamoil", "Agip", "TotalErg"];

/** chart palette — cycles through brand accents */
export const CHART_COLORS = [
  "#245bc1",
  "#08dc7d",
  "#46286E",
  "#00afd7",
  "#e8935e",
  "#21264e",
  "#c9a40b",
  "#d66a9f",
];
