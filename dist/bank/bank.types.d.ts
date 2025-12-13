export type LedgerTx = {
    id: string;
    clientEventId: string;
    type: "earn" | "spend";
    reason: string;
    amount: number;
    createdAt: string;
    meta?: Record<string, unknown>;
};
export type Wallet = {
    userId: string;
    points: number;
    updatedAt: string;
    ledger: LedgerTx[];
};
export type BankDB = {
    wallets: Wallet[];
};
//# sourceMappingURL=bank.types.d.ts.map