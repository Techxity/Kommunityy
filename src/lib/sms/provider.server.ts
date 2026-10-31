// The active SMS provider. Logged on every sms_messages row as `provider`.
import { bulkSmsNigeria } from "./bulksmsnigeria.server";
import type { SmsProvider } from "./provider-types";

export const SMS_PROVIDER_NAME = "bulksmsnigeria";
export const smsProvider: SmsProvider = bulkSmsNigeria;
