import { useI18n } from '../contexts/I18nContext';

/**
 * Hook simplificado para usar traducciones
 * Wrapper alrededor de useI18n para facilitar el uso
 * 
 * @example
 * const { t } = useTranslation();
 * const text = t('common.loading');
 */
export function useTranslation() {
  const { t, locale, setLocale } = useI18n();
  return { t, locale, setLocale };
}

