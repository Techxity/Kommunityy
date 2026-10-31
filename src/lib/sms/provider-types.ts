// The SMS provider contract. The wallet and send pipeline only talk to this,
// so swapping providers is one adapter plus the wiring in provider.server.ts.

export type SmsSendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

export interface SmsProvider {
  sendOne(args: {
    to: string; // 234XXXXXXXXXX
    from: string; // approved sender ID
    body: string;
    route: "dnd" | "generic";
    unicode: boolean;
    callbackUrl?: string; // per-send delivery-report webhook
  }): Promise<SmsSendResult>;
  // Provider ACCOUNT balance in NGN (operator reconciliation only).
  getAccountBalance(): Promise<number | null>;
}
