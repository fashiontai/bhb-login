import { env } from "@bhb-login/env/web";
import { Button } from "@bhb-login/ui/components/button";
import { Card, CardContent, CardHeader } from "@bhb-login/ui/components/card";
import { Input } from "@bhb-login/ui/components/input";
import { Label } from "@bhb-login/ui/components/label";
import { createFileRoute } from "@tanstack/react-router";
import {
	DatabaseIcon,
	ExternalLinkIcon,
	GitBranchIcon,
	LoaderCircleIcon,
	PlusIcon,
	ShieldCheckIcon,
	Trash2Icon,
} from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import LanguageToggle from "@/components/language-toggle";
import { useLanguage } from "@/i18n";

export const Route = createFileRoute("/_auth/github-profile")({
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

interface SavedGithubField {
	createdAt: string;
	id: string;
	key: string;
	updatedAt: string;
	value: string;
}

interface SavedGithubAccount {
	avatarUrl: string | null;
	bio: string | null;
	createdAt: string;
	fields: SavedGithubField[];
	followers: number;
	following: number;
	githubCreatedAt: string;
	githubId: number;
	id: string;
	login: string;
	name: string | null;
	profileUrl: string;
	publicRepos: number;
	updatedAt: string;
}

interface GithubAccountsApiResponse {
	accounts: SavedGithubAccount[];
}

interface GithubAccountApiResponse {
	account: SavedGithubAccount;
}

interface FieldDraft {
	key: string;
	value: string;
}

interface GithubFieldApiResponse {
	field: SavedGithubField;
}

interface ProfileStatProps {
	label: string;
	value: number | string;
}

function ProfileStat({ label, value }: ProfileStatProps) {
	return (
		<div className="flex min-w-0 flex-col gap-1 border border-border bg-muted/40 p-3">
			<span className="text-muted-foreground text-xs">{label}</span>
			<span className="break-words font-semibold text-base text-foreground">
				{value}
			</span>
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
	const [accounts, setAccounts] = useState<SavedGithubAccount[]>([]);
	const [fieldDrafts, setFieldDrafts] = useState<Record<string, FieldDraft>>(
		{}
	);
	const [error, setError] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isSavingAccount, setIsSavingAccount] = useState(false);
	const [pendingFieldAccountId, setPendingFieldAccountId] = useState<
		string | null
	>(null);
	const apiUrl = useMemo(() => `${env.VITE_SERVER_URL}/api/github/profile`, []);
	const accountsApiUrl = useMemo(
		() => `${env.VITE_SERVER_URL}/api/github/accounts`,
		[]
	);
	const dateFormatter = useMemo(
		() =>
			new Intl.DateTimeFormat(locale, {
				dateStyle: "medium",
				timeStyle: "short",
			}),
		[locale]
	);
	const canSubmit = token.trim().length > 0 && !isLoading;
	const canSaveAccount = token.trim().length > 0 && !isSavingAccount;

	const formatDate = (value: string) => dateFormatter.format(new Date(value));

	const loadAccounts = useCallback(async () => {
		try {
			const response = await fetch(accountsApiUrl, {
				credentials: "include",
			});
			const payload = (await response.json()) as unknown;

			if (!response.ok) {
				const message = isGithubProfileApiError(payload)
					? payload.message
					: response.statusText;
				throw new Error(message);
			}

			const data = payload as GithubAccountsApiResponse;
			setAccounts(data.accounts);
		} catch {
			setError(t.githubProfile.loadAccountsFailed);
		}
	}, [accountsApiUrl, t.githubProfile.loadAccountsFailed]);

	useEffect(() => {
		loadAccounts();
	}, [loadAccounts]);

	const loadProfile = async () => {
		setIsLoading(true);
		setError(null);
		setStatusMessage(null);
		setProfile(null);

		try {
			const response = await fetch(apiUrl, {
				body: JSON.stringify({ token: token.trim() }),
				credentials: "include",
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

	const saveAccount = async () => {
		setIsSavingAccount(true);
		setError(null);
		setStatusMessage(null);

		try {
			const response = await fetch(accountsApiUrl, {
				body: JSON.stringify({ token: token.trim() }),
				credentials: "include",
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

			const data = payload as GithubAccountApiResponse;
			setAccounts((currentAccounts) => [
				data.account,
				...currentAccounts.filter((account) => account.id !== data.account.id),
			]);
			setStatusMessage(t.githubProfile.savedAccount);
		} catch (requestError) {
			const message =
				requestError instanceof Error
					? requestError.message
					: t.githubProfile.errorTitle;
			setError(message);
		} finally {
			setIsSavingAccount(false);
		}
	};

	const deleteAccount = async (accountId: string) => {
		setError(null);
		setStatusMessage(null);

		try {
			const response = await fetch(
				`${accountsApiUrl}/${encodeURIComponent(accountId)}`,
				{
					credentials: "include",
					method: "DELETE",
				}
			);

			if (!response.ok) {
				const payload = (await response.json()) as unknown;
				const message = isGithubProfileApiError(payload)
					? payload.message
					: response.statusText;
				throw new Error(message);
			}

			setAccounts((currentAccounts) =>
				currentAccounts.filter((account) => account.id !== accountId)
			);
			setStatusMessage(t.githubProfile.accountDeleted);
		} catch (requestError) {
			const message =
				requestError instanceof Error
					? requestError.message
					: t.githubProfile.errorTitle;
			setError(message);
		}
	};

	const saveField = async (accountId: string) => {
		const draft = fieldDrafts[accountId] ?? { key: "", value: "" };
		setPendingFieldAccountId(accountId);
		setError(null);
		setStatusMessage(null);

		try {
			const response = await fetch(
				`${accountsApiUrl}/${encodeURIComponent(accountId)}/fields`,
				{
					body: JSON.stringify({
						key: draft.key.trim(),
						value: draft.value.trim(),
					}),
					credentials: "include",
					headers: {
						"Content-Type": "application/json",
					},
					method: "POST",
				}
			);
			const payload = (await response.json()) as unknown;

			if (!response.ok) {
				const message = isGithubProfileApiError(payload)
					? payload.message
					: response.statusText;
				throw new Error(message);
			}

			const data = payload as GithubFieldApiResponse;
			setAccounts((currentAccounts) =>
				currentAccounts.map((account) =>
					account.id === accountId
						? {
								...account,
								fields: [
									...account.fields.filter(
										(field) => field.id !== data.field.id
									),
									data.field,
								],
							}
						: account
				)
			);
			setFieldDrafts((currentDrafts) => ({
				...currentDrafts,
				[accountId]: { key: "", value: "" },
			}));
			setStatusMessage(t.githubProfile.fieldSaved);
		} catch (requestError) {
			const message =
				requestError instanceof Error
					? requestError.message
					: t.githubProfile.errorTitle;
			setError(message);
		} finally {
			setPendingFieldAccountId(null);
		}
	};

	const deleteField = async (accountId: string, fieldId: string) => {
		setError(null);
		setStatusMessage(null);

		try {
			const response = await fetch(
				`${accountsApiUrl}/${encodeURIComponent(accountId)}/fields/${encodeURIComponent(fieldId)}`,
				{
					credentials: "include",
					method: "DELETE",
				}
			);

			if (!response.ok) {
				const payload = (await response.json()) as unknown;
				const message = isGithubProfileApiError(payload)
					? payload.message
					: response.statusText;
				throw new Error(message);
			}

			setAccounts((currentAccounts) =>
				currentAccounts.map((account) =>
					account.id === accountId
						? {
								...account,
								fields: account.fields.filter((field) => field.id !== fieldId),
							}
						: account
				)
			);
			setStatusMessage(t.githubProfile.fieldDeleted);
		} catch (requestError) {
			const message =
				requestError instanceof Error
					? requestError.message
					: t.githubProfile.errorTitle;
			setError(message);
		}
	};

	const setFieldDraft = (
		accountId: string,
		key: keyof FieldDraft,
		value: string
	) => {
		setFieldDrafts((currentDrafts) => ({
			...currentDrafts,
			[accountId]: {
				key: currentDrafts[accountId]?.key ?? "",
				value: currentDrafts[accountId]?.value ?? "",
				[key]: value,
			},
		}));
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		await loadProfile();
	};

	return (
		<main className="min-h-screen bg-background px-6 py-8 text-foreground">
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
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

				{statusMessage ? (
					<p className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-primary text-sm">
						{statusMessage}
					</p>
				) : null}

				{profile ? (
					<Card className="rounded-lg">
						<CardHeader className="flex-row items-start justify-between gap-4">
							<h2 className="font-semibold text-card-foreground text-lg">
								{t.githubProfile.resultTitle}
							</h2>
							<Button
								className="shrink-0 rounded-lg"
								disabled={!canSaveAccount}
								onClick={() => {
									saveAccount();
								}}
								type="button"
								variant="outline"
							>
								{isSavingAccount ? (
									<LoaderCircleIcon
										aria-hidden="true"
										className="size-4 animate-spin"
									/>
								) : (
									<DatabaseIcon aria-hidden="true" className="size-4" />
								)}
								{t.githubProfile.saveAccount}
							</Button>
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

				<section className="flex flex-col gap-4">
					<div className="flex items-center justify-between gap-4">
						<h2 className="font-semibold text-2xl">
							{t.githubProfile.accountListTitle}
						</h2>
						<Button
							className="rounded-lg"
							onClick={() => {
								loadAccounts();
							}}
							type="button"
							variant="outline"
						>
							<DatabaseIcon aria-hidden="true" className="size-4" />
							{t.common.retry}
						</Button>
					</div>

					{accounts.length === 0 ? (
						<p className="rounded-lg border border-border p-4 text-muted-foreground text-sm">
							{t.githubProfile.noSavedAccounts}
						</p>
					) : (
						<div className="grid gap-4">
							{accounts.map((account) => {
								const draft = fieldDrafts[account.id] ?? {
									key: "",
									value: "",
								};
								const canSaveField =
									draft.key.trim().length > 0 &&
									draft.value.trim().length > 0 &&
									pendingFieldAccountId !== account.id;

								return (
									<Card className="rounded-lg" key={account.id}>
										<CardHeader className="flex-row items-start justify-between gap-4">
											<div className="flex min-w-0 items-center gap-3">
												{account.avatarUrl ? (
													<img
														alt={`${account.login} avatar`}
														className="size-12 rounded-lg border border-border object-cover"
														height="48"
														src={account.avatarUrl}
														width="48"
													/>
												) : null}
												<div className="flex min-w-0 flex-col gap-1">
													<h3 className="break-words font-semibold text-base">
														{account.name ?? account.login}
													</h3>
													<a
														className="text-muted-foreground text-xs hover:underline"
														href={account.profileUrl}
														rel="noopener"
														target="_blank"
													>
														@{account.login}
													</a>
												</div>
											</div>
											<Button
												className="shrink-0 rounded-lg"
												onClick={() => {
													deleteAccount(account.id);
												}}
												type="button"
												variant="destructive"
											>
												<Trash2Icon aria-hidden="true" className="size-4" />
												{t.githubProfile.delete}
											</Button>
										</CardHeader>
										<CardContent className="flex flex-col gap-4">
											<div className="grid gap-3 sm:grid-cols-3">
												<ProfileStat
													label={t.githubProfile.publicRepos}
													value={account.publicRepos}
												/>
												<ProfileStat
													label={t.githubProfile.followers}
													value={account.followers}
												/>
												<ProfileStat
													label={t.githubProfile.updatedAt}
													value={formatDate(account.updatedAt)}
												/>
											</div>

											<form
												className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
												onSubmit={(event) => {
													event.preventDefault();
													saveField(account.id);
												}}
											>
												<div className="flex flex-col gap-2">
													<Label htmlFor={`${account.id}-field-key`}>
														{t.githubProfile.fieldKeyLabel}
													</Label>
													<Input
														id={`${account.id}-field-key`}
														onChange={(event) => {
															setFieldDraft(
																account.id,
																"key",
																event.target.value
															);
														}}
														placeholder={t.githubProfile.fieldKeyPlaceholder}
														value={draft.key}
													/>
												</div>
												<div className="flex flex-col gap-2">
													<Label htmlFor={`${account.id}-field-value`}>
														{t.githubProfile.fieldValueLabel}
													</Label>
													<Input
														id={`${account.id}-field-value`}
														onChange={(event) => {
															setFieldDraft(
																account.id,
																"value",
																event.target.value
															);
														}}
														placeholder={t.githubProfile.fieldValuePlaceholder}
														value={draft.value}
													/>
												</div>
												<Button
													className="mt-auto rounded-lg"
													disabled={!canSaveField}
													type="submit"
												>
													{pendingFieldAccountId === account.id ? (
														<LoaderCircleIcon
															aria-hidden="true"
															className="size-4 animate-spin"
														/>
													) : (
														<PlusIcon aria-hidden="true" className="size-4" />
													)}
													{t.githubProfile.addField}
												</Button>
											</form>

											{account.fields.length > 0 ? (
												<div className="grid gap-2">
													{account.fields.map((field) => (
														<div
															className="flex items-center justify-between gap-3 border border-border bg-muted/30 p-3"
															key={field.id}
														>
															<div className="min-w-0">
																<p className="break-words font-medium text-sm">
																	{field.key}
																</p>
																<p className="break-words text-muted-foreground text-xs">
																	{field.value}
																</p>
															</div>
															<Button
																aria-label={t.githubProfile.deleteField}
																className="rounded-lg"
																onClick={() => {
																	deleteField(account.id, field.id);
																}}
																size="icon"
																type="button"
																variant="ghost"
															>
																<Trash2Icon
																	aria-hidden="true"
																	className="size-4"
																/>
															</Button>
														</div>
													))}
												</div>
											) : null}
										</CardContent>
									</Card>
								);
							})}
						</div>
					)}
				</section>
			</div>
		</main>
	);
}
