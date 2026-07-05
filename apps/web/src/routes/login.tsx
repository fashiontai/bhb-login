import { AuthShell } from "@bhb-login/ui/components/auth";
import { Button } from "@bhb-login/ui/components/button";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import LanguageToggle from "@/components/language-toggle";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { useLanguage } from "@/i18n";

export const Route = createFileRoute("/login")({
	component: RouteComponent,
});

function RouteComponent() {
	const [showSignIn, setShowSignIn] = useState(true);
	const { t } = useLanguage();

	return (
		<AuthShell
			brand={t.authShell.brand}
			copyright={t.authShell.copyright}
			footerLinks={t.authShell.footerLinks}
			headerActions={
				<>
					<Button
						className="hidden text-muted-foreground md:inline-flex"
						size="sm"
						type="button"
						variant="link"
					>
						{t.header.support}
					</Button>
					<Button
						className="hidden text-muted-foreground md:inline-flex"
						size="sm"
						type="button"
						variant="link"
					>
						{t.header.helpCenter}
					</Button>
					<Button
						className="hidden font-semibold md:inline-flex"
						onClick={() => setShowSignIn(false)}
						size="sm"
						type="button"
						variant="link"
					>
						{t.header.createAccount}
					</Button>
					<LanguageToggle />
				</>
			}
			navigationLabel={t.authShell.navigationLabel}
		>
			{showSignIn ? (
				<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
			) : (
				<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
			)}
		</AuthShell>
	);
}
