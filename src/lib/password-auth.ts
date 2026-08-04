import * as crypto from "node:crypto";

const ARGON_ALGORITHM = "argon2id";
const SCRYPT_ALGORITHM = "scrypt";
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELISM = 1;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_SALT_LENGTH = 16;

type Argon2Parameters = {
  message: Buffer;
  nonce: Buffer;
  parallelism: number;
  tagLength: number;
  memory: number;
  passes: number;
};

const { randomBytes, timingSafeEqual } = crypto;
const argon2Sync = (crypto as typeof crypto & {
  argon2Sync?: (algorithm: string, parameters: Argon2Parameters) => Buffer;
}).argon2Sync;
const { scryptSync } = crypto;

export function createSetupToken() {
  return randomBytes(24).toString("hex");
}

function hashWithScrypt(password: string) {
  const salt = randomBytes(SCRYPT_SALT_LENGTH);
  const digest = scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELISM,
  });

  return [
    SCRYPT_ALGORITHM,
    String(SCRYPT_COST),
    String(SCRYPT_BLOCK_SIZE),
    String(SCRYPT_PARALLELISM),
    salt.toString("base64url"),
    digest.toString("base64url"),
  ].join("$");
}

export function hashPassword(password: string) {
  const normalized = password.trim();
  if (!normalized) {
    throw new Error("Password is required.");
  }

  return hashWithScrypt(normalized);
}

function verifyArgon2Password(
  password: string,
  memory: string,
  passes: string,
  parallelism: string,
  nonceEncoded: string,
  digestEncoded: string,
) {
  if (typeof argon2Sync !== "function") {
    return false;
  }

  const nonce = Buffer.from(nonceEncoded, "base64url");
  const expectedDigest = Buffer.from(digestEncoded, "base64url");
  const actualDigest = argon2Sync(ARGON_ALGORITHM, {
    message: Buffer.from(password, "utf8"),
    nonce,
    parallelism: Number(parallelism),
    tagLength: expectedDigest.length,
    memory: Number(memory),
    passes: Number(passes),
  });

  if (actualDigest.length !== expectedDigest.length) {
    return false;
  }

  return timingSafeEqual(actualDigest, expectedDigest);
}

function verifyScryptPassword(
  password: string,
  cost: string,
  blockSize: string,
  parallelism: string,
  saltEncoded: string,
  digestEncoded: string,
) {
  const salt = Buffer.from(saltEncoded, "base64url");
  const expectedDigest = Buffer.from(digestEncoded, "base64url");
  const actualDigest = scryptSync(password, salt, expectedDigest.length, {
    N: Number(cost),
    r: Number(blockSize),
    p: Number(parallelism),
  });

  if (actualDigest.length !== expectedDigest.length) {
    return false;
  }

  return timingSafeEqual(actualDigest, expectedDigest);
}

export function verifyPassword(password: string, storedHash?: string | null) {
  if (!storedHash) return false;

  const normalized = password.trim();
  const [algorithm, firstParam, secondParam, thirdParam, saltOrNonce, digestEncoded] = storedHash.split("$");
  if (!algorithm || !firstParam || !secondParam || !thirdParam || !saltOrNonce || !digestEncoded) {
    return false;
  }

  if (algorithm === ARGON_ALGORITHM) {
    return verifyArgon2Password(normalized, firstParam, secondParam, thirdParam, saltOrNonce, digestEncoded);
  }

  if (algorithm === SCRYPT_ALGORITHM) {
    return verifyScryptPassword(normalized, firstParam, secondParam, thirdParam, saltOrNonce, digestEncoded);
  }

  return false;
}
