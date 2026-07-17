import fs from 'fs';

let content = fs.readFileSync('src/components/public/CarShowroom.tsx', 'utf8');
const analyticsImport = "import { analyticsService } from '../../services/analyticsService';\n";
content = content.replace("import { generateVehicleSlug }", analyticsImport + "import { generateVehicleSlug }");
content = content.replace("<Link\n                  to={url}", "<Link\n                  onClick={() => analyticsService.trackEvent('click', 'vehicle_card', { metadata: { vehicle_id: group.representativeId, model: group.displayName } })}\n                  to={url}");
fs.writeFileSync('src/components/public/CarShowroom.tsx', content);

let insightsContent = fs.readFileSync('src/components/public/InsightsHome.tsx', 'utf8');
insightsContent = insightsContent.replace("import { Link } from 'react-router-dom';", "import { Link } from 'react-router-dom';\n" + analyticsImport);
insightsContent = insightsContent.replace("<Link\n                  key={item.id}\n                  to={`/insights/${item.slug}`}", "<Link\n                  key={item.id}\n                  onClick={() => analyticsService.trackEvent('click', 'article_card', { metadata: { article_slug: item.slug, title: item.title } })}\n                  to={`/insights/${item.slug}`}");
fs.writeFileSync('src/components/public/InsightsHome.tsx', insightsContent);

