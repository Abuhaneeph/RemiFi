import { describe, it, expect } from "vitest";
import { parseRemittanceIntent } from "../src/intent/parser.js";

describe("parseRemittanceIntent", () => {
  it("parses English USD transfer to Philippines", () => {
    const intent = parseRemittanceIntent(
      "Send $50 to my mom in the Philippines"
    );
    expect(intent.amount).toBe(50);
    expect(intent.sourceCurrency).toBe("USD");
    expect(intent.destinationCountry).toBe("PH");
    expect(intent.frequency).toBe("once");
    expect(intent.locale).toBe("en");
  });

  it("parses Spanish monthly transfer", () => {
    const intent = parseRemittanceIntent(
      "Transferir €100 a Nigeria cada mes"
    );
    expect(intent.amount).toBe(100);
    expect(intent.sourceCurrency).toBe("EUR");
    expect(intent.destinationCountry).toBe("NG");
    expect(intent.frequency).toBe("monthly");
  });

  it("parses French weekly transfer", () => {
    const intent = parseRemittanceIntent(
      "Envoyer 200 euros au Kenya chaque semaine"
    );
    expect(intent.amount).toBe(200);
    expect(intent.destinationCountry).toBe("KE");
    expect(intent.frequency).toBe("weekly");
    expect(intent.locale).toBe("fr");
  });

  it("parses bare amount without currency symbol", () => {
    const intent = parseRemittanceIntent("Send 50 to Mom");
    expect(intent.amount).toBe(50);
    expect(intent.recipientName).toBe("Mom");
  });

  it("throws when amount is missing", () => {
    expect(() =>
      parseRemittanceIntent("Send money to Nigeria")
    ).toThrow(/amount/i);
  });
});
