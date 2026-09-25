import bcrypt from 'bcryptjs';

// bcrypt (same as the old app) so migrated password hashes keep working.
const ROUNDS = 12;

export const hashPassword = (plain) => bcrypt.hash(plain, ROUNDS);

export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

/** Compared against when the account does not exist, to keep timing uniform. */
export const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', ROUNDS);
