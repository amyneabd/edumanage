import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPassword } from "../../api/auth";
import { extractErrorMessage } from "../../api/client";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/Feedback";
import { FieldError } from "../../components/FieldError";
import { Input } from "../../components/Input";
import { Logo } from "../../components/Logo";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "../../lib/authSchemas";

export function ForgotPasswordPage() {
  useDocumentTitle("Réinitialiser votre mot de passe");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: ForgotPasswordFormValues) => forgotPassword(values.email),
  });

  return (
    <div className="flex min-h-svh">
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Logo className="h-10 w-10" />
          {mutation.isSuccess ? (
            <>
              <h1 className="mt-6 text-2xl font-bold text-ink-900">Vérifiez votre e-mail</h1>
              <p className="mt-2 text-sm text-ink-500">{mutation.data.message}</p>
              {mutation.data.devResetUrl && (
                <div className="mt-4 rounded-sm border border-dashed border-border-strong bg-canvas p-3 text-xs text-ink-700">
                  <p className="font-medium text-ink-900">Mode développement — SMTP non configuré</p>
                  <Link
                    to={mutation.data.devResetUrl.replace(window.location.origin, "")}
                    className="focus-ring mt-1 block break-all rounded-sm font-mono text-[11px] text-accent-600 underline underline-offset-2"
                  >
                    {mutation.data.devResetUrl}
                  </Link>
                </div>
              )}
              <Link
                to="/login"
                className="focus-ring mt-6 block rounded-sm text-center text-sm font-medium text-accent-600 hover:text-accent-700"
              >
                Retour à la connexion
              </Link>
            </>
          ) : (
            <>
              <h1 className="mt-6 text-2xl font-bold text-ink-900">Mot de passe oublié ?</h1>
              <p className="mt-1 text-sm text-ink-500">
                Entrez votre e-mail et nous vous enverrons un lien pour le réinitialiser.
              </p>

              <form className="mt-5 space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
                <div>
                  <label htmlFor="forgot-email" className="text-sm font-medium text-ink-700">
                    E-mail
                  </label>
                  <Input
                    id="forgot-email"
                    type="email"
                    invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "forgot-email-error" : undefined}
                    {...register("email")}
                  />
                  <FieldError id="forgot-email-error" message={errors.email?.message} />
                </div>

                {mutation.isError && <ErrorState message={extractErrorMessage(mutation.error)} />}

                <Button type="submit" className="w-full" disabled={mutation.isPending}>
                  {mutation.isPending ? "Envoi…" : "Envoyer le lien de réinitialisation"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-ink-500">
                Vous vous en souvenez ?{" "}
                <Link to="/login" className="focus-ring rounded-sm font-medium text-accent-600 hover:text-accent-700">
                  Se connecter
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
      <div className="hidden bg-navy lg:block lg:w-1/2" aria-hidden="true" />
    </div>
  );
}
