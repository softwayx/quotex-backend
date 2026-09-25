import { z } from 'zod';

export const messagingSettingsSchema = z.object({
  resendApiKey: z.string().trim().max(200).optional(),
  fromEmail: z.string().trim().max(160).optional(),
  // An empty string resets a template to the built-in default.
  whatsappTemplate: z.string().max(1500).optional(),
  emailSubject: z.string().max(200).optional(),
  emailTemplate: z.string().max(20000).optional(),
});

export const emailTestSchema = z.object({ to: z.string().trim().toLowerCase().email('Enter a valid email address.') });

export const whatsappSessionSchema = z.object({ label: z.string().trim().min(1, 'Give the number a label.').max(40) });

export const whatsappIdParams = z.object({ id: z.uuid() });

export const whatsappActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reconnect') }),
  z.object({ action: z.literal('enable') }),
  z.object({ action: z.literal('disable') }),
  z.object({ action: z.literal('test'), phone: z.string().trim().min(8).max(20) }),
]);
