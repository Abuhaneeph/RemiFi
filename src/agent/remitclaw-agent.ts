import type { Address } from "viem";
import type { Config } from "../config/index.js";
import type { Corridor, RemittanceIntent, RouteQuote, TransferRecord } from "../types/index.js";
import { parseRemittanceIntent } from "../intent/parser.js";
import { compareFees, formatSavings } from "../fees/comparison.js";
import { corridorDestinationDecimals } from "../mento/client.js";
import { prepareTransfer } from "../transfers/executor.js";
import { scheduleRecurringTransfer } from "../transfers/scheduler.js";
import { saveTransaction } from "../history/store.js";
import { notifyRecipient, notifyClaimLink } from "../notifications/twilio.js";
import { executeRemittance } from "../transfers/onchain.js";
import { formatUnits } from "viem";
import { resolveContactContext } from "../contacts/resolve.js";
import { executeEscrowRemittance, vaultConfigured } from "../escrow/client.js";

export interface AgentResponse {
  message: string;
  intent?: RemittanceIntent;
  record?: TransferRecord;
  needsConfirmation?: boolean;
  claimUrl?: string;
}

export class RemitClawAgent {
  constructor(private readonly config: Config) {}

  private enrichIntent(userMessage: string): RemittanceIntent {
    const intent = parseRemittanceIntent(userMessage);
    const contactCtx = resolveContactContext(
      this.config.dataDir,
      intent.recipientName
    );
    if (!contactCtx) return intent;
    return {
      ...intent,
      destinationCountry:
        contactCtx.destinationCountry ?? intent.destinationCountry,
      recipientWallet: contactCtx.recipientWallet ?? intent.recipientWallet,
      recipientPhone: contactCtx.recipientPhone ?? intent.recipientPhone,
    };
  }

  async handleMessage(userMessage: string): Promise<AgentResponse> {
    const intent = this.enrichIntent(userMessage);

    if (intent.frequency !== "once") {
      const schedule = scheduleRecurringTransfer(this.config.dataDir, intent);
      return {
        message: `Scheduled ${intent.frequency} transfer of ${intent.amount} ${intent.sourceCurrency} to ${intent.destinationCountry}. Next run: ${schedule.nextRunAt}`,
        intent,
      };
    }

    const { corridor, quote, needsConfirmation } = await prepareTransfer(
      this.config,
      intent
    );

    const corridorKey = `${corridor.sourceCurrency}-${corridor.destinationCountry.slice(0, 2)}`;
    const destDecimals = corridorDestinationDecimals(corridor);
    const recipientReceives = Number(formatUnits(quote.amountOut, destDecimals));
    const destLabel = corridor.mentoPair.includes("USDC")
      ? "USDC"
      : corridor.destinationCurrency;
    const comparisons = compareFees(
      corridorKey,
      intent.amount,
      quote.mentoFeeUsd,
      recipientReceives
    );
    const savings = formatSavings(comparisons);

    const phoneOnly =
      !intent.recipientWallet &&
      Boolean(intent.recipientPhone) &&
      vaultConfigured(this.config);

    const summary = [
      `Route: ${corridor.mentoPair} (${quote.routeHops} hop${quote.routeHops === 1 ? "" : "s"})`,
      `Send: ${intent.amount} ${intent.sourceCurrency}`,
      `Recipient receives: ~${recipientReceives.toFixed(2)} ${destLabel}`,
      `Mento fee: ~$${quote.mentoFeeUsd.toFixed(2)} | Gas: ~$${quote.estimatedGasUsd.toFixed(4)}`,
      phoneOnly
        ? "Delivery: claim link via SMS/WhatsApp"
        : intent.recipientWallet
          ? `Recipient: ${this.truncateAddress(intent.recipientWallet)}`
          : "Delivery: add wallet or phone on contact",
      savings,
    ].join("\n");

    if (needsConfirmation) {
      return {
        message: `${summary}\n\nConfirm to proceed? (amount exceeds $${this.config.requireConfirmationAboveUsd} threshold)`,
        intent,
        needsConfirmation: true,
      };
    }

    if (!intent.recipientWallet && !phoneOnly) {
      const hint = intent.recipientPhone
        ? "\n\nPhone on file but REMIFI_VAULT_ADDRESS is not set — deploy the vault or add a wallet."
        : "\n\nCannot execute — save a contact with a phone or wallet, or set DEMO_RECIPIENT_ADDRESS.";
      return { message: `${summary}${hint}`, intent };
    }

    const record = await this.executeTransfer(intent, corridor, quote, comparisons);
    const txLine = record.txHash ? `\nTx: ${record.txHash}` : "";
    const claimLine = record.claimUrl ? `\nClaim link sent: ${record.claimUrl}` : "";

    return {
      message: `${summary}\n\nTransfer ${record.status}. Receipt ID: ${record.id}${txLine}${claimLine}`,
      intent,
      record,
      claimUrl: record.claimUrl,
    };
  }

  async executeTransfer(
    intent: RemittanceIntent,
    corridor: Corridor,
    quote: RouteQuote,
    feeComparison?: ReturnType<typeof compareFees>
  ): Promise<TransferRecord> {
    const record: TransferRecord = {
      id: crypto.randomUUID(),
      intent,
      status: "pending",
      createdAt: new Date().toISOString(),
      feeComparison,
    };

    const phoneOnly =
      !intent.recipientWallet &&
      Boolean(intent.recipientPhone) &&
      vaultConfigured(this.config);

    if (phoneOnly && intent.recipientPhone) {
      try {
        const escrow = await executeEscrowRemittance(
          this.config,
          corridor,
          quote,
          intent.recipientPhone
        );
        record.txHash = escrow.txHash;
        record.status = "confirmed";
        record.confirmedAt = new Date().toISOString();
        record.deliveryMethod = "escrow";
        record.claimId = escrow.claim.claimId;
        record.claimUrl = escrow.claim.claimUrl;

        saveTransaction(this.config.dataDir, record);
        await notifyClaimLink(
          this.config,
          intent,
          escrow.claim.claimUrl,
          Number(formatUnits(escrow.amount, 18)),
          corridor.destinationCurrency
        );
        return record;
      } catch (err) {
        record.status = "failed";
        saveTransaction(this.config.dataDir, record);
        throw err;
      }
    }

    if (!intent.recipientWallet) {
      const fallback = this.resolveRecipientWallet(intent);
      if (fallback) intent.recipientWallet = fallback;
    }

    if (!intent.recipientWallet) {
      record.status = "failed";
      saveTransaction(this.config.dataDir, record);
      throw new Error(
        "No recipient wallet address. Add the recipient's 0x address, phone for claim escrow, or set DEMO_RECIPIENT_ADDRESS."
      );
    }

    try {
      const result = await executeRemittance(
        this.config,
        corridor,
        quote,
        intent.recipientWallet as Address
      );
      record.txHash = result.txHash;
      record.status = "confirmed";
      record.confirmedAt = new Date().toISOString();
      record.deliveryMethod = "wallet";
    } catch (err) {
      record.status = "failed";
      saveTransaction(this.config.dataDir, record);
      throw err;
    }

    saveTransaction(this.config.dataDir, record);
    await notifyRecipient(this.config, intent, record.txHash);
    return record;
  }

  /** Demo recipient or explicit wallet from the parsed intent. */
  private resolveRecipientWallet(intent: RemittanceIntent): string | undefined {
    return intent.recipientWallet || this.config.demoRecipientAddress;
  }

  private truncateAddress(address: string): string {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }
}
