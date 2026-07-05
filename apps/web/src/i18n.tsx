import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "zh-CN" | "en-US";

export interface AppTranslations {
	app: {
		description: string;
		title: string;
	};
	authErrors: {
		emailExists: string;
		invalidCredentials: string;
		invalidCurrentPassword: string;
		passwordTooShort: string;
		unknown: string;
	};
	authShell: {
		brand: string;
		copyright: string;
		footerLinks: Array<{
			href: string;
			label: string;
		}>;
		navigationLabel: string;
	};
	changePassword: {
		confirmPasswordLabel: string;
		confirmPasswordPlaceholder: string;
		currentPasswordLabel: string;
		currentPasswordPlaceholder: string;
		newPasswordLabel: string;
		newPasswordPlaceholder: string;
		submit: string;
		submitting: string;
		success: string;
		title: string;
	};
	common: {
		languageShortLabel: string;
		or: string;
		retry: string;
		switchLanguage: string;
		switchToLanguage: string;
	};
	dashboard: {
		signOut: string;
		title: string;
		welcome: (name?: string | null) => string;
	};
	header: {
		createAccount: string;
		helpCenter: string;
		support: string;
	};
	signIn: {
		createAccountCta: string;
		emailLabel: string;
		emailPlaceholder: string;
		googleNotConfigured: string;
		googleSubmit: string;
		noAccount: string;
		passwordLabel: string;
		passwordPlaceholder: string;
		submit: string;
		submitting: string;
		subtitle: string;
		success: string;
		title: string;
	};
	signUp: {
		emailLabel: string;
		emailPlaceholder: string;
		hasAccount: string;
		nameLabel: string;
		namePlaceholder: string;
		passwordLabel: string;
		passwordPlaceholder: string;
		signInCta: string;
		submit: string;
		submitting: string;
		subtitle: string;
		success: string;
		title: string;
	};
	validation: {
		currentPasswordRequired: string;
		invalidEmail: string;
		nameMinLength: string;
		newPasswordSameAsCurrent: string;
		passwordMinLength: string;
		passwordMismatch: string;
	};
}

const DEFAULT_LOCALE: Locale = "zh-CN";
const LOCALE_STORAGE_KEY = "bhb-login.locale";

