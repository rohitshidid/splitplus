export interface User {
    id: string;
    username: string;
    password: string; // Plain text/simulated for MVP
    createdAt: number;
}

export interface Group {
    id: string;
    name: string;
    members: string[]; // List of User IDs
    image?: string; // Optional group icon
    createdBy: string;
    createdAt: number;
}

export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE';

export interface Expense {
    id: string;
    groupId: string;
    description: string;
    amount: number;
    paidBy: string; // User ID
    // splitAmong: string[]; // DEPRECATED
    splits: { userId: string; amount: number }[]; // Explicit amount per user
    splitType: SplitType;
    createdAt: number;
}
