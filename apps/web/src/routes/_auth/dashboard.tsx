import { Button } from "@bhb-login/ui/components/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useLanguage } from "@/i18n";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth/dashboard")({
	component: RouteComponent,
});

function RouteComponent() {
	const { session } = Route.useRouteContext();
	const navigate = useNavigate();
	const { t } = useLanguage();

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-6">
			<section className="flex w-full max-w-lg flex-col gap-6 rounded-lg border bg-card p-8 shadow-[0_4px_20px_rgba(9,30,66,0.08)]">
				<div className="flex flex-col gap-2">
					<h1 className="font-semibold text-2xl text-card-foreground">
						{t.dashboard.title}
					</h1>
					<p className="text-muted-foreground text-sm">
						{t.dashboard.welcome(session.data?.user.name)}
					</p>
				</div>
				<Button
					className="h-10 rounded-lg"
					onClick={() => {
						authClient.signOut({
							fetchOptions: {
								onSuccess: () => {
									navigate({
										to: "/login",
									});
								},
							},
						});
					}}
					type="button"
				>
					{t.dashboard.signOut}
				</Button>
			</section>
		</div>
	);
}
