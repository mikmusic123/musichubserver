export type Show = {
    id: number;
    date: string;
    city: string;
    venue: string;
    event: string;
    status: "Confirmed" | "TBC" | "Cancelled";
};
export type SectionType = "text" | "text+image+left" | "text+image+right" | "text+video+left" | "text+video+right";
export type Section = {
    type: SectionType;
    subtitle?: string;
    text?: string;
    image?: string;
    video?: string;
};
export type ResourceLink = {
    label: string;
    url: string;
};
export type ResourceFile = {
    label: string;
    url: string;
};
export type Resource = {
    id: number;
    title: string;
    author: string;
    sections: Section[];
    links?: ResourceLink[];
    files?: ResourceFile[];
};
export type AuthProvider = "local" | "facebook" | "apple";
export type User = {
    id: number;
    name: string;
    email: string;
    passwordHash?: string;
    provider: AuthProvider;
    providerId?: string;
};
export type MarketType = "free" | "exclusive";
export type MarketItem = {
    id: number;
    type: MarketType;
    title: string;
    imageUrl: string;
    price: string;
    description: string;
    category: string;
    linkUrl: string;
};
//# sourceMappingURL=server.d.ts.map