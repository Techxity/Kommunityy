// The active SMS provider. Logged on every sms_messages row as `provider`.
import { bulkSmsNigeria } from "./bulksmsnigeria.server";
import type { SmsProvider } from "./provider-types";

export const SMS_PROVIDER_NAME = "bulksmsnigeria";
export const smsProvider: SmsProvider = bulkSmsNigeria;

// Every community sends from one approved platform sender ID: providers cap how
// many an account can hold, so one per community can't scale.
export function smsSenderId(): string {
  return process.env.SMS_SENDER_ID?.trim() || "Kommunity";
}
