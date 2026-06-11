"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Avatar } from "./Avatar";
import { AgentStatusBanner } from "./AgentStatusBanner";
import {
  formatConfirmDetails,
  formatQuoteText,
  formatSuccessText,
} from "../lib/pay-format";
import { ASSISTANT, PROFILE } from "../data/people";
import { BoltIcon, ChevronLeftIcon, ContactPickerIcon, MicIcon } from "./icons";
import { useAgentApi } from "../context/AgentApiContext";
import { useContacts } from "../context/ContactsContext";
import { useLanguage } from "../context/LanguageContext";
import {
  contactTransferContext,
  extractRecipientName,
  matchContact,
} from "../lib/contacts";
import { normalizePayMessage, payErrorHint } from "../lib/pay-message";
import {
  fetchPayAgentReply,
  isOpenClawConfigured,
  isOpenClawReachable,
  toAgentHistory,
} from "../lib/pay-agent";
import {
  executeTransfer,
  fetchQuote,
  type QuoteResponse,
  type TransferContext,
} from "../lib/api";
import { checkRateAlerts } from "../lib/rate-alerts";
import { listenForSpeech, speechLocale, speechRecognitionSupported } from "../lib/speech";
import { FxRateBanner } from "./FxRateBanner";
import { RateAlertSheet } from "./RateAlertSheet";
import { TxReceiptShare } from "./TxReceiptShare";
import { formatAgentReply } from "../lib/format-agent-reply";
import { getSessionId } from "../lib/session";

type Message =
  | {
      id: string;
      role: "bot";
      text: string;
      quote?: QuoteResponse;
      txHash?: string;
      receipt?: {
        receiptId: string;
        amount: number;
        sourceCurrency: string;
        destinationCurrency?: string;
        recipientReceives?: number;
        recipientName?: string;
        savings?: string;
      };
      confirm?: {
        label: string;
        message: string;
        quote: QuoteResponse;
        ctx?: TransferContext;
      };
    }
  | { id: string; role: "user"; text: string };

/** Fire-and-forget: persist a single message to Neon. */
function persistMessage(
  sessionId: string,
  role: "user" | "bot",
  text: string
) {
  if (!sessionId) return;
  fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, role, text }),
  }).catch(() => {});
}

/** Fire-and-forget: add a notification to Neon. */
export function addNotification(
  sessionId: string,
  title: string,
  body: string
) {
  if (!sessionId) return;
  fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, title, body }),
  }).catch(() => {});
}

