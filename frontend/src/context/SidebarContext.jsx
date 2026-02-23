import React, { createContext, useContext, useState, useCallback } from 'react';

const SIDEBAR_KEY = 'utube_sidebar_open';

const SidebarContext = createContext(null);

export const SidebarProvider = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        try {
            return localStorage.getItem(SIDEBAR_KEY) === 'true';
        } catch {
            return false;
        }
    });

    const toggleSidebar = useCallback(() => {
        setIsSidebarOpen(prev => {
            const next = !prev;
            try {
                localStorage.setItem(SIDEBAR_KEY, String(next));
            } catch { /* ignore */ }
            return next;
        });
    }, []);

    const setSidebarOpen = useCallback((value) => {
        setIsSidebarOpen(value);
        try {
            localStorage.setItem(SIDEBAR_KEY, String(value));
        } catch { /* ignore */ }
    }, []);

    return (
        <SidebarContext.Provider value={{ isSidebarOpen, toggleSidebar, setSidebarOpen }}>
            {children}
        </SidebarContext.Provider>
    );
};

export const useSidebar = () => {
    const ctx = useContext(SidebarContext);
    if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
    return ctx;
};
