import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar, type TabType } from "../components/Sidebar";
import { Header } from "../components/Header";
import type { AuthToken } from "../types/auth";

const TAB_PATH: Record<TabType, string> = {
    upload: '/upload',
    traffic: '/upload-traffic',
    sku: '/sku',
    bundle: '/sku-bundling',
    team: '/team',
};

interface MainPageProps {
    authToken: AuthToken;
    onAuthChange: (token: AuthToken | undefined) => void;
}

function MainPage({ authToken, onAuthChange }: MainPageProps) {
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
    const location = useLocation();
    const navigate = useNavigate();

    // The URL is now the source of truth for which tab is active, e.g.
    // /upload, /sku, /sku-bundling, /team — instead of local component state.
    // /sku-bundling and /upload-traffic are checked first: they also start with '/sku' / '/upload'.
    const activeTab: TabType = location.pathname.startsWith('/upload-traffic')
        ? 'traffic'
        : location.pathname.startsWith('/sku-bundling')
        ? 'bundle'
        : location.pathname.startsWith('/sku')
        ? 'sku'
        : location.pathname.startsWith('/team')
            ? 'team'
            : 'upload';

    const roles: string[] = authToken?.decoded_token?.roles ?? [];
    const isAdmin = roles.includes('admin');

    const handleToggleCollapse = () => {
        setIsCollapsed((prev) => !prev)
    }

    return (
        <div className="app-shell">
            {/* Section 1: Left Menu Bar (20% width, collapsible) */}
            <Sidebar
                activeTab={activeTab}
                onSelectTab={(tab) => navigate(TAB_PATH[tab])}
                isCollapsed={isCollapsed}
                onToggleCollapse={handleToggleCollapse}
                isAdmin={isAdmin}
            />

            {/* Section 2: Display Container */}
            <main className="display-container">
                <Header
                    activeTab={activeTab}
                    onToggleSidebar={handleToggleCollapse}
                    authToken={authToken}
                    onAuthChange={onAuthChange}
                />

                <Outlet />
            </main>
        </div>
    )
}

export default MainPage;
