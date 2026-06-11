"use client";

import { MoonPayProvider as MoonPaySdkProvider } from "../lib/moonpay-widgets";
import { moonpayConfigured, moonpayPublishableKey } from "../lib/moonpay";

/** MoonPay context for buy/sell widgets (skipped when API key is unset). */
export function RemifiMoonPayProvider({ children }: { children: React.ReactNode }) {
  if (!moonpayConfigured()) {
    return <>{children}</>;
  }

  return (
    <MoonPaySdkProvider apiKey={moonpayPublishableKey}>
      {children}
    </MoonPaySdkProvider>
  );
}
