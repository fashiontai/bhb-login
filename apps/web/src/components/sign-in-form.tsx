import {
	AuthCard,
	AuthDivider,
	AuthField,
	GoogleButton,
	GoogleIcon,
} from "@bhb-login/ui/components/auth";
import { Button } from "@bhb-login/ui/components/button";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";

import { useLanguage } from "@/i18n";
import { authClient } from "@/lib/auth-client";
import { mapAuthError } from "@/lib/auth-error";

import Loader from "./loader";

export default function SignInForm({
	onSwitchToSignUp,
}: {
	onSwitchToSignUp: () => void;
}) {
	const navigate = useNavigate({
		from: "/",
	});
	const { isPending } = authClient.useSession();
	const { t } = useLanguage();
	const signInText = t.signIn;

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{
					email: value.email,
					password: value.password,
				},
				{
					onSuccess: () => {
						navigate({
							to: "/dashboard",
						});
						toast.success(signInText.success);
					},
					onError: (error) => {
						toast.error(mapAuthError(error.error, t));
					},
				}
			);
		},
		validators: {
			onSubmit: z.object({
				email: z.email(t.validation.invalidEmail),
				password: z.string().min(8, t.validation.passwordMinLength),
			}),
		},
	});

	if (isPending) {
		return <Loader />;
	}

	return (
		<AuthCard subtitle={signInText.subtitle} title={signInText.title}>
			<GoogleButton onClick={() => toast.info(signInText.googleNotConfigured)}>
				<GoogleIcon />
				{signInText.googleSubmit}
			</GoogleButton>

			<AuthDivider label={t.common.or} />
			<form
				className="flex flex-col gap-8"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div className="flex flex-col gap-7">
					<form.Field name="email">
						{(field) => (
							<AuthField
								error={field.state.meta.errors[0]?.message}
								id={field.name}
								label={signInText.emailLabel}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								placeholder={signInText.emailPlaceholder}
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
								label={signInText.passwordLabel}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								placeholder={signInText.passwordPlaceholder}
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
							{isSubmitting ? signInText.submitting : signInText.submit}
						</Button>
					)}
				</form.Subscribe>
			</form>

			<div className="text-center">
				<span className="font-semibold text-muted-foreground text-sm">
					{signInText.noAccount}{" "}
				</span>
				<Button
					className="h-auto p-0 font-semibold text-sm"
					onClick={onSwitchToSignUp}
					type="button"
					variant="link"
				>
					{signInText.createAccountCta}
				</Button>
			</div>
		</AuthCard>
	);
}
