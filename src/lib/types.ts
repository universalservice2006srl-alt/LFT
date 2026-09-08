export type SessionUserDTO = {
  id: string;
  fullName: string;
  email: string;
  role: "super_admin" | "branch_manager" | "driver";
  branchId: string | null;
  branchName: string | null;
  branchCode: string | null;
  avatarColor: string | null;
};

export type VehicleOption = {
  id: string;
  plateNumber: string;
  label: string; // "Fiat Ducato · 2022"
  make: string;
  model: string;
  branchId: string;
  branchName: string;
  status: "active" | "maintenance" | "retired";
  primaryDriverId: string | null;
  primaryDriverName: string | null;
  currentOdometer: number;
};

export type RefuelDTO = {
  liters: string;
  totalCost: string;
  pricePerLiter: string | null;
  stationName: string | null;
  receiptUrl: string | null;
};

export type LogRow = {
  id: string;
  createdAt: string;
  entryType: "morning" | "evening" | "refuel";
  odometerValue: number;
  distanceKm: number;
  isTemporaryDriver: boolean;
  tripPurpose: string | null;
  status: "pending" | "approved" | "flagged";
  photoUrl: string | null;
  locationLat: string | null;
  locationLng: string | null;
  note: string | null;
  reviewerName: string | null;
  reviewerRole: "super_admin" | "branch_manager" | "driver" | null;
  reviewedAt: string | null;
  driverId: string;
  driverName: string;
  driverColor: string | null;
  vehicleId: string;
  plate: string;
  vehicleLabel: string;
  branchId: string;
  branchName: string;
  refuel: RefuelDTO | null;
};

export type BranchDTO = { id: string; name: string; code: string };

export type DashboardStats = {
  kpis: {
    activeFleet: number;
    vehiclesTotal: number;
    kmToday: number;
    kmTrendPct: number; // vs 7d avg
    fuelSpendMonth: number;
    fuelTrendPct: number;
    tempLogsMonth: number;
    pendingReview: number;
    fleetKmMonth: number;
    avgKmPerLiter: number | null;
  };
  kmByBranch: {
    months: string[];
    series: { name: string; values: number[] }[];
  };
  efficiencyTrend: { month: string; kmPerLiter: number | null }[];
  fuelByBranch: { name: string; value: number }[];
  typeSplit: { name: string; value: number; color: string }[];
};
