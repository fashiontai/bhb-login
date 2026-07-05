import type { AppTranslations } from "@/i18n";

/**
 * Shape of the error payload Better Auth passes to `onError` callbacks.
 * `code` mirrors the server-side `BASE_ERROR_CODES` keys; `message` and
 * `statusText` are kept as fallbacks when the code is missing or unmapped.
 */
export interface AuthErrorLike {
	code?: string;
	message?: string;
	statusText?: string;
}

type AuthErrorKey = keyof AppTranslations["authErrors"];

/**
 * Scopes error-code resolution for endpoints where Better Auth reuses the
 * same error code across different user-facing flows (see
 * `CHANGE_PASSWORD_ERROR_CODE_MAP` below).
 */
export type AuthErrorContext = "changePassword";

/**
 * Maps Better Auth error codes (see `BASE_ERROR_CODES` in `better-auth/core`)
 * to the localized `authErrors` i18n keys.
 */
const AUTH_ERROR_CODE_MAP: Record<string, AuthErrorKey> = {
	CREDENTIAL_ACCOUNT_NOT_FOUND: "invalidCredentials",
	INVALID_EMAIL_OR_PASSWORD: "invalidCredentials",
	INVALID_PASSWORD: "invalidCredentials",
	PASSWORD_TOO_SHORT: "passwordTooShort",
	USER_ALREADY_EXISTS: "emailExists",
	USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "emailExists",
	USER_NOT_FOUND: "invalidCredentials",
};

/**
 * `POST /api/auth/change-password` throws the same `INVALID_PASSWORD` code
 * as sign-in when `currentPassword` doesn't match, but the correct message
 * here is "current password is wrong", not "email or password is wrong".
 * Callers in the change-password flow must pass `context: "changePassword"`
 * so this scoped map takes precedence over `AUTH_ERROR_CODE_MAP`.
 */
const CHANGE_PASSWORD_ERROR_CODE_MAP: Record<string, AuthErrorKey> = {
	INVALID_PASSWORD: "invalidCurrentPassword",
};

/**
 * Resolves a Better Auth `onError` payload to a localized, user-facing
 * message. Falls back to the raw server message/statusText, then to the
 * generic `unknown` translation when nothing else is available.
 */
export function mapAuthError(
	error: AuthErrorLike | null | undefined,
	t: AppTranslations,
	context?: AuthErrorContext
): string {
	if (!error) {
		return t.authErrors.unknown;
	}

	const scopedMap =
		context === "changePassword" ? CHANGE_PASSWORD_ERROR_CODE_MAP : undefined;
	const key = error.code
		? (scopedMap?.[error.code] ?? AUTH_ERROR_CODE_MAP[error.code])
		: undefined;
	if (key) {
		return t.authErrors[key];
	}

	return error.message || error.statusText || t.authErrors.unknown;
}
