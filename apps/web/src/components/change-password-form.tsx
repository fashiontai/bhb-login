import { AuthField } from "@bhb-login/ui/components/auth";
import { Button } from "@bhb-login/ui/components/button";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";

import { useLanguage } from "@/i18n";
import { authClient } from "@/lib/auth-client";
import { mapAuthError } from "@/lib/auth-error";

export default function ChangePasswordForm() {
	const { t } = useLanguage();
	const changePasswordText = t.changePassword;

	const changePasswordSchema = z
		.object({
			confirmPassword: z.string(),
			currentPassword: z.string().min(1, t.validation.currentPasswordRequired),
			newPassword: z.string().min(8, t.validation.passwordMinLength),
		})
		.refine((value) => value.newPassword === value.confirmPassword, {
			message: t.validation.passwordMismatch,
			path: ["confirmPassword"],
		})
		.refine((value) => value.newPassword !== value.currentPassword, {
			message: t.validation.newPasswordSameAsCurrent,
			path: ["newPassword"],
		});

	const form = useForm({
		defaultValues: {
			confirmPassword: "",
			currentPassword: "",
			newPassword: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.changePassword(
				{
					currentPassword: value.currentPassword,
					newPassword: value.newPassword,
					revokeOtherSessions: true,
				},
				{
					onSuccess: () => {
						toast.success(changePasswordText.success);
						form.reset();
					},
					onError: (error) => {
						toast.error(mapAuthError(error.error, t, "changePassword"));
					},
				}
			);
		},
		validators: {
			onSubmit: changePasswordSchema,
		},
	});

	return (
		<form
			className="flex flex-col gap-8"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<div className="flex flex-col gap-7">
				<form.Field name="currentPassword">
					{(field) => (
						<AuthField
							error={field.state.meta.errors[0]?.message}
							id={field.name}
							label={changePasswordText.currentPasswordLabel}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							placeholder={changePasswordText.currentPasswordPlaceholder}
							type="password"
							value={field.state.value}
						/>
					)}
				</form.Field>

				<form.Field name="newPassword">
					{(field) => (
						<AuthField
							error={field.state.meta.errors[0]?.message}
							id={field.name}
							label={changePasswordText.newPasswordLabel}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							placeholder={changePasswordText.newPasswordPlaceholder}
							type="password"
							value={field.state.value}
						/>
					)}
				</form.Field>

				<form.Field name="confirmPassword">
					{(field) => (
						<AuthField
							error={field.state.meta.errors[0]?.message}
							id={field.name}
							label={changePasswordText.confirmPasswordLabel}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							placeholder={changePasswordText.confirmPasswordPlaceholder}
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
						{isSubmitting
							? changePasswordText.submitting
							: changePasswordText.submit}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
