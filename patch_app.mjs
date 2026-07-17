import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const importNavigate = `import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';`;

content = content.replace(
  "import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';",
  importNavigate
);

const redirectComponent = `
function OldModelRedirect() {
  const { id } = useParams();
  const location = useLocation();
  return <Navigate to={\`/vehicles/\${id}\${location.search}\`} replace />;
}

export default function App() {`;

content = content.replace(
  "export default function App() {",
  redirectComponent
);

const routes = `
                          <Route path="/vehicles/:slug" element={<VehicleModelDetails />} />
                          <Route path="/models/:id" element={<OldModelRedirect />} />`;

content = content.replace(
  '                          <Route path="/models/:id" element={<VehicleModelDetails />} />',
  routes
);

fs.writeFileSync('src/App.tsx', content);
