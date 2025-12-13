import fs from "fs";
import path from "path";
import type { BankDB, Wallet } from "./bank.types.js";

const DATA_PATH = path.join("src", "data", "bank.json");

function readDB(): BankDB {
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw) as BankDB;
}

function writeDB(db: BankDB) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2), "utf-8");
}

export function getOrCreateWallet(userId: string): Wallet {
  const db = readDB();
  let w = db.wallets.find((x) => x.userId === userId);

  if (!w) {
    w = {
      userId,
      points: 0,
      updatedAt: new Date().toISOString(),
      ledger: [],
    };
    db.wallets.push(w);
    writeDB(db);
  }

  return w;
}

export function updateWallet(userId: string, updater: (w: Wallet) => Wallet): Wallet {
  const db = readDB();
  const idx = db.wallets.findIndex((x) => x.userId === userId);

  if (idx === -1) {
    const created = getOrCreateWallet(userId);
    const next = updater(created);
    // reload + write properly
    const db2 = readDB();
    const idx2 = db2.wallets.findIndex((x) => x.userId === userId);
    db2.wallets[idx2] = next;
    writeDB(db2);
    return next;
  }

  const next = db.wallets[idx]!!? updater(db.wallets[idx]) : null;
  db.wallets[idx] = next!!;
  writeDB(db);
  return next!!;
}
