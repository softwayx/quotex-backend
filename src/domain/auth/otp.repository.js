import { OTP_SEND_WINDOW_MINUTES } from '../core/index.js';
import { PendingRegistration, toRow } from '../../models/index.js';

const windowStart = () => new Date(Date.now() - OTP_SEND_WINDOW_MINUTES * 60_000);

/** Pending sign-ups created for this phone recently — used to rate-limit WhatsApp sends. */
export const countRecentRegistrations = (phone) =>
  PendingRegistration.countDocuments({ phone, created_at: { $gt: windowStart() } });

export const createPendingRegistration = async (values) => {
  const [row] = await PendingRegistration.create([
    {
      display_name: values.displayName,
      username: values.username,
      password_hash: values.passwordHash,
      password_encrypted: values.passwordEncrypted,
      phone: values.phone,
      email: values.email,
      ref: values.ref ?? null,
      otp_hash: values.otpHash,
      expires_at: values.expiresAt,
    },
  ]);
  return row._id;
};

export const findPendingRegistration = async (id) => toRow(await PendingRegistration.findById(id).lean());

export const bumpPendingAttempts = (id) => PendingRegistration.updateOne({ _id: id }, { $inc: { attempts: 1 } });

export const deletePendingRegistration = (id) => PendingRegistration.softDelete({ _id: id });
