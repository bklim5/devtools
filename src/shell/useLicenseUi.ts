// React hook over the license-status snapshot store (D-43/D-44). The footer
// hint (Sidebar) and the upsell panel read the SAME snapshot through this hook,
// so a refreshLicenseUi() flip propagates to both at once — mirrors
// useEntitlements (the established hook placement convention).
import { useSyncExternalStore } from "react";
import {
  getLicenseUiSnapshot,
  subscribeLicenseUi,
} from "@/lib/license/licenseUi";
import type { LicenseStatusPayload } from "@/lib/platform";

export function useLicenseUi(): LicenseStatusPayload {
  return useSyncExternalStore(subscribeLicenseUi, getLicenseUiSnapshot);
}
