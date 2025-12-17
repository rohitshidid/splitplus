"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "../types";
import { StorageService } from "../services/StorageService";
import { useRouter } from "next/navigation";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (u: string, p: string) => Promise<void>;
    signup: (u: string, p: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    login: async () => { },
    signup: async () => { },
    logout: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Check for existing session
        const currentUser = StorageService.getCurrentUser();
        setUser(currentUser);
        setLoading(false);
    }, []);

    const login = async (u: string, p: string) => {
        // Simulate async
        await new Promise((r) => setTimeout(r, 500));
        const loggedUser = StorageService.login(u, p);
        setUser(loggedUser);
        router.push("/dashboard");
    };

    const signup = async (u: string, p: string) => {
        await new Promise((r) => setTimeout(r, 500));
        const newUser = StorageService.createUser(u, p);
        // Auto login after signup
        StorageService.login(u, p);
        setUser(newUser);
        router.push("/dashboard");
    };

    const logout = () => {
        StorageService.logout();
        setUser(null);
        router.push("/");
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
