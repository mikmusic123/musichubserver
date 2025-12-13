export type LedgerTx = {
  id: string;                 // tx id (server)
  clientEventId: string;      // idempotency key from client
  type: "earn" | "spend";
  reason: string;             // action or itemId
  amount: number;             // + earn, - spend
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
