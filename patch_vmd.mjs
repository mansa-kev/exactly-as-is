import fs from 'fs';

let content = fs.readFileSync('src/components/public/VehicleModelDetails.tsx', 'utf8');

// 1. Add import for urlUtils
const importUrlUtils = `import { parseVehicleFriendlyId, generateVehicleSlug } from '../../utils/urlUtils';\nimport { supabase } from '../../lib/supabase';`;
content = content.replace("import { supabase } from '../../lib/supabase';", importUrlUtils);

// 2. Change useParams to get slug instead of id
const useParamsReplace = `  const { slug } = useParams<{ slug: string }>();
  const id = slug; // Keep id variable for internal logic, but we'll parse it`;
content = content.replace("  const { id } = useParams<{ id: string }>();", useParamsReplace);

// 3. Update fetchModel
const fetchModelNew = `  useEffect(() => {
    async function fetchModel() {
      if (!slug) return;
      
      const { friendlyId, uuid } = parseVehicleFriendlyId(slug);
      
      try {
        let familyGroup = null;
        if (friendlyId) {
          familyGroup = await fleetService.getVehicleModelFamilyByFriendlyId(friendlyId);
        } else if (uuid) {
          familyGroup = await fleetService.getVehicleModelFamilyById(uuid);
        }
        
        if (familyGroup) {
          setModelFamily(familyGroup);
          // If a specific variant is requested (via UUID fallback), set it
          if (uuid && familyGroup.variants.some((v: any) => v.id === uuid)) {
             const v = familyGroup.variants.find((v: any) => v.id === uuid);
             if (v) setModel(v);
             else setModel(familyGroup.representative);
          } else {
             setModel(familyGroup.representative);
          }
        } else {
          setError('Vehicle model not found');
        }
      } catch (err: any) {
        console.error('Error fetching model:', err);
        setError('Failed to load vehicle model');
      } finally {
        setLoading(false);
      }
    }
    fetchModel();
  }, [slug]);`;

content = content.replace(/  useEffect\(\(\) => \{\n    async function fetchModel\(\) \{[\s\S]*?fetchModel\(\);\n  \}, \[id\]\);/m, fetchModelNew);

// 4. Update shareUrl and SEO tags
content = content.replace(
  /const shareUrl = `\$\{window\.location\.origin\}\/models\/\$\{model\.id\}\?booking=true`;/g,
  "const shareUrl = `${window.location.origin}/vehicles/${generateVehicleSlug(model)}?booking=true`;"
);

content = content.replace(
  /href=\{`https:\/\/linkedupcarsrentals\.com\/models\/\$\{model\.id\}`\}/g,
  "href={`https://linkedupcarsrentals.com/vehicles/${generateVehicleSlug(model)}`}"
);

content = content.replace(
  /content=\{`https:\/\/linkedupcarsrentals\.com\/models\/\$\{model\.id\}`\}/g,
  "content={`https://linkedupcarsrentals.com/vehicles/${generateVehicleSlug(model)}`}"
);

// 5. Update navigate calls (variant selection)
content = content.replace(
  /navigate\(`\/models\/\$\{variant\.id\}\$\{location\.search\}`/g,
  "navigate(`/vehicles/${generateVehicleSlug(variant)}${location.search}`"
);

fs.writeFileSync('src/components/public/VehicleModelDetails.tsx', content);
