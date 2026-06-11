"use client";

import dynamic from "next/dynamic";

/** MoonPay React SDK — client-only per https://dev.moonpay.com/widget/on-ramp-react-sdk */
export const MoonPayProvider = dynamic(
  () => import("@moonpay/moonpay-react").then((mod) => mod.MoonPayProvider),
  { ssr: false },
);

export const MoonPayBuyWidget = dynamic(
  () => import("@moonpay/moonpay-react").then((mod) => mod.MoonPayBuyWidget),
  { ssr: false },
);

export const MoonPaySellWidget = dynamic(
  () => import("@moonpay/moonpay-react").then((mod) => mod.MoonPaySellWidget),
  { ssr: false },
);