const translations = {
	"zh-CN": {
		app: {
			description: "BHB 登录系统",
			title: "BHB 登录",
		},
		authErrors: {
			emailExists: "该邮箱已被注册，请直接登录或更换邮箱",
			invalidCredentials: "邮箱或密码不正确，请重新输入",
			invalidCurrentPassword: "当前密码不正确",
			passwordTooShort: "密码至少需要 8 个字符",
			unknown: "操作失败，请稍后重试",
		},
		authShell: {
			brand: "BHB 登录",
			copyright: "© 2026 BHB 登录。保留所有权利。",
			footerLinks: [
				{ href: "#", label: "隐私政策" },
				{ href: "#", label: "服务条款" },
				{ href: "#", label: "Cookie 政策" },
			],
			navigationLabel: "主导航",
		},
		changePassword: {
			confirmPasswordLabel: "确认新密码",
			confirmPasswordPlaceholder: "********",
			currentPasswordLabel: "当前密码",
			currentPasswordPlaceholder: "********",
			newPasswordLabel: "新密码",
			newPasswordPlaceholder: "********",
			submit: "确认修改",
			submitting: "修改中...",
			success: "密码修改成功",
			title: "修改密码",
		},
		common: {
			languageShortLabel: "中",
			or: "或",
			retry: "重试",
			switchLanguage: "切换语言",
			switchToLanguage: "切换到英文",
		},
		dashboard: {
			signOut: "退出登录",
			title: "控制台",
			welcome: (name) => `欢迎，${name ?? "用户"}`,
		},
		header: {
			createAccount: "创建账户",
			helpCenter: "帮助中心",
			support: "支持",
		},
		signIn: {
			createAccountCta: "注册",
			emailLabel: "邮箱地址",
			emailPlaceholder: "name@company.com",
			googleNotConfigured: "暂未配置 Google 登录",
			googleSubmit: "使用 Google 登录",
			noAccount: "还没有账户？",
			passwordLabel: "密码",
			passwordPlaceholder: "********",
			submit: "登录",
			submitting: "登录中...",
			subtitle: "访问你的安全门户控制台。",
			success: "登录成功",
			title: "欢迎回来",
		},
		signUp: {
			emailLabel: "邮箱地址",
			emailPlaceholder: "name@company.com",
			hasAccount: "已有账户？",
			nameLabel: "姓名",
			namePlaceholder: "请输入姓名",
			passwordLabel: "密码",
			passwordPlaceholder: "********",
			signInCta: "登录",
			submit: "注册",
			submitting: "注册中...",
			subtitle: "创建你的安全门户账户。",
			success: "注册成功",
			title: "创建账户",
		},
		validation: {
			currentPasswordRequired: "请输入当前密码",
			invalidEmail: "请输入有效的邮箱地址",
			nameMinLength: "姓名至少需要 2 个字符",
			newPasswordSameAsCurrent: "新密码不能与当前密码相同",
			passwordMinLength: "密码至少需要 8 个字符",
			passwordMismatch: "两次输入的密码不一致",
		},
	},
	"en-US": {
		app: {
			description: "BHB login system",
			title: "BHB Login",
		},
		authErrors: {
			emailExists:
				"This email is already registered. Sign in or use another email.",
			invalidCredentials: "Incorrect email or password. Please try again.",
			invalidCurrentPassword: "Current password is incorrect",
			passwordTooShort: "Password must be at least 8 characters",
			unknown: "Something went wrong. Please try again later.",
		},
		authShell: {
			brand: "BHB Login",
			copyright: "© 2026 BHB Login. All rights reserved.",
			footerLinks: [
				{ href: "#", label: "Privacy Policy" },
				{ href: "#", label: "Terms of Service" },
				{ href: "#", label: "Cookie Policy" },
			],
			navigationLabel: "Main navigation",
		},
		changePassword: {
			confirmPasswordLabel: "Confirm New Password",
			confirmPasswordPlaceholder: "********",
			currentPasswordLabel: "Current Password",
			currentPasswordPlaceholder: "********",
			newPasswordLabel: "New Password",
			newPasswordPlaceholder: "********",
			submit: "Change Password",
			submitting: "Changing...",
			success: "Password changed successfully",
			title: "Change Password",
		},
		common: {
			languageShortLabel: "EN",
			or: "or",
			retry: "Retry",
			switchLanguage: "Switch language",
			switchToLanguage: "Switch to Chinese",
		},
		dashboard: {
			signOut: "Sign Out",
			title: "Dashboard",
			welcome: (name) => `Welcome ${name ?? "user"}`,
		},
		header: {
			createAccount: "Create Account",
			helpCenter: "Help Center",
			support: "Support",
		},
		signIn: {
			createAccountCta: "Sign up",
			emailLabel: "Email Address",
			emailPlaceholder: "name@company.com",
			googleNotConfigured: "Google sign-in is not configured yet",
			googleSubmit: "Sign in with Google",
			noAccount: "Don't have an account?",
			passwordLabel: "Password",
			passwordPlaceholder: "********",
			submit: "Sign In",
			submitting: "Signing in...",
			subtitle: "Access your secure portal dashboard.",
			success: "Sign in successful",
			title: "Welcome Back",
		},
		signUp: {
			emailLabel: "Email Address",
			emailPlaceholder: "name@company.com",
			hasAccount: "Already have an account?",
			nameLabel: "Name",
			namePlaceholder: "Your name",
			passwordLabel: "Password",
			passwordPlaceholder: "********",
			signInCta: "Sign in",
			submit: "Sign Up",
			submitting: "Signing up...",
			subtitle: "Create your secure portal profile.",
			success: "Sign up successful",
			title: "Create Account",
		},
		validation: {
			currentPasswordRequired: "Please enter your current password",
			invalidEmail: "Invalid email address",
			nameMinLength: "Name must be at least 2 characters",
			newPasswordSameAsCurrent:
				"New password must be different from the current password",
			passwordMinLength: "Password must be at least 8 characters",
			passwordMismatch: "Passwords do not match",
		},
	},
} satisfies Record<Locale, AppTranslations>;

interface LanguageContextValue {
	locale: Locale;
	setLocale: (locale: Locale) => void;
	t: AppTranslations;
	toggleLocale: () => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
	undefined
);

const isLocale = (value: string | null): value is Locale =>
	value === "zh-CN" || value === "en-US";

const getStoredLocale = (): Locale => {
	if (typeof window === "undefined") {
		return DEFAULT_LOCALE;
	}

	try {
		const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
		return isLocale(storedLocale) ? storedLocale : DEFAULT_LOCALE;
	} catch {
		return DEFAULT_LOCALE;
	}
};

export const getRuntimeTranslations = (): AppTranslations =>
	translations[getStoredLocale()];

export function LanguageProvider({ children }: { children: ReactNode }) {
	const [locale, setLocale] = useState<Locale>(getStoredLocale);
	const t = translations[locale];

	useEffect(() => {
		try {
			window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
		} catch {
			// Ignore storage failures; the in-memory language still works.
		}

		document.documentElement.lang = locale;
		document.title = t.app.title;
		document
			.querySelector('meta[name="description"]')
			?.setAttribute("content", t.app.description);
	}, [locale, t.app.description, t.app.title]);

	const value = useMemo<LanguageContextValue>(
		() => ({
			locale,
			setLocale,
			t,
			toggleLocale: () => {
				setLocale((currentLocale) =>
					currentLocale === "zh-CN" ? "en-US" : "zh-CN"
				);
			},
		}),
		[locale, t]
	);

	return (
		<LanguageContext.Provider value={value}>
			{children}
		</LanguageContext.Provider>
	);
}

export const useLanguage = (): LanguageContextValue => {
	const context = useContext(LanguageContext);
	if (!context) {
		throw new Error("useLanguage must be used within LanguageProvider");
	}

	return context;
};
