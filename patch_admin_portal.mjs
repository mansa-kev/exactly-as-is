import fs from 'fs';

let content = fs.readFileSync('src/components/AdminPortal.tsx', 'utf8');

// Add import 
content = content.replace("const importAdminLogout = () => import('./admin/AdminLogout');", "const importAdminLogout = () => import('./admin/AdminLogout');\nconst importAdminAnalyticsCenter = () => import('./admin/AdminAnalyticsCenter');");
content = content.replace("const AdminLogout = React.lazy(() => importAdminLogout().then(m => ({ default: m.AdminLogout })));", "const AdminLogout = React.lazy(() => importAdminLogout().then(m => ({ default: m.AdminLogout })));\nconst AdminAnalyticsCenter = React.lazy(() => importAdminAnalyticsCenter().then(m => ({ default: m.AdminAnalyticsCenter })));");

// Add preloader
content = content.replace("logout: importAdminLogout,", "logout: importAdminLogout,\n  analytics: importAdminAnalyticsCenter,");

// Add to menu
content = content.replace("{ id: 'reports', label: 'Reports', icon: BarChart3 },", "{ id: 'reports', label: 'Reports', icon: BarChart3 },\n      { id: 'analytics', label: 'Analytics & Traffic', icon: TrendingUp },");

// Add route
content = content.replace("<Route path=\"logout\" element={<AdminLogout />} />", "<Route path=\"logout\" element={<AdminLogout />} />\n                <Route path=\"analytics\" element={<AdminAnalyticsCenter />} />");

fs.writeFileSync('src/components/AdminPortal.tsx', content);

