import fs from "fs";
import path from "path";
const DATA_PATH = path.join("src", "data", "bank.json");
function readDB() {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(raw);
}
function writeDB(db) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2), "utf-8");
}
export function getOrCreateWallet(userId) {
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
export function updateWallet(userId, updater) {
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
    const next = db.wallets[idx] ? updater(db.wallets[idx]) : null;
    db.wallets[idx] = next;
    writeDB(db);
    return next;
}
//# sourceMappingURL=bank.store.js.map