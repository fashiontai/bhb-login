import { AuthCard, AuthField } from "@bhb-login/ui/components/auth";
import { Button } from "@bhb-login/ui/components/button";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";

import { useLanguage } from "@/i18n";
import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

export default function SignUpForm({
	onSwitchToSignIn,
}: {
	onSwitchToSignIn: () => void;
}) {
	const navigate = useNavigate({
		from: "/",
	});
	const { isPending } = authClient.useSession();
	const { t } = useLanguage();
	const signUpText = t.signUp;

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
			name: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signUp.email(
				{
					email: value.email,
					password: value.password,
					name: value.name,
				},
				{
					onSuccess: () => {
						navigate({
							to: "/dashboard",
						});
						toast.success(signUpText.success);
					},
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText);
					},
				}
			);
		},
		validators: {
			onSubmit: z.object({
				name: z.string().min(2, t.validation.nameMinLength),
				email: z.email(t.validation.invalidEmail),
				password: z.string().min(8, t.validation.passwordMinLength),
			}),
		},
	});

	if (isPending) {
		return <Loader />;
	}

	return (
		<AuthCard subtitle={signUpText.subtitle} title={signUpText.title}>
			<form
				className="flex flex-col gap-8"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div className="flex flex-col gap-7">
					<form.Field name="name">
						{(field) => (
							<AuthField
								error={field.state.meta.errors[0]?.message}
								id={field.name}
								label={signUpText.nameLabel}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								placeholder={signUpText.namePlaceholder}
								value={field.state.value}
							/>
						)}
					</form.Field>

					<form.Field name="email">
						{(field) => (
							<AuthField
								error={field.state.meta.errors[0]?.message}
								id={field.name}
								label={signUpText.emailLabel}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								placeholder={signUpText.emailPlaceholder}
								type="email"
								value={field.state.value}
							/>
						)}
					</form.Field>

					<form.Field name="password">
						{(field) => (
							<AuthField
								error={field.state.meta.errors[0]?.message}
								id={field.name}
								label={signUpText.passwordLabel}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								placeholder={signUpText.passwordPlaceholder}
								type="password"
								value={field.state.value}
							/>
						)}
					</form.Field>
				</div>

				<form.Subscribe
					selector={(state) => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
					})}
				>
					{({ canSubmit, isSubmitting }) => (
						<Button
							className="h-16 w-full rounded-lg text-sm"
							disabled={!canSubmit || isSubmitting}
							type="submit"
						>
							{isSubmitting ? signUpText.submitting : signUpText.submit}
						</Button>
					)}
				</form.Subscribe>
			</form>

			<div className="text-center">
				<span className="font-semibold text-muted-foreground text-sm">
					{signUpText.hasAccount}{" "}
				</span>
				<Button
					className="h-auto p-0 font-semibold text-sm"
					onClick={onSwitchToSignIn}
					type="button"
					variant="link"
				>
					{signUpText.signInCta}
				</Button>
			</div>
		</AuthCard>
	);
}
