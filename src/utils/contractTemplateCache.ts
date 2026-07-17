import {
  applyTemplateReplacements,
  fetchCompanySettings,
  getMasterTemplateUrl,
  isHtmlContract,
  type ContractBookingData,
  type ContractCar,
} from './contractTemplate.js';

const templateHtmlCache = new Map<string, string>();
let settingsCache: Record<string, string> | null = null;
let settingsCacheAt = 0;
const SETTINGS_TTL_MS = 5 * 60_000;

async function fetchTemplateHtml(url: string): Promise<string> {
  const cached = templateHtmlCache.get(url);
  if (cached) return cached;

  const sessionKey = `contract_tpl:${url}`;
  try {
    const fromSession = sessionStorage.getItem(sessionKey);
    if (fromSession) {
      templateHtmlCache.set(url, fromSession);
      return fromSession;
    }
  } catch {
    // ignore sessionStorage errors
  }

  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error('Failed to load contract template');
  const html = await response.text();
  templateHtmlCache.set(url, html);
  try {
    sessionStorage.setItem(sessionKey, html);
  } catch {
    // ignore quota errors
  }
  return html;
}

async function getCompanySettingsCached(): Promise<Record<string, string>> {
  const now = Date.now();
  if (settingsCache && now - settingsCacheAt < SETTINGS_TTL_MS) {
    return settingsCache;
  }
  settingsCache = await fetchCompanySettings();
  settingsCacheAt = now;
  return settingsCache;
}

export async function prefetchContractAssets(contract: any): Promise<void> {
  if (!contract || !isHtmlContract(contract)) return;
  const templateUrl = getMasterTemplateUrl(contract);
  if (!templateUrl) return;
  await Promise.allSettled([fetchTemplateHtml(templateUrl), getCompanySettingsCached()]);
}

export async function loadFilledContractHtmlCached(
  contract: any,
  bookingData: ContractBookingData,
  car: ContractCar,
  signatureData = '',
  vehicleModelId?: string | null
): Promise<string | null> {
  if (!isHtmlContract(contract)) return null;

  const templateUrl = getMasterTemplateUrl(contract);
  if (!templateUrl) return null;

  const [templateHtml, settings] = await Promise.all([
    fetchTemplateHtml(templateUrl),
    getCompanySettingsCached(),
  ]);

  return applyTemplateReplacements(
    templateHtml,
    bookingData,
    car,
    settings,
    signatureData,
    vehicleModelId
  );
}
