// Locale switcher refs:
// - Paraglide docs: https://inlang.com/m/gerre34r/library-inlang-paraglideJs
// - Router example: https://github.com/TanStack/router/tree/main/examples/react/i18n-paraglide#switching-locale
import { getLocale, locales, setLocale } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'
import { cn } from '#/lib/utils'

export default function ParaglideLocaleSwitcher() {
  const currentLocale = getLocale()

  return (
    <div
      className="flex items-center gap-2 text-sm text-muted-foreground"
      aria-label={m.language_label()}
    >
      <div className="flex gap-1">
        {locales.map((locale) => (
          <button
            key={locale}
            type="button"
            onClick={() => setLocale(locale)}
            aria-pressed={locale === currentLocale}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium tracking-wide transition-colors',
              locale === currentLocale
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-input bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {locale.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}
