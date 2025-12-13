import type { Wallet } from "./bank.types.js";
export declare function getOrCreateWallet(userId: string): Wallet;
export declare function updateWallet(userId: string, updater: (w: Wallet) => Wallet): Wallet;
//# sourceMappingURL=bank.store.d.ts.map