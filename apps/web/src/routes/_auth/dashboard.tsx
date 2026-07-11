import { Button, buttonVariants } from "@bhb-login/ui/components/button";
import {
	createFileRoute,
	Link,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { GitBranchIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import ChangePasswordForm from "@/components/change-password-form";
import LanguageToggle from "@/components/language-toggle";
import { useLanguage } from "@/i18n";
import { authClient } from "@/lib/auth-client";
import { mapAuthError } from "@/lib/auth-error";

export const Route = createFileRoute("/_auth/dashboard")({
	component: RouteComponent,
});

function RouteComponent() {
	const { session } = Route.useRouteContext();
	const navigate = useNavigate();
	const router = useRouter();
	const { t } = useLanguage();

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
			<div className="flex w-full max-w-lg flex-col gap-6">
				<section className="flex flex-col gap-6 rounded-lg border bg-card p-8 shadow-[0_4px_20px_rgba(9,30,66,0.08)]">
					<div className="flex items-start justify-between gap-4">
						<div className="flex flex-col gap-2">
							<h1 className="font-semibold text-2xl text-card-foreground">
								{t.dashboard.title}
							</h1>
							<p className="text-muted-foreground text-sm">
								{t.dashboard.welcome(session.data?.user.name)}
							</p>
						</div>
						<LanguageToggle />
					</div>
					<div className="grid gap-3 sm:grid-cols-2">
						<Link
							className={buttonVariants({ variant: "outline" })}
							to="/github-profile"
						>
							<GitBranchIcon aria-hidden="true" className="size-4" />
							{t.dashboard.githubAccounts}
						</Link>
						<Link
							className={buttonVariants({ variant: "outline" })}
							to="/introduction"
						>
							<SparklesIcon aria-hidden="true" className="size-4" />
							{t.dashboard.personalIntroduction}
						</Link>
					</div>
					<Button
						className="h-10 rounded-lg"
						onClick={() => {
							authClient.signOut({
								fetchOptions: {
									onError: (error) => {
										toast.error(mapAuthError(error.error, t));
									},
									onSuccess: async () => {
										// 清除路由缓存的会话数据，避免退出后短暂放行受保护路由；
										// invalidate 失败也要跳转，避免签出成功却停在受保护页面
										try {
											await router.invalidate();
										} catch {
											// 忽略缓存失效异常，继续跳转到登录页
										}
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

				<section className="flex flex-col gap-6 rounded-lg border bg-card p-8 shadow-[0_4px_20px_rgba(9,30,66,0.08)]">
					<h2 className="font-semibold text-card-foreground text-xl">
						{t.changePassword.title}
					</h2>
					<ChangePasswordForm />
				</section>
			</div>
		</div>
	);
}
