"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Mode = "login" | "register" | "forgot-user" | "reset-pass";

export default function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [loginField, setLoginField] = useState("");  // username or email
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const router = useRouter();
  const reset = () => { setError(""); setSuccess(""); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (mode === "register") {
        if (!username.trim()) { setError("Username is required"); return; }
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (err) throw err;
        setSuccess("Account created! Check your email for a confirmation link, then sign in.");

      } else if (mode === "login") {
        // Accept username or email
        let loginEmail = loginField;
        if (!loginField.includes("@")) {
          // Look up email by username via RPC
          const { data: emailData, error: rpcErr } = await supabase.rpc("get_email_by_username", {
            p_username: loginField,
          });
          if (rpcErr || !emailData) {
            setError("Username not found");
            return;
          }
          loginEmail = emailData as string;
        }
        const { error: err } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (err) throw err;
        router.push("/dashboard");

      } else if (mode === "forgot-user") {
        const { data, error: rpcErr } = await supabase.rpc("get_username_by_email", { p_email: email });
        if (rpcErr || !data) { setError("No account found with that email"); return; }
        setSuccess(`Your username is: ${data}`);

      } else if (mode === "reset-pass") {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (err) throw err;
        setSuccess("Check your email for a password reset link.");
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400/60 transition-all text-sm";

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-400/30 mb-4">
            <TrendingUp className="w-7 h-7 text-blue-400" />
          </div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">StockFix</h1>
          <p className="text-white/40 text-sm mt-1">한국 주식 분석 플랫폼</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-white font-medium text-lg mb-6">
                {mode === "login" && "Sign in"}
                {mode === "register" && "Create account"}
                {mode === "forgot-user" && "Find username"}
                {mode === "reset-pass" && "Reset password"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === "login" && (
                  <input
                    className={inputCls}
                    placeholder="Username or email"
                    value={loginField}
                    onChange={(e) => setLoginField(e.target.value)}
                    required
                  />
                )}
                {mode === "register" && (
                  <input
                    className={inputCls}
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                )}
                {(mode === "register" || mode === "forgot-user" || mode === "reset-pass") && (
                  <input
                    className={inputCls}
                    placeholder="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                )}
                {(mode === "login" || mode === "register") && (
                  <div className="relative">
                    <input
                      className={inputCls + " pr-11"}
                      placeholder="Password"
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                )}
                {mode === "reset-pass" && (
                  <div className="relative">
                    <input
                      className={inputCls + " pr-11"}
                      placeholder="New password"
                      type={showPass ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                )}

                {error && (
                  <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                )}
                {success && (
                  <p className="text-green-400 text-xs bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">{success}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/40 text-white font-medium py-3 rounded-xl transition-all text-sm mt-2"
                >
                  {loading ? "Loading..." : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "forgot-user" ? "Find username" : "Send reset email"}
                </button>
              </form>
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 space-y-2">
            {mode === "login" && (
              <>
                <button onClick={() => { setMode("register"); reset(); }} className="w-full text-white/40 text-xs hover:text-white/70 transition-colors">
                  Don&apos;t have an account? <span className="text-blue-400">Sign up</span>
                </button>
                <div className="flex justify-center gap-4">
                  <button onClick={() => { setMode("forgot-user"); reset(); }} className="text-white/30 text-xs hover:text-white/60">Find username</button>
                  <span className="text-white/20 text-xs">·</span>
                  <button onClick={() => { setMode("reset-pass"); reset(); }} className="text-white/30 text-xs hover:text-white/60">Reset password</button>
                </div>
              </>
            )}
            {mode !== "login" && (
              <button onClick={() => { setMode("login"); reset(); }} className="w-full text-white/40 text-xs hover:text-white/70">
                ← Back to sign in
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
