import { Button } from "@bhb-login/ui/components/button";
import { Card, CardContent, CardHeader } from "@bhb-login/ui/components/card";
import { Input } from "@bhb-login/ui/components/input";
import { Label } from "@bhb-login/ui/components/label";
import { cn } from "@bhb-login/ui/lib/utils";
import type * as React from "react";

type AuthShellProps = React.ComponentProps<"div"> & {
	brand?: string;
	copyright?: string;
	footerLinks?: Array<{
		href: string;
		label: string;
	}>;
	headerActions?: React.ReactNode;
	navigationLabel?: string;
};

function AuthBrand({ children = "BHB 登录" }: { children?: React.ReactNode }) {
	return (
		<div className="font-semibold text-lg text-primary tracking-normal">
			{children}
		</div>
	);
}

function AuthShell({
	brand = "BHB 登录",
	children,
	className,
	copyright = "© 2026 BHB 登录。保留所有权利。",
	footerLinks = [
		{ href: "#", label: "隐私政策" },
		{ href: "#", label: "服务条款" },
		{ href: "#", label: "Cookie 政策" },
	],
	headerActions,
	navigationLabel = "主导航",
	...props
}: AuthShellProps) {
	return (
		<div
			className={cn(
				"flex min-h-screen flex-col bg-background text-foreground",
				className
			)}
			{...props}
		>
			<header className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur">
				<nav
					aria-label={navigationLabel}
					className="mx-auto flex min-h-20 w-full max-w-6xl items-center justify-between px-6"
				>
					<AuthBrand>{brand}</AuthBrand>
					{headerActions ? (
						<div className="flex items-center gap-2 md:gap-8">
							{headerActions}
						</div>
					) : null}
				</nav>
			</header>

			<main className="flex flex-1 items-center justify-center px-6 py-12">
				{children}
			</main>

			<footer className="mt-auto w-full border-t bg-background">
				<div className="mx-auto flex min-h-28 w-full max-w-6xl flex-col items-center justify-between gap-6 px-6 py-8 md:flex-row md:py-0">
					<AuthBrand>{brand}</AuthBrand>
					<div className="flex flex-wrap justify-center gap-6">
						{footerLinks.map((link) => (
							<a
								className="font-medium text-muted-foreground text-xs transition-colors hover:text-primary"
								href={link.href}
								key={link.label}
							>
								{link.label}
							</a>
						))}
					</div>
					<div className="font-medium text-muted-foreground text-xs">
						{copyright}
					</div>
				</div>
			</footer>
		</div>
	);
}

type AuthCardProps = React.ComponentProps<typeof Card> & {
	subtitle?: React.ReactNode;
	title: React.ReactNode;
};

function AuthCard({
	children,
	className,
	subtitle,
	title,
	...props
}: AuthCardProps) {
	return (
		<Card
			className={cn(
				"w-full max-w-[440px] gap-8 rounded-lg border bg-card py-8 shadow-[0_4px_20px_rgba(9,30,66,0.08)] md:max-w-[550px] md:px-12 md:py-14",
				className
			)}
			{...props}
		>
			<CardHeader className="gap-2 px-8 text-center md:px-8">
				<h1 className="font-semibold text-2xl text-card-foreground md:text-3xl">
					{title}
				</h1>
				{subtitle ? (
					<p className="text-base text-muted-foreground">{subtitle}</p>
				) : null}
			</CardHeader>
			<CardContent className="flex flex-col gap-8 px-8">{children}</CardContent>
		</Card>
	);
}

function AuthDivider({ label = "或" }: { label?: string }) {
	return (
		<div className="flex items-center gap-4">
			<div className="h-px flex-1 bg-border" />
			<span className="font-medium text-muted-foreground text-xs">{label}</span>
			<div className="h-px flex-1 bg-border" />
		</div>
	);
}

type AuthFieldProps = Omit<React.ComponentProps<"input">, "className"> & {
	action?: React.ReactNode;
	className?: string;
	error?: string;
	label: React.ReactNode;
};

function AuthField({
	action,
	className,
	error,
	id,
	label,
	...props
}: AuthFieldProps) {
	const errorId = error && id ? `${id}-error` : undefined;

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-4">
				<Label className="font-semibold text-sm" htmlFor={id}>
					{label}
				</Label>
				{action}
			</div>
			<Input
				aria-describedby={errorId}
				aria-invalid={error ? true : undefined}
				className={cn("h-[62px] rounded-lg bg-card px-4 text-base", className)}
				id={id}
				{...props}
			/>
			{error ? (
				<p className="font-medium text-destructive text-xs" id={errorId}>
					{error}
				</p>
			) : null}
		</div>
	);
}

function GoogleIcon(props: React.ComponentProps<"svg">) {
	return (
		<svg
			aria-hidden="true"
			height="20"
			viewBox="0 0 24 24"
			width="20"
			{...props}
		>
			<path
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
				fill="#4285F4"
			/>
			<path
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
				fill="#34A853"
			/>
			<path
				d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
				fill="#FBBC05"
			/>
			<path
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
				fill="#EA4335"
			/>
		</svg>
	);
}

function GoogleButton({
	className,
	...props
}: React.ComponentProps<typeof Button>) {
	return (
		<Button
			className={cn(
				"h-[58px] w-full gap-3 rounded-lg border-border bg-card text-sm",
				className
			)}
			type="button"
			variant="outline"
			{...props}
		/>
	);
}

export {
	AuthBrand,
	AuthCard,
	AuthDivider,
	AuthField,
	AuthShell,
	GoogleButton,
	GoogleIcon,
};
