import bcrypt from "bcryptjs";
import { User } from "../models/user.model.js";

/**
 * Auth business logic: registration, credential verification, password hashing.
 * Sessions are handled by express-session in the controller, not here.
 */

const BCRYPT_ROUNDS = 12;

/**
 * Hashes a plaintext password.
 */
export async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Compares a plaintext password against a hash.
 */
export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/**
 * Registers a new user.
 * Throws an error with a `code` field on failure so the controller
 * can map it to the correct HTTP status.
 */
export async function registerUser({ fullName, username, email, password }) {
  // 1. Check for existing username or email (Section 11.2 step 3)
  const existing = await User.findOne({ $or: [{ username }, { email }] }).lean();
  if (existing) {
    const err = new Error(
      existing.username === username
        ? "Username is already taken."
        : "Email is already registered."
    );
    err.code = "DUPLICATE";
    err.status = 409;
    throw err;
  }

  // 2. Hash the password (Section 11.2 step 4)
  const passwordHash = await hashPassword(password);

  // 3. Create the user document (Section 11.2 step 5)
  try {
    const user = await User.create({
      fullName,
      username,
      email,
      passwordHash,
    });
    return user;
  } catch (err) {
    // Race condition: someone else created the same username/email
    // between our check and the insert. The unique index rejects it.
    if (err.code === 11000) {
      const dupErr = new Error("Username or email is already registered.");
      dupErr.code = "DUPLICATE";
      dupErr.status = 409;
      throw dupErr;
    }
    throw err;
  }
}

/**
 * Finds a user by username OR email, including the passwordHash
 * (which is select:false by default).
 */
export async function findUserByIdentifier(identifier) {
  const normalized = identifier.toLowerCase().trim();
  return User.findOne({
    $or: [{ username: normalized }, { email: normalized }],
  }).select("+passwordHash");
}