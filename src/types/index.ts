export interface User {
    id: string;
    username: string;
    password: string; // SHA-256 hash; blank on stub records pulled from the sheet
    createdAt: number;
}

export interface Group {
    id: string;
    name: string;
    members: string[]; // Active members
    pendingMembers: string[]; // Invited, waiting for acceptance
    joinRequests: string[]; // Requested to join, waiting for approval
    image?: string; // Optional group icon
    createdBy: string; // Admin ID
    createdAt: number;
}

export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE';

export interface Expense {
    id: string;
    groupId: string;
    description: string;
    amount: number;
    paidBy: string; // User ID
    splits: { userId: string; amount: number }[]; // Explicit amount per user
    splitType: SplitType;
    createdAt: number;
}
