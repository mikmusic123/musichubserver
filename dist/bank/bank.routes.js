import { Router } from "express";
import crypto from "crypto";
import { requireAuth } from "../auth/auth.middleware.js";
import { getOrCreateWallet, updateWallet } from "./bank.store.js";
import { EARN_RULES, STORE } from "./bank.jobs.js";
const router = Router();
function nowISO() {
    return new Date().toISOString();
}
function hasClientEventId(ledger, clientEventId) {
    return ledger.some((tx) => tx.clientEventId === clientEventId);
}
function lastTxByReason(ledger, reason, type) {
    for (let i = ledger.length - 1; i >= 0; i--) {
        const tx = ledger[i];
        if (tx.type === type && tx.reason === reason)
            return tx;
    }
    return null;
}
router.get("/wallet", requireAuth, (req, res) => {
    const userId = req.user.id;
    const w = getOrCreateWallet(userId);
    return res.json({
        userId: w.userId,
        points: w.points,
        updatedAt: w.updatedAt,
        ledger: w.ledger.slice(-20),
    });
});
router.post("/wallet/earn", requireAuth, (req, res) => {
    const userId = req.user.id;
    const action = req.body?.action;
    const clientEventId = req.body?.clientEventId;
    const meta = (req.body?.meta ?? {});
    if (!action || !(action in EARN_RULES)) {
        return res.status(400).json({ error: "Invalid action" });
    }
    if (!clientEventId || typeof clientEventId !== "string" || clientEventId.length < 8) {
        return res.status(400).json({ error: "Invalid clientEventId" });
    }
    const rule = EARN_RULES[action];
    try {
        const next = updateWallet(userId, (w) => {
            // 1) idempotency
            if (hasClientEventId(w.ledger, clientEventId))
                return w;
            // 2) once-only
            if (rule.once) {
                const already = w.ledger.some((tx) => tx.type === "earn" && tx.reason === action);
                if (already) {
                    const err = new Error("ALREADY_CLAIMED");
                    err.status = 409;
                    throw err;
                }
            }
            // 3) cooldown
            if (rule.cooldownMs && rule.cooldownMs > 0) {
                const last = lastTxByReason(w.ledger, action, "earn");
                if (last) {
                    const elapsed = Date.now() - new Date(last.createdAt).getTime();
                    const remainingMs = rule.cooldownMs - elapsed;
                    if (remainingMs > 0) {
                        const err = new Error("COOLDOWN_ACTIVE");
                        err.status = 409;
                        err.remainingMs = remainingMs;
                        throw err;
                    }
                }
            }
            // 4) grant
            const tx = {
                id: "tx_" + crypto.randomBytes(8).toString("hex"),
                clientEventId,
                type: "earn",
                reason: action,
                amount: rule.points,
                createdAt: nowISO(),
                meta,
            };
            return {
                ...w,
                points: w.points + rule.points,
                updatedAt: nowISO(),
                ledger: [...w.ledger, tx],
            };
        });
        return res.json({
            userId: next.userId,
            points: next.points,
            updatedAt: next.updatedAt,
        });
    }
    catch (e) {
        if (e?.status === 409 && e.message === "ALREADY_CLAIMED") {
            return res.status(409).json({ error: "Already claimed" });
        }
        if (e?.status === 409 && e.message === "COOLDOWN_ACTIVE") {
            return res.status(409).json({ error: "Cooldown active", remainingMs: e.remainingMs });
        }
        console.error(e);
        return res.status(500).json({ error: "Earn failed" });
    }
});
// ✅ POST /wallet/spend body: { itemId, clientEventId, meta? }
router.post("/wallet/spend", requireAuth, (req, res) => {
    const userId = req.user.id;
    const itemId = req.body?.itemId;
    const clientEventId = req.body?.clientEventId;
    const meta = (req.body?.meta ?? {});
    if (!itemId || !(itemId in STORE)) {
        return res.status(400).json({ error: "Invalid itemId" });
    }
    if (!clientEventId || typeof clientEventId !== "string" || clientEventId.length < 8) {
        return res.status(400).json({ error: "Invalid clientEventId" });
    }
    const item = STORE[itemId];
    try {
        const next = updateWallet(userId, (w) => {
            // idempotency
            if (hasClientEventId(w.ledger, clientEventId))
                return w;
            // sufficient balance
            if (w.points < item.cost) {
                const err = new Error("INSUFFICIENT_POINTS");
                err.status = 409;
                err.required = item.cost;
                err.have = w.points;
                throw err;
            }
            const tx = {
                id: "tx_" + crypto.randomBytes(8).toString("hex"),
                clientEventId,
                type: "spend",
                reason: itemId,
                amount: -item.cost,
                createdAt: nowISO(),
                meta,
            };
            return {
                ...w,
                points: w.points - item.cost,
                updatedAt: nowISO(),
                ledger: [...w.ledger, tx],
            };
        });
        return res.json({
            userId: next.userId,
            points: next.points,
            updatedAt: next.updatedAt,
        });
    }
    catch (e) {
        if (e?.status === 409 && e.message === "INSUFFICIENT_POINTS") {
            return res.status(409).json({
                error: "Insufficient points",
                required: e.required,
                have: e.have,
            });
        }
        console.error(e);
        return res.status(500).json({ error: "Spend failed" });
    }
});
export default router;
//# sourceMappingURL=bank.routes.js.map