import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar, type TabType } from "../components/Sidebar";
import { Header } from "../components/Header";
import type { AuthToken } from "../types/auth";

interface MainPageProps {
    authToken: AuthToken;
    onAuthChange: (token: AuthToken | undefined) => void;
}

function MainPage({ authToken, onAuthChange }: MainPageProps) {
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
    const location = useLocation();
    const navigate = useNavigate();

    // The URL is now the source of truth for which tab is active, e.g.
    // /upload, /sku, /team — instead of local component state.
    const activeTab: TabType = location.pathname.startsWith('/sku')
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
                onSelectTab={(tab) => navigate(`/${tab}`)}
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
