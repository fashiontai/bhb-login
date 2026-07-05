import { env } from "@bhb-login/env/web";
import { Button } from "@bhb-login/ui/components/button";
import { Card, CardContent, CardHeader } from "@bhb-login/ui/components/card";
import { Input } from "@bhb-login/ui/components/input";
import { Label } from "@bhb-login/ui/components/label";
import { createFileRoute } from "@tanstack/react-router";
import {
	ExternalLinkIcon,
	GitBranchIcon,
	LoaderCircleIcon,
	ShieldCheckIcon,
} from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import LanguageToggle from "@/components/language-toggle";
import { useLanguage } from "@/i18n";

export const Route = createFileRoute("/github-profile")({
	component: RouteComponent,
});

interface GithubProfile {
	avatar_url: string | null;
	bio: string | null;
	blog: string | null;
	company: string | null;
	created_at: string;
	email: string | null;
	followers: number;
	following: number;
	html_url: string;
	id: number;
	location: string | null;
	login: string;
	name: string | null;
	public_repos: number;
	updated_at: string;
}

interface GithubProfileApiResponse {
	profile: GithubProfile;
}

interface GithubProfileApiError {
	error: string;
	message: string;
}

interface ProfileStatProps {
	label: string;
	value: number | string;
}

function ProfileStat({ label, value }: ProfileStatProps) {
	return (
		<div className="flex min-w-0 flex-col gap-1 border border-border bg-muted/40 p-3">
			<span className="text-muted-foreground text-xs">{label}</span>
			<span className="font-semibold text-base text-foreground">{value}</span>
		</div>
	);
}

const isGithubProfileApiError = (
	value: unknown
): value is GithubProfileApiError => {
	if (!value || typeof value !== "object") {
		return false;
	}

	return "message" in value && typeof value.message === "string";
};

function RouteComponent() {
	const { locale, t } = useLanguage();
	const [token, setToken] = useState("");
	const [profile, setProfile] = useState<GithubProfile | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const apiUrl = useMemo(() => `${env.VITE_SERVER_URL}/api/github/profile`, []);
	const dateFormatter = useMemo(
		() =>
			new Intl.DateTimeFormat(locale, {
				dateStyle: "medium",
				timeStyle: "short",
			}),
		[locale]
	);
	const canSubmit = token.trim().length > 0 && !isLoading;

	const formatDate = (value: string) => dateFormatter.format(new Date(value));

	const loadProfile = async () => {
		setIsLoading(true);
		setError(null);
		setProfile(null);

		try {
			const response = await fetch(apiUrl, {
				body: JSON.stringify({ token: token.trim() }),
				headers: {
					"Content-Type": "application/json",
				},
				method: "POST",
			});
			const payload = (await response.json()) as unknown;

			if (!response.ok) {
				const message = isGithubProfileApiError(payload)
					? payload.message
					: response.statusText;
				throw new Error(message);
			}

			const data = payload as GithubProfileApiResponse;
			setProfile(data.profile);
		} catch (requestError) {
			const message =
				requestError instanceof Error
					? requestError.message
					: t.githubProfile.errorTitle;
			setError(message);
		} finally {
			setIsLoading(false);
		}
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		await loadProfile();
	};

	return (
		<main className="min-h-screen bg-background px-6 py-8 text-foreground">
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
				<div className="flex items-start justify-between gap-4">
					<div className="flex min-w-0 flex-col gap-2">
						<div className="flex items-center gap-2 text-muted-foreground">
							<GitBranchIcon aria-hidden="true" className="size-5" />
							<span className="font-medium text-xs">GitHub</span>
						</div>
						<h1 className="font-semibold text-3xl text-foreground">
							{t.githubProfile.title}
						</h1>
						<p className="max-w-2xl text-muted-foreground text-sm leading-6">
							{t.githubProfile.subtitle}
						</p>
					</div>
					<LanguageToggle />
				</div>

				<Card className="rounded-lg">
					<CardHeader>
						<div className="flex flex-col gap-1">
							<h2 className="font-semibold text-card-foreground text-lg">
								{t.githubProfile.tokenLabel}
							</h2>
							<p className="text-muted-foreground text-xs leading-5">
								{t.githubProfile.tokenHelp}
							</p>
						</div>
					</CardHeader>
					<CardContent>
						<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
							<div className="flex flex-col gap-2">
								<Label htmlFor="github-token">
									{t.githubProfile.tokenLabel}
								</Label>
								<Input
									autoComplete="off"
									id="github-token"
									onChange={(event) => {
										setToken(event.target.value);
									}}
									placeholder={t.githubProfile.tokenPlaceholder}
									type="password"
									value={token}
								/>
							</div>

							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<p className="flex items-center gap-2 text-muted-foreground text-xs leading-5">
									<ShieldCheckIcon aria-hidden="true" className="size-4" />
									<span>{t.githubProfile.securityNote}</span>
								</p>
								<Button
									className="w-full rounded-lg sm:w-auto"
									disabled={!canSubmit}
									type="submit"
								>
									{isLoading ? (
										<LoaderCircleIcon
											aria-hidden="true"
											className="size-4 animate-spin"
										/>
									) : (
										<GitBranchIcon aria-hidden="true" className="size-4" />
									)}
									{isLoading
										? t.githubProfile.submitting
										: t.githubProfile.submit}
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>

				{error ? (
					<p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
						{t.githubProfile.errorTitle}: {error}
					</p>
				) : null}

				{profile ? (
					<Card className="rounded-lg">
						<CardHeader>
							<h2 className="font-semibold text-card-foreground text-lg">
								{t.githubProfile.resultTitle}
							</h2>
						</CardHeader>
						<CardContent className="flex flex-col gap-5">
							<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
								{profile.avatar_url ? (
									<img
										alt={`${profile.login} avatar`}
										className="size-20 rounded-lg border border-border object-cover"
										height="80"
										src={profile.avatar_url}
										width="80"
									/>
								) : null}
								<div className="flex min-w-0 flex-1 flex-col gap-2">
									<div className="flex flex-col gap-1">
										<h3 className="break-words font-semibold text-2xl">
											{profile.name ?? profile.login}
										</h3>
										<p className="text-muted-foreground text-sm">
											@{profile.login}
										</p>
									</div>
									{profile.bio ? (
										<p className="text-sm leading-6">{profile.bio}</p>
									) : null}
									<a
										className="inline-flex w-fit items-center gap-1 text-primary text-sm hover:underline"
										href={profile.html_url}
										rel="noopener"
										target="_blank"
									>
										{t.githubProfile.profileUrl}
										<ExternalLinkIcon aria-hidden="true" className="size-4" />
									</a>
								</div>
							</div>

							<div className="grid gap-3 sm:grid-cols-3">
								<ProfileStat
									label={t.githubProfile.publicRepos}
									value={profile.public_repos}
								/>
								<ProfileStat
									label={t.githubProfile.followers}
									value={profile.followers}
								/>
								<ProfileStat
									label={t.githubProfile.following}
									value={profile.following}
								/>
							</div>

							<div className="grid gap-3 text-sm sm:grid-cols-2">
								<ProfileStat
									label={t.githubProfile.createdAt}
									value={formatDate(profile.created_at)}
								/>
								<ProfileStat
									label={t.githubProfile.updatedAt}
									value={formatDate(profile.updated_at)}
								/>
							</div>
						</CardContent>
					</Card>
				) : null}
			</div>
		</main>
	);
}
