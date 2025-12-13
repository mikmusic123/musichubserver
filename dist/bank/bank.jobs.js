export const EARN_RULES = {
    purchase: { points: 20, cooldownMs: 1000 * 5 },
    signup: { points: 100, once: true },
    daily_login: { points: 50, cooldownMs: 20 * 60 * 60 * 1000 }, // 20h
    watch_video: { points: 10, cooldownMs: 60 * 1000 }, // 60s
};
export const STORE = {
    pack_01: { cost: 200 },
    preset_chain: { cost: 500 },
};
//# sourceMappingURL=bank.jobs.js.map