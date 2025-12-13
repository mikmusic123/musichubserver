export type EarnRule = {
    points: number;
    once?: boolean;
    cooldownMs?: number;
};
export declare const EARN_RULES: Record<string, EarnRule>;
export declare const STORE: {
    readonly pack_01: {
        readonly cost: 200;
    };
    readonly preset_chain: {
        readonly cost: 500;
    };
};
export type EarnAction = keyof typeof EARN_RULES;
export type StoreItemId = keyof typeof STORE;
//# sourceMappingURL=bank.jobs.d.ts.map