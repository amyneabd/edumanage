import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { logout, resendVerification, verifyEmail } from "../../api/auth";
import { extractErrorMessage } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/Feedback";
import { Logo } from "../../components/Logo";
import { roleHome } from "../../routes/guards";

export function VerifyEmailPage() {
  useDocumentTitle("Vérifiez votre e-mail");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { user, isAuthenticated, refetch } = useAuth();

  const verifyMutation = useMutation({
    mutationFn: (t: string) => verifyEmail(t),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });

  const resendMutation = useMutation({ mutationFn: resendVerification });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/login");
    },
  });

  useEffect(() => {
    if (token) verifyMutation.mutate(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (user?.emailVerified) {
      navigate(roleHome(user), { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (token) return;
    const interval = setInterval(() => refetch(), 8000);
    return () => clearInterval(interval);
  }, [refetch, token]);

  if (token) {
    return (
      <div className="flex min-h-svh">
        <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
          <div className="mx-auto w-full max-w-sm text-center">
            <Logo className="mx-auto h-10 w-10" />
            {verifyMutation.isPending && (
              <h1 className="mt-6 text-2xl font-bold text-ink-900">Vérification de votre e-mail…</h1>
            )}
            {verifyMutation.isSuccess && (
              <>
                <h1 className="mt-6 text-2xl font-bold text-ink-900">E-mail vérifié</h1>
                <p className="mt-2 text-sm text-ink-500">
                  {isAuthenticated ? "Redirection en cours…" : "Vous pouvez maintenant vous connecter à votre compte."}
                </p>
                {!isAuthenticated && (
                  <Link
                    to="/login"
                    className="focus-ring mt-6 block rounded-sm text-sm font-medium text-accent-600 hover:text-accent-700"
                  >
                    Aller à la connexion
                  </Link>
                )}
              </>
            )}
            {verifyMutation.isError && (
              <>
                <h1 className="mt-6 text-2xl font-bold text-danger-600">Échec de la vérification</h1>
                <ErrorState message={extractErrorMessage(verifyMutation.error)} />
                <Link
                  to="/verify-email"
                  className="focus-ring mt-6 block rounded-sm text-sm font-medium text-accent-600 hover:text-accent-700"
                >
                  Demander un nouveau lien
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="hidden bg-navy lg:block lg:w-1/2" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh">
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-sm text-center">
          <Logo className="mx-auto h-10 w-10" />
          <h1 className="mt-6 text-2xl font-bold text-ink-900">Vérifiez votre e-mail</h1>
          <p className="mt-2 text-sm text-ink-500">
            Nous avons envoyé un lien de vérification à {user?.email ?? "votre adresse e-mail"}. Cliquez sur le lien
            pour activer votre compte.
          </p>

          <Button
            variant="secondary"
            className="mt-6"
            onClick={() => resendMutation.mutate()}
            disabled={resendMutation.isPending}
          >
            {resendMutation.isPending ? "Envoi…" : "Renvoyer l'e-mail de vérification"}
          </Button>

          {resendMutation.isSuccess && <p className="mt-3 text-sm text-success-600">E-mail de vérification envoyé.</p>}
          {resendMutation.data?.devVerifyUrl && (
            <div className="mt-4 rounded-sm border border-dashed border-border-strong bg-canvas p-3 text-left text-xs text-ink-700">
              <p className="font-medium text-ink-900">Mode développement — SMTP non configuré</p>
              <Link
                to={resendMutation.data.devVerifyUrl.replace(window.location.origin, "")}
                className="focus-ring mt-1 block break-all rounded-sm font-mono text-[11px] text-accent-600 underline underline-offset-2"
              >
                {resendMutation.data.devVerifyUrl}
              </Link>
            </div>
          )}

          <Button variant="ghost" className="mt-3" onClick={() => logoutMutation.mutate()}>
            Se déconnecter
          </Button>
        </div>
      </div>
      <div className="hidden bg-navy lg:block lg:w-1/2" aria-hidden="true" />
    </div>
  );
}