export function PayChat() {
  const searchParams = useSearchParams();
  const presetTo = searchParams.get("to");
  const presetAmount = searchParams.get("amount");
  const presetWallet = searchParams.get("wallet");
  const { allPeople } = useContacts();
  const { refreshBalancesAfterSend } = useAgentApi();
  const { t, locale } = useLanguage();

  const sessionId = useRef("");
  useEffect(() => {
    sessionId.current = getSessionId();
  }, []);

  const quickReplies = useMemo(
    () => [
      { label: t("pay.quick1") },
      { label: t("pay.quick2") },
    ],
    [t, locale]
  );

  const [input, setInput] = useState(() => {
    if (presetWallet) return `Send $50 to ${presetWallet.slice(0, 6)}…${presetWallet.slice(-4)}`;
    if (presetTo && presetAmount) return `Send $${presetAmount} to ${presetTo}`;
    if (presetTo) return `Send $50 to ${presetTo}`;
    return "";
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const historyLoaded = useRef(false);
  const presetSent = useRef(false);
  const [thinking, setThinking] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [alertQuote, setAlertQuote] = useState<QuoteResponse | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [contactPickerSupported, setContactPickerSupported] = useState(false);
  const [openClawMode, setOpenClawMode] = useState(false);
  const [openClawOnline, setOpenClawOnline] = useState(true);
  const stopSpeechRef = useRef<(() => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      const configured = await isOpenClawConfigured();
      setOpenClawMode(configured);
      if (configured) {
        setOpenClawOnline(await isOpenClawReachable());
      }
    })();
  }, []);

  useEffect(() => {
    setContactPickerSupported(
      typeof navigator !== "undefined" &&
        "contacts" in navigator &&
        "ContactsManager" in window
    );
  }, []);

  // Load chat history from Neon on mount
  useEffect(() => {
    if (historyLoaded.current) return;
    historyLoaded.current = true;
    const sid = getSessionId();
    sessionId.current = sid;
    fetch(`/api/chat?sessionId=${sid}`)
      .then((r) => r.json())
      .then((data: { messages?: Array<{ id: string; role: string; text: string }> }) => {
        const hist = data.messages ?? [];
        if (hist.length > 0) {
          setMessages(
            hist.map((m) => ({
              id: m.id,
              role: m.role as "user" | "bot",
              text: m.text,
            }))
          );
        } else {
          setMessages([{ id: "intro", role: "bot", text: t("pay.intro") }]);
        }
      })
      .catch(() => {
        setMessages([{ id: "intro", role: "bot", text: t("pay.intro") }]);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (historyLoaded.current && messages.length === 0) {
      setMessages([{ id: "intro", role: "bot", text: t("pay.intro") }]);
    }
  }, [locale, t, messages.length]);

  const appendBot = useCallback(
    (msg: Omit<Extract<Message, { role: "bot" }>, "id" | "role">) => {
      const id = crypto.randomUUID();
      setMessages((prev) => [...prev, { id, role: "bot", ...msg }]);
      persistMessage(sessionId.current, "bot", msg.text);
    },
    []
  );

  const contactForMessage = (text: string) => {
    if (presetTo) {
      const preset = matchContact(presetTo, allPeople);
      if (preset) return preset;
    }
    const name = extractRecipientName(text);
    return matchContact(name, allPeople);
  };

  const sendViaOpenClaw = async (trimmed: string) => {
    const history = toAgentHistory(
      messages
        .filter((m) => m.id !== "intro")
        .map((m) => ({ role: m.role, text: m.text }))
    );
    const { reply, error } = await fetchPayAgentReply(
      sessionId.current,
      history,
      trimmed
    );
    if (reply) {
      appendBot({ text: formatAgentReply(reply) });
      if (/\b(sent|confirmed|tx hash|0x[a-fA-F0-9]{64})\b/i.test(reply)) {
        void refreshBalancesAfterSend(0);
      }
      setOpenClawOnline(true);
      return;
    }
    setOpenClawOnline(false);
    appendBot({ text: error ?? t("pay.agentUnavailable") });
  };

  const sendViaDirectApi = async (
    trimmed: string,
    extraCtx?: TransferContext
  ) => {
    const pendingConfirm = [...messages]
      .reverse()
      .find(
        (m): m is Extract<Message, { role: "bot" }> =>
          m.role === "bot" && Boolean(m.confirm)
      );
    if (pendingConfirm?.confirm) {
      if (/^(yes|yeah|yep|si|sí|oui|confirm|ok|okay|send|enviar)$/i.test(trimmed)) {
        await handleInlineConfirm(pendingConfirm.id, pendingConfirm.confirm);
        return;
      }
      if (/^(no|nope|cancel|cancelar|annuler)$/i.test(trimmed)) {
        dismissConfirm(pendingConfirm.id);
        appendBot({ text: t("pay.cancelled") });
        return;
      }
    }

    const activeContact = contactForMessage(trimmed);
    const ctx = {
      ...contactTransferContext(activeContact),
      ...extraCtx,
    };
    const apiMessage = normalizePayMessage(trimmed, activeContact);
    const quote = await fetchQuote(apiMessage, ctx);

    if (quote.kind === "schedule") {
      appendBot({ text: quote.summary, quote });
      return;
    }

    const hits = checkRateAlerts(
      quote.intent.sourceCurrency,
      quote.destinationCurrency ?? "",
      quote.intent.destinationCountry,
      quote.exchangeRate
    );
    const alertNote =
      hits.length > 0
        ? `\n\n${t("rateAlerts.hit", {
            rate: hits[0].currentRate.toFixed(4),
            currency: hits[0].alert.destinationCurrency,
          })}`
        : "";

    const recipientName =
      quote.intent.recipientName ?? activeContact?.name ?? "your recipient";

    let extra = "";
    if (!ctx?.recipientWallet && !ctx?.recipientPhone) {
      extra = `\n\n${t("pay.addContactHint")}`;
    } else if (quote.deliveryMethod === "escrow") {
      extra = `\n\n${t("pay.escrowHint")}`;
    } else if (ctx?.recipientPhone && !ctx?.recipientWallet) {
      extra = `\n\n${t("pay.vaultHint")}`;
    }

    appendBot({
      text: `${formatQuoteText(quote, recipientName, t)}${alertNote}${extra}`,
      confirm: {
        label: t("pay.confirmSend", {
          amount: quote.intent.amount,
          currency: quote.intent.sourceCurrency,
          name: recipientName,
        }),
        message: apiMessage,
        quote,
        ctx,
      },
    });
  };

  const sendMessage = async (
    text: string,
    silent = false,
    extraCtx?: TransferContext
  ) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text: trimmed },
    ]);
    persistMessage(sessionId.current, "user", trimmed);
    if (!silent) setInput("");
    setThinking(true);

    try {
      if (openClawMode) {
        await sendViaOpenClaw(trimmed);
        return;
      }

      await sendViaDirectApi(trimmed, extraCtx);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Something went wrong";
      appendBot({
        text: `${t("pay.errorPrefix")} ${reason}. ${payErrorHint(reason)}`,
      });
    } finally {
      setThinking(false);
    }
  };

  useEffect(() => {
    if (presetSent.current) return;
    if (!presetTo && !presetWallet) return;
    presetSent.current = true;
    if (presetWallet) {
      void sendMessage(
        `Send $50 to wallet ${presetWallet}`,
        true,
        { recipientWallet: presetWallet }
      );
      return;
    }
    const amount = presetAmount ? Number(presetAmount) : 50;
    void sendMessage(`Send $${amount} to ${presetTo}`, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetTo, presetAmount, presetWallet]);

  const dismissConfirm = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.role === "bot" ? { ...m, confirm: undefined } : m
      )
    );
  };

  const handleInlineConfirm = async (
    msgId: string,
    confirm: NonNullable<Extract<Message, { role: "bot" }>["confirm"]>
  ) => {
    if (confirmingId) return;
    setConfirmingId(msgId);
    const recipientName =
      confirm.quote.intent.recipientName ?? "your recipient";

    try {
      const result = await executeTransfer(confirm.message, confirm.ctx);
      const sentTotal =
        confirm.quote.intent.amount + (confirm.quote.mentoFeeUsd ?? 0);
      await refreshBalancesAfterSend(sentTotal);

      addNotification(
        sessionId.current,
        "Payment sent",
        `$${confirm.quote.intent.amount} ${confirm.quote.intent.sourceCurrency} sent to ${recipientName}.`
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.role === "bot" ? { ...m, confirm: undefined } : m
        )
      );

      const claimNote =
        result.deliveryMethod === "escrow" && result.claimUrl
          ? `\n${t("pay.claimLink")}${result.notificationSent ? ` ${t("pay.claimSent")}` : ""}: ${result.claimUrl}`
          : "";

      appendBot({
        text:
          formatSuccessText(
            confirm.quote.intent.amount,
            confirm.quote.intent.sourceCurrency,
            recipientName,
            result.recipientReceives,
            result.destinationCurrency,
            result.savings,
            t
          ) + claimNote,
        txHash: result.txHash,
        receipt: {
          receiptId: result.receiptId,
          amount: confirm.quote.intent.amount,
          sourceCurrency: confirm.quote.intent.sourceCurrency,
          destinationCurrency: result.destinationCurrency,
          recipientReceives: result.recipientReceives,
          recipientName,
          savings: result.savings,
        },
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Transfer failed";
      appendBot({ text: `${t("pay.transferFailed")} ${reason}` });
    } finally {
      setConfirmingId(null);
    }
  };

  const pickContact = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contacts = await (navigator as any).contacts.select(["name", "tel"], {
        multiple: false,
      });
      if (!contacts || contacts.length === 0) return;
      const contact = contacts[0];
      const name = Array.isArray(contact.name) ? contact.name[0] : contact.name;
      const tel = Array.isArray(contact.tel) ? contact.tel[0] : contact.tel;
      if (name) {
        setInput(`Send $50 to ${name}`);
      } else if (tel) {
        setInput(`Send $50 to ${tel}`);
      }
    } catch {
      // User cancelled or API unavailable
    }
  };

  const toggleVoice = () => {
    if (listening) {
      stopSpeechRef.current?.();
      stopSpeechRef.current = null;
      setListening(false);
      return;
    }
    if (!speechRecognitionSupported()) {
      appendBot({ text: t("pay.voiceUnsupported") });
      return;
    }
    setListening(true);
    stopSpeechRef.current = listenForSpeech({
      locale: speechLocale(locale),
      onResult: (text) => {
        setInput(text);
        void sendMessage(text);
      },
      onError: (message) => appendBot({ text: message }),
      onEnd: () => setListening(false),
    });
  };

  useEffect(() => {
    return () => stopSpeechRef.current?.();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: reduced ? "auto" : "smooth",
    });
  }, [messages, thinking]);

  const hasStarted =
    input.length > 0 || messages.some((m) => m.role === "user");
  const visibleMessages = hasStarted
    ? messages.filter((m) => m.id !== "intro")
    : messages;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mobile-only flex shrink-0 items-center px-5 pb-3 pt-5">
        <Link href="/home" className="icon-btn" aria-label={t("common.back")}>
          <ChevronLeftIcon className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-[1.05rem] font-bold">
          {t("pay.title")}
        </h1>
        <span className="w-10" />
      </header>

      <AgentStatusBanner />

      {openClawMode && !openClawOnline ? (
        <div className="mx-5 mb-2 rounded-[var(--radius-lg)] border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          {t("pay.openClawOffline")}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="pay-chat-messages screen screen-has-composer min-h-0 flex-1 gap-4 px-5 pt-1"
      >
        {visibleMessages.map((msg) =>
          msg.role === "bot" ? (
            <div key={msg.id} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Avatar name={ASSISTANT.name} src={ASSISTANT.avatar} size={26} ring />
                <span className="text-xs font-bold text-brand-700">{ASSISTANT.name}</span>
              </div>
              <div className="bubble bubble-bot whitespace-pre-line">{msg.text}</div>
              {msg.quote?.kind === "quote" && msg.quote.exchangeRate != null && (
                <FxRateBanner
                  quote={msg.quote}
                  alertLabel={t("rateAlerts.set")}
                  onSetAlert={() => {
                    setAlertQuote(msg.quote ?? null);
                    setAlertOpen(true);
                  }}
                />
              )}
              {msg.receipt && (
                <TxReceiptShare
                  receipt={{ ...msg.receipt, txHash: msg.txHash }}
                  explorerLabel={t("pay.explorer")}
                  shareLabel={t("pay.shareReceipt")}
                  copiedLabel={t("pay.receiptCopied")}
                />
              )}
              {msg.confirm && (
                <div className="pay-confirm-card mt-1 max-w-[min(100%,20rem)] self-start">
                  <div className="confirm-modal-details">
                    {formatConfirmDetails(
                      msg.confirm.quote,
                      msg.confirm.quote.intent.recipientName ?? "Recipient",
                      t
                    ).map(
                      (row) => (
                        <div key={row.label} className="confirm-modal-detail-row">
                          <span className="text-muted">{row.label}</span>
                          <span className="tnum font-semibold text-ink">
                            {row.value}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    <button
                      type="button"
                      className="btn btn-dark"
                      disabled={Boolean(confirmingId)}
                      onClick={() => void handleInlineConfirm(msg.id, msg.confirm!)}
                    >
                      <BoltIcon className="h-4 w-4 text-accent-400" />
                      {confirmingId === msg.id
                        ? t("pay.sending")
                        : msg.confirm.label}
                    </button>
                    <button
                      type="button"
                      className="btn btn-light"
                      disabled={Boolean(confirmingId)}
                      onClick={() => dismissConfirm(msg.id)}
                    >
                      {t("pay.cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div key={msg.id} className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-soft">{t("pay.you")}</span>
                <Avatar name={PROFILE.name} src={PROFILE.avatar} size={26} ring />
              </div>
              <div className="bubble bubble-user">{msg.text}</div>
            </div>
          )
        )}
        {thinking && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Avatar name={ASSISTANT.name} src={ASSISTANT.avatar} size={26} ring />
              <span className="text-xs font-bold text-brand-700">{ASSISTANT.name}</span>
            </div>
            <div className="bubble bubble-bot text-soft">
              {t(openClawMode ? "pay.agentThinking" : "pay.thinking")}
            </div>
          </div>
        )}
      </div>

      <div className="pay-composer shrink-0">
        {!hasStarted && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            {quickReplies.map((q) => (
              <button
                key={q.label}
                type="button"
                className="chip chip-pay-quick min-w-0"
                disabled={thinking}
                onClick={() => void sendMessage(q.label)}
              >
                {q.label}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex items-center gap-2 rounded-[var(--radius-pill)] border border-line bg-surface p-1.5 pl-4 shadow-[0_16px_30px_-16px_rgba(15,15,20,0.35)]"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("pay.placeholder")}
            className="min-w-0 flex-1 bg-transparent text-[0.9rem] text-ink outline-none placeholder:text-soft"
          />
          {contactPickerSupported && (
            <button
              type="button"
              className="icon-btn shrink-0"
              aria-label="Pick a contact"
              onClick={() => void pickContact()}
              disabled={thinking}
            >
              <ContactPickerIcon className="h-[1.15rem] w-[1.15rem]" />
            </button>
          )}
          <button
            type="button"
            className={`icon-btn shrink-0 ${listening ? "ring-2 ring-brand-500" : ""}`}
            aria-label={t("pay.voice")}
            aria-pressed={listening}
            onClick={toggleVoice}
            disabled={thinking}
          >
            <MicIcon className="h-[1.15rem] w-[1.15rem]" />
          </button>
          <button type="submit" className="btn btn-dark shrink-0 px-5" disabled={thinking}>
            {t("pay.payButton")}
          </button>
        </form>
      </div>

      <RateAlertSheet
        open={alertOpen}
        onClose={() => setAlertOpen(false)}
        quote={alertQuote}
      />

    </div>
  );
}
