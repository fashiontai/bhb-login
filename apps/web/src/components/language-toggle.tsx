import { Button } from "@bhb-login/ui/components/button";
import { LanguagesIcon } from "lucide-react";

import { useLanguage } from "@/i18n";

export default function LanguageToggle() {
	const { t, toggleLocale } = useLanguage();

	return (
		<Button
			aria-label={t.common.switchLanguage}
			className="h-8 gap-1.5 rounded-lg px-2 font-semibold"
			onClick={toggleLocale}
			title={t.common.switchToLanguage}
			type="button"
			variant="outline"
		>
			<LanguagesIcon aria-hidden="true" className="size-4" />
			<span className="min-w-5 text-xs">{t.common.languageShortLabel}</span>
		</Button>
	);
}
