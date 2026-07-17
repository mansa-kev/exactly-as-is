import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add import
const importTracker = "import { AnalyticsTracker } from './components/shared/AnalyticsTracker';\n";
content = content.replace("import { ScrollToTop }", importTracker + "import { ScrollToTop }");

// Add component inside Router
content = content.replace("<ScrollToTop />", "<ScrollToTop />\n          <AnalyticsTracker />");

fs.writeFileSync('src/App.tsx', content);
