"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FAVOURITES } from "../data/people";
import { Avatar } from "./Avatar";
import { BoltIcon } from "./icons";
import { InlineWalletSetup } from "./InlineWalletSetup";
import { useLanguage } from "../context/LanguageContext";

function StepHero({ step }: { step: "welcome" | "ai-pay" | "people" }) {
  const { t } = useLanguage();

  if (step === "welcome") {
    return (
      <div className="relative mt-2 flex flex-1 items-center justify-center">
        <div className="bg-hero-glow absolute inset-x-0 top-6 mx-auto h-72 w-72 rounded-full blur-2xl" />
        <Image
          src="/assets/img1.png"
          alt="Stablecoins"
          width={520}
          height={360}
          priority
          loading="eager"
          fetchPriority="high"
          sizes="(max-width: 440px) 88vw, 360px"
          className="onboarding-hero-image animate-coin-bob relative w-[88%] max-w-[340px] drop-shadow-2xl"
        />
      </div>
    );
  }

  if (step === "ai-pay") {
    return (
      <div className="relative mt-4 flex flex-1 flex-col justify-center gap-3 px-2">
        <div className="bubble bubble-bot self-start max-w-[85%]">
          {t("onboarding.chatGreeting")}
        </div>
        <div className="bubble bubble-user self-end max-w-[85%]">
          {t("onboarding.chatExample")}
        </div>
        <div className="bubble bubble-bot self-start max-w-[85%]">
          <span className="inline-flex items-center gap-1.5 font-semibold text-brand-700">
            <BoltIcon className="h-4 w-4" />
            {t("onboarding.chatRoute")}
          </span>
          <span className="mt-1 block text-[0.85rem]">{t("onboarding.chatFee")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mt-6 flex flex-1 flex-col items-center justify-center">
      <div className="people-scroll w-full justify-center px-2">
        {FAVOURITES.map((person, index) => (
          <div key={person.id} className="people-item pointer-events-none">
            <Avatar
              name={person.name}
              src={person.avatar}
              ring
              priority={index === 0}
            />
            <span className="people-name">{person.name}</span>
          </div>
        ))}
        <div className="people-item pointer-events-none">
          <span className="people-more people-more-add border-dashed">
            <span className="text-xl font-light text-brand-500">+</span>
          </span>
          <span className="people-name">You</span>
        </div>
      </div>
    </div>
  );
}

export function OnboardingFlow() {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);

  const steps = useMemo(
    () => [
      {
        id: "welcome" as const,
        title: (
          <>
            {t("onboarding.welcomeTitle1")}
            <br />
            {t("onboarding.welcomeTitle2")}
          </>
        ),
      },
      {
        id: "ai-pay" as const,
        title: (
          <>
            {t("onboarding.aiTitle1")}
            <br />
            {t("onboarding.aiTitle2")}
          </>
        ),
        subtitle: t("onboarding.aiSub"),
      },
      {
        id: "people" as const,
        title: (
          <>
            {t("onboarding.peopleTitle1")}
            <br />
            {t("onboarding.peopleTitle2")}
          </>
        ),
        subtitle: t("onboarding.peopleSub"),
      },
    ],
    [t]
  );

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
      <div className="onboarding-flow screen px-7 pb-8 pt-5">
        <div className="flex justify-end">
          <Link href="/home" className="chip">
            {t("common.skip")}
          </Link>
        </div>

        <StepHero step={current.id} />

        <div key={current.id} className="onboarding-copy animate-float-in mt-2 text-center">
          <h1 className="onboarding-title text-[2.6rem] leading-[1.05] text-ink">
            {current.title}
          </h1>
          {current.subtitle ? (
            <p className="onboarding-subtitle mx-auto mt-4 max-w-[18rem] text-[0.95rem] leading-6 text-muted">
              {current.subtitle}
            </p>
          ) : null}
        </div>

        <div className="mt-7 flex items-center justify-center gap-2">
          {steps.map((s, index) => (
            <span
              key={s.id}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === step ? "w-6 bg-brand-500" : "w-2 bg-brand-100"
              }`}
            />
          ))}
        </div>

        {isLast ? (
          <InlineWalletSetup />
        ) : (
          <button
            type="button"
            className="btn btn-gradient onboarding-next-btn mt-7"
            onClick={() => setStep((s) => s + 1)}
          >
            {t("common.next")}
          </button>
        )}
      </div>
  );
}
