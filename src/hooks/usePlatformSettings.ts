import { useEffect, useState } from "react";
import { dataService, isDemoDataMode } from "../services/dataService";
import type { LegalSettings, PlatformSettings } from "../services/dataService";
import { appStorage } from "../services/appStorage";
import { loadPublicAppSettings } from "../services/platformSettingsApiService";
import { isAbortError, reportApiError } from "../services/apiErrorUtils";

export const usePlatformSettings = () => {
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(() =>
    appStorage.getPlatformSettings()
  );
  const [legalSettings, setLegalSettings] = useState<LegalSettings>(() =>
    appStorage.getLegalSettings()
  );

  useEffect(() => {
    const applySettings = (
      platform?: Partial<PlatformSettings>,
      legal?: Partial<LegalSettings>
    ) => {
      setPlatformSettings({
        ...appStorage.getPlatformSettings(),
        ...(platform || {}),
      });
      setLegalSettings({
        ...appStorage.getLegalSettings(),
        ...(legal || {}),
      });
    };

    if (isDemoDataMode) {
      const refresh = () => {
        setPlatformSettings(dataService.getPlatformSettings());
        setLegalSettings(dataService.getLegalSettings());
      };
      window.addEventListener("platform-settings-updated", refresh);
      window.addEventListener("app-data-updated", refresh);
      return () => {
        window.removeEventListener("platform-settings-updated", refresh);
        window.removeEventListener("app-data-updated", refresh);
      };
    }

    let cancelled = false;
    const controller = new AbortController();
    const refreshPublicSettings = () =>
      loadPublicAppSettings(controller.signal)
      .then((settings) => {
        if (cancelled) return;
        applySettings(settings.platformSettings, settings.legalSettings);
      })
      .catch((error) => {
        if (isAbortError(error)) return;
        reportApiError(error, { silentTransient: true });
      });

    refreshPublicSettings();
    window.addEventListener("platform-settings-updated", refreshPublicSettings);

    return () => {
      cancelled = true;
      controller.abort();
      window.removeEventListener("platform-settings-updated", refreshPublicSettings);
    };
  }, []);

  return { platformSettings, legalSettings };
};
