"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import gsap from "gsap";
import { ArrowLeft, Eye, EyeOff, KeyRound, MailCheck, ShieldCheck, Sparkles, Target, Timer, TrendingUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminPasswordLoginAction,
  completeTeamPasswordSetupAction,
  sendOtpAction,
  teamPasswordLoginAction,
  verifyOtpAction,
} from "@/lib/crm-actions";

const PRIMARY_ADMIN_EMAIL = "shajib.mugnee@gmail.com";

const loginSchema = z.object({
  login: z.string().min(3, "Enter your email or mobile number"),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
});

type TeamFlow = "login" | "verify-otp" | "set-password";
type TeamPurpose = "FIRST_LOGIN" | "PASSWORD_RESET";
type FeedbackTone = "info" | "success" | "error";

function normalizeLogin(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  const digits = trimmed.replace(/\D/g, "");
  return digits.startsWith("88") ? digits.slice(2) : digits;
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const brandRef = React.useRef<HTMLDivElement>(null);
  const inputsRef = React.useRef<Array<HTMLInputElement | null>>([]);
  const [otp, setOtp] = React.useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ tone: FeedbackTone; message: string }>({
    tone: "info",
    message: "Admin, supervisor, and marketer users can log in with password, or use OTP for first login and password reset.",
  });
  const [showPrimaryPassword, setShowPrimaryPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [teamFlow, setTeamFlow] = React.useState<TeamFlow>("login");
  const [teamPurpose, setTeamPurpose] = React.useState<TeamPurpose>("FIRST_LOGIN");
  const [setupToken, setSetupToken] = React.useState("");

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      login: "",
      password: "",
      confirmPassword: "",
    },
  });

  const loginValue = form.watch("login");
  const requestedAs = (searchParams.get("as") ?? "").trim().toLowerCase();
  const prefersAdminLogin = requestedAs === "admin";
  const adminEmailHint = React.useMemo(() => PRIMARY_ADMIN_EMAIL, []);
  const normalizedAdminEmail = React.useMemo(() => PRIMARY_ADMIN_EMAIL.toLowerCase(), []);
  const normalizedAdminMobile = React.useMemo(() => normalizeLogin(process.env.NEXT_PUBLIC_CRM_ADMIN_MOBILE ?? ""), []);
  const isAdminLogin = React.useMemo(() => {
    const normalizedLogin = normalizeLogin(loginValue);

    if (!normalizedLogin) return false;

    if (loginValue?.trim()?.includes("@")) {
      return normalizedLogin === normalizedAdminEmail;
    }

    return Boolean(normalizedAdminMobile) && normalizedLogin === normalizedAdminMobile;
  }, [loginValue, normalizedAdminEmail, normalizedAdminMobile]);

  React.useEffect(() => {
    if (!brandRef.current) return;
    gsap.fromTo(
      brandRef.current.querySelectorAll("[data-float]"),
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: "power3.out" },
    );
  }, []);

  React.useEffect(() => {
    if (timer <= 0) return undefined;
    const interval = window.setInterval(() => setTimer((value) => value - 1), 1000);
    return () => window.clearInterval(interval);
  }, [timer]);

  React.useEffect(() => {
    setOtp(["", "", "", "", "", ""]);
    setTimer(0);
    setSetupToken("");
    setTeamFlow("login");
    setTeamPurpose("FIRST_LOGIN");
    setShowPrimaryPassword(false);
    setShowConfirmPassword(false);
    form.setValue("password", "");
    form.setValue("confirmPassword", "");
    setFeedback({
      tone: "info",
      message: isAdminLogin
        ? "Admin can log in with password, or use First Login / Forgot Password to set or reset it."
        : "Team users can log in with password, or use First Login / Forgot Password to receive OTP by email.",
    });
  }, [form, isAdminLogin, loginValue]);

  const requestOtp = React.useCallback((purpose: TeamPurpose) => {
    void form.handleSubmit(async ({ login }) => {
      setSubmitting(true);
      try {
        const formData = new FormData();
        formData.set("login", normalizeLogin(login));
        formData.set("purpose", purpose);
        const result = await sendOtpAction(formData);

        if (!result.ok) {
          setFeedback({ tone: "error", message: result.message ?? "OTP could not be sent." });
          return;
        }

        setTeamPurpose(purpose);
        setTeamFlow("verify-otp");
        setTimer(90);
        setOtp(["", "", "", "", "", ""]);
        setFeedback({ tone: "success", message: result.message ?? "OTP sent successfully." });
        window.setTimeout(() => inputsRef.current[0]?.focus(), 60);
      } catch (error) {
        console.error("Failed to request team OTP.", error);
        setFeedback({ tone: "error", message: "OTP request failed. Please try again." });
      } finally {
        setSubmitting(false);
      }
    })();
  }, [form]);

  function handleAdminLogin() {
    void form.handleSubmit(async ({ login, password }) => {
      setSubmitting(true);
      try {
        const formData = new FormData();
        formData.set("login", normalizeLogin(login));
        formData.set("password", password ?? "");
        const result = await adminPasswordLoginAction(formData);

        if (!result.ok || !result.redirectTo) {
          setFeedback({ tone: "error", message: result.message ?? "Admin login failed." });
          return;
        }

        setFeedback({ tone: "success", message: "Admin login successful. Opening dashboard..." });
        window.location.replace(result.redirectTo);
      } catch (error) {
        console.error("Admin login failed unexpectedly.", error);
        setFeedback({ tone: "error", message: "Admin login failed. Please try again." });
      } finally {
        setSubmitting(false);
      }
    })();
  }

  function handleTeamPasswordLogin() {
    void form.handleSubmit(async ({ login, password }) => {
      setSubmitting(true);
      try {
        const formData = new FormData();
        formData.set("login", normalizeLogin(login));
        formData.set("password", password ?? "");
        const result = await teamPasswordLoginAction(formData);

        if (!result.ok || !result.redirectTo) {
          setFeedback({ tone: "error", message: result.message ?? "Login failed." });
          return;
        }

        setFeedback({ tone: "success", message: "Login successful. Opening dashboard..." });
        window.location.replace(result.redirectTo);
      } catch (error) {
        console.error("Team password login failed unexpectedly.", error);
        setFeedback({ tone: "error", message: "Login failed. Please try again." });
      } finally {
        setSubmitting(false);
      }
    })();
  }

  function updateOtp(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtp((current) => current.map((item, itemIndex) => (itemIndex === index ? digit : item)));
    if (digit && index < 5) inputsRef.current[index + 1]?.focus();
  }

  function handleOtpVerify() {
    void form.handleSubmit(async ({ login }) => {
      setSubmitting(true);
      try {
        const formData = new FormData();
        formData.set("login", normalizeLogin(login));
        formData.set("otp", otp.join(""));
        formData.set("purpose", teamPurpose);
        const result = await verifyOtpAction(formData);

        if (!result.ok || typeof result.setupToken !== "string") {
          setFeedback({ tone: "error", message: result.message ?? "OTP verification failed." });
          return;
        }

        setSetupToken(result.setupToken);
        setTeamFlow("set-password");
        form.setValue("password", "");
        form.setValue("confirmPassword", "");
        setFeedback({ tone: "success", message: result.message ?? "OTP verified." });
      } catch (error) {
        console.error("OTP verification failed unexpectedly.", error);
        setFeedback({ tone: "error", message: "OTP verification failed. Please try again." });
      } finally {
        setSubmitting(false);
      }
    })();
  }

  function handlePasswordSetup() {
    void form.handleSubmit(async ({ login, password, confirmPassword }) => {
      setSubmitting(true);
      try {
        const formData = new FormData();
        formData.set("login", normalizeLogin(login));
        formData.set("password", password ?? "");
        formData.set("confirmPassword", confirmPassword ?? "");
        formData.set("purpose", teamPurpose);
        formData.set("setupToken", setupToken);
        const result = await completeTeamPasswordSetupAction(formData);

        if (!result.ok || !result.redirectTo) {
          setFeedback({ tone: "error", message: result.message ?? "Password setup failed." });
          return;
        }

        setFeedback({ tone: "success", message: result.message ?? "Password saved successfully." });
        window.location.replace(result.redirectTo);
      } catch (error) {
        console.error("Team password setup failed unexpectedly.", error);
        setFeedback({ tone: "error", message: "Password setup failed. Please try again." });
      } finally {
        setSubmitting(false);
      }
    })();
  }

  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) return;

    if (teamFlow === "verify-otp") {
      handleOtpVerify();
      return;
    }

    if (teamFlow === "set-password") {
      handlePasswordSetup();
      return;
    }

    if (isAdminLogin) {
      handleAdminLogin();
      return;
    }

    handleTeamPasswordLogin();
  }

  const feedbackClassName =
    feedback.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : feedback.tone === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-blue-100 bg-blue-50 text-blue-700";

  const actionButtonLabel = isAdminLogin
    ? submitting ? "Opening Dashboard..." : "Login as Admin"
    : teamFlow === "verify-otp"
      ? submitting ? "Verifying OTP..." : "Verify OTP"
      : teamFlow === "set-password"
        ? submitting ? "Saving Password..." : teamPurpose === "PASSWORD_RESET" ? "Reset Password" : "Set Password & Login"
        : submitting ? "Opening Dashboard..." : "Login to Dashboard";

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[0.95fr_1.25fr]">
      <section
        ref={brandRef}
        className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_18%_18%,rgba(59,130,246,0.48),transparent_28rem),linear-gradient(150deg,#08163a,#0b1d4d_54%,#10113a)] p-10 text-white lg:flex lg:flex-col lg:justify-between"
      >
        <div className="absolute inset-0 soft-grid opacity-30" />
        <div className="relative z-10" data-float>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-semibold text-blue-50">
            <ShieldCheck className="h-4 w-4" />
            Secure CRM Access
          </div>
          <h1 className="mt-20 text-4xl font-black tracking-normal">Mugnee CRM</h1>
          <p className="mt-3 max-w-sm text-lg font-semibold text-blue-100">Smart CRM for smarter business.</p>
        </div>

        <div className="relative z-10" data-float>
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white/15 p-4">
                <Target className="h-6 w-6 text-cyan-200" />
                <p className="mt-4 text-2xl font-black">520</p>
                <p className="text-xs text-blue-100">Customers</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-4">
                <TrendingUp className="h-6 w-6 text-emerald-200" />
                <p className="mt-4 text-2xl font-black">28%</p>
                <p className="text-xs text-blue-100">Conversion</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-4">
                <Sparkles className="h-6 w-6 text-amber-200" />
                <p className="mt-4 text-2xl font-black">15k</p>
                <p className="text-xs text-blue-100">Rewards</p>
              </div>
            </div>
            <div className="mt-5 h-36 rounded-2xl bg-gradient-to-br from-blue-500/70 to-indigo-500/50 p-4">
              <div className="flex h-full items-end gap-3">
                {[42, 72, 52, 90, 64].map((height) => (
                  <div key={height} className="flex flex-1 items-end rounded-xl bg-white/14 p-1">
                    <div className="w-full rounded-lg bg-white shadow-lg" style={{ height: `${height}%` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 grid max-w-md gap-3">
            {["Track Leads & Customers", "Follow Ups & Tasks", "Achieve Sales Goals"].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm font-semibold text-blue-50">
                <span className="h-2 w-2 rounded-full bg-cyan-300" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-xl p-6 md:p-8">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <span className="text-base font-black">M</span>
            </div>
            <h2 className="mt-4 text-2xl font-black text-slate-950">Mugnee CRM</h2>
            <p className="mt-2 text-sm font-semibold text-blue-700">Welcome Back</p>
            <p className="mt-1 text-sm text-slate-500">
              {isAdminLogin
                ? "Admin can use password login or reset it by OTP."
                : teamFlow === "set-password"
                  ? "Create a secure password for future logins."
                  : "Supervisor and Marketer accounts use password login after setup."}
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleFormSubmit}>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="login">
                Email or Mobile Number
              </label>
              <div className="mt-2 flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm focus-within:ring-4 focus-within:ring-blue-100">
                <input
                  id="login"
                  className="h-11 flex-1 px-3 text-sm outline-none"
                  placeholder={prefersAdminLogin || isAdminLogin ? adminEmailHint : "Enter your email"}
                  autoComplete="username"
                  {...form.register("login")}
                />
                {teamFlow === "verify-otp" ? (
                  <Button type="button" className="m-1 h-9" variant="outline" onClick={() => requestOtp(teamPurpose)} disabled={submitting || timer > 0}>
                    {timer > 0 ? `${timer}s` : "Resend OTP"}
                  </Button>
                ) : null}
              </div>
              {form.formState.errors.login ? (
                <p className="mt-1 text-xs font-semibold text-red-600">{form.formState.errors.login.message}</p>
              ) : null}
            </div>

            {isAdminLogin && teamFlow === "login" ? (
              <div>
                <label className="text-sm font-semibold text-slate-700" htmlFor="password">
                  Admin Password
                </label>
                <div className="relative mt-2">
                  <Input
                    id="password"
                    type={showPrimaryPassword ? "text" : "password"}
                    className="h-11 pr-12"
                    autoComplete="current-password"
                    {...form.register("password")}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-900"
                    onClick={() => setShowPrimaryPassword((value) => !value)}
                    aria-label={showPrimaryPassword ? "Hide password" : "Show password"}
                  >
                    {showPrimaryPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ) : null}

            {!isAdminLogin && teamFlow === "login" ? (
              <div>
                <label className="text-sm font-semibold text-slate-700" htmlFor="password">
                  Password
                </label>
                <div className="relative mt-2">
                  <Input
                    id="password"
                    type={showPrimaryPassword ? "text" : "password"}
                    className="h-11 pr-12"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    {...form.register("password")}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-900"
                    onClick={() => setShowPrimaryPassword((value) => !value)}
                    aria-label={showPrimaryPassword ? "Hide password" : "Show password"}
                  >
                    {showPrimaryPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ) : null}

            {teamFlow === "login" ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="ghost" className="h-8 px-0 text-blue-700 hover:bg-transparent hover:text-blue-800" onClick={() => requestOtp("FIRST_LOGIN")} disabled={submitting}>
                  <MailCheck className="h-4 w-4" />
                  First Login
                </Button>
                <Button type="button" variant="ghost" className="h-8 px-0 text-slate-600 hover:bg-transparent hover:text-slate-900" onClick={() => requestOtp("PASSWORD_RESET")} disabled={submitting}>
                  <KeyRound className="h-4 w-4" />
                  Forgot Password?
                </Button>
              </div>
            ) : null}

            {teamFlow === "verify-otp" ? (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">Enter OTP</label>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <Timer className="h-3.5 w-3.5" />
                    {timer > 0 ? `${timer}s` : "OTP expired"}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-6 gap-2">
                  {otp.map((digit, index) => (
                    <Input
                      key={index}
                      ref={(node) => {
                        inputsRef.current[index] = node;
                      }}
                      className="h-12 text-center text-lg font-black"
                      value={digit}
                      inputMode="numeric"
                      maxLength={1}
                      onChange={(event) => updateOtp(index, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Backspace" && !otp[index] && index > 0) {
                          inputsRef.current[index - 1]?.focus();
                        }
                      }}
                    />
                  ))}
                </div>
                <Button type="button" variant="ghost" className="mt-3 h-8 px-0 text-slate-600 hover:bg-transparent hover:text-slate-900" onClick={() => { setTeamFlow("login"); setTimer(0); setOtp(["", "", "", "", "", ""]); }}>
                  <ArrowLeft className="h-4 w-4" />
                  Back to password login
                </Button>
              </div>
            ) : null}

            {teamFlow === "set-password" ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700" htmlFor="password">
                    New Password
                  </label>
                  <div className="relative mt-2">
                    <Input
                      id="password"
                      type={showPrimaryPassword ? "text" : "password"}
                      className="h-11 pr-12"
                      placeholder="Minimum 8 characters"
                      autoComplete="new-password"
                      {...form.register("password")}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-900"
                      onClick={() => setShowPrimaryPassword((value) => !value)}
                      aria-label={showPrimaryPassword ? "Hide password" : "Show password"}
                    >
                      {showPrimaryPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700" htmlFor="confirmPassword">
                    Confirm Password
                  </label>
                  <div className="relative mt-2">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      className="h-11 pr-12"
                      placeholder="Retype your password"
                      autoComplete="new-password"
                      {...form.register("confirmPassword")}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-900"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className={`rounded-2xl border px-4 py-3 text-center text-sm font-semibold ${feedbackClassName}`}>
              {feedback.message}
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={submitting}
            >
              {actionButtonLabel}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs font-semibold text-slate-400">Secure | Fast | Reliable</p>
        </Card>
      </section>
    </main>
  );
}
