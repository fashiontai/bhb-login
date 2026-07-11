import { env } from "@bhb-login/env/web";
import { Button, buttonVariants } from "@bhb-login/ui/components/button";
import { Input } from "@bhb-login/ui/components/input";
import { Label } from "@bhb-login/ui/components/label";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	ExternalLinkIcon,
	GitBranchIcon,
	LoaderCircleIcon,
	SparklesIcon,
} from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import LanguageToggle from "@/components/language-toggle";
import { useLanguage } from "@/i18n";

export const Route = createFileRoute("/_auth/introduction")({
	component: RouteComponent,
});

interface Introduction {
	avatarUrl: string;
	content: string;
	generatedAt: string;
	locale: "zh-CN" | "en-US";
	name: string;
	profileUrl: string;
	username: string;
}

interface IntroductionResponse {
	introduction: Introduction;
}

interface ApiError {
	message?: string;
}

function RouteComponent() {
	const { locale, t } = useLanguage();
	const [username, setUsername] = useState("");
	const [result, setResult] = useState<Introduction | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isGenerating, setIsGenerating] = useState(false);

	const generateIntroduction = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);
		setIsGenerating(true);

		try {
			const response = await fetch(
				`${env.VITE_SERVER_URL}/api/introductions/generate`,
				{
					body: JSON.stringify({ locale, username: username.trim() }),
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					method: "POST",
				}
			);
			const payload = (await response.json()) as IntroductionResponse &
				ApiError;
			if (!response.ok) {
				throw new Error(payload.message ?? t.introduction.generateFailed);
			}
			setResult(payload.introduction);
		} catch (requestError) {
			setError(
				requestError instanceof Error
					? requestError.message
					: t.introduction.generateFailed
			);
		} finally {
			setIsGenerating(false);
		}
	};

	const loadPublicIntroduction = async () => {
		setError(null);
		try {
			const response = await fetch(
				`${env.VITE_GO_PROFILE_URL}/public/v1/introductions/${encodeURIComponent(username.trim())}?locale=${locale}`
			);
			const payload = (await response.json()) as IntroductionResponse &
				ApiError;
			if (!response.ok) {
				throw new Error(payload.message ?? t.introduction.loadFailed);
			}
			setResult(payload.introduction);
		} catch (requestError) {
			setError(
				requestError instanceof Error
					? requestError.message
					: t.introduction.loadFailed
			);
		}
	};

	const canSubmit = username.trim().length > 0 && !isGenerating;

	return (
		<main className="min-h-screen bg-background text-foreground">
			<header className="border-border border-b">
				<div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
					<Link
						className={buttonVariants({ size: "sm", variant: "ghost" })}
						to="/dashboard"
					>
						<ArrowLeftIcon aria-hidden="true" className="size-4" />
						{t.introduction.back}
					</Link>
					<LanguageToggle />
				</div>
			</header>

			<div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
				<section className="flex flex-col gap-6">
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
							<GitBranchIcon aria-hidden="true" className="size-4" />
							GitHub
						</div>
						<h1 className="font-semibold text-3xl">{t.introduction.title}</h1>
						<p className="max-w-xl text-muted-foreground text-sm leading-6">
							{t.introduction.subtitle}
						</p>
					</div>

					<form className="flex flex-col gap-4" onSubmit={generateIntroduction}>
						<div className="flex flex-col gap-2">
							<Label htmlFor="github-username">
								{t.introduction.usernameLabel}
							</Label>
							<Input
								autoComplete="off"
								id="github-username"
								onChange={(event) => setUsername(event.target.value)}
								placeholder={t.introduction.usernamePlaceholder}
								value={username}
							/>
						</div>
						<div className="flex flex-col gap-3 sm:flex-row">
							<Button disabled={!canSubmit} type="submit">
								{isGenerating ? (
									<LoaderCircleIcon
										aria-hidden="true"
										className="size-4 animate-spin"
									/>
								) : (
									<SparklesIcon aria-hidden="true" className="size-4" />
								)}
								{isGenerating
									? t.introduction.generating
									: t.introduction.generate}
							</Button>
							<Button
								disabled={!canSubmit}
								onClick={loadPublicIntroduction}
								type="button"
								variant="outline"
							>
								{t.introduction.loadPublic}
							</Button>
						</div>
					</form>

					{error ? (
						<p className="border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
							{error}
						</p>
					) : null}
				</section>

				<section className="min-h-80 border border-border bg-card p-6 shadow-[0_4px_20px_rgba(9,30,66,0.08)]">
					{result ? (
						<div className="flex h-full flex-col gap-6">
							<div className="flex items-center gap-4">
								{result.avatarUrl ? (
									<img
										alt={`${result.username} avatar`}
										className="size-16 border border-border object-cover"
										height="64"
										src={result.avatarUrl}
										width="64"
									/>
								) : null}
								<div className="min-w-0">
									<h2 className="break-words font-semibold text-xl">
										{result.name || result.username}
									</h2>
									<p className="text-muted-foreground text-sm">
										@{result.username}
									</p>
								</div>
							</div>
							<p className="whitespace-pre-wrap text-base leading-8">
								{result.content}
							</p>
							<a
								className="mt-auto inline-flex w-fit items-center gap-2 text-primary text-sm hover:underline"
								href={result.profileUrl}
								rel="noopener"
								target="_blank"
							>
								{t.introduction.viewProfile}
								<ExternalLinkIcon aria-hidden="true" className="size-4" />
							</a>
						</div>
					) : (
						<div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 text-center">
							<SparklesIcon
								aria-hidden="true"
								className="size-7 text-muted-foreground"
							/>
							<p className="max-w-sm text-muted-foreground text-sm leading-6">
								{t.introduction.empty}
							</p>
						</div>
					)}
				</section>
			</div>
		</main>
	);
}
